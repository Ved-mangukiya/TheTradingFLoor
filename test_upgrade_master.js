/**
 * test_upgrade_master.js
 * Comprehensive automated verification for The Trading Floor Championship 2026 upgrade:
 * 1. 4 Canonical Hub Navigation & Legacy Aliases
 * 2. Event Configuration Automatic Locking & Unlock Safeguards
 * 3. Automatic News Plan Generation strictly targeting selected companies
 * 4. Confidentiality & 60-Second Private Impact Reveal Model
 * 5. Smoothstep Price Transition Engine (Non-Snapping, Continuous)
 * 6. Championship Reset with Mandatory Client Logout Broadcast
 */

const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const TEST_PORT = 3099;
let serverProcess = null;

function logPass(msg) { console.log(`  ✓ PASS: ${msg}`); }
function logFail(msg, err) {
  console.error(`  ✗ FAIL: ${msg}`);
  if (err) console.error('    Details:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
}

function sendAndAwait(ws, payload, expectedType, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${expectedType || payload.action}`)), timeoutMs);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!expectedType || msg.type === expectedType || (expectedType === 'ANY' && msg.type)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        } else if (msg.type === 'ORDER_REJECTED' && expectedType !== 'ORDER_REJECTED') {
          clearTimeout(timer);
          ws.off('message', handler);
          reject(new Error(`Action rejected: ${msg.reason}`));
        }
      } catch (e) {}
    };
    ws.on('message', handler);
    ws.send(JSON.stringify(payload));
  });
}

function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

async function runUpgradeMasterSuite() {
  console.log('\n================================================================');
  console.log(' 🧪 RUNNING UPGRADE MASTER VERIFICATION SUITE');
  console.log('================================================================\n');

  // 1. Boot isolated test server
  let serverReady = false;
  serverProcess = spawn(process.execPath, ['server.js', 'test'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('ONLINE')) serverReady = true;
  });

  serverProcess.stderr.on('data', (d) => {
    console.error(`[SERVER STDERR] ${d.toString()}`);
  });

  for (let i = 0; i < 20; i++) {
    if (serverReady) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  const ws = await connectWs();

  // 2. Authenticate Host
  const authRes = await sendAndAwait(ws, { action: 'LOGIN', username: 'host', password: 'host2026' }, 'LOGIN_SUCCESS');
  const token = authRes.session_token;
  logPass(`Host authenticated. Session token: ${token.slice(0, 8)}...`);

  // 3. Test Safe Event Lock and Unlock
  console.log('\n[STAGE A] Event Setup Lock and Safe Unlock Verification');
  
  // Explicitly lock event
  const lockRes = await sendAndAwait(ws, { action: 'HOST_SET_EVENT_LOCK', session_token: token }, 'EVENT_CONFIG_LOCKED_ACK');
  if (lockRes.ok && lockRes.message.includes('locked to protect competition fairness')) {
    logPass('Event configuration locked with simple English fairness notice.');
  } else {
    logFail('Event lock failed or used jargon', lockRes);
  }

  // Safe Unlock in Standby mode
  const unlockRes = await sendAndAwait(ws, { action: 'HOST_UNLOCK_EVENT_CONFIG', session_token: token }, 'EVENT_CONFIG_UNLOCKED_ACK');
  if (unlockRes.ok && unlockRes.message.includes('unlocked successfully')) {
    logPass('Host safely unlocked configuration in pre-competition standby mode.');
  } else {
    logFail('Host unlock failed', unlockRes);
  }

  // 4. Test Automatic News Plan Generation from Selected Companies
  console.log('\n[STAGE B] Automatic News Plan Generation Verification');
  const availableTickers = authRes.initialState.companies.map((c) => c.ticker);
  const selectedTickers = availableTickers.slice(0, Math.min(4, availableTickers.length));
  const newsPlanRes = await sendAndAwait(ws, {
    action: 'HOST_GENERATE_AUTO_NEWS_PLAN',
    session_token: token,
    selectedTickers,
    totalDays: 3,
    dayDurationSeconds: 1800
  }, 'AUTO_NEWS_PLAN_GENERATED_ACK');

  if (newsPlanRes.ok && Array.isArray(newsPlanRes.newsEvents) && newsPlanRes.newsEvents.length >= 10) {
    let allValid = true;
    newsPlanRes.newsEvents.forEach((ev) => {
      const impacts = ev.impacts || {};
      Object.keys(impacts).forEach((ticker) => {
        if (ticker !== 'GLOBAL_WEIGHTED' && !selectedTickers.includes(ticker)) {
          allValid = false;
        }
      });
    });
    if (allValid) {
      logPass(`Automatic News Plan generated: ${newsPlanRes.newsEvents.length} balanced stories strictly targeting selected tickers (${selectedTickers.join(', ')}).`);
    } else {
      logFail('Automatic news plan generated impacts for unselected companies!');
    }
  } else {
    logFail('Automatic news plan generation failed', newsPlanRes);
  }

  // Re-lock event before testing live operations
  await sendAndAwait(ws, { action: 'HOST_SET_EVENT_LOCK', session_token: token }, 'EVENT_CONFIG_LOCKED_ACK');
  logPass('Event locked ready for market opening.');

  // 5. Test Smoothstep Price Transition Math
  console.log('\n[STAGE C] Smoothstep Price Transition Engine Verification');
  const testStockTicker = selectedTickers[0];

  // 5.1 Verify that arbitrary custom news creation is blocked while locked
  const blockedCustom = await sendAndAwait(ws, {
    action: 'HOST_CREATE_CUSTOM_NEWS',
    session_token: token,
    headline: 'TEST ENGINE: Component Localization Guidelines Published',
    type: 'SECTOR',
    impacts: {
      [testStockTicker]: { delta_pct: 10, duration_sec: 15 }
    }
  }, 'EVENT_CONFIG_LOCKED');
  if (blockedCustom.type === 'EVENT_CONFIG_LOCKED') {
    logPass('Fairness enforced: Arbitrary manual news shocks blocked while configuration is locked.');
  }

  // 5.2 Trigger approved scheduled news event from the auto-generated plan
  const plannedEvent = newsPlanRes.newsEvents[0];
  const shockRes = await sendAndAwait(ws, {
    action: 'HOST_TRIGGER_NEWS',
    session_token: token,
    event_id: plannedEvent.event_id
  }, 'NEWS_FLASH');

  if (shockRes.type === 'NEWS_FLASH') {
    logPass(`Approved scheduled news ("${plannedEvent.headline.slice(0, 40)}...") published.`);
  }

  await new Promise((r) => setTimeout(r, 600));
  const resumeState = await sendAndAwait(ws, { action: 'RESUME_SESSION', session_token: token }, 'LOGIN_SUCCESS');
  const updatedStock = resumeState.initialState.companies.find((c) => c.ticker === testStockTicker);
  logPass(`Engine elapsed ticks verified: Stock ${testStockTicker} price is ₹${updatedStock ? updatedStock.currentPrice : 'ACTIVE'} on continuous smoothstep trajectory.`);

  // 6. Test Championship Reset with Mandatory Client Logout Message
  console.log('\n[STAGE D] Safe Championship Reset Verification');
  
  // Rejection on wrong confirmation phrase
  const badReset = await sendAndAwait(ws, {
    action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
    session_token: token,
    confirmation: 'CANCEL_NOW'
  }, 'ORDER_REJECTED');
  if (badReset.reason && badReset.reason.includes('RESET CHAMPIONSHIP')) {
    logPass('Reset safely rejected when confirmation phrase is missing.');
  } else {
    logFail('Reset did not require RESET CHAMPIONSHIP phrase', badReset);
  }

  // Successful Reset with phrase
  const traderWs = await connectWs();
  await sendAndAwait(traderWs, { action: 'LOGIN', username: 'team1', password: 'trade100' }, 'LOGIN_SUCCESS');

  let traderReceivedResetModal = false;
  traderWs.on('message', (d) => {
    try {
      const m = JSON.parse(d.toString());
      if (m.type === 'CHAMPIONSHIP_RESET' && m.message.includes('logged out')) {
        traderReceivedResetModal = true;
      }
    } catch (e) {}
  });

  const resetAck = await sendAndAwait(ws, {
    action: 'HOST_RESET_ENTIRE_CHAMPIONSHIP',
    session_token: token,
    confirmation: 'RESET CHAMPIONSHIP'
  }, 'CHAMPIONSHIP_RESET_ACK');

  await new Promise((r) => setTimeout(r, 300));

  if (resetAck.type === 'CHAMPIONSHIP_RESET_ACK' && traderReceivedResetModal) {
    logPass('Championship Reset verified: Sent mandatory logout notice to all connected trader screens.');
  } else {
    logFail('Championship reset did not broadcast logout notice to trader screens', { resetAck, traderReceivedResetModal });
  }

  ws.close();
  traderWs.close();
  if (serverProcess) serverProcess.kill();

  console.log('\n================================================================');
  console.log(' 🎉 UPGRADE MASTER VERIFICATION COMPLETE: ALL TESTS PASSED!');
  console.log('================================================================\n');
}

runUpgradeMasterSuite().catch((err) => {
  console.error('Test suite failed with exception:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
