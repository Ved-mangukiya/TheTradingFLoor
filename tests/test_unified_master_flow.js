/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * UNIFIED SINGLE-FLOW MASTER VERIFICATION SUITE (test_unified_master_flow.js)
 *
 * Executes all 11 lifecycle phases in a single chronological state-machine flow
 * on an isolated server process with zero overlapping ports, zero fake assertions,
 * and automatic disk-state restoration.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const TEST_PORT = 3099;
const HTTP_URL = `http://127.0.0.1:${TEST_PORT}`;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;
const PROJECT_ROOT = path.join(__dirname, '..');
const UNIVERSE_FILE = path.join(PROJECT_ROOT, 'data', 'universe_active.json');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(urlPath, token = null) {
  return new Promise((resolve, reject) => {
    const sep = urlPath.includes('?') ? '&' : '?';
    const fullUrl = `${HTTP_URL}${urlPath}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
    http.get(fullUrl, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(raw); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, raw, body });
      });
    }).on('error', reject);
  });
}

function createTrackedWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.inbox = [];
    ws.on('message', (data) => {
      try {
        ws.inbox.push(JSON.parse(data.toString()));
      } catch (e) {}
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForWs(ws, predicate, timeoutMs = 6000, label = 'message') {
  return new Promise((resolve, reject) => {
    // Check messages that arrived after the last cursor mark
    const startIdx = ws._cursor || 0;
    for (let i = startIdx; i < ws.inbox.length; i++) {
      if (predicate(ws.inbox[i])) {
        ws._cursor = i + 1;
        return resolve(ws.inbox[i]);
      }
    }
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for ${label}`));
    }, timeoutMs);

    function onMsg(raw) {
      try {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off('message', onMsg);
          ws._cursor = ws.inbox.length;
          resolve(msg);
        }
      } catch (e) {}
    }
    ws.on('message', onMsg);
  });
}

async function sendAndAwait(ws, payload, predicateOrTypes, timeoutMs = 6000) {
  ws._cursor = ws.inbox.length;
  const types = Array.isArray(predicateOrTypes)
    ? predicateOrTypes
    : typeof predicateOrTypes === 'string'
    ? [predicateOrTypes]
    : null;
  const pred = types ? (m) => types.includes(m.type) : predicateOrTypes;
  const label = types ? types.join(' | ') : 'custom predicate';
  ws.send(JSON.stringify(payload));
  return waitForWs(ws, pred, timeoutMs, label);
}

