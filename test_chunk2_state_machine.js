/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * CHUNK 2 STATE MACHINE & INVARIANTS VERIFICATION SUITE (test_chunk2_state_machine.js)
 *
 * Verifies the 5 authoritative state machine and monotonic versioning tests:
 * - TEST-STATE-001: Post-Reset Wizard Login Gate Test
 * - TEST-STATE-002: Emergency Stop During 3-2-1 Countdown Test
 * - TEST-STATE-003: Premature Winner Presentation & Podium Dismiss Test
 * - TEST-STATE-004: Mid-Session HOST_START_EVENT_NOW Clock Preservation Test
 * - TEST-STATE-005: Client Monotonic stateVersion Guard Test
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const TEST_PORT = 3102;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function runChunk2Tests() {
  console.log('\n======================================================================');
  console.log(' 🧪 RUNNING CHUNK 2 STATE MACHINE VERIFICATION SUITE (PORT 3102)');
  console.log('======================================================================\n');

  // TEST-STATE-005 (Client Monotonic stateVersion Guard Unit Test)
  console.log('[TEST-STATE-005] Client Monotonic stateVersion Guard Test');
  const StateGuard = require('./public/js/state_guard.js').StateGuard;
  assert.ok(StateGuard, 'StateGuard must be exported');
  StateGuard.resetStateGuard();

  const evId = 'EVT_TEST_STATE_GUARD_01';
  // Step 1: Initial state packet with stateVersion 10
  const accept1 = StateGuard.shouldAcceptIncomingState({ eventId: evId, stateVersion: 10 });
  assert.strictEqual(accept1, true, 'Initial stateVersion 10 must be accepted');

  // Step 2: Forward state packet with stateVersion 11
  const accept2 = StateGuard.shouldAcceptIncomingState({ eventId: evId, stateVersion: 11 });
  assert.strictEqual(accept2, true, 'Ascending stateVersion 11 must be accepted');

  // Step 3: Stale out-of-order packet with stateVersion 8 (same eventId)
  const acceptStale = StateGuard.shouldAcceptIncomingState({ eventId: evId, stateVersion: 8 });
  assert.strictEqual(acceptStale, false, 'Stale out-of-order stateVersion 8 must be rejected (dropped)');

  // Step 4: Event reset to brand new eventId must reset guard immediately
  const acceptNewEvent = StateGuard.shouldAcceptIncomingState({ eventId: 'EVT_NEW_EVENT_02', stateVersion: 1 });
  assert.strictEqual(acceptNewEvent, true, 'New eventId must be accepted immediately');
  console.log('  ✓ PASS [TEST-STATE-005]: Client Monotonic stateVersion Guard verified\n');

  // Start isolated test server
  let serverProcess = null;
  const openSockets = [];

  try {
    serverProcess = spawn(process.execPath, [path.join(__dirname, 'server.js'), 'test'], {
      env: { ...process.env, PORT: TEST_PORT },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server spawn timeout')), 10000);
      serverProcess.stdout.on('data', (d) => {
        if (d.toString().includes('THE TRADING FLOOR ENGINE ONLINE')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      serverProcess.on('error', reject);
    });

    const wsHost = await createTrackedWs();
    openSockets.push(wsHost);
    const hostLogin = await sendAndAwait(wsHost, { action: 'LOGIN', username: 'host', password: 'host2026' }, 'LOGIN_SUCCESS');
    const hostToken = hostLogin.session_token;

    // Lock setup for Day 1
    await sendAndAwait(wsHost, {
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      title: 'State Machine Certification 2026',
      startingCash: 500000,
      totalDays: 2,
      dayDurationSeconds: 1800,
      transactionFeeBps: 10,
      circuitBreakerPercent: 20
    }, 'EVENT_CONFIG_LOCKED');

    // [TEST-STATE-002] Emergency Stop During 3-2-1 Countdown Test
    console.log('[TEST-STATE-002] Emergency Stop During 3-2-1 Countdown Test');
    const cdStart = await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
    assert.strictEqual(cdStart.seconds, 3);

    // Wait 500ms into countdown, then fire HOST_EMERGENCY_STOP
    await delay(500);
    const emStop = await sendAndAwait(wsHost, { action: 'HOST_EMERGENCY_STOP', session_token: hostToken }, 'EMERGENCY_STOP');
    assert.ok(emStop, 'EMERGENCY_STOP must be broadcast');

    // Wait 3500ms (longer than the 3000ms countdown duration)
    await delay(3500);

    // Inspect server state: must remain in PAUSED / EMERGENCY_HALT and NEVER transition to LIVE
    wsHost._cursor = wsHost.inbox.length;
    wsHost.send(JSON.stringify({ action: 'HOST_GET_STATE', session_token: hostToken }));
    const tickAfterWait = await waitForWs(wsHost, (m) => m.type === 'TICK_UPDATE', 3000, 'TICK_UPDATE');
    const gsAfterStop = tickAfterWait.gameState;

    assert.strictEqual(gsAfterStop.status, 'PAUSED', 'Status must remain PAUSED after emergency stop');
    assert.strictEqual(gsAfterStop.pauseMode, 'EMERGENCY_HALT', 'pauseMode must be EMERGENCY_HALT');
    assert.strictEqual(gsAfterStop.isPaused, true, 'isPaused must remain true (never flip to LIVE)');
    console.log('  ✓ PASS [TEST-STATE-002]: Emergency Stop cancelled countdown cleanly, prevented auto-flip to LIVE\n');

    // Resume trading cleanly to LIVE
    await sendAndAwait(wsHost, { action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }, 'COUNTDOWN_START');
    await delay(3300);

    // [TEST-STATE-004] Mid-Session HOST_START_EVENT_NOW Clock Preservation Test
    console.log('[TEST-STATE-004] Mid-Session HOST_START_EVENT_NOW Clock Preservation Test');
    // Let trading run for 5 seconds
    await delay(5000);

    // Pause trading
    await sendAndAwait(wsHost, { action: 'HOST_PAUSE', session_token: hostToken, pauseMode: 'VISIBLE_FROZEN' }, 'MARKET_PAUSED');
    wsHost._cursor = wsHost.inbox.length;
    wsHost.send(JSON.stringify({ action: 'HOST_GET_STATE', session_token: hostToken }));
    const tickPaused = await waitForWs(wsHost, (m) => m.type === 'TICK_UPDATE', 3000, 'TICK_UPDATE');
    const pausedElapsed = tickPaused.gameState.elapsedSeconds;
    assert.ok(pausedElapsed >= 4, `elapsedSeconds must be >= 4, got ${pausedElapsed}`);

    // Send HOST_START_EVENT_NOW mid-session to resume
    await sendAndAwait(wsHost, { action: 'HOST_START_EVENT_NOW', session_token: hostToken }, 'MARKET_RESUMED');
    wsHost._cursor = wsHost.inbox.length;
    wsHost.send(JSON.stringify({ action: 'HOST_GET_STATE', session_token: hostToken }));
    const tickResumed = await waitForWs(wsHost, (m) => m.type === 'TICK_UPDATE', 3000, 'TICK_UPDATE');
    const resumedElapsed = tickResumed.gameState.elapsedSeconds;

    assert.ok(resumedElapsed >= pausedElapsed, `Mid-session launch must preserve elapsedSeconds (was ${pausedElapsed}, now ${resumedElapsed})`);
    console.log(`  ✓ PASS [TEST-STATE-004]: Clock preserved on mid-session launch (elapsedSeconds=${resumedElapsed})\n`);

    // [TEST-STATE-003] Premature Winner Presentation & Podium Dismiss Test
    console.log('[TEST-STATE-003] Premature Winner Presentation & Podium Dismiss Test');
    // During Day 1 LIVE, attempt HOST_START_WINNER_PRESENTATION
    const prematurePres = await sendAndAwait(wsHost, {
      action: 'HOST_START_WINNER_PRESENTATION',
      session_token: hostToken
    }, ['ACTION_REJECTED', 'ORDER_REJECTED']);
    assert.ok(prematurePres.reason.includes('concluded'), 'Premature winner presentation must be rejected');

    // Conclude Day 1
    await sendAndAwait(wsHost, { action: 'HOST_CONCLUDE_DAY', session_token: hostToken }, 'DAY_CONCLUDED');
    // Start Day 2
    await sendAndAwait(wsHost, { action: 'HOST_START_NEXT_DAY', session_token: hostToken }, 'DAY_TRANSITION');
    // Resume Day 2 to live
    await sendAndAwait(wsHost, { action: 'HOST_START_EVENT_NOW', session_token: hostToken }, 'MARKET_RESUMED');
    await delay(1000);
    // Conclude Day 2 (final day)
    await sendAndAwait(wsHost, { action: 'HOST_CONCLUDE_DAY', session_token: hostToken }, 'DAY_CONCLUDED');
    // Conclude Championship
    await sendAndAwait(wsHost, { action: 'HOST_CONCLUDE_CHAMPIONSHIP', session_token: hostToken }, 'CHAMPIONSHIP_CONCLUDED');

    // Start Winner Presentation
    await sendAndAwait(wsHost, { action: 'HOST_START_WINNER_PRESENTATION', session_token: hostToken }, 'PRESENTATION_SCENE_UPDATE');

    // Dismiss Podium
    await sendAndAwait(wsHost, { action: 'HOST_DISMISS_PODIUM', session_token: hostToken }, 'PODIUM_DISMISSED');
    wsHost._cursor = wsHost.inbox.length;
    wsHost.send(JSON.stringify({ action: 'HOST_GET_STATE', session_token: hostToken }));
    const tickAfterDismiss = await waitForWs(wsHost, (m) => m.type === 'TICK_UPDATE', 3000, 'TICK_UPDATE');
    const gsAfterDismiss = tickAfterDismiss.gameState;

    assert.strictEqual(gsAfterDismiss.isConcluded, true, 'isConcluded must remain TRUE after podium dismissal');
    assert.ok(gsAfterDismiss.winnerData !== null, 'winnerData must remain intact after podium dismissal');
    console.log('  ✓ PASS [TEST-STATE-003]: Premature presentation rejected; podium dismiss preserved isConcluded & winnerData\n');

    // [TEST-STATE-001] Post-Reset Wizard Login Gate Test
    console.log('[TEST-STATE-001] Post-Reset Wizard Login Gate Test');
    // Reset entire championship
    await sendAndAwait(wsHost, {
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      session_token: hostToken,
      confirmation: 'RESET THE ENTIRE CHAMPIONSHIP'
    }, 'CHAMPIONSHIP_RESET');

    // Initialize new championship via Setup Wizard
    await sendAndAwait(wsHost, {
      action: 'HOST_INITIALIZE_NEW_CHAMPIONSHIP',
      session_token: hostToken,
      config: {
        title: 'Fresh Post-Reset Championship 2026',
        startingCash: 600000,
        totalDays: 2,
        dayDurationSeconds: 1200
      }
    }, 'CHAMPIONSHIP_INITIALIZED_SUCCESS');

    // Login as team1
    const wsTeam1 = await createTrackedWs();
    openSockets.push(wsTeam1);
    const t1Login = await sendAndAwait(wsTeam1, { action: 'LOGIN', username: 'team1', password: 'trade100' }, 'LOGIN_SUCCESS');
    assert.strictEqual(t1Login.type, 'LOGIN_SUCCESS', 'Trader login must succeed after setup initialization');
    assert.strictEqual(t1Login.initialState.gameState.configLocked, true, 'configLocked must be true after initialization');
    console.log('  ✓ PASS [TEST-STATE-001]: Post-reset wizard initializes configLocked=true and allows trader logins\n');

    console.log('======================================================================');
    console.log(' 🏆 ALL 5 CHUNK 2 STATE MACHINE VERIFICATION TESTS PASSED!');
    console.log('======================================================================\n');
  } finally {
    for (const s of openSockets) {
      try { s.close(); } catch (e) {}
    }
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }
  }
}

runChunk2Tests().catch((err) => {
  console.error('\n❌ CHUNK 2 TESTS FAILED:', err);
  process.exit(1);
});
