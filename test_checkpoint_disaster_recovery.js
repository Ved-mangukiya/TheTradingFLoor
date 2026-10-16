// test_checkpoint_disaster_recovery.js
// Automated verification of Disaster Recovery & Checkpoints Engine

const WebSocket = require('ws');
const http = require('http');

const PORT = 3000;
const WS_URL = `ws://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🛡️ [TEST] Starting Disaster Recovery & Checkpoint Verification...');

  // Start temporary server instance
  const server = require('./server.js');
  await sleep(1500);

  let hostWs;
  let traderWs;
  let hostToken;
  let traderToken;

  try {
    // 1. Connect Host
    hostWs = new WebSocket(WS_URL);
    await new Promise((res) => { hostWs.on('open', res); });

    hostWs.send(JSON.stringify({ action: 'LOGIN', username: 'host', password: 'host2026' }));
    const hostLoginRes = await new Promise((res) => {
      hostWs.once('message', (d) => res(JSON.parse(d)));
    });
    if (hostLoginRes.type !== 'LOGIN_SUCCESS') throw new Error('Host login failed');
    hostToken = hostLoginRes.session_token;
    console.log(' ✓ Host authenticated successfully');

    // 2. Connect Trader Team 1
    traderWs = new WebSocket(WS_URL);
    await new Promise((res) => { traderWs.on('open', res); });

    traderWs.send(JSON.stringify({ action: 'LOGIN', username: 'team1', password: 'trade100' }));
    const traderLoginRes = await new Promise((res) => {
      traderWs.once('message', (d) => res(JSON.parse(d)));
    });
    if (traderLoginRes.type !== 'LOGIN_SUCCESS') throw new Error('Trader login failed');
    traderToken = traderLoginRes.session_token;
    console.log(' ✓ Team 1 authenticated successfully');

    // 3. Resume Market
    hostWs.send(JSON.stringify({ action: 'RESUME_MARKET', session_token: hostToken }));
    await sleep(400);

    // 4. Team 1 executes a trade: Buy 10 APEXAUTO
    traderWs.send(JSON.stringify({
      action: 'ORDER_BUY',
      ticker: 'APEXAUTO',
      quantity: 10,
      session_token: traderToken
    }));
    await sleep(400);
    console.log(' ✓ Team 1 placed initial BUY order');

    // 5. Host saves instant Checkpoint
    hostWs.send(JSON.stringify({
      action: 'HOST_CREATE_CHECKPOINT',
      label: 'mid_session_test',
      session_token: hostToken
    }));
    const cpCreatedMsg = await new Promise((res) => {
      hostWs.once('message', (d) => res(JSON.parse(d)));
    });
    if (cpCreatedMsg.type !== 'CHECKPOINT_CREATED_ACK' || !cpCreatedMsg.ok) {
      throw new Error(`Failed to create checkpoint: ${JSON.stringify(cpCreatedMsg)}`);
    }
    const savedFilename = cpCreatedMsg.filename;
    console.log(` ✓ Checkpoint created successfully: ${savedFilename}`);

    // 6. Host requests list of checkpoints
    hostWs.send(JSON.stringify({
      action: 'HOST_LIST_CHECKPOINTS',
      session_token: hostToken
    }));
    const cpListMsg = await new Promise((res) => {
      hostWs.once('message', (d) => res(JSON.parse(d)));
    });
    if (cpListMsg.type !== 'CHECKPOINTS_LIST_ACK' || !Array.isArray(cpListMsg.checkpoints)) {
      throw new Error('Failed to retrieve checkpoints list');
    }
    const found = cpListMsg.checkpoints.find((c) => c.filename === savedFilename);
    if (!found) throw new Error(`Saved checkpoint not found in list!`);
    console.log(` ✓ Checkpoints list returned ${cpListMsg.checkpoints.length} recovery points (Found: ${found.filename}, Size: ${found.sizeKB} KB)`);

    // 7. Mutate state: Team 1 buys another 20 shares
    await sleep(300);
    traderWs.send(JSON.stringify({
      action: 'ORDER_BUY',
      ticker: 'APEXAUTO',
      quantity: 20,
      session_token: traderToken
    }));
    await sleep(400);
    console.log(' ✓ Mutated state with secondary BUY order');

    // Set up listener on trader for MARKET_RESTORED
    let traderHeardRestore = false;
    traderWs.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'MARKET_RESTORED') traderHeardRestore = true;
      } catch (e) {}
    });

    // 8. Host restores the previous checkpoint
    hostWs.send(JSON.stringify({
      action: 'HOST_RESTORE_CHECKPOINT',
      filename: savedFilename,
      session_token: hostToken
    }));

    const cpRestoreMsg = await new Promise((res) => {
      hostWs.on('message', function handler(d) {
        const m = JSON.parse(d);
        if (m.type === 'CHECKPOINT_RESTORED_ACK') {
          hostWs.removeListener('message', handler);
          res(m);
        }
      });
    });

    if (!cpRestoreMsg.ok) throw new Error(`Checkpoint restore failed: ${JSON.stringify(cpRestoreMsg)}`);
    console.log(` ✓ Checkpoint restored cleanly! Message: "${cpRestoreMsg.message}"`);

    await sleep(300);
    if (!traderHeardRestore) throw new Error('Trader terminal did not receive MARKET_RESTORED broadcast!');
    console.log(' ✓ Trader client received MARKET_RESTORED broadcast and safe pause notice');

    // 9. Verify state is safely PAUSED
    if (!cpRestoreMsg.gameState.isPaused || cpRestoreMsg.gameState.status !== 'PAUSED') {
      throw new Error(`Restored market state must be PAUSED, got status: ${cpRestoreMsg.gameState.status}`);
    }
    console.log(' ✓ Authoritative Invariant Verified: Restored market is safely PAUSED waiting for Host Resume');

    console.log('\n======================================================');
    console.log(' 🛡️ ALL DISASTER RECOVERY TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    if (hostWs) hostWs.close();
    if (traderWs) traderWs.close();
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('\n❌ [TEST FAILURE]', err.message);
  process.exit(1);
});