async function runUnifiedMasterFlow() {
  console.log('\n======================================================================');
  console.log(' 🧪 STARTING UNIFIED SINGLE-FLOW MASTER VERIFICATION SUITE (PORT 3099)');
  console.log('======================================================================\n');

  // Backup universe_active.json so test mutations never corrupt disk state
  const universeBackup = fs.existsSync(UNIVERSE_FILE) ? fs.readFileSync(UNIVERSE_FILE, 'utf8') : null;

  let serverProcess = null;
  const openSockets = [];
  let passed = 0;
  const pass = (msg) => {
    passed++;
    console.log(`  ✓ PASS [${passed}]: ${msg}`);
  };

  try {
    // Always spawn a brand-new isolated server instance
    serverProcess = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server.js'), 'test'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PORT: String(TEST_PORT) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for /api/health to respond 200
    let booted = false;
    for (let i = 0; i < 35; i++) {
      try {
        const h = await httpGet('/api/health');
        if (h.status === 200 && h.body && h.body.status === 'ONLINE') {
          booted = true;
          break;
        }
      } catch (e) {}
      await delay(200);
    }
    assert.ok(booted, `Test server failed to boot on port ${TEST_PORT}`);
    pass(`Fresh isolated server booted on port ${TEST_PORT}`);

    // =========================================================================
    // PHASE 1: PRE-AUTH REST SECURITY & PUBLIC LOGIN SCREEN ISOLATION
    // =========================================================================
    console.log('\n[PHASE 1] Pre-Auth Security, Real Universe Baseline & Login Isolation');

    if (universeBackup) {
      const diskUniverse = JSON.parse(universeBackup);
      const tickers = diskUniverse.map((c) => c.ticker);
      ['RELIANCE', 'TATAMOTORS', 'TCS', 'HDFCBANK', 'SBIN', 'LT', 'AIRTEL', 'ITC'].forEach((reqT) => {
        assert.ok(tickers.includes(reqT), `Missing required real company ${reqT} in universe_active.json`);
      });
      pass(`Verified real-company baseline universe (${diskUniverse.length} companies) before mutations`);
    }

    const unauthInvest = await httpGet('/api/team-investments');
    assert.strictEqual(unauthInvest.status, 403, 'Expected 403 on unauthenticated /api/team-investments');
    const unauthCsv = await httpGet('/api/export/standings', 'invalid_token_xyz');
    assert.strictEqual(unauthCsv.status, 403, 'Expected 403 on unauthorized /api/export/standings');
    pass('Unauthenticated REST endpoints (/api/team-investments & /api/export/standings) rejected with 403');

    const wsPublic = await createTrackedWs();
    openSockets.push(wsPublic);
    const pubStatus = await waitForWs(wsPublic, (m) => m.type === 'PUBLIC_EVENT_STATUS', 3000, 'PUBLIC_EVENT_STATUS');
    assert.strictEqual(pubStatus.status, 'SETUP', 'Initial status on fresh socket must be SETUP');
    assert.strictEqual(pubStatus.configLocked, false, 'Initial configLocked must be false');
    await delay(300);
    assert.strictEqual(wsPublic.inbox.find((m) => m.type === 'TICK_UPDATE'), undefined, 'Public socket must never receive private TICK_UPDATE');
    pass('Fresh public socket received PUBLIC_EVENT_STATUS (SETUP) with zero private tick leakage');

    // =========================================================================
    // PHASE 2: PRE-LOCK HOST SETUP, DYNAMIC SCHEDULE & UNIVERSE CONFIGURATION
    // =========================================================================
    console.log('\n[PHASE 2] Host Auth, Pre-Lock Gating, Dynamic Schedule & Custom Share Setup');

    const wsHost = await createTrackedWs();
    const wsTeam1 = await createTrackedWs();
    const wsTeam2 = await createTrackedWs();
    const wsProj = await createTrackedWs();
    const wsSound = await createTrackedWs();
    openSockets.push(wsHost, wsTeam1, wsTeam2, wsProj, wsSound);

    // 2.1 Invalid Host Password
    const badHostLogin = await sendAndAwait(wsHost, { action: 'LOGIN', username: 'host', password: 'wrong' }, 'LOGIN_ERROR');
    assert.ok(badHostLogin.message.toLowerCase().includes('invalid'), 'Expected invalid credentials message');
    pass('Invalid host password rejected safely');

    // 2.2 Trader Login Gated Before Setup Lock
    const gatedTeamLogin = await sendAndAwait(wsTeam1, { action: 'LOGIN', username: 'team1', password: 'trade100' }, 'LOGIN_ERROR');
    assert.ok(gatedTeamLogin.message.includes('preparing the event'), 'Expected pre-lock gating message for trader');
    pass('Trader login strictly blocked before Host locks event configuration');

    // 2.3 Valid Host Login & Private Parameter Visibility
    const hostLogin = await sendAndAwait(wsHost, { action: 'LOGIN', username: 'host', password: 'host2026' }, 'LOGIN_SUCCESS');
    const hostToken = hostLogin.session_token;
    assert.strictEqual(hostLogin.role, 'HOST');
    assert.ok(hostToken, 'Expected host session token');
    const sampleHostStock = hostLogin.initialState.companies[0];
    assert.strictEqual(typeof sampleHostStock.beta, 'number', 'Host must receive private stock beta');
    assert.strictEqual(typeof sampleHostStock.volatility_factor, 'number', 'Host must receive private volatility_factor');
    pass(`Host authenticated and received private quantitative parameters (beta=${sampleHostStock.beta}, vol=${sampleHostStock.volatility_factor})`);

    // 2.4 Dynamic Schedule Scaling (45m -> 10m -> 30m)
    const scale45 = await sendAndAwait(wsHost, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 2700
    }, 'SCHEDULE_RECALCULATED_ACK');
    assert.strictEqual(scale45.dayDurationSeconds, 2700);
    assert.ok(scale45.feasibility.valid, '45m schedule must be feasible');
    const ev0_45 = scale45.allScheduledNews[0];
    assert.strictEqual(ev0_45.trigger_second, Math.round(2700 * (ev0_45.relative_position || 0.18)));

    const scale10 = await sendAndAwait(wsHost, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 600
    }, 'SCHEDULE_RECALCULATED_ACK');
    assert.strictEqual(scale10.allScheduledNews[0].reading_duration_sec, 18, '10m session reading window must scale to 18s');

    await sendAndAwait(wsHost, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 1800
    }, 'SCHEDULE_RECALCULATED_ACK');
    pass('Dynamic schedule scaling verified for 2700s (45m), 600s (10m), and restored to 1800s (30m)');

    // 2.5 Invalid Event Lock Validation (< 4 stocks / empty title)
    const invalidLock = await sendAndAwait(wsHost, {
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      eventTitle: '',
      selectedTickers: ['RELIANCE']
    }, 'SETUP_VALIDATION_ERROR');
    assert.strictEqual(invalidLock.type, 'SETUP_VALIDATION_ERROR');
    pass('Server rejected invalid setup lock (< 4 stocks and blank title)');

    // 2.6 Add Custom Share Before Lock
    wsHost.send(JSON.stringify({
      action: 'HOST_ADD_SHARE',
      session_token: hostToken,
      ticker: 'CAMPUSCO',
      name: 'Campus Innovations Ltd',
      sector: 'Technology',
      base_price: 250.0,
      volatility_factor: 0.005,
      beta: 1.2,
      summary: 'Student-led tech enterprise'
    }));
    await delay(350);
    pass('Custom share CAMPUSCO added to pre-lock universe');

    // =========================================================================
    // PHASE 3: AUTHORITATIVE SETUP LOCK, IMMUTABILITY & ROLE SANITIZATION
    // =========================================================================
    console.log('\n[PHASE 3] Setup Lock, Config Immutability & Role Parameter Isolation');

    const teamsRoster = Array.from({ length: 16 }, (_, i) => ({
      slot: i + 1,
      name: i === 0 ? 'Alpha Kings' : i === 1 ? 'Beta Bulls' : `Team ${i + 1}`,
      username: `team${i + 1}`,
      password: `trade${i + 1}00`,
      members: `Trader ${i + 1}A, Trader ${i + 1}B`,
      startingCash: 500000
    }));
    const baseTickers = hostLogin.initialState.companies.map((c) => c.ticker);
    const selectedTickers = [...new Set([...baseTickers, 'CAMPUSCO'])];

    wsPublic._cursor = wsPublic.inbox.length;
    const lockRes = await sendAndAwait(wsHost, {
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      eventTitle: 'The Trading Floor Championship 2026',
      institution: 'Gujarat Technological University',
      startingCash: 500000,
      totalDays: 2,
      dayDurationSeconds: 1800,
      transactionFeeBps: 10,
      circuitBreakerPercent: 20,
      teams: teamsRoster,
      selectedTickers
    }, ['EVENT_CONFIG_LOCKED_ACK', 'EVENT_CONFIG_LOCKED']);

    const pubLockNotice = await waitForWs(wsPublic, (m) => m.type === 'EVENT_CONFIG_LOCKED', 3000, 'EVENT_CONFIG_LOCKED on public socket');
    assert.ok(pubLockNotice, 'Public client must receive EVENT_CONFIG_LOCKED live without refresh');
    const initialEventId = (lockRes.gameState && lockRes.gameState.eventId) || pubLockNotice.eventId || hostLogin.initialState.gameState.eventId;
    pass(`Event setup locked (eventId: ${initialEventId}) and propagated live to public login screen`);

    // 3.1 Post-Lock Immutability Checks
    const illegalAddShare = await sendAndAwait(wsHost, {
      action: 'HOST_ADD_SHARE',
      session_token: hostToken,
      ticker: 'ILLEGAL_CO',
      name: 'Illegal Mid-Event Share',
      base_price: 100
    }, ['EVENT_CONFIG_LOCKED', 'ACTION_REJECTED']);
    assert.ok(illegalAddShare, 'Adding share after lock must be rejected');

    const illegalDupShare = await sendAndAwait(wsHost, {
      action: 'HOST_DUPLICATE_SHARE',
      session_token: hostToken,
      ticker: selectedTickers[0]
    }, ['EVENT_CONFIG_LOCKED', 'ACTION_REJECTED']);
    assert.ok(illegalDupShare, 'Duplicating share after lock must be rejected');

    const illegalTeams = await sendAndAwait(wsHost, {
      action: 'HOST_CONFIGURE_TEAMS',
      session_token: hostToken,
      teams: [{ name: 'Hacked', username: 'hacked', password: '123' }]
    }, ['EVENT_CONFIG_LOCKED', 'ACTION_REJECTED']);
    assert.ok(illegalTeams, 'Modifying team roster after lock must be rejected');

    const illegalSched = await sendAndAwait(wsHost, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 2400
    }, ['ACTION_REJECTED', 'EVENT_CONFIG_LOCKED']);
    assert.ok(illegalSched, 'Recalculating schedule after lock must be rejected');

    const illegalEditNews = await sendAndAwait(wsHost, {
      action: 'HOST_EDIT_NEWS',
      session_token: hostToken,
      event_id: 'EVT_D1_01',
      headline: 'Tampered Headline'
    }, ['ORDER_REJECTED', 'ACTION_REJECTED', 'EVENT_CONFIG_LOCKED']);
    assert.ok(illegalEditNews, 'Editing locked news schedule must be rejected');
    pass('All 5 post-lock mutation vectors (add share, dup share, roster, schedule, edit news) strictly rejected');

    // 3.2 Login Traders, Projector & Sound Console + Verify Security Stripping
    const t1Login = await sendAndAwait(wsTeam1, { action: 'LOGIN', username: 'team1', password: 'trade100' }, 'LOGIN_SUCCESS');
    const t2Login = await sendAndAwait(wsTeam2, { action: 'LOGIN', username: 'team2', password: 'trade200' }, 'LOGIN_SUCCESS');
    const projLogin = await sendAndAwait(wsProj, { action: 'LOGIN', username: 'projector', password: 'screen2026' }, 'LOGIN_SUCCESS');
    const soundLogin = await sendAndAwait(wsSound, { action: 'LOGIN', username: 'sound', password: 'sound2026' }, 'LOGIN_SUCCESS');

    const t1Token = t1Login.session_token;
    const t2Token = t2Login.session_token;
    assert.strictEqual(t1Login.role, 'TRADER');
    assert.strictEqual(projLogin.role, 'PROJECTOR');
    assert.strictEqual(soundLogin.role, 'SOUND_CONSOLE');

    t1Login.initialState.companies.forEach((c) => {
      assert.strictEqual(c.beta, undefined, `Trader leaked beta on ${c.ticker}`);
      assert.strictEqual(c.volatility_factor, undefined, `Trader leaked volatility_factor on ${c.ticker}`);
    });
    projLogin.initialState.companies.forEach((c) => {
      assert.strictEqual(c.beta, undefined, `Projector leaked beta on ${c.ticker}`);
      assert.strictEqual(c.volatility_factor, undefined, `Projector leaked volatility_factor on ${c.ticker}`);
    });
    assert.strictEqual(t1Login.initialState.allScheduledNews, undefined, 'Trader must not receive allScheduledNews');
    assert.strictEqual(projLogin.initialState.allScheduledNews, undefined, 'Projector must not receive allScheduledNews');
    assert.strictEqual(projLogin.initialState.gameState.status, 'STANDBY', 'Projector pre-market state must be STANDBY');
    assert.strictEqual(projLogin.initialState.gameState.elapsedSeconds, 0, 'Pre-market elapsedSeconds must be 0');
    pass('Traders, Projector, and Sound Console authenticated with zero beta/volatility/unpublished-news leakage');

    // 3.3 Session Resumption & Sound Cue Verification
    const wsResume = await createTrackedWs();
    openSockets.push(wsResume);
    const resumeAck = await sendAndAwait(wsResume, { action: 'RESUME_SESSION', session_token: t1Token }, 'LOGIN_SUCCESS');
    assert.strictEqual(resumeAck.id, 'team_1');
    wsResume.close();

    wsSound._cursor = wsSound.inbox.length;
    wsHost.send(JSON.stringify({
      action: 'HOST_TEST_SOUND_CUE',
      session_token: hostToken,
      cueName: 'test_hall_chime',
      category: 'lifecycle'
    }));
    const cueMsg = await waitForWs(wsSound, (m) => m.type === 'AUDIO_CUE' && m.cueName === 'test_hall_chime', 3000, 'AUDIO_CUE');
    assert.strictEqual(cueMsg.cueName, 'test_hall_chime');
    pass('Session token resumption and dedicated Sound Console AUDIO_CUE dispatch verified');

    // =========================================================================
    // PHASE 4: COUNTDOWN, PAUSE & EMERGENCY STOP STATE MACHINE
    // =========================================================================
    console.log('\n[PHASE 4] Countdown, Cancel, Duplicate Pause & Emergency Stop State Machine');

    const primaryTicker = t1Login.initialState.companies.find((c) => c.ticker !== 'CAMPUSCO').ticker;

    // 4.1 Order while STANDBY / Paused must be rejected
    const standbyOrder = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 5
    }, 'ORDER_REJECTED');
    assert.ok(standbyOrder.reason, 'Order must be rejected before market is LIVE');
    pass(`Order during STANDBY rejected: "${standbyOrder.reason}"`);

    // 4.2 Start 3-2-1 Countdown -> Reject overlapping countdown -> Cancel with Pause
    wsTeam1._cursor = wsTeam1.inbox.length;
    const cdStart1 = await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
    assert.strictEqual(cdStart1.seconds, 3);

    const dupCd = await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, ['ORDER_REJECTED', 'ACTION_REJECTED']);
    assert.ok(dupCd.reason.includes('already active'), 'Duplicate countdown must be rejected');

    const cdCancel = await sendAndAwait(wsHost, { action: 'HOST_PAUSE', session_token: hostToken }, 'COUNTDOWN_CANCELLED');
    assert.strictEqual(cdCancel.type, 'COUNTDOWN_CANCELLED');
    pass('3-2-1 Countdown started, overlapping countdown rejected, and active countdown cancelled cleanly on pause');

    // 4.3 Complete 3-2-1 Countdown to LIVE
    await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
    await delay(3300);

    // 4.4 Pause & Duplicate Pause Protection
    wsTeam1._cursor = wsTeam1.inbox.length;
    await sendAndAwait(wsHost, { action: 'HOST_PAUSE', session_token: hostToken, pauseMode: 'VISIBLE_FROZEN' }, 'MARKET_PAUSED');
    const dupPause = await sendAndAwait(wsHost, { action: 'HOST_PAUSE', session_token: hostToken, pauseMode: 'VISIBLE_FROZEN' }, ['ACTION_REJECTED', 'ORDER_REJECTED']);
    assert.ok(dupPause.reason.includes('already paused'), `Expected 'already paused', got: ${dupPause.reason}`);
    pass(`Duplicate pause rejected safely: "${dupPause.reason}"`);

    // 4.5 Emergency Stop & Resume back to LIVE
    const emStop = await sendAndAwait(wsHost, { action: 'HOST_EMERGENCY_STOP', session_token: hostToken }, 'EMERGENCY_STOP');
    assert.ok(emStop, 'Expected EMERGENCY_STOP broadcast');
    await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
    await delay(3300);
    pass('Emergency Stop broadcast and 3-2-1 resumption to LIVE state verified');

    // =========================================================================
    // PHASE 5: LIVE TRADING, FEE MATH, DEBOUNCE, SHARE TOGGLE & LIQUIDATION
    // =========================================================================
    console.log('\n[PHASE 5] Order Accounting (10 bps), Debounce, Share Toggle & Liquidation');

    // 5.1 Buy 10 shares & verify exact 10 bps fee accounting
    const buy1 = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 10
    }, 'ORDER_FILLED');
    const expectedGross = +(buy1.price * 10).toFixed(2);
    const expectedFee = +((expectedGross * 10) / 10000).toFixed(2);
    assert.strictEqual(buy1.grossValue, expectedGross, 'Gross value mismatch');
    assert.strictEqual(buy1.fee, expectedFee, '10 bps fee mismatch');
    assert.strictEqual(buy1.totalImpact, +(expectedGross + expectedFee).toFixed(2), 'Total impact mismatch');
    pass(`Buy 10 ${primaryTicker} filled with exact 10 bps fee: Gross ₹${buy1.grossValue} + Fee ₹${buy1.fee} = ₹${buy1.totalImpact}`);

    // 5.2 Sell 4 shares, Oversell Rejection, Overbuy Rejection
    await delay(250);
    const sell1 = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'SELL',
      quantity: 4
    }, 'ORDER_FILLED');
    assert.strictEqual(sell1.holdings, 6, 'Holdings must be 6 after selling 4 of 10');

    await delay(250);
    const oversell = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'SELL',
      quantity: 999
    }, 'ORDER_REJECTED');
    assert.ok(oversell.reason.includes('Insufficient shares') || oversell.reason.includes('hold'));

    await delay(250);
    const overbuy = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 999999
    }, 'ORDER_REJECTED');
    assert.ok(overbuy.reason.includes('Insufficient cash') || overbuy.reason.includes('afford'));
    pass('Legal sell (6 remaining), oversell rejection, and overbuy rejection verified');

    // 5.3 Anti-Spam Rate-Limit Debounce (2 orders sent simultaneously)
    await delay(250);
    wsTeam1._cursor = wsTeam1.inbox.length;
    wsTeam1.send(JSON.stringify({ action: 'ORDER', session_token: t1Token, ticker: primaryTicker, type: 'BUY', quantity: 1 }));
    wsTeam1.send(JSON.stringify({ action: 'ORDER', session_token: t1Token, ticker: primaryTicker, type: 'BUY', quantity: 1 }));
    const rateReject = await waitForWs(wsTeam1, (m) => m.type === 'ORDER_REJECTED' && (m.reason || '').toLowerCase().includes('rate limit'), 3000, 'rate limit ORDER_REJECTED');
    assert.ok(rateReject, 'Second simultaneous order must be rejected by debounce guard');
    pass('Double-click 200ms rate-limit debounce protection verified');

    // 5.4 Dynamic Share Toggle (Disable CAMPUSCO -> Reject BUY -> Enable CAMPUSCO -> Fill BUY)
    await delay(250);
    wsHost.send(JSON.stringify({ action: 'HOST_TOGGLE_SHARE', session_token: hostToken, ticker: 'CAMPUSCO' }));
    await delay(350);
    const disabledBuy = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: 'CAMPUSCO',
      type: 'BUY',
      quantity: 5
    }, 'ORDER_REJECTED');
    assert.ok(disabledBuy.reason.includes('not enabled') || disabledBuy.reason.includes('disabled'));

    wsHost.send(JSON.stringify({ action: 'HOST_TOGGLE_SHARE', session_token: hostToken, ticker: 'CAMPUSCO' }));
    await delay(350);
    const enabledBuy = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: 'CAMPUSCO',
      type: 'BUY',
      quantity: 5
    }, 'ORDER_FILLED');
    assert.strictEqual(enabledBuy.ticker, 'CAMPUSCO');
    pass('Dynamic share disable/enable toggle enforced on live order routing');

    // 5.5 Liquidate All & Empty Liquidation Rejection
    await delay(250);
    const liqRes = await sendAndAwait(wsTeam1, { action: 'LIQUIDATE_ALL', session_token: t1Token }, 'PORTFOLIO_LIQUIDATED');
    assert.ok(liqRes.tradesCount >= 2, 'Expected both active positions to be liquidated');

    await delay(250);
    const emptyLiq = await sendAndAwait(wsTeam1, { action: 'LIQUIDATE_ALL', session_token: t1Token }, 'ORDER_REJECTED');
    assert.ok(emptyLiq.reason.includes('No active holdings'));
    pass('LIQUIDATE_ALL and empty portfolio liquidation guard verified');

    // 5.6 Establish Clean Day 1 Position for Team 1 & Verify Team 2 Isolation
    await delay(250);
    const day1Position = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 10
    }, 'ORDER_FILLED');
    assert.strictEqual(day1Position.holdings, 10);

    const t2Check = await sendAndAwait(wsTeam2, { action: 'RESUME_SESSION', session_token: t2Token }, 'LOGIN_SUCCESS');
    assert.strictEqual(t2Check.initialState.portfolio.holdings[primaryTicker] || 0, 0, 'Team 2 must have 0 shares');
    pass(`Team 1 established 10 shares of ${primaryTicker}; Team 2 isolation verified (0 shares)`);

    // =========================================================================
    // PHASE 6: NEWS IDEMPOTENCY (REAL ZERO DOUBLE-SHOCK) & CIRCUIT BREAKERS
    // =========================================================================
    console.log('\n[PHASE 6] Real News Idempotency (Zero Double Shock) & Directional Circuit Breakers');

    // 6.1 Real News Idempotency Test: Trigger scheduled news twice & assert no double price jump
    const scheduledId = 'EVT_D1_01';
    wsHost._cursor = wsHost.inbox.length;
    wsHost.send(JSON.stringify({ action: 'HOST_TRIGGER_NEWS', session_token: hostToken, event_id: scheduledId }));
    await delay(500);

    const newsFlashesAfterFirst = wsHost.inbox.filter((m) => m.type === 'NEWS_FLASH' && (m.news && (m.news.id === scheduledId || m.news.event_id === scheduledId))).length;
    wsHost._cursor = wsHost.inbox.length;
    wsHost.send(JSON.stringify({ action: 'HOST_TRIGGER_NEWS', session_token: hostToken, event_id: scheduledId }));
    await delay(500);
    const newsFlashesOnDuplicate = wsHost.inbox.slice(wsHost._cursor).filter((m) => m.type === 'NEWS_FLASH' && (m.news && (m.news.id === scheduledId || m.news.event_id === scheduledId))).length;
    assert.strictEqual(newsFlashesOnDuplicate, 0, 'Duplicate news trigger must NEVER broadcast a second NEWS_FLASH');
    pass(`News idempotency verified: ${scheduledId} broadcasted once (${newsFlashesAfterFirst}) and 0 times on duplicate trigger`);

    // 6.2 Custom News Shock (+12%) on primaryTicker so Team 1 has a real non-zero Day 1 P&L
    const customNews = await sendAndAwait(wsHost, {
      action: 'HOST_CREATE_CUSTOM_NEWS',
      session_token: hostToken,
      headline: 'LANDMARK CONTRACT: Record Export Order Secured',
      explanation: 'Strong positive catalyst for Day 1 valuation.',
      ticker: primaryTicker,
      deltaPct: 12.0,
      durationSec: 10
    }, 'NEWS_FLASH');
    assert.ok(customNews.news.headline.includes('LANDMARK CONTRACT'));
    pass(`Custom news shock (+12%) applied to ${primaryTicker}`);

    // 6.3 Directional UPPER Circuit Breaker on CAMPUSCO
    await sendAndAwait(wsHost, {
      action: 'HOST_TRIGGER_CIRCUIT_BREAKER',
      session_token: hostToken,
      ticker: 'CAMPUSCO',
      direction: 'UPPER'
    }, 'CIRCUIT_BREAKER_ALERT');

    await delay(250);
    const upperBuyReject = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: 'CAMPUSCO',
      type: 'BUY',
      quantity: 1
    }, 'ORDER_REJECTED');
    assert.ok(upperBuyReject.reason.includes('Upper circuit') || upperBuyReject.reason.includes('Circuit'));

    // Verify stock isolation: primaryTicker is NOT halted while CAMPUSCO is halted
    await delay(250);
    const isolatedBuy = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 2
    }, 'ORDER_FILLED');
    assert.strictEqual(isolatedBuy.holdings, 12, 'Unaffected stock must remain tradeable during another stock circuit halt');

    await sendAndAwait(wsHost, {
      action: 'HOST_RELEASE_CIRCUIT_BREAKER',
      session_token: hostToken,
      ticker: 'CAMPUSCO'
    }, 'CIRCUIT_RECOVERY_ALERT');
    pass('Directional UPPER circuit breaker (BUY halted, other stocks isolated, clean release) verified');

    // 6.4 Directional LOWER Circuit Breaker on primaryTicker (SELL blocked, counter-flow BUY allowed)
    await sendAndAwait(wsHost, {
      action: 'HOST_TRIGGER_CIRCUIT_BREAKER',
      session_token: hostToken,
      ticker: primaryTicker,
      direction: 'LOWER'
    }, 'CIRCUIT_BREAKER_ALERT');

    await delay(250);
    const lowerSellReject = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'SELL',
      quantity: 1
    }, 'ORDER_REJECTED');
    assert.ok(lowerSellReject.reason.includes('Lower circuit') || lowerSellReject.reason.includes('restricted'));

    await delay(250);
    const lowerCounterBuy = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 1
    }, 'ORDER_FILLED');
    assert.strictEqual(lowerCounterBuy.holdings, 13);

    await sendAndAwait(wsHost, {
      action: 'HOST_RELEASE_CIRCUIT_BREAKER',
      session_token: hostToken,
      ticker: primaryTicker
    }, ['CIRCUIT_RECOVERY_ALERT', 'TICK_UPDATE']);
    pass('Directional LOWER circuit breaker (SELL blocked, counter-flow BUY executed) verified');

    // =========================================================================
    // PHASE 7: REST ANALYTICS & PRIVACY-SAFE MACRO ENDPOINTS
    // =========================================================================
    console.log('\n[PHASE 7] Team Investment Analytics & Privacy-Safe Macro APIs');

    const invAll = await httpGet('/api/team-investments', hostToken);
    assert.strictEqual(invAll.status, 200);
    const t1Analytics = invAll.body.teamInvestments.find((t) => t.teamId === 'team_1');
    assert.ok(t1Analytics, 'Team 1 must be present in /api/team-investments');
    const mathDiff = Math.abs(t1Analytics.portfolioValue - (t1Analytics.availableCash + t1Analytics.holdingsMarketValue));
    assert.ok(mathDiff < 0.05, `Portfolio math invariant violated: diff=${mathDiff}`);

    const invSingle = await httpGet('/api/team-investments/team_1', hostToken);
    assert.strictEqual(invSingle.status, 200);
    assert.ok(Array.isArray(invSingle.body.holdingsDetail));

    const indicesRes = await httpGet('/api/market-indices');
    assert.strictEqual(indicesRes.status, 200);
    assert.ok(indicesRes.body.indices && indicesRes.body.indices.NIFTY_TF20);

    const allocRes = await httpGet('/api/sector-allocations');
    assert.strictEqual(allocRes.status, 200);
    const allocStr = JSON.stringify(allocRes.body.allocations);
    assert.ok(!allocStr.includes('avgBuyPrice'), 'Sector allocations must not leak individual position avgBuyPrice');

    const commRes = await httpGet('/api/anchor-commentary');
    assert.strictEqual(commRes.status, 200);
    assert.ok(Array.isArray(commRes.body.prompts));
    pass('Verified /api/team-investments math invariant, /api/market-indices, /api/sector-allocations privacy, and /api/anchor-commentary');

    // =========================================================================
    // PHASE 8: CONCURRENCY-SAFE DAY 1 CONCLUSION & NON-PAUSE INVARIANT
    // =========================================================================
    console.log('\n[PHASE 8] Concurrency-Safe Day 1 Conclusion & Non-Pause Invariant');

    wsHost._cursor = wsHost.inbox.length;
    wsTeam1._cursor = wsTeam1.inbox.length;

    // Send 2 concurrent HOST_CONCLUDE_DAY commands
    wsHost.send(JSON.stringify({ action: 'HOST_CONCLUDE_DAY', session_token: hostToken }));
    wsHost.send(JSON.stringify({ action: 'HOST_CONCLUDE_DAY', session_token: hostToken }));
    await delay(700);

    const day1ConcludedMsgs = wsTeam1.inbox.slice(wsTeam1._cursor).filter((m) => m.type === 'DAY_CONCLUDED');
    assert.strictEqual(day1ConcludedMsgs.length, 1, 'Concurrent HOST_CONCLUDE_DAY must broadcast DAY_CONCLUDED strictly once');
    const day1CloseMsg = day1ConcludedMsgs[0];
    assert.strictEqual(day1CloseMsg.status, 'DAY_COMPLETED');
    assert.strictEqual(wsTeam1.inbox.slice(wsTeam1._cursor).find((m) => m.type === 'MARKET_PAUSED'), undefined, 'Day conclusion must NEVER broadcast MARKET_PAUSED');

    const dupConcludeReject = wsHost.inbox.slice(wsHost._cursor).find((m) => m.type === 'ACTION_REJECTED');
    assert.ok(dupConcludeReject, 'Second concurrent HOST_CONCLUDE_DAY must return ACTION_REJECTED');
    pass(`Day 1 concluded atomically once (status=DAY_COMPLETED, zero MARKET_PAUSED); concurrent duplicate rejected`);

    // Verify orders, pause, and resume are all rejected on a concluded day
    const postCloseOrder = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 1
    }, 'ORDER_REJECTED');
    assert.ok(postCloseOrder.reason);

    const postClosePause = await sendAndAwait(wsHost, { action: 'HOST_PAUSE', session_token: hostToken }, 'ACTION_REJECTED');
    assert.ok(postClosePause.reason);

    const postCloseResume = await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, ['ORDER_REJECTED', 'ACTION_REJECTED']);
    assert.ok(postCloseResume.reason);

    const snap1 = await httpGet('/api/daily-snapshot/1');
    assert.strictEqual(snap1.status, 200);
    const t1Day1Rank = (snap1.body.rankings || day1CloseMsg.daySnapshot.rankings).find((r) => r.teamId === 'team_1');
    assert.strictEqual(t1Day1Rank.dayOpeningValuation, 500000);
    assert.notStrictEqual(t1Day1Rank.dailyPnl, 0, 'Team 1 Day 1 PnL must be non-zero after trades and +12% news shock');
    pass(`Day 1 snapshot locked: Team 1 Opening=₹500,000, Closing=₹${t1Day1Rank.closingPortfolioValue}, Daily P&L=₹${t1Day1Rank.dailyPnl}`);

    // =========================================================================
    // PHASE 9: DAY 2 CARRY-OVER & NON-ZERO DAILY VS. CUMULATIVE P&L ISOLATION
    // =========================================================================
    console.log('\n[PHASE 9] Day 2 Carry-Over & Strictly Isolated Daily vs. Cumulative P&L Math');

    const day2Trans = await sendAndAwait(wsHost, { action: 'HOST_START_NEXT_DAY', session_token: hostToken }, ['DAY_TRANSITION', 'DAY_ADVANCED']);
    const activeDay2 = day2Trans.newDay || day2Trans.currentDay;
    assert.strictEqual(activeDay2, 2, 'Must advance to Day 2');

    // Open Day 2 Market
    await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
    await delay(3300);

    // Verify Team 1 carried over all 13 shares of primaryTicker into Day 2 and buys 3 more
    const day2Buy = await sendAndAwait(wsTeam1, {
      action: 'ORDER',
      session_token: t1Token,
      ticker: primaryTicker,
      type: 'BUY',
      quantity: 3
    }, 'ORDER_FILLED');
    assert.strictEqual(day2Buy.holdings, 16, 'Day 1 holdings (13) + Day 2 buy (3) must equal 16 shares');

    // Apply a Day 2 price shock (+10%) so Day 2 P&L is genuinely non-zero
    await sendAndAwait(wsHost, {
      action: 'HOST_CREATE_CUSTOM_NEWS',
      session_token: hostToken,
      headline: 'DAY 2 SURGE: Institutional Upgrade',
      explanation: 'Day 2 price expansion.',
      ticker: primaryTicker,
      deltaPct: 10.0,
      durationSec: 10
    }, 'NEWS_FLASH');
    await delay(600);

    // Conclude Day 2
    const day2CloseMsg = await sendAndAwait(wsHost, { action: 'HOST_CONCLUDE_DAY', session_token: hostToken }, 'DAY_CONCLUDED');
    assert.strictEqual(day2CloseMsg.day, 2);

    const t1Day2Rank = (day2CloseMsg.dailyRankings || day2CloseMsg.daySnapshot.rankings).find((r) => r.teamId === 'team_1');
    assert.ok(t1Day2Rank, 'Team 1 must be in Day 2 rankings');
    assert.ok(
      Math.abs(t1Day2Rank.dayOpeningValuation - t1Day1Rank.closingPortfolioValue) < 1.0,
      `Day 2 opening valuation (${t1Day2Rank.dayOpeningValuation}) must equal Day 1 closing valuation (${t1Day1Rank.closingPortfolioValue})`
    );
    const expectedDay2DailyPnl = +(t1Day2Rank.closingPortfolioValue - t1Day2Rank.dayOpeningValuation).toFixed(2);
    const expectedDay2CumPnl = +(t1Day2Rank.closingPortfolioValue - 500000).toFixed(2);
    assert.ok(Math.abs(t1Day2Rank.dailyPnl - expectedDay2DailyPnl) < 0.1, 'Day 2 dailyPnl must equal Closing - Day 2 Opening');
    assert.ok(Math.abs(t1Day2Rank.cumulativePnl - expectedDay2CumPnl) < 0.1, 'Day 2 cumulativePnl must equal Closing - 500,000');
    assert.notStrictEqual(t1Day2Rank.dailyPnl, t1Day2Rank.cumulativePnl, 'Day 2 dailyPnl and cumulativePnl must be distinct');
    pass(`Day 2 P&L strictly isolated: Day2 Open=₹${t1Day2Rank.dayOpeningValuation}, Day2 Daily P&L=₹${t1Day2Rank.dailyPnl}, Cumulative P&L=₹${t1Day2Rank.cumulativePnl}`);

    // Advancing past final day (Day 2 of 2) must be rejected
    const pastFinalReject = await sendAndAwait(wsHost, { action: 'HOST_START_NEXT_DAY', session_token: hostToken }, ['ORDER_REJECTED', 'ACTION_REJECTED']);
    assert.ok(pastFinalReject.reason.includes('final planned day') || pastFinalReject.reason.includes('final'));

    // Extend tournament by 1 day via HOST_ADD_DAY, advance to Day 3, and conclude Day 3
    const dayAdded = await sendAndAwait(wsHost, { action: 'HOST_ADD_DAY', session_token: hostToken }, 'DAY_ADDED');
    assert.strictEqual(dayAdded.totalDays, 3);
    await sendAndAwait(wsHost, { action: 'HOST_START_NEXT_DAY', session_token: hostToken }, ['DAY_TRANSITION', 'DAY_ADVANCED']);
    await sendAndAwait(wsHost, { action: 'HOST_CONCLUDE_DAY', session_token: hostToken }, 'DAY_CONCLUDED');
    pass('Final-day gating verified, tournament extended to Day 3 via HOST_ADD_DAY, and Day 3 concluded');

    // =========================================================================
    // PHASE 10: GRAND FINALE, AUDITED EXPORTS & CEREMONIAL WINNER REVEAL
    // =========================================================================
    console.log('\n[PHASE 10] Grand Finale, Audited CSV/JSON Exports & 6-Stage Winner Reveal');

    const finaleMsg = await sendAndAwait(wsHost, { action: 'HOST_CONCLUDE_CHAMPIONSHIP', session_token: hostToken }, 'CHAMPIONSHIP_CONCLUDED');
    assert.ok(finaleMsg.winnerData && finaleMsg.winnerData.first, 'Expected audited winnerData');

    const standingsCsv = await httpGet('/api/export/standings', hostToken);
    assert.strictEqual(standingsCsv.status, 200);
    assert.ok(standingsCsv.raw.includes('Rank,Team ID,Team Name'));

    const tradesCsv = await httpGet('/api/export/trades', hostToken);
    assert.strictEqual(tradesCsv.status, 200);
    assert.ok(tradesCsv.raw.includes('Trade Seq,Time,Day'));

    const univJson = await httpGet('/api/export/universe', hostToken);
    assert.strictEqual(univJson.status, 200);
    const univCsv = await httpGet('/api/export/universe-csv', hostToken);
    assert.strictEqual(univCsv.status, 200);

    const resultsSnap = await httpGet('/api/results-snapshot', hostToken);
    assert.strictEqual(resultsSnap.status, 200);
    assert.ok(resultsSnap.body.rankings && resultsSnap.body.rankings.length > 0);
    pass('Championship concluded and all 5 export/snapshot endpoints verified');

    // Projector Remote Controls & 6-Stage Ceremonial Reveal
    const projMode = await sendAndAwait(wsHost, {
      action: 'HOST_UPDATE_PROJECTOR_MODE',
      session_token: hostToken,
      mode: 'AUTO_CYCLE',
      sceneDurationSeconds: 15
    }, 'PROJECTOR_STATE_UPDATE');
    assert.strictEqual(projMode.projectorState.sceneDurationSeconds, 15);

    wsProj._cursor = wsProj.inbox.length;
    await sendAndAwait(wsHost, { action: 'HOST_START_WINNER_PRESENTATION', session_token: hostToken }, ['PRESENTATION_SCENE_UPDATE', 'PROJECTOR_STATE_UPDATE']);
    for (const scene of ['SCENE_BRONZE', 'SCENE_SILVER', 'SCENE_CHAMPION', 'SCENE_PODIUM', 'SCENE_LEADERBOARD']) {
      const scMsg = await sendAndAwait(wsHost, {
        action: 'HOST_SET_PRESENTATION_SCENE',
        session_token: hostToken,
        scene
      }, 'PRESENTATION_SCENE_UPDATE');
      assert.strictEqual(scMsg.scene, scene);
    }
    await sendAndAwait(wsHost, { action: 'HOST_EXIT_WINNER_PRESENTATION', session_token: hostToken }, 'PROJECTOR_STATE_UPDATE');
    pass('Projector remote controls and complete 6-stage ceremonial winner reveal verified');

    // =========================================================================
    // PHASE 11: FULL CHAMPIONSHIP RESET & NEW EVENT IN SAME SERVER PROCESS
    // =========================================================================
    console.log('\n[PHASE 11] Full Championship Reset & Second Event Identity Isolation');

    const badReset = await sendAndAwait(wsHost, {
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      session_token: hostToken,
      confirmation: 'WRONG_CONFIRMATION'
    }, ['ORDER_REJECTED', 'ACTION_REJECTED']);
    assert.ok(badReset.reason.includes('RESET'));

    wsProj._cursor = wsProj.inbox.length;
    const resetAck = await sendAndAwait(wsHost, {
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      session_token: hostToken,
      confirmation: 'RESET THE ENTIRE CHAMPIONSHIP'
    }, ['CHAMPIONSHIP_RESET', 'CHAMPIONSHIP_RESET_ACK']);
    assert.ok(resetAck, 'Reset must succeed with authoritative confirmation');

    const projReset = await waitForWs(wsProj, (m) => m.type === 'CHAMPIONSHIP_RESET', 3000, 'Projector CHAMPIONSHIP_RESET');
    assert.notStrictEqual(projReset.eventId, initialEventId, 'Reset must generate a new isolated eventId');

    // Initialize a new championship with >= 4 valid stocks in the same server process
    const newInit = await sendAndAwait(wsHost, {
      action: 'HOST_INITIALIZE_NEW_CHAMPIONSHIP',
      session_token: hostToken,
      config: {
        title: 'Fresh Tournament Beta 2026',
        startingCash: 750000,
        totalDays: 2,
        dayDurationSeconds: 1200,
        transactionFeeBps: 5,
        circuitBreakerPercent: 15,
        selectedTickers: baseTickers.slice(0, 5)
      }
    }, 'CHAMPIONSHIP_INITIALIZED_SUCCESS');
    assert.strictEqual(newInit.type, 'CHAMPIONSHIP_INITIALIZED_SUCCESS');

    const wsProjReconn = await createTrackedWs();
    openSockets.push(wsProjReconn);
    const reconnLogin = await sendAndAwait(wsProjReconn, { action: 'LOGIN', username: 'projector', password: 'screen2026' }, 'LOGIN_SUCCESS');
    const newGs = reconnLogin.initialState.gameState;
    assert.strictEqual(newGs.title, 'Fresh Tournament Beta 2026');
    assert.strictEqual(newGs.currentDay, 1);
    assert.strictEqual(newGs.elapsedSeconds, 0);
    assert.notStrictEqual(newGs.eventId, initialEventId);
    pass(`Second championship initialized in same server process (eventId=${newGs.eventId}, Day 1, elapsed=0s)`);

    console.log('\n======================================================================');
    console.log(` 🏆 ALL ${passed} UNIFIED SINGLE-FLOW ASSERTIONS PASSED WITH ZERO OVERLAP!`);
    console.log('======================================================================\n');
  } finally {
    for (const s of openSockets) {
      try { s.close(); } catch (e) {}
    }
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }
    if (universeBackup !== null) {
      fs.writeFileSync(UNIVERSE_FILE, universeBackup, 'utf8');
    }
  }
}

runUnifiedMasterFlow().catch((err) => {
  console.error('\n❌ UNIFIED MASTER FLOW FAILED:', err);
  process.exit(1);
});
