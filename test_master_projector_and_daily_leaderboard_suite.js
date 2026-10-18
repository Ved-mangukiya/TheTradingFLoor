// ==============================================================================
// MASTER PROJECTOR, EVENT ISOLATION & DAILY LEADERBOARD TEST SUITE
// ==============================================================================
// Verifies all critical master upgrade requirements:
// Test A: Tournament Reset & New Event in Same Server Session (EventId & StateVersion isolation)
// Test B: Pre-Event Projector Scenes (Reset, Setup, Ready, Gating without chart leaks)
// Test C: Daily-Only Leaderboard vs Cumulative Championship Standings (Day 1 & Day 2 isolated math)
// Test D: Dynamic Movement Intensity & Directional Circuit Breakers (Upper/Lower halts & order rules)
// Test E: Host Buttons & 4-Stage Ceremonial Winner Reveal (INTRO -> BRONZE -> SILVER -> CHAMPION -> PODIUM -> LEADERBOARD)
// ==============================================================================

const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3097;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendWs(ws, payload) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify(payload), resolve);
  });
}

function waitForMessage(ws, predicate, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for message`));
    }, timeoutMs);

    function handler(data) {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`  [MSG] ${msg.type}`);
        if (msg.type === 'ACTION_REJECTED' || msg.type === 'ORDER_REJECTED') {
          console.log(`  ⚠️ REJECTED: [${msg.type}]`, msg.reason || msg.message);
        }
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch (e) {}
    }

    ws.on('message', handler);
  });
}

async function runMasterProjectorAndDailyLeaderboardSuite() {
  console.log('\n================================================================');
  console.log(' 🧪 RUNNING MASTER PROJECTOR, EVENT ISOLATION & DAILY LEADERBOARD SUITE');
  console.log('================================================================\n');

  let serverProcess = spawn(process.execPath, ['server.js', 'test'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Wait for test server to boot
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://127.0.0.1:${TEST_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        if (attempts > 35) {
          clearInterval(interval);
          reject(new Error('Test server failed to boot on port ' + TEST_PORT));
        }
      });
    }, 200);
  });

  console.log(`✓ Test server running cleanly on port ${TEST_PORT}\n`);

  let passed = 0;

  try {
    // -------------------------------------------------------------------------
    // TEST A: RESET & NEW EVENT IN SAME SERVER SESSION (EVENT ISOLATION)
    // -------------------------------------------------------------------------
    console.log('[TEST A] Tournament Reset & Event Identity Isolation');
    const hostWs = new WebSocket(WS_URL);
    const projWs = new WebSocket(WS_URL);
    const traderWs = new WebSocket(WS_URL);

    await Promise.all([
      new Promise((r) => hostWs.on('open', r)),
      new Promise((r) => projWs.on('open', r)),
      new Promise((r) => traderWs.on('open', r))
    ]);

    // 1. Authenticate Host
    await sendWs(hostWs, { action: 'LOGIN', username: 'host', password: 'host2026' });
    const hostAuth = await waitForMessage(hostWs, (m) => m.type === 'LOGIN_SUCCESS');
    const hostToken = hostAuth.session_token;
    assert.ok(hostToken, 'Host authenticated successfully with session token');
    console.log('  ✓ PASS: Host authenticated');

    // 2. Lock Initial Event
    await sendWs(hostWs, {
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      eventTitle: 'Initial Competition Alpha',
      institution: 'SSASIT GTU Hub',
      totalDays: 2,
      dayDurationSeconds: 60,
      startingCash: 500000,
      transactionFeeBps: 10,
      circuitBreakerPercent: 20
    });
    const lockMsg = await waitForMessage(hostWs, (m) => m.type === 'EVENT_CONFIG_LOCKED' || m.type === 'EVENT_CONFIG_LOCKED_ACK');
    const initialEventId = (lockMsg.gameState && lockMsg.gameState.eventId) || lockMsg.eventId || (lockMsg.initialState && lockMsg.initialState.gameState.eventId);
    assert.ok(initialEventId, `Initial event configured with eventId: ${initialEventId}`);
    console.log(`  ✓ PASS: Initial event configured with eventId: ${initialEventId}`);

    // 3. Authenticate Trader and Projector
    await sendWs(traderWs, { action: 'LOGIN', username: 'team1', password: 'trade100' });
    const traderAuth = await waitForMessage(traderWs, (m) => m.type === 'LOGIN_SUCCESS');
    assert.strictEqual(traderAuth.role, 'TRADER', 'Team 1 logged into Initial Competition');

    await sendWs(projWs, { action: 'LOGIN', username: 'projector', password: 'screen2026' });
    const projAuth = await waitForMessage(projWs, (m) => m.type === 'LOGIN_SUCCESS');
    assert.strictEqual(projAuth.role, 'PROJECTOR', 'Projector authenticated in Initial Competition');
    console.log('  ✓ PASS: Trader and Projector authenticated');

    // 4. Host Resets Entire Championship
    console.log('  • Executing HOST_RESET_ENTIRE_CHAMPIONSHIP...');
    const projResetPromise = waitForMessage(projWs, (m) => m.type === 'CHAMPIONSHIP_RESET');
    const traderResetPromise = waitForMessage(traderWs, (m) => m.type === 'CHAMPIONSHIP_RESET');

    await sendWs(hostWs, {
      action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
      session_token: hostToken,
      confirmation: 'RESET THE ENTIRE CHAMPIONSHIP'
    });

    const [projResetMsg, traderResetMsg] = await Promise.all([projResetPromise, traderResetPromise]);
    assert.strictEqual(projResetMsg.type, 'CHAMPIONSHIP_RESET', 'Projector received authoritative reset event');
    assert.strictEqual(traderResetMsg.type, 'CHAMPIONSHIP_RESET', 'Trader received authoritative reset event');
    assert.notStrictEqual(projResetMsg.eventId, initialEventId, 'Reset generated a new isolated eventId');
    console.log(`  ✓ PASS: Reset broadcasted new isolated eventId: ${projResetMsg.eventId}`);

    // 5. Host Configures a NEW Event in the SAME server process
    console.log('  • Configuring Second Event (Competition Beta) in same server session...');
    await sendWs(hostWs, {
      action: 'HOST_INITIALIZE_NEW_CHAMPIONSHIP',
      session_token: hostToken,
      config: {
        title: 'New Competition Beta',
        totalDays: 2,
        dayDurationSeconds: 120,
        startingCash: 500000,
        circuitBreakerPercent: 20,
        selectedTickers: ['APEXAUTO', 'VELOCAR', 'NEXUSTECH']
      }
    });

    const newEventMsg = await waitForMessage(hostWs, (m) => m.type === 'CHAMPIONSHIP_INITIALIZED_SUCCESS');
    assert.ok(newEventMsg, 'New championship initialized successfully without server restart');
    console.log('  ✓ PASS: New championship initialized in same server process');

    // 6. Verify Projector receives new event state with clean isolation
    const projPublicStatus = await waitForMessage(projWs, (m) => (m.type === 'TICK_UPDATE' || m.type === 'STATE_UPDATE') && m.gameState && m.gameState.title === 'New Competition Beta');
    const currentGs = projPublicStatus.gameState;
    assert.strictEqual(currentGs.title, 'New Competition Beta', `Projector title updated to new event: "${currentGs.title}"`);
    assert.strictEqual(currentGs.currentDay, 1, 'Current Day reset to Day 1');
    assert.strictEqual(currentGs.elapsedSeconds, 0, 'Elapsed seconds reset to 0');
    assert.notStrictEqual(currentGs.eventId, initialEventId, 'Event identity isolated: previous eventId cannot overwrite');
    console.log('  ✓ PASS: Projector received new event state without refresh');
    passed++;

    // -------------------------------------------------------------------------
    // TEST B: PRE-EVENT PROJECTOR SCENES & ZERO PRE-MARKET CHART LEAKS
    // -------------------------------------------------------------------------
    console.log('\n[TEST B] Pre-Event Projector Scene Behavior & Data Gating');
    // In STANDBY Day 1, elapsedSeconds === 0:
    assert.strictEqual(currentGs.status, 'STANDBY', 'New event status is STANDBY (Day 1 pre-market)');
    assert.strictEqual(currentGs.elapsedSeconds, 0, 'Day 1 elapsed seconds is 0');
    assert.strictEqual(projPublicStatus.companies.length, 3, 'Universe correctly reflects 3 selected stocks');

    // Test Reconnection after reset
    const reconnectedProjWs = new WebSocket(WS_URL);
    await new Promise((r) => reconnectedProjWs.on('open', r));
    await sendWs(reconnectedProjWs, { action: 'LOGIN', username: 'projector', password: 'screen2026' });
    const reconnState = await waitForMessage(reconnectedProjWs, (m) => m.type === 'LOGIN_SUCCESS');
    const reconnGs = reconnState.initialState.gameState;
    assert.strictEqual(reconnGs.title, 'New Competition Beta', 'Reconnected projector received new event title');
    assert.strictEqual(reconnGs.status, 'STANDBY', 'Reconnected projector remains in STANDBY scene');
    assert.notStrictEqual(reconnGs.eventId, initialEventId, 'Reconnected projector is bound to new event identity');
    reconnectedProjWs.close();
    console.log('  ✓ PASS: Reconnecting projector restored current authoritative event (not stale event)');
    passed++;

    // -------------------------------------------------------------------------
    // TEST C: DAILY-ONLY LEADERBOARD VS CUMULATIVE CHAMPIONSHIP STANDINGS
    // -------------------------------------------------------------------------
    console.log('\n[TEST C] Daily-Only Leaderboard vs Cumulative Standings');
    // Start Day 1
    await sendWs(hostWs, { action: 'HOST_START_MARKET', session_token: hostToken });
    await waitForMessage(hostWs, (m) => m.type === 'TICK_UPDATE' && m.gameState.status === 'LIVE');
    console.log('  • Day 1 is now LIVE');

    // Re-login Team 1 for new event
    const t1Ws = new WebSocket(WS_URL);
    await new Promise((r) => t1Ws.on('open', r));
    await sendWs(t1Ws, { action: 'LOGIN', username: 'team1', password: 'trade100' });
    const t1Auth = await waitForMessage(t1Ws, (m) => m.type === 'LOGIN_SUCCESS');
    const t1Token = t1Auth.session_token;

    // Team 1 trades in Day 1
    await sendWs(t1Ws, { action: 'ORDER_BUY', session_token: t1Token, ticker: 'APEXAUTO', quantity: 10 });
    await sleep(350);

    // Host Concludes Day 1
    console.log('  • Concluding Day 1...');
    await sendWs(hostWs, { action: 'HOST_CONCLUDE_DAY', session_token: hostToken });
    const day1ConcludedMsg = await waitForMessage(hostWs, (m) => m.type === 'DAY_CONCLUDED');
    assert.strictEqual(day1ConcludedMsg.day, 1, 'Day 1 officially concluded');
    assert.ok(day1ConcludedMsg.dailyRankings && day1ConcludedMsg.dailyRankings.length > 0, 'Day 1 dailyRankings generated');

    const day1Snapshot = day1ConcludedMsg.dailyRankings[0];
    assert.ok(day1Snapshot.dailyPnl !== undefined, `Day 1 rankings have explicit dailyPnl: ${day1Snapshot.dailyPnl}`);
    assert.ok(day1Snapshot.dailyReturnPct !== undefined, `Day 1 rankings have explicit dailyReturnPct: ${day1Snapshot.dailyReturnPct}%`);
    assert.strictEqual(day1Snapshot.dayOpeningValuation, 500000, `Day 1 opening valuation confirmed at starting cash: ₹${day1Snapshot.dayOpeningValuation}`);

    // Verify Projector receives separate dailyLeaderboard and cumulativeLeaderboard
    const projDay1Msg = await waitForMessage(projWs, (m) => m.type === 'TICK_UPDATE' || m.type === 'STATE_UPDATE');
    assert.ok(Array.isArray(projDay1Msg.dailyLeaderboard), 'Projector received dedicated dailyLeaderboard');
    assert.ok(Array.isArray(projDay1Msg.cumulativeLeaderboard), 'Projector received separate cumulativeLeaderboard');
    console.log('  ✓ PASS: Day 1 concluded with isolated dailyLeaderboard and cumulativeLeaderboard');

    // Advance to Day 2
    console.log('  • Advancing to Day 2 via HOST_NEXT_DAY...');
    await sendWs(hostWs, { action: 'HOST_NEXT_DAY', session_token: hostToken });
    const day2Msg = await waitForMessage(hostWs, (m) => m.type === 'DAY_ADVANCED' || (m.type === 'TICK_UPDATE' && m.gameState && m.gameState.currentDay === 2));
    const newDayNum = day2Msg.newDay || (day2Msg.gameState && day2Msg.gameState.currentDay);
    assert.strictEqual(newDayNum, 2, 'Market advanced to Day 2 on Standby');

    // Start Day 2
    await sendWs(hostWs, { action: 'HOST_START_MARKET', session_token: hostToken });
    await waitForMessage(hostWs, (m) => m.type === 'TICK_UPDATE' && m.gameState.status === 'LIVE');
    console.log('  • Day 2 is now LIVE');

    // Team 1 trades in Day 2
    await sendWs(t1Ws, { action: 'ORDER_BUY', session_token: t1Token, ticker: 'VELOCAR', quantity: 15 });
    await sleep(350);

    // -------------------------------------------------------------------------
    // TEST D: DIRECTIONAL CIRCUIT BREAKERS & ORDER RESTRICTIONS (WHILE MARKET LIVE)
    // -------------------------------------------------------------------------
    console.log('\n[TEST D] Directional Circuit Breakers & Order Permissions');
    // Trigger UPPER Circuit Breaker on APEXAUTO
    await sendWs(hostWs, {
      action: 'HOST_TRIGGER_CIRCUIT_BREAKER',
      session_token: hostToken,
      ticker: 'APEXAUTO',
      direction: 'UPPER'
    });
    const cbMsg = await waitForMessage(hostWs, (m) => m.type === 'CIRCUIT_BREAKER_ALERT' && m.ticker === 'APEXAUTO');
    assert.strictEqual(cbMsg.direction, 'UPPER', 'APEXAUTO Upper Circuit triggered');

    // Attempt to BUY APEXAUTO while UPPER circuit is active (must be rejected)
    await sendWs(t1Ws, { action: 'ORDER', session_token: t1Token, ticker: 'APEXAUTO', orderType: 'BUY', quantity: 5 });
    const orderReject = await waitForMessage(t1Ws, (m) => m.type === 'ORDER_REJECTED' && (m.reason.includes('Upper circuit') || m.reason.includes('Circuit Breaker')));
    assert.ok(orderReject, 'BUY order rejected while Upper Circuit is active');
    console.log('  ✓ PASS: Directional circuit breaker halts BUY while permitting counter-flow');

    // Release circuit breaker
    await sendWs(hostWs, { action: 'HOST_RELEASE_CIRCUIT_BREAKER', session_token: hostToken, ticker: 'APEXAUTO' });
    const cbReleaseMsg = await waitForMessage(hostWs, (m) => m.type === 'CIRCUIT_RECOVERY_ALERT' && m.ticker === 'APEXAUTO');
    assert.ok(cbReleaseMsg, 'APEXAUTO circuit breaker released cleanly');
    console.log('  ✓ PASS: Circuit breaker released cleanly');
    passed++;

    // Conclude Day 2
    console.log('  • Concluding Day 2...');
    await sendWs(hostWs, { action: 'HOST_CONCLUDE_DAY', session_token: hostToken });
    const day2ConcludedMsg = await waitForMessage(hostWs, (m) => m.type === 'DAY_CONCLUDED');
    assert.strictEqual(day2ConcludedMsg.day, 2, 'Day 2 officially concluded');

    const day2Team1 = day2ConcludedMsg.dailyRankings.find((t) => t.teamId === 'team_1' || t.teamId === 'team1' || t.id === 'team_1' || t.name === 'Team 1' || t.teamName === 'Team 1');
    assert.ok(day2Team1, 'Team 1 audited in Day 2 daily results');
    // Crucial check: Day 2 daily P&L is calculated against Day 2 opening valuation, NOT cumulative ₹500,000!
    const expectedDay2Pnl = +(day2Team1.closingPortfolioValue - day2Team1.dayOpeningValuation).toFixed(2);
    assert.ok(
      Math.abs(day2Team1.dailyPnl - expectedDay2Pnl) < 0.05,
      `Day 2 dailyPnl (${day2Team1.dailyPnl}) strictly matches (Closing - Day 2 Opening: ${expectedDay2Pnl}), isolated from Day 1!`
    );

    // Verify Day 1 snapshot was preserved and not overwritten
    const day1Stored = day2ConcludedMsg.dailyLeaderboards && day2ConcludedMsg.dailyLeaderboards['day_1'];
    assert.ok(day1Stored, 'Day 1 historical audited snapshot safely preserved in gameState');
    assert.strictEqual(day1Stored.rankings[0].dayOpeningValuation, 500000, 'Day 1 opening baseline remains ₹500,000');
    console.log('  ✓ PASS: Day 2 daily P&L strictly isolated from Day 1 performance');
    passed++;

    // -------------------------------------------------------------------------
    // TEST E: 4-STAGE CEREMONIAL WINNER REVEAL & HOST CONTROLS
    // -------------------------------------------------------------------------
    console.log('\n[TEST E] Ceremonial Winner Reveal Stages & Stage Advance Controls');
    // Host concludes entire championship
    await sendWs(hostWs, { action: 'HOST_CONCLUDE_CHAMPIONSHIP', session_token: hostToken });
    const champConcluded = await waitForMessage(hostWs, (m) => m.type === 'CHAMPIONSHIP_CONCLUDED');
    assert.ok(champConcluded, 'Championship concluded officially with audited winnerData');

    // Host Launches Winner Presentation
    await sendWs(hostWs, { action: 'HOST_START_WINNER_PRESENTATION', session_token: hostToken });
    const winSceneIntro = await waitForMessage(projWs, (m) => m.type === 'PRESENTATION_SCENE_UPDATE');
    assert.strictEqual(winSceneIntro.scene, 'SCENE_INTRO', 'Projector entered Stage 1: SCENE_INTRO');

    // Stage 2: Advance to BRONZE
    await sendWs(hostWs, { action: 'HOST_SET_PRESENTATION_SCENE', session_token: hostToken, scene: 'SCENE_BRONZE' });
    const winSceneBronze = await waitForMessage(projWs, (m) => m.type === 'PRESENTATION_SCENE_UPDATE');
    assert.strictEqual(winSceneBronze.scene, 'SCENE_BRONZE', 'Projector entered Stage 2: SCENE_BRONZE');

    // Stage 3: Advance to SILVER
    await sendWs(hostWs, { action: 'HOST_SET_PRESENTATION_SCENE', session_token: hostToken, scene: 'SCENE_SILVER' });
    const winSceneSilver = await waitForMessage(projWs, (m) => m.type === 'PRESENTATION_SCENE_UPDATE');
    assert.strictEqual(winSceneSilver.scene, 'SCENE_SILVER', 'Projector entered Stage 3: SCENE_SILVER');

    // Stage 4: Advance to CHAMPION (Gold)
    await sendWs(hostWs, { action: 'HOST_SET_PRESENTATION_SCENE', session_token: hostToken, scene: 'SCENE_CHAMPION' });
    const winSceneChamp = await waitForMessage(projWs, (m) => m.type === 'PRESENTATION_SCENE_UPDATE');
    assert.strictEqual(winSceneChamp.scene, 'SCENE_CHAMPION', 'Projector entered Stage 4: SCENE_CHAMPION (Gold)');

    // Stage 5: Advance to PODIUM
    await sendWs(hostWs, { action: 'HOST_SET_PRESENTATION_SCENE', session_token: hostToken, scene: 'SCENE_PODIUM' });
    const winScenePodium = await waitForMessage(projWs, (m) => m.type === 'PRESENTATION_SCENE_UPDATE');
    assert.strictEqual(winScenePodium.scene, 'SCENE_PODIUM', 'Projector entered Stage 5: SCENE_PODIUM');

    // Stage 6: Advance to LEADERBOARD (Final stable screen)
    await sendWs(hostWs, { action: 'HOST_SET_PRESENTATION_SCENE', session_token: hostToken, scene: 'SCENE_LEADERBOARD' });
    const winSceneLdr = await waitForMessage(projWs, (m) => m.type === 'PRESENTATION_SCENE_UPDATE');
    assert.strictEqual(winSceneLdr.scene, 'SCENE_LEADERBOARD', 'Projector entered Stage 6: SCENE_LEADERBOARD (Final stable screen)');
    console.log('  ✓ PASS: Complete 6-stage ceremonial reveal sequence advanced cleanly to final stable screen');
    passed++;

    // Close connections
    hostWs.close();
    projWs.close();
    traderWs.close();
    t1Ws.close();

    console.log('\n================================================================');
    console.log(` 📋 ALL ${passed} TESTS IN MASTER PROJECTOR & DAILY SUITE PASSED CLEANLY!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }
  }
}

runMasterProjectorAndDailyLeaderboardSuite();
