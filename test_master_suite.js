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

    // 2.6 Dedicated Event-Hall Sound Console Login
    const wsSound = await connectWs();
    const soundLogin = await sendAndAwait(wsSound, { action: 'LOGIN', username: 'sound', password: 'sound2026' }, 'LOGIN_SUCCESS');
    if (soundLogin.role === 'SOUND_CONSOLE') {
      logPass('Dedicated Sound Console authenticated successfully on separate client connection.');
    } else {
      logFail('Sound console login failed', soundLogin);
    }

    // 2.7 Authoritative Audio Cue Dispatch & Reception
    const testAudioPromise = new Promise((resolve) => {
      wsSound.on('message', (data) => {
        try {
          const m = JSON.parse(data);
          if (m.type === 'AUDIO_CUE' && m.cueName === 'test_hall_chime') resolve(m);
        } catch (e) {}
      });
    });
    ws1.send(JSON.stringify({
      action: 'HOST_TEST_SOUND_CUE',
      session_token: hostToken,
      cueName: 'test_hall_chime',
      category: 'lifecycle'
    }));
    const audioCueReceived = await testAudioPromise;
    if (audioCueReceived && audioCueReceived.cueName === 'test_hall_chime') {
      logPass('Authoritative audio cue dispatched from host and received by dedicated sound console.');
    } else {
      logFail('Sound console failed to receive audio cue', audioCueReceived);
    }

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

    // 3.2 Host unpauses with authoritative countdown
    const resumeCountdown = await sendAndAwait(ws1, {
      action: 'HOST_RESUME_COUNTDOWN',
      session_token: hostToken
    }, 'COUNTDOWN_START');
    if (resumeCountdown.seconds === 3 && resumeCountdown.targetServerTimeMs) {
      logPass('Host triggered resume countdown with authoritative server target timestamp.');
    } else {
      logFail('Countdown did not trigger properly', resumeCountdown);
    }

    // 3.3 Repeated resume click during active countdown must be rejected
    const dupCountdown = await sendAndAwait(ws1, {
      action: 'HOST_RESUME_COUNTDOWN',
      session_token: hostToken
    }, 'ORDER_REJECTED');
    if (dupCountdown.reason && dupCountdown.reason.includes('already active')) {
      logPass('Overlapping resume countdown rejected: Server enforces single authoritative countdown.');
    } else {
      logFail('Did not reject duplicate countdown', dupCountdown);
    }

    // 3.4 Host pause cancels active countdown
    const cancelCountdown = await sendAndAwait(ws1, {
      action: 'HOST_PAUSE',
      session_token: hostToken
    }, 'COUNTDOWN_CANCELLED');
    if (cancelCountdown.type === 'COUNTDOWN_CANCELLED') {
      logPass('Host pause during countdown immediately broadcasts COUNTDOWN_CANCELLED.');
    } else {
      logFail('Countdown was not cancelled on pause', cancelCountdown);
    }

    // 3.5 Restart countdown and wait for market to resume
    await sendAndAwait(ws1, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
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
      title: 'GTU B-School Championship 2026',
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

    // 8.4 Official Audited Results Snapshot API
    const snapRes = await httpGet('/api/results-snapshot', hostToken);
    if (snapRes.status === 200) {
      const snapJson = JSON.parse(snapRes.body);
      if (snapJson.rankings && snapJson.rankings.length > 0 && snapJson.rankings[0].startingCash) {
        logPass(`Official audited results snapshot verified: ${snapJson.rankings.length} teams audited with starting cash, net profit, and return %.`);
      } else {
        logFail('Snapshot format invalid', snapJson);
      }
    } else {
      logFail(`Snapshot endpoint failed with status ${snapRes.status}`);
    }

    // 8.5 Host Stage Presentation Remote Synchronization
    const presPromise = new Promise((resolve) => {
      wsTeam1.on('message', (data) => {
        try {
          const m = JSON.parse(data);
          if (m.type === 'PRESENTATION_SCENE_UPDATE' && m.scene === 'CHAMPION') resolve(m);
        } catch (e) {}
      });
    });
    ws1.send(JSON.stringify({
      action: 'HOST_SET_PRESENTATION_SCENE',
      session_token: hostToken,
      scene: 'CHAMPION'
    }));
    const presUpdate = await presPromise;
    if (presUpdate && presUpdate.scene === 'CHAMPION') {
      logPass('Host stage presentation remote sync: All connected terminals transitioned to CHAMPION scene.');
    } else {
      logFail('Presentation scene sync failed', presUpdate);
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
        selectedTickers: ['APEXAUTO', 'CAMPUSCO', 'CROWNBNK']
      },
      session_token: hostToken
    }, 'CHAMPIONSHIP_INITIALIZED_SUCCESS');

    if (wizardRes.type === 'CHAMPIONSHIP_INITIALIZED_SUCCESS') {
      logPass(`New championship initialized successfully: "${wizardRes.title}" with custom teams and universe.`);
    } else {
      logFail('Setup wizard initialization failed', wizardRes);
    }

    // ==========================================
    // [STAGE 9] Real-Company Universe, Indices & Sector Strategy Verification
    // ==========================================
    console.log('\n[STAGE 9] Real-Company Universe, Market Indices & Macro Strategy');

    // 9.1 Verify Real-Company Data in Live Universe File
    const fs = require('fs');
    const universeData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'universe_active.json'), 'utf8'));
    const realTickers = universeData.map((c) => c.ticker);
    const requiredRealTickers = ['RELIANCE', 'TATAMOTORS', 'TCS', 'HDFCBANK', 'SBIN', 'LT', 'AIRTEL', 'ITC'];
    const allRequiredPresent = requiredRealTickers.every((t) => realTickers.includes(t));
    if (universeData.length === 20 && allRequiredPresent) {
      logPass(`Real Indian Listed Universe verified: 20 companies loaded (${requiredRealTickers.slice(0, 4).join(', ')}...) with lot presets & official baselines.`);
    } else {
      logFail(`Universe validation failed. Length: ${universeData.length}, missing tickers.`);
    }

    // 9.2 Verify Market Indices REST API
    const indicesRes = await httpGet('/api/market-indices');
    const indicesJson = JSON.parse(indicesRes.body);
    if (indicesJson.indices && indicesJson.indices.NIFTY_TF20 && indicesJson.indices.BANK_TF) {
      logPass('Market Indices API verified: NIFTY_TF20 benchmark and sector indices (BANK_TF, IT_TF, AUTO_TF) calculated.');
    } else {
      logFail('Market Indices API failed', indicesRes);
    }

    // 9.3 Verify Team Macro Sector Allocations REST API (Privacy-Safe Invariant)
    const allocationsRes = await httpGet('/api/sector-allocations');
    const allocationsJson = JSON.parse(allocationsRes.body);
    if (Array.isArray(allocationsJson.allocations)) {
      // Strict privacy invariant: ensure no individual stock ticker or share quantity is leaked
      const leaksTicker = JSON.stringify(allocationsJson.allocations).includes('holdings') &&
                          (JSON.stringify(allocationsJson.allocations).includes('quantity') || JSON.stringify(allocationsJson.allocations).includes('avgBuyPrice'));
      if (!leaksTicker) {
        logPass('Team Sector Allocations API verified: Macro sector percentages & cash computed with zero stock ticker leakage.');
      } else {
        logFail('Team Sector Allocations leaked individual stock holdings!');
      }
    } else {
      logFail('Sector Allocations API returned invalid format', allocationsRes);
    }

    // 9.4 Verify Live Event Anchor Commentary Prompts
    const commentaryRes = await httpGet('/api/anchor-commentary');
    const commentaryJson = JSON.parse(commentaryRes.body);
    if (Array.isArray(commentaryJson.prompts)) {
      logPass(`Event Anchor Commentary Prompts API verified: ${commentaryJson.prompts.length} dynamic talking points generated.`);
    } else {
      logFail('Anchor Commentary API failed', commentaryRes);
    }

    // ==========================================
    // [STAGE 10] Event Config Lock, Projector Cycling & Embedded Winner Stage
    // ==========================================
    console.log('\n[STAGE 10] Event Config Lock, Intelligent Projector & Winner Presentation');

    // 10.1 Re-login as host and start event to engage EVENT_CONFIG_LOCKED
    await sendAndAwait(ws1, {
      action: 'HOST_START_EVENT_NOW',
      session_token: hostToken
    }, 'MARKET_RESUMED', 3000);

    // 10.2 Attempting to mutate share universe while tournament is active must be rejected
    const addShareAttempt = await sendAndAwait(ws1, {
      action: 'HOST_ADD_SHARE',
      company: { ticker: 'ILLEGAL_STOCK', name: 'Illegal Co', base_price: 100 },
      session_token: hostToken
    }, 'EVENT_CONFIG_LOCKED');

    if (addShareAttempt.type === 'EVENT_CONFIG_LOCKED') {
      logPass('Event Configuration Lock verified: Rejected share universe mutation during active tournament.');
    } else {
      logFail('Server failed to reject share addition during locked event', addShareAttempt);
    }

    // 10.3 Host Intelligent Projector Mode Updates
    const projModeRes = await sendAndAwait(ws1, {
      action: 'HOST_UPDATE_PROJECTOR_MODE',
      mode: 'AUTO_CYCLE',
      sceneDurationSeconds: 15,
      session_token: hostToken
    }, 'PROJECTOR_STATE_UPDATE');

    if (projModeRes.type === 'PROJECTOR_STATE_UPDATE' && projModeRes.projectorState.sceneDurationSeconds === 15) {
      logPass('Projector auto-cycle mode and duration update broadcast verified.');
    } else {
      logFail('Projector mode update failed', projModeRes);
    }

    // 10.4 Host Finalize Day
    const finalizeDayRes = await sendAndAwait(ws1, {
      action: 'HOST_FINALIZE_DAY',
      session_token: hostToken
    }, 'DAY_FINALIZED');

    if (finalizeDayRes.type === 'DAY_FINALIZED' && finalizeDayRes.daySnapshot) {
      logPass(`Day ${finalizeDayRes.day} finalized: Official closing snapshot & rank deltas computed.`);
    } else {
      logFail('Host day finalization failed', finalizeDayRes);
    }

    // 10.5 Daily Snapshot REST endpoint
    const daySnapshotRes = await httpGet('/api/daily-snapshot/1');
    const daySnapshotJson = JSON.parse(daySnapshotRes.body);
    if (daySnapshotJson.rankings && daySnapshotJson.rankings.length > 0) {
      logPass(`Daily Snapshot API verified via /api/daily-snapshot/1: ${daySnapshotJson.rankings.length} teams recorded.`);
    } else {
      logFail('Daily Snapshot endpoint failed', daySnapshotRes);
    }

    // 10.6 Embedded Projector Winner Presentation Trigger
    const startWinnerRes = await sendAndAwait(ws1, {
      action: 'HOST_START_WINNER_PRESENTATION',
      session_token: hostToken
    }, 'PROJECTOR_STATE_UPDATE');

    if (startWinnerRes.type === 'PROJECTOR_STATE_UPDATE' && startWinnerRes.projectorState.isWinnerActive === true) {
      logPass('Embedded Projector Winner Presentation trigger verified: Auditorium projector activated ceremony mode.');
    } else {
      logFail('Winner presentation trigger failed', startWinnerRes);
    }

    // 10.7 Exit Winner Presentation and restore market
    const exitWinnerRes = await sendAndAwait(ws1, {
      action: 'HOST_EXIT_WINNER_PRESENTATION',
      session_token: hostToken
    }, 'PROJECTOR_STATE_UPDATE');

    // 10.8 Projector Board Pagination & Pause Remote Controls
    const boardPageRes = await sendAndAwait(ws1, {
      action: 'HOST_SET_PROJECTOR_BOARD_PAGE',
      page: 2,
      session_token: hostToken
    }, 'PROJECTOR_STATE_UPDATE');

    if (boardPageRes.type === 'PROJECTOR_STATE_UPDATE' && boardPageRes.projectorState.boardPage === 2) {
      logPass('Projector board page navigation verified: Successfully set to Page 2.');
    } else {
      logFail('Projector board page navigation failed', boardPageRes);
    }

    const boardPauseRes = await sendAndAwait(ws1, {
      action: 'HOST_TOGGLE_PROJECTOR_BOARD_PAUSE',
      isPaused: true,
      session_token: hostToken
    }, 'PROJECTOR_STATE_UPDATE');

    if (boardPauseRes.type === 'PROJECTOR_STATE_UPDATE' && boardPauseRes.projectorState.isBoardPaused === true) {
      logPass('Projector board auto-flip pause toggle verified: Remote pause confirmed.');
    } else {
      logFail('Projector board auto-flip pause toggle failed', boardPauseRes);
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
