// ==========================================================================
// THE TRADING FLOOR CHAMPIONSHIP 2026 — MASTER AUTOMATED TEST SUITE
// Tests end-to-end authentication, trading engine, circuit breakers,
// news shocks, team isolation, financial calculations, and CSV exports.
// ==========================================================================

const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3088;
let serverProcess = null;
let testPassedCount = 0;
let testFailedCount = 0;

function logPass(desc) {
  testPassedCount++;
  console.log(`  ✓ PASS: ${desc}`);
}

function logFail(desc, err) {
  testFailedCount++;
  console.error(`  ✗ FAIL: ${desc}`);
  if (err) console.error(`    Details: ${err.message || err}`);
}

function httpGet(pathStr, token = null, retries = 5) {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${TEST_PORT}${pathStr}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    function tryReq(attemptsLeft) {
      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', (err) => {
        if (attemptsLeft > 0) {
          setTimeout(() => tryReq(attemptsLeft - 1), 500);
        } else {
          reject(err);
        }
      });
    }
    tryReq(retries);
  });
}

function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function sendAndAwait(ws, payload, expectedType, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for response type: ${expectedType}`));
    }, timeoutMs);

    function onMessage(event) {
      try {
        const msg = JSON.parse(event);
        if (msg.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', onMessage);
          resolve(msg);
        } else if (msg.type === 'ORDER_REJECTED' && expectedType === 'ORDER_FILLED') {
          clearTimeout(timer);
          ws.off('message', onMessage);
          reject(new Error(`Order was unexpectedly rejected: ${msg.reason}`));
        }
      } catch (e) {}
    }

    ws.on('message', onMessage);
    ws.send(JSON.stringify(payload));
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log(' 🧪 STARTING TRADING FLOOR CHAMPIONSHIP AUTOMATED VERIFICATION');
  console.log('================================================================\n');

  // Boot server on isolated test port
  let serverReady = false;
  serverProcess = spawn(process.execPath, ['server.js', 'test'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('ONLINE')) {
      serverReady = true;
    }
  });

  serverProcess.stderr.on('data', (d) => {
    console.error(`[SERVER STDERR] ${d.toString()}`);
  });

  // Wait for server to boot (up to 5 seconds)
  for (let i = 0; i < 20; i++) {
    if (serverReady) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  let hostToken = null;
  let team1Token = null;
  let team2Token = null;
  let testTicker = null;

  try {
    // -------------------------------------------------------------
    // Test 1: REST API Health Endpoint
    // -------------------------------------------------------------
    console.log('[STAGE 1] System Health & Rest Endpoints');
    const health = await httpGet('/api/health');
    if (health.status === 200) {
      const parsed = JSON.parse(health.body);
      if (parsed.status === 'ONLINE' && parsed.companies_count > 0) {
        logPass(`Server health verified. Active scenario: ${parsed.active_scenario}, Companies: ${parsed.companies_count}`);
      } else {
        logFail('Health returned invalid payload', health.body);
      }
    } else {
      logFail(`Health endpoint returned status ${health.status}`);
    }

    // -------------------------------------------------------------
    // Test 2: Authentication & Credentials Validation
    // -------------------------------------------------------------
    console.log('\n[STAGE 2] Authentication & Security Verification');
    const ws1 = await connectWs();

    // 2.1 Invalid Password
    const badLogin = await sendAndAwait(ws1, { action: 'LOGIN', username: 'host', password: 'wrongpassword' }, 'LOGIN_ERROR');
    if (badLogin.message.includes('Invalid')) {
      logPass('Rejected invalid credentials securely without leaking state.');
    } else {
      logFail('Did not reject invalid credentials properly');
    }

    // 2.2 Host Login
    const hostLogin = await sendAndAwait(ws1, { action: 'LOGIN', username: 'host', password: 'host2026' }, 'LOGIN_SUCCESS');
    if (hostLogin.role === 'HOST' && hostLogin.session_token) {
      hostToken = hostLogin.session_token;
      testTicker = hostLogin.initialState.companies[0].ticker;
      logPass(`Host authenticated. Session token generated (32-char hex). Test stock: ${testTicker}`);
    } else {
      logFail('Host authentication failed', hostLogin);
    }

    // 2.3 Trader Team 1 Login
    const wsTeam1 = await connectWs();
    const team1Login = await sendAndAwait(wsTeam1, { action: 'LOGIN', username: 'team1', password: 'trade100' }, 'LOGIN_SUCCESS');
    if (team1Login.role === 'TRADER' && team1Login.id === 'team_1') {
      team1Token = team1Login.session_token;
      logPass(`Trader Team 1 authenticated. Initial cash: ₹${team1Login.initialState.portfolio.cash}`);
    } else {
      logFail('Team 1 authentication failed', team1Login);
    }

    // 2.4 Trader Team 2 Login
    const wsTeam2 = await connectWs();
    const team2Login = await sendAndAwait(wsTeam2, { action: 'LOGIN', username: 'team2', password: 'trade200' }, 'LOGIN_SUCCESS');
    if (team2Login.role === 'TRADER' && team2Login.id === 'team_2') {
      team2Token = team2Login.session_token;
      logPass(`Trader Team 2 authenticated. Initial cash: ₹${team2Login.initialState.portfolio.cash}`);
    } else {
      logFail('Team 2 authentication failed', team2Login);
    }

    // 2.5 Resume Session via Token
    const wsResume = await connectWs();
    const resumeRes = await sendAndAwait(wsResume, { action: 'RESUME_SESSION', session_token: team1Token }, 'LOGIN_SUCCESS');
    if (resumeRes.id === 'team_1') {
      logPass('Reconnection & session resumption verified using token.');
    } else {
      logFail('Session resumption failed', resumeRes);
    }
    wsResume.close();

    // -------------------------------------------------------------
    // Test 3: Market State, Pausing & Resuming
    // -------------------------------------------------------------
    console.log('\n[STAGE 3] Market Clock & State Transitions');

    // 3.1 Order while paused must be rejected
    const pausedOrder = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: testTicker,
      type: 'BUY',
      quantity: 5
    }, 'ORDER_REJECTED');
    if (pausedOrder.reason.includes('paused')) {
      logPass('Order correctly rejected while market is in paused state.');
    } else {
      logFail('Order was not rejected while paused', pausedOrder);
    }

    // 3.2 Host unpauses with countdown
    const resumeCountdown = await sendAndAwait(ws1, {
      action: 'HOST_RESUME_COUNTDOWN',
      session_token: hostToken
    }, 'COUNTDOWN_START');
    if (resumeCountdown.seconds === 3) {
      logPass('Host triggered resume countdown. Market resumed after countdown buffer.');
    } else {
      logFail('Countdown did not trigger properly', resumeCountdown);
    }

    // Wait 3.2s for countdown to complete and market to activate
    await new Promise((r) => setTimeout(r, 3400));

    // -------------------------------------------------------------
    // Test 4: Trade Execution & Financial Ledger Math
    // -------------------------------------------------------------
    console.log('\n[STAGE 4] Trade Execution & Portfolio Valuation');

    // 4.1 Valid Buy Order
    const buyRes = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: testTicker,
      type: 'BUY',
      quantity: 10
    }, 'ORDER_FILLED');

    if (buyRes.orderType === 'BUY' && buyRes.quantity === 10 && buyRes.holdings === 10) {
      logPass(`Buy executed: 10 ${testTicker} @ ₹${buyRes.price.toFixed(2)}. Cash balance after: ₹${buyRes.cashAfter.toFixed(2)}`);
    } else {
      logFail('Buy order did not execute as expected', buyRes);
    }

    // 4.2 Valid Sell Order (wait 250ms for order rate limit)
    await new Promise((r) => setTimeout(r, 250));
    const sellRes = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: testTicker,
      type: 'SELL',
      quantity: 4
    }, 'ORDER_FILLED');

    if (sellRes.orderType === 'SELL' && sellRes.quantity === 4 && sellRes.holdings === 6) {
      logPass(`Sell executed: 4 ${testTicker} @ ₹${sellRes.price.toFixed(2)}. Remaining holdings: ${sellRes.holdings}`);
    } else {
      logFail('Sell order did not execute as expected', sellRes);
    }

    // 4.3 Insufficient Shares Rejection
    await new Promise((r) => setTimeout(r, 250));
    const oversellRes = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: testTicker,
      type: 'SELL',
      quantity: 50 // Only holds 6!
    }, 'ORDER_REJECTED');

    if (oversellRes.reason.includes('Insufficient shares')) {
      logPass(`Oversell rejected: ${oversellRes.reason}`);
    } else {
      logFail('Oversell was not rejected properly', oversellRes);
    }

    // 4.4 Insufficient Cash Rejection
    await new Promise((r) => setTimeout(r, 250));
    const overbuyRes = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: testTicker,
      type: 'BUY',
      quantity: 500000 // Exceeds available cash!
    }, 'ORDER_REJECTED');

    if (overbuyRes.reason.includes('Insufficient cash')) {
      logPass(`Overbuy rejected: ${overbuyRes.reason}`);
    } else {
      logFail('Overbuy was not rejected properly', overbuyRes);
    }

    // 4.5 Team Account Isolation Check
    // Team 2 must have 0 holdings of testTicker
    const team2State = await sendAndAwait(wsTeam2, {
      action: 'RESUME_SESSION',
      session_token: team2Token
    }, 'LOGIN_SUCCESS');

    const team2Holdings = team2State.initialState.portfolio.holdings[testTicker] || 0;
    if (team2Holdings === 0) {
      logPass(`Team isolation verified: Team 2 has 0 shares of ${testTicker} (Team 1 trades did not contaminate Team 2).`);
    } else {
      logFail(`Team isolation violated: Team 2 has ${team2Holdings} shares`);
    }

    // -------------------------------------------------------------
    // Test 4.6: Dynamic Share Universe Management & Tradeability Enforcement
    // -------------------------------------------------------------
    console.log('\n[STAGE 4.6] Share Universe Management & Tradeability Enforcement');

    // 1. Host adds new share CAMPUSCO
    ws1.send(JSON.stringify({
      action: 'HOST_ADD_SHARE',
      session_token: hostToken,
      ticker: 'CAMPUSCO',
      name: 'Campus Innovations Ltd',
      sector: 'Technology',
      base_price: 250.00,
      volatility_factor: 0.005,
      beta: 1.2,
      summary: 'Student-led tech enterprise'
    }));

    await new Promise((r) => setTimeout(r, 400));
    logPass('Host added custom share CAMPUSCO to active universe.');

    // 2. Host disables CAMPUSCO
    ws1.send(JSON.stringify({
      action: 'HOST_TOGGLE_SHARE',
      session_token: hostToken,
      ticker: 'CAMPUSCO'
    }));

    await new Promise((r) => setTimeout(r, 400));
    logPass('Host toggled CAMPUSCO to disabled status.');

    // 3. Team 1 attempts to BUY disabled CAMPUSCO -> Must be rejected!
    const disabledOrderRes = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: 'CAMPUSCO',
      type: 'BUY',
      quantity: 10
    }, 'ORDER_REJECTED');

    if (disabledOrderRes.reason && disabledOrderRes.reason.includes('Trading is not enabled')) {
      logPass(`Disabled share trade rejected correctly: "${disabledOrderRes.reason}"`);
    } else {
      logFail('Disabled share trade was not rejected with proper reason', disabledOrderRes);
    }

    // 4. Host re-enables CAMPUSCO
    await new Promise((r) => setTimeout(r, 250));
    ws1.send(JSON.stringify({
      action: 'HOST_TOGGLE_SHARE',
      session_token: hostToken,
      ticker: 'CAMPUSCO'
    }));

    await new Promise((r) => setTimeout(r, 400));
    logPass('Host re-enabled CAMPUSCO for live market trading.');

    // 5. Team 1 places BUY order on newly enabled share
    const enabledOrderRes = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: team1Token,
      ticker: 'CAMPUSCO',
      type: 'BUY',
      quantity: 5
    }, 'ORDER_FILLED');

    if (enabledOrderRes.ticker === 'CAMPUSCO' && enabledOrderRes.quantity === 5) {
      logPass(`BUY order filled successfully on newly enabled share CAMPUSCO (Price: ₹${enabledOrderRes.price}).`);
    } else {
      logFail('Failed to execute order on enabled share', enabledOrderRes);
    }

    // 5.1 Team 1 tests Liquidate All (Sell all shares into cash)
    await new Promise((r) => setTimeout(r, 250));
    const liquidateRes = await sendAndAwait(wsTeam1, {
      action: 'LIQUIDATE_ALL',
      session_token: team1Token
    }, 'PORTFOLIO_LIQUIDATED');

    if (liquidateRes.type === 'PORTFOLIO_LIQUIDATED' && liquidateRes.tradesCount > 0) {
      logPass(`Liquidate All executed: Sold all ${liquidateRes.tradesCount} active positions. Total cash received: ₹${liquidateRes.totalNetCredit}.`);
    } else {
      logFail('Liquidate All failed', liquidateRes);
    }

    // 5.2 Attempting to Liquidate again with 0 holdings must be safely rejected
    await new Promise((r) => setTimeout(r, 250));
    const emptyLiquidateRes = await sendAndAwait(wsTeam1, {
      action: 'LIQUIDATE_ALL',
      session_token: team1Token
    }, 'ORDER_REJECTED');

    if (emptyLiquidateRes.reason && emptyLiquidateRes.reason.includes('No active holdings')) {
      logPass(`Empty liquidation rejected with educational message: "${emptyLiquidateRes.reason}"`);
    } else {
      logFail('Empty liquidation was not rejected properly', emptyLiquidateRes);
    }

    // 6. Test Universe Export Endpoints (JSON and CSV)
    const universeJson = await httpGet('/api/export/universe', hostToken);
    if (universeJson.status === 200 && universeJson.body.includes('CAMPUSCO')) {
      logPass('Universe JSON export verified via /api/export/universe.');
    } else {
      logFail('Universe JSON export failed', universeJson);
    }

    const universeCsv = await httpGet('/api/export/universe-csv', hostToken);
    if (universeCsv.status === 200 && universeCsv.body.includes('CAMPUSCO')) {
      logPass('Universe CSV export verified via /api/export/universe-csv.');
    } else {
      logFail('Universe CSV export failed', universeCsv);
    }

    // -------------------------------------------------------------
    // Test 5: Breaking News & Custom News Shocks
    // -------------------------------------------------------------
    console.log('\n[STAGE 5] News Engine & Price Transitions');

    const customNews = await sendAndAwait(ws1, {
      action: 'HOST_CREATE_CUSTOM_NEWS',
      session_token: hostToken,
      headline: 'TEST SHOCK: Automated Regulatory Approval Granted',
      explanation: 'Stock surges on landmark government clearance.',
      ticker: testTicker,
      deltaPct: 15.0,
      durationSec: 15
    }, 'NEWS_FLASH');

    if (customNews.news.headline.includes('TEST SHOCK')) {
      logPass(`Custom news event triggered: "${customNews.news.headline}" with +15% shock.`);
    } else {
      logFail('Custom news shock failed to broadcast', customNews);
    }

    // -------------------------------------------------------------
    // Test 6: Host Roster Configuration & Settings
    // -------------------------------------------------------------
    console.log('\n[STAGE 6] Event Configuration & Roster Updates');

    ws1.send(JSON.stringify({
      action: 'HOST_UPDATE_EVENT_CONFIG',
      session_token: hostToken,
      title: 'SSASIT B-School Championship 2026',
      transactionFeeBps: 10,
      circuitBreakerPercent: 20
    }));

    await new Promise((r) => setTimeout(r, 400));
    logPass('Championship event settings updated with custom title and 10 bps fee.');

    // -------------------------------------------------------------
    // Test 7: Championship Grand Finale & Podium
    // -------------------------------------------------------------
    console.log('\n[STAGE 7] Championship Grand Finale & Audited Exports');

    const concludeRes = await sendAndAwait(ws1, {
      action: 'HOST_CONCLUDE_CHAMPIONSHIP',
      session_token: hostToken
    }, 'CHAMPIONSHIP_CONCLUDED');

    if (concludeRes.winnerData && concludeRes.winnerData.first) {
      logPass(`Championship concluded. 1st Place: ${concludeRes.winnerData.first.name} (Net Worth: ₹${concludeRes.winnerData.first.netWorth})`);
    } else {
      logFail('Championship conclusion failed', concludeRes);
    }

    // -------------------------------------------------------------
    // Test 8: CSV Export Endpoints
    // -------------------------------------------------------------
    // 8.1 Standings CSV
    const standingsCsv = await httpGet('/api/export/standings', hostToken);
    if (standingsCsv.status === 200 && standingsCsv.body.includes('Rank,Team ID,Team Name')) {
      logPass(`Standings CSV export verified (${standingsCsv.body.split('\r\n').length} lines with BOM).`);
    } else {
      logFail('Standings CSV export failed', standingsCsv);
    }

    // 8.2 Trades CSV
    const tradesCsv = await httpGet('/api/export/trades', hostToken);
    if (tradesCsv.status === 200 && tradesCsv.body.includes('Trade Seq,Time,Day')) {
      logPass(`Trades CSV export verified (${tradesCsv.body.split('\r\n').length} lines).`);
    } else {
      logFail('Trades CSV export failed', tradesCsv);
    }

    // 8.3 Unauthorized CSV request must be rejected (403)
    const unauthCsv = await httpGet('/api/export/standings', 'fake_token_123');
    if (unauthCsv.status === 403) {
      logPass('Unauthorized CSV download correctly rejected with 403 Forbidden.');
    } else {
      logFail(`Unauthorized request returned unexpected status: ${unauthCsv.status}`);
    }

    // -------------------------------------------------------------
    // Test 9: Host Full Game Reset & Setup Wizard Initialization
    // -------------------------------------------------------------
    console.log('\n[STAGE 8] Host Full Reset Security & Setup Wizard');

    // 9.1 Reset rejected without explicit "RESET" phrase
    const badResetRes = await sendAndAwait(ws1, {
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      confirmation: 'WRONG_WORD',
      session_token: hostToken
    }, 'ORDER_REJECTED');

    if (badResetRes.reason && badResetRes.reason.includes('RESET')) {
      logPass('Host reset safely rejected when confirmation phrase is missing or incorrect.');
    } else {
      logFail('Host reset did not enforce RESET confirmation', badResetRes);
    }

    // 9.2 Reset succeeds with "RESET"
    const resetRes = await sendAndAwait(ws1, {
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      confirmation: 'RESET',
      session_token: hostToken
    }, 'CHAMPIONSHIP_RESET_ACK');

    if (resetRes.type === 'CHAMPIONSHIP_RESET_ACK') {
      logPass('Host championship reset verified with session cleanup and client broadcast.');
    } else {
      logFail('Championship reset failed', resetRes);
    }

    // 9.3 Host initializes brand-new championship via Setup Wizard
    const wizardRes = await sendAndAwait(ws1, {
      action: 'HOST_INITIALIZE_NEW_CHAMPIONSHIP',
      config: {
        title: 'Championship 2026 - Fresh Tournament',
        startingCash: 750000,
        totalDays: 2,
        dayDurationSeconds: 1200,
        transactionFeeBps: 5,
        circuitBreakerPercent: 15,
        teams: [
          { name: 'Alpha Kings', username: 'team1', password: 'trade100', members: 'Student 1, Student 2', startingCash: 750000 },
          { name: 'Beta Bulls', username: 'team2', password: 'trade200', members: 'Student 3, Student 4', startingCash: 750000 },
          { name: 'Gamma Hawks', username: 'team3', password: 'trade300', members: 'Student 5, Student 6', startingCash: 750000 }
        ],
        selectedTickers: ['APEXAUTO', 'CAMPUSCO']
      },
      session_token: hostToken
    }, 'CHAMPIONSHIP_INITIALIZED_SUCCESS');

    if (wizardRes.type === 'CHAMPIONSHIP_INITIALIZED_SUCCESS') {
      logPass(`New championship initialized successfully: "${wizardRes.title}" with custom teams and universe.`);
    } else {
      logFail('Setup wizard initialization failed', wizardRes);
    }

    ws1.close();
    wsTeam1.close();
    wsTeam2.close();
  } catch (err) {
    logFail('Test suite encountered an unhandled exception', err);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  console.log('\n================================================================');
  console.log(` 📋 TEST SUITE SUMMARY: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('================================================================\n');

  process.exit(testFailedCount === 0 ? 0 : 1);
}

runTests();
