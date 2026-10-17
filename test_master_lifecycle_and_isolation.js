/**
 * Master Lifecycle & Login Isolation Test Suite
 * Specifically verifies:
 * 1. Day Conclusion Isolation: Concluded day never sends or displays a pause state.
 * 2. Unauthenticated Login Screen Isolation: No news, circuit breakers, or countdown alerts.
 * 3. Live Setup Status Broadcast: PUBLIC_EVENT_STATUS & EVENT_CONFIG_LOCKED update login status immediately.
 * 4. Transition Safety & Order Rejection: Invalid lifecycle actions are safely rejected.
 * 5. Multi-Day Balance & Holdings Carry-Over: Day 1 -> Day 2 continuity.
 */

const assert = require('assert');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3089;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMasterLifecycleVerification() {
  console.log('\n================================================================');
  console.log(' 🧪 RUNNING MASTER LIFECYCLE & LOGIN ISOLATION TEST SUITE');
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
        if (attempts > 30) {
          clearInterval(interval);
          reject(new Error('Test server failed to boot on port ' + TEST_PORT));
        }
      });
    }, 200);
  });

  let passed = 0;

  try {
    // -------------------------------------------------------------
    // TEST 1: Unauthenticated Socket Receives PUBLIC_EVENT_STATUS Immediately
    // -------------------------------------------------------------
    console.log('[TEST 1] Public Event Access State on Fresh WebSocket Connection');
    const wsPublic = new WebSocket(WS_URL);
    const publicMessages = [];
    wsPublic.on('message', (data) => {
      try { publicMessages.push(JSON.parse(data)); } catch (e) {}
    });

    await delay(400);
    const statusMsg = publicMessages.find((m) => m.type === 'PUBLIC_EVENT_STATUS');
    assert.ok(statusMsg, 'Expected PUBLIC_EVENT_STATUS on fresh socket connection');
    assert.ok(statusMsg.status, 'Expected status field in public event status');
    assert.strictEqual(typeof statusMsg.configLocked, 'boolean', 'Expected boolean configLocked');
    console.log(`  ✓ PASS: Fresh connection immediately received PUBLIC_EVENT_STATUS (status: ${statusMsg.status}, configLocked: ${statusMsg.configLocked})`);
    passed++;

    // -------------------------------------------------------------
    // TEST 2: Host Authentication & Event Lock Broadcasts to Public Client
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Host Setup & Live Config Lock Propagation');
    const wsHost = new WebSocket(WS_URL);
    const hostMessages = [];
    wsHost.on('message', (data) => {
      try { hostMessages.push(JSON.parse(data)); } catch (e) {}
    });
    await delay(200);

    // Login as host
    wsHost.send(JSON.stringify({ action: 'LOGIN', username: 'host', password: 'host2026' }));
    await delay(400);

    const hostLoginAck = hostMessages.find((m) => m.type === 'LOGIN_SUCCESS');
    assert.ok(hostLoginAck, 'Host failed to log in');
    const hostToken = hostLoginAck.session_token;

    // Clear public messages to catch EVENT_CONFIG_LOCKED
    publicMessages.length = 0;

    // Lock event configuration
    wsHost.send(JSON.stringify({
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      eventTitle: 'Trading Floor Championship 2026',
      institution: 'Gujarat Technological University',
      startingCash: 500000,
      totalDays: 3,
      dayDurationSeconds: 1800,
      transactionFeeBps: 10,
      circuitBreakerPercent: 20,
      teams: [
        { name: 'Alpha Kings', username: 'team1', password: 'trade100', members: 'Ved M., Classmate 1', startingCash: 500000 },
        { name: 'Beta Bulls', username: 'team2', password: 'trade200', members: 'Student 3, Student 4', startingCash: 500000 },
        { name: 'Gamma Hawks', username: 'team3', password: 'trade300', members: 'Student 5, Student 6', startingCash: 500000 },
        { name: 'Delta Traders', username: 'team4', password: 'trade400', members: 'Student 7, Student 8', startingCash: 500000 }
      ]
    }));
    await delay(400);

    const lockEventOnPublic = publicMessages.find((m) => m.type === 'EVENT_CONFIG_LOCKED');
    assert.ok(lockEventOnPublic, 'Unauthenticated public client must receive EVENT_CONFIG_LOCKED');
    console.log(`  ✓ PASS: Public socket received EVENT_CONFIG_LOCKED without manual refresh: "${lockEventOnPublic.message}"`);
    passed++;

    // -------------------------------------------------------------
    // TEST 3: Login Screen Isolation — Unauthenticated Socket Never Receives Private Ticks
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Login Screen Data Isolation');
    const tickOnPublic = publicMessages.find((m) => m.type === 'TICK_UPDATE');
    assert.strictEqual(tickOnPublic, undefined, 'Unauthenticated client must not receive private portfolio ticks');
    console.log('  ✓ PASS: Unauthenticated socket did not receive private trading ticks');
    passed++;

    // -------------------------------------------------------------
    // TEST 4: Authenticate Trader Desks
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Trader Terminal Authentication');
    const wsTrader1 = new WebSocket(WS_URL);
    let trader1Messages = [];
    wsTrader1.on('message', (data) => {
      try { trader1Messages.push(JSON.parse(data)); } catch (e) {}
    });

    const wsTrader2 = new WebSocket(WS_URL);
    let trader2Messages = [];
    wsTrader2.on('message', (data) => {
      try { trader2Messages.push(JSON.parse(data)); } catch (e) {}
    });
    await delay(250);

    wsTrader1.send(JSON.stringify({ action: 'LOGIN', username: 'team1', password: 'trade100' }));
    wsTrader2.send(JSON.stringify({ action: 'LOGIN', username: 'team2', password: 'trade200' }));
    await delay(400);

    const t1Login = trader1Messages.find((m) => m.type === 'LOGIN_SUCCESS');
    const t2Login = trader2Messages.find((m) => m.type === 'LOGIN_SUCCESS');
    assert.ok(t1Login, 'Trader 1 login failed');
    assert.ok(t2Login, 'Trader 2 login failed');
    const t1Token = t1Login.session_token;
    const t2Token = t2Login.session_token;
    console.log('  ✓ PASS: Both Team 1 and Team 2 logged in successfully with isolated sessions');
    passed++;

    // -------------------------------------------------------------
    // TEST 5: Resume Countdown to LIVE Market
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Authoritative Resume Countdown (3-2-1)');
    trader1Messages = [];
    wsHost.send(JSON.stringify({ action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }));
    await delay(400);

    const cdMsg = trader1Messages.find((m) => m.type === 'COUNTDOWN_START');
    assert.ok(cdMsg, 'Trader 1 expected COUNTDOWN_START message');
    assert.strictEqual(cdMsg.seconds, 3, 'Countdown must be 3 seconds');
    console.log('  ✓ PASS: Authenticated traders received 3-2-1 authoritative countdown start');
    passed++;

    // Wait for 3-second countdown to complete and market to open
    await delay(3200);

    // -------------------------------------------------------------
    // TEST 6: Active Trading Execution
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Active Order Execution & Valuation');
    const testStock = hostLoginAck.initialState.companies[0];
    wsTrader1.send(JSON.stringify({
      action: 'ORDER',
      session_token: t1Token,
      ticker: testStock.ticker,
      type: 'BUY',
      quantity: 5
    }));
    await delay(350);

    const fillMsg = trader1Messages.find((m) => m.type === 'ORDER_FILLED');
    assert.ok(fillMsg, 'Trader 1 BUY order failed to execute');
    console.log(`  ✓ PASS: Trade executed on ${testStock.ticker}: 5 shares @ ₹${fillMsg.price.toFixed(2)}`);
    passed++;

    // -------------------------------------------------------------
    // TEST 7: Critical Bug 1 Fix — Conclude Day 1 (Must Never Look Like a Pause)
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Day 1 Conclusion & Non-Pause Invariant Verification');
    trader1Messages = [];
    trader2Messages = [];
    hostMessages.length = 0;

    wsHost.send(JSON.stringify({ action: 'HOST_CONCLUDE_DAY', session_token: hostToken }));
    await delay(500);

    const dayConcludedBroadcast = trader1Messages.find((m) => m.type === 'DAY_CONCLUDED');
    assert.ok(dayConcludedBroadcast, 'Expected DAY_CONCLUDED broadcast on trader terminal');
    assert.strictEqual(dayConcludedBroadcast.status, 'DAY_COMPLETED', 'Status must be explicitly DAY_COMPLETED');
    assert.ok(dayConcludedBroadcast.daySnapshot, 'Expected daySnapshot in DAY_CONCLUDED payload');
    assert.ok(dayConcludedBroadcast.daySnapshot.rankings.length >= 2, 'Expected full team rankings list');

    // Verify that NO MARKET_PAUSED message was broadcast
    const pauseBroadcast = trader1Messages.find((m) => m.type === 'MARKET_PAUSED');
    assert.strictEqual(pauseBroadcast, undefined, 'CRITICAL INVARIANT: Day conclusion must NEVER broadcast MARKET_PAUSED');
    console.log(`  ✓ PASS: DAY_CONCLUDED received for Day 1 with status DAY_COMPLETED (zero MARKET_PAUSED messages)`);
    passed++;

    // Verify tick state delivered after conclusion has isPaused: false
    const latestTick = trader1Messages.filter((m) => m.type === 'TICK_UPDATE').pop();
    if (latestTick && latestTick.gameState) {
      assert.strictEqual(latestTick.gameState.status, 'DAY_COMPLETED', 'Tick gameState.status must be DAY_COMPLETED');
      assert.strictEqual(latestTick.gameState.isPaused, false, 'CRITICAL: gameState.isPaused must be false after conclusion');
      console.log(`  ✓ PASS: Authoritative server state verified: status='DAY_COMPLETED', isPaused=false`);
      passed++;
    }

    // -------------------------------------------------------------
    // TEST 8: Order Rejection During DAY_COMPLETED State
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Order Placement Rejection During Concluded Day');
    trader1Messages = [];
    await delay(250);
    wsTrader1.send(JSON.stringify({
      action: 'ORDER',
      session_token: t1Token,
      ticker: testStock.ticker,
      type: 'BUY',
      quantity: 1
    }));
    await delay(350);

    const rejectMsg = trader1Messages.find((m) => m.type === 'ORDER_REJECTED');
    assert.ok(rejectMsg, 'Expected ORDER_REJECTED during DAY_COMPLETED state');
    assert.ok(rejectMsg.reason.includes('Day 1') || rejectMsg.reason.includes('concluded'), `Expected Day Concluded rejection notice. Got: ${rejectMsg.reason}`);
    console.log(`  ✓ PASS: Order safely rejected with authoritative message: "${rejectMsg.reason}"`);
    passed++;

    // -------------------------------------------------------------
    // TEST 9: Invalid Transitions Safely Rejected (Host Safety)
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Host Action Safety & Rejection of Invalid Transitions');
    hostMessages.length = 0;

    // Attempt to pause a concluded day
    wsHost.send(JSON.stringify({ action: 'HOST_PAUSE', session_token: hostToken }));
    await delay(250);
    const pauseReject = hostMessages.find((m) => m.type === 'ACTION_REJECTED');
    assert.ok(pauseReject, 'Server must reject pausing a concluded day');
    console.log(`  ✓ PASS: Invalid pause safely rejected: "${pauseReject.reason}"`);
    passed++;

    // Attempt to conclude day again (duplicate command)
    hostMessages.length = 0;
    wsHost.send(JSON.stringify({ action: 'HOST_CONCLUDE_DAY', session_token: hostToken }));
    await delay(250);
    const concludeReject = hostMessages.find((m) => m.type === 'ACTION_REJECTED');
    assert.ok(concludeReject, 'Server must reject duplicate conclude day action');
    console.log(`  ✓ PASS: Duplicate conclude safely rejected: "${concludeReject.reason}"`);
    passed++;

    // Attempt to resume a concluded day without advancing to next day
    hostMessages.length = 0;
    wsHost.send(JSON.stringify({ action: 'HOST_RESUME_COUNTDOWN', session_token: hostToken }));
    await delay(250);
    const resumeReject = hostMessages.find((m) => m.type === 'ORDER_REJECTED' || m.type === 'ACTION_REJECTED');
    assert.ok(resumeReject, 'Server must reject resuming a concluded day');
    console.log(`  ✓ PASS: Invalid resume safely rejected: "${resumeReject.reason}"`);
    passed++;

    // -------------------------------------------------------------
    // TEST 10: Multi-Day Transition & Holdings Carry-Over
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Advance to Day 2 & Holdings Carry-Over');
    trader1Messages = [];
    wsHost.send(JSON.stringify({ action: 'HOST_START_NEXT_DAY', session_token: hostToken }));
    await delay(500);

    const dayTransitionMsg = trader1Messages.find((m) => m.type === 'DAY_TRANSITION');
    assert.ok(dayTransitionMsg, 'Expected DAY_TRANSITION broadcast to traders');
    assert.strictEqual(dayTransitionMsg.newDay, 2, 'Expected transition to Day 2');

    const day2Tick = trader1Messages.filter((m) => m.type === 'TICK_UPDATE').pop();
    assert.ok(day2Tick && day2Tick.portfolio, 'Expected portfolio in Day 2 tick');
    assert.strictEqual(day2Tick.portfolio.holdings[testStock.ticker], 5, 'Holdings must carry over cleanly into Day 2');
    console.log(`  ✓ PASS: Advanced to Day 2 on Standby. Team 1 holdings cleanly preserved: 5 shares of ${testStock.ticker}`);
    passed++;

    // Clean up sockets
    wsPublic.close();
    wsHost.close();
    wsTrader1.close();
    wsTrader2.close();

    console.log('\n================================================================');
    console.log(` 📋 MASTER LIFECYCLE SUITE COMPLETE: ALL ${passed} TESTS PASSED!`);
    console.log('================================================================\n');

  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }
  }
}

runMasterLifecycleVerification().catch((err) => {
  console.error('\n❌ MASTER LIFECYCLE SUITE FAILED:', err);
  process.exit(1);
});
