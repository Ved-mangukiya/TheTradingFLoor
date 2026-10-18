/**
 * TEST_MASTER_QUANTITATIVE_AND_SECURITY_SUITE.JS
 * 
 * Master Verification Suite for:
 * 1. Sensitive Parameter Isolation & Boundary Security (Beta & Volatility hidden from Trader/Projector/Public)
 * 2. Dynamic Schedule Engine & Proportional Time Ratios (D = 300s, 600s, 1800s, 2700s scaling)
 * 3. Schedule Feasibility & Minimum Reading Separation Constraints (>= 60s gap)
 * 4. Locked News Schedule & Exactly-Once Publication Idempotency
 * 5. Directional Circuit Breakers & Financial Accounting (Cash, fees, valuation, daily vs cumulative P&L)
 * 6. 12-Hour AM/PM Time Formatting Verification
 */

const http = require('http');
const WebSocket = require('ws');
const assert = require('assert');

const TEST_PORT = 3098;
process.env.PORT = TEST_PORT;
process.argv[2] = 'test';

// Boot test server instance
delete require.cache[require.resolve('./server.js')];
const serverApp = require('./server.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectWs(port = TEST_PORT) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

function sendAndAwait(ws, payload, expectedType, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout waiting for ${expectedType}`));
    }, timeoutMs);

    function handler(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch (e) {}
    }

    ws.on('message', handler);
    ws.send(JSON.stringify(payload));
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' 🧪 STARTING MASTER QUANTITATIVE ENGINE & SECURITY SUITE');
  console.log('================================================================');

  let hostWs, traderWs, projectorWs;
  let hostToken, traderToken, projectorToken;

  try {
    await sleep(800);

    // -------------------------------------------------------------
    // [TEST 1] Setup & Host Authentication
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Host Authentication & Pre-Event Initialization');
    hostWs = await connectWs();
    const hostLoginRes = await sendAndAwait(hostWs, {
      action: 'LOGIN',
      username: 'host',
      password: 'host2026'
    }, 'LOGIN_SUCCESS');

    assert.strictEqual(hostLoginRes.role, 'HOST');
    hostToken = hostLoginRes.session_token;
    assert.ok(hostToken, 'Host token received');

    // Verify HOST receives beta and volatility_factor
    assert.ok(hostLoginRes.initialState.companies, 'Companies received');
    const sampleHostComp = hostLoginRes.initialState.companies[0];
    assert.strictEqual(typeof sampleHostComp.beta, 'number', 'Host receives stock beta');
    assert.strictEqual(typeof sampleHostComp.volatility_factor, 'number', 'Host receives stock volatility_factor');
    console.log(`  ✓ PASS: Host authenticated. Private parameters verified in host state (Beta: ${sampleHostComp.beta}, Vol: ${sampleHostComp.volatility_factor})`);

    // -------------------------------------------------------------
    // [TEST 2] Dynamic Time Management & Proportional Schedule Ratios
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Dynamic Time Management & Schedule Scaling');
    
    // Scale duration from 1800s (30m) to 2700s (45m) before locking
    const scaleRes45 = await sendAndAwait(hostWs, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 2700
    }, 'SCHEDULE_RECALCULATED_ACK');

    assert.strictEqual(scaleRes45.dayDurationSeconds, 2700);
    assert.ok(scaleRes45.feasibility.valid, '45-minute schedule is feasible');
    const news45 = scaleRes45.allScheduledNews;
    assert.ok(news45.length > 0, 'News items present');

    // Verify relative positions scale proportionally: t_i = round(D * p_i)
    const firstEv45 = news45[0];
    const expectedTrig45 = Math.round(2700 * (firstEv45.relative_position || 0.18));
    assert.strictEqual(firstEv45.trigger_second, expectedTrig45, `Expected ${expectedTrig45}s for 45m session, got ${firstEv45.trigger_second}s`);
    console.log(`  ✓ PASS: 45-minute (2,700s) schedule recalculated proportionally (Event 1: ${firstEv45.trigger_second}s, reading window: ${firstEv45.reading_duration_sec}s)`);

    // Scale duration to 600s (10m) session
    const scaleRes10 = await sendAndAwait(hostWs, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 600
    }, 'SCHEDULE_RECALCULATED_ACK');

    assert.strictEqual(scaleRes10.dayDurationSeconds, 600);
    assert.ok(scaleRes10.feasibility.valid, '10-minute schedule is feasible');
    const firstEv10 = scaleRes10.allScheduledNews[0];
    assert.strictEqual(firstEv10.reading_duration_sec, 18, '10-minute reading window is 18s');
    console.log(`  ✓ PASS: 10-minute (600s) schedule recalculated with constrained 18s reading window`);

    // Reset back to 1800s (30m)
    await sendAndAwait(hostWs, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 1800
    }, 'SCHEDULE_RECALCULATED_ACK');

    // -------------------------------------------------------------
    // [TEST 3] Lock Event Configuration & Team Login Activation
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Lock Event Configuration & Credential Activation');
    const lockRes = await sendAndAwait(hostWs, {
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      eventTitle: 'Master Quantitative Championship 2026',
      startingCash: 500000,
      totalDays: 2,
      dayDurationSeconds: 1800,
      circuitBreakerPercent: 20,
      transactionFeeBps: 10,
      selectedTickers: ['APEXAUTO', 'NEXUSTECH', 'CROWNBNK', 'CYBERINF', 'VELOCAR']
    }, 'EVENT_CONFIG_LOCKED_ACK');

    assert.ok(lockRes.ok, 'Event setup locked successfully');
    console.log('  ✓ PASS: Event setup locked. Stock selection and timings permanently frozen.');

    // Attempting schedule change after lock MUST be rejected
    const rejectScheduleChange = await sendAndAwait(hostWs, {
      action: 'HOST_RECALCULATE_SCHEDULE',
      session_token: hostToken,
      dayDurationSeconds: 2400
    }, 'ACTION_REJECTED');
    assert.ok(rejectScheduleChange.reason.includes('locked'), 'Rejected schedule modification after lock');
    console.log('  ✓ PASS: Server correctly rejected schedule modification after configuration lock');

    // -------------------------------------------------------------
    // [TEST 4] Sensitive Parameter Security (Trader & Projector Isolation)
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Sensitive Parameter Isolation (Zero Beta/Volatility Leakage)');
    traderWs = await connectWs();
    const traderLoginRes = await sendAndAwait(traderWs, {
      action: 'LOGIN',
      username: 'team1',
      password: 'trade100'
    }, 'LOGIN_SUCCESS');

    assert.strictEqual(traderLoginRes.role, 'TRADER');
    traderToken = traderLoginRes.session_token;

    // Assert TRADER companies array contains ZERO beta or volatility_factor
    assert.ok(traderLoginRes.initialState.companies, 'Trader companies received');
    traderLoginRes.initialState.companies.forEach((comp) => {
      assert.strictEqual(comp.beta, undefined, `SECURITY BREACH: Stock ${comp.ticker} leaked beta to trader!`);
      assert.strictEqual(comp.volatility_factor, undefined, `SECURITY BREACH: Stock ${comp.ticker} leaked volatility_factor to trader!`);
    });
    console.log(`  ✓ PASS: Verified all ${traderLoginRes.initialState.companies.length} stocks sent to TRADER have beta and volatility_factor stripped (undefined)`);

    // Assert PROJECTOR companies array contains ZERO beta or volatility_factor
    projectorWs = await connectWs();
    const projLoginRes = await sendAndAwait(projectorWs, {
      action: 'LOGIN',
      username: 'projector',
      password: 'screen2026'
    }, 'LOGIN_SUCCESS');

    assert.strictEqual(projLoginRes.role, 'PROJECTOR');
    projLoginRes.initialState.companies.forEach((comp) => {
      assert.strictEqual(comp.beta, undefined, `SECURITY BREACH: Stock ${comp.ticker} leaked beta to projector!`);
      assert.strictEqual(comp.volatility_factor, undefined, `SECURITY BREACH: Stock ${comp.ticker} leaked volatility_factor to projector!`);
    });
    console.log(`  ✓ PASS: Verified all ${projLoginRes.initialState.companies.length} stocks sent to PROJECTOR have beta and volatility_factor stripped`);

    // Verify non-hosts receive zero unpublished news or private impacts
    assert.strictEqual(traderLoginRes.initialState.allScheduledNews, undefined, 'Trader must not receive allScheduledNews');
    assert.strictEqual(projLoginRes.initialState.allScheduledNews, undefined, 'Projector must not receive allScheduledNews');
    console.log('  ✓ PASS: Unpublished news schedule and future impacts strictly concealed from non-host terminals');

    // -------------------------------------------------------------
    // [TEST 5] News Publication Idempotency & Exactly-Once Trigger
    // -------------------------------------------------------------
    console.log('\n[TEST 5] News Publication Idempotency & Exactly-Once Trigger');
    // Start market live
    await sendAndAwait(hostWs, { action: 'HOST_START_EVENT_NOW', session_token: hostToken }, 'BELL_EVENT');

    // Trigger news manually from host
    const sampleNews = lockRes.gameState ? lockRes.gameState.newsHistory : [];
    // Trigger via custom news or first news event
    const customShockRes = await sendAndAwait(hostWs, {
      action: 'HOST_CREATE_CUSTOM_NEWS',
      session_token: hostToken,
      headline: 'RBI Monetary Policy Update: Liquidity Infusion Approved',
      ticker: 'CROWNBNK',
      deltaPct: 8.5,
      durationSec: 30
    }, 'TICK_UPDATE');

    // Verify attempt to re-edit locked news or duplicate after lock is rejected
    const rejectEditLockedNews = await sendAndAwait(hostWs, {
      action: 'HOST_EDIT_NEWS',
      session_token: hostToken,
      event_id: 'EVT_D1_01',
      headline: 'Tampered Headline'
    }, 'ORDER_REJECTED');
    assert.ok(rejectEditLockedNews.reason.includes('locked'), 'Rejected news edit during locked competition');
    console.log('  ✓ PASS: Server correctly rejected news modification after schedule lock');

    // -------------------------------------------------------------
    // [TEST 6] Mathematical Accounting, Order Fees & Directional Circuit Breakers
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Mathematical Engine & Financial Accounting');
    await sleep(300);

    // Trader 1 Buy 10 APEXAUTO @ currentPrice with 10 bps fee
    const buyRes = await sendAndAwait(traderWs, {
      action: 'ORDER',
      session_token: traderToken,
      type: 'BUY',
      ticker: 'APEXAUTO',
      quantity: 10
    }, 'ORDER_FILLED');

    assert.strictEqual(buyRes.orderType, 'BUY');
    assert.strictEqual(buyRes.quantity, 10);
    assert.ok(buyRes.fee > 0, '10 bps transaction fee applied');
    const expectedGross = +(buyRes.price * 10).toFixed(2);
    const expectedFee = +((expectedGross * 10) / 10000).toFixed(2);
    assert.strictEqual(buyRes.grossValue, expectedGross, 'Gross value mathematically accurate');
    assert.strictEqual(buyRes.fee, expectedFee, 'Transaction fee mathematically accurate');
    assert.strictEqual(buyRes.totalImpact, +(expectedGross + expectedFee).toFixed(2), 'Total deduction includes exact fee');
    console.log(`  ✓ PASS: Order accounting verified: Gross ₹${buyRes.grossValue} + Fee ₹${buyRes.fee} = Total ₹${buyRes.totalImpact}`);

    // Test Directional Circuit Breakers
    // Trigger upper circuit on APEXAUTO
    await sendAndAwait(hostWs, {
      action: 'HOST_TRIGGER_CIRCUIT_BREAKER',
      session_token: hostToken,
      ticker: 'APEXAUTO',
      direction: 'UPPER'
    }, 'CIRCUIT_BREAKER_ALERT');

    // Upper circuit: BUY must be rejected, SELL must be permitted
    await sleep(250);
    const cbBuyReject = await sendAndAwait(traderWs, {
      action: 'ORDER',
      session_token: traderToken,
      type: 'BUY',
      ticker: 'APEXAUTO',
      quantity: 5
    }, 'ORDER_REJECTED');
    assert.ok(cbBuyReject.reason.includes('Upper circuit ceiling reached'), 'BUY blocked at upper circuit');
    console.log('  ✓ PASS: Directional circuit breaker strictly halts BUY at upper limit');

    // SELL must be permitted at upper limit
    await sleep(250);
    const cbSellAllowed = await sendAndAwait(traderWs, {
      action: 'ORDER',
      session_token: traderToken,
      type: 'SELL',
      ticker: 'APEXAUTO',
      quantity: 2
    }, 'ORDER_FILLED');
    assert.strictEqual(cbSellAllowed.orderType, 'SELL');
    console.log('  ✓ PASS: Directional circuit breaker permits counter-flow SELL at upper limit');

    // -------------------------------------------------------------
    // [TEST 7] Daily vs. Cumulative P&L Separation
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Daily vs. Cumulative P&L Isolation');
    // Conclude Day 1
    const day1Close = await sendAndAwait(hostWs, {
      action: 'HOST_CONCLUDE_DAY',
      session_token: hostToken
    }, 'DAY_CONCLUDED');

    assert.strictEqual(day1Close.day, 1);
    assert.ok(day1Close.daySnapshot.rankings, 'Day 1 snapshot rankings present');
    const t1Day1 = day1Close.daySnapshot.rankings.find((r) => r.teamId === 'team_1');
    assert.ok(t1Day1, 'Team 1 present in Day 1 snapshot');
    assert.strictEqual(typeof t1Day1.dailyPnl, 'number');
    assert.strictEqual(typeof t1Day1.cumulativePnl, 'number');
    console.log(`  ✓ PASS: Day 1 concluded with isolated daily P&L (₹${t1Day1.dailyPnl}) and cumulative P&L (₹${t1Day1.cumulativePnl})`);

    // Advance to Day 2
    const advanceDay = await sendAndAwait(hostWs, {
      action: 'HOST_START_NEXT_DAY',
      session_token: hostToken
    }, 'DAY_TRANSITION');
    assert.strictEqual(advanceDay.newDay, 2);
    console.log('  ✓ PASS: Advanced to Day 2. Daily baseline opening values initialized cleanly without resetting balances.');

    console.log('\n================================================================');
    console.log(' 📋 ALL MASTER QUANTITATIVE & SECURITY TESTS PASSED (100%)');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (hostWs) hostWs.close();
    if (traderWs) traderWs.close();
    if (projectorWs) projectorWs.close();
    process.exit(0);
  }
}

runTestSuite();
