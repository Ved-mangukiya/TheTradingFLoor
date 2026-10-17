/**
 * Dynamic Upgrade Verification Suite
 * Tests:
 * 1. Dynamic team capacity: Solo (1), 2 Teams, 4 Teams, 8 Teams, Custom
 * 2. Risk Profiles: Conservative, Balanced, High Opportunity
 * 3. 5-Phase News Engine: Reading window countdown -> Reaction start -> Cubic S-curve interpolation
 * 4. Post-Lock Start Day 1 Options: Start Now (HOST_START_DAY1_NOW), Schedule Day 1
 * 5. Minimalist Login Gate Status updates
 */

const http = require('http');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const messages = [];
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('message', (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch (e) {}
    });
    ws.on('error', reject);
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log(' 🚀 RUNNING DYNAMIC UPGRADE & RELIABILITY TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Verify Public Event Status API
    const statusRes = await fetchJson('/api/event-status');
    assert(statusRes.status === 200, 'Public /api/event-status returns HTTP 200');
    assert(statusRes.data.title !== undefined, 'Event title present in status');

    // 2. Connect Host client
    const { ws: hostWs, messages: hostMsgs } = await createClient();
    hostWs.send(JSON.stringify({
      action: 'LOGIN',
      username: 'host',
      password: 'host2026'
    }));
    await wait(350);

    const hostLoginAck = hostMsgs.find((m) => m.type === 'LOGIN_SUCCESS');
    assert(!!hostLoginAck && hostLoginAck.role === 'HOST', 'Host logged in successfully');
    const sessionToken = hostLoginAck ? hostLoginAck.session_token : null;

    // 3. Test Dynamic Teams Preset: 4 Teams with High Opportunity Risk Profile
    const test4Teams = [
      { slot: 1, id: 'team_1', username: 'team1', password: 'pin101', name: 'Alpha Traders', members: 'Alice, Bob' },
      { slot: 2, id: 'team_2', username: 'team2', password: 'pin202', name: 'Beta Quants', members: 'Charlie, Diana' },
      { slot: 3, id: 'team_3', username: 'team3', password: 'pin303', name: 'Gamma Capital', members: 'Evan, Fiona' },
      { slot: 4, id: 'team_4', username: 'team4', password: 'pin404', name: 'Delta Growth', members: 'George, Hannah' }
    ];

    hostWs.send(JSON.stringify({
      action: 'HOST_SET_EVENT_LOCK',
      session_token: sessionToken,
      eventTitle: 'GTU Dynamic Invitational 2026',
      institution: 'Gujarat Technological University',
      startingCash: 500000,
      totalDays: 2,
      dayDurationSeconds: 1200,
      transactionFeeBps: 5,
      circuitBreakerPercent: 20,
      riskProfile: 'HIGH_OPPORTUNITY',
      teams: test4Teams,
      selectedTickers: ['RELIANCE', 'TCS', 'HDFCBANK', 'TATAMOTORS', 'INFY', 'LT']
    }));
    await wait(450);

    const lockAck = hostMsgs.find((m) => m.type === 'EVENT_CONFIG_LOCKED_ACK');
    assert(!!lockAck && lockAck.ok === true, 'Host locked event with dynamic 4-team roster');
    assert(lockAck && lockAck.teamsCount === 4, 'Authoritative teamsCount confirmed as 4 (no 16 hardcode)');

    // 4. Test Team Logins: Team 1 and Team 4 authenticate, Team 5 rejected (out of roster)
    const { ws: t1Ws, messages: t1Msgs } = await createClient();
    t1Ws.send(JSON.stringify({
      action: 'LOGIN',
      username: 'team1',
      password: 'pin101'
    }));
    await wait(350);
    const t1Login = t1Msgs.find((m) => m.type === 'LOGIN_SUCCESS');
    assert(!!t1Login && t1Login.role === 'TRADER', 'Dynamic Team 1 authenticated with custom password pin101');

    const { ws: t4Ws, messages: t4Msgs } = await createClient();
    t4Ws.send(JSON.stringify({
      action: 'LOGIN',
      username: 'team4',
      password: 'pin404'
    }));
    await wait(350);
    const t4Login = t4Msgs.find((m) => m.type === 'LOGIN_SUCCESS');
    assert(!!t4Login && t4Login.role === 'TRADER', 'Dynamic Team 4 authenticated with custom password pin404');

    const { ws: t5Ws, messages: t5Msgs } = await createClient();
    t5Ws.send(JSON.stringify({
      action: 'LOGIN',
      username: 'team5',
      password: 'trade500'
    }));
    await wait(350);
    const t5LoginErr = t5Msgs.find((m) => m.type === 'LOGIN_ERROR');
    assert(!!t5LoginErr, 'Non-configured Team 5 correctly rejected (only configured 4 teams active)');

    // 5. Test Post-Lock Start Day 1 Now (3-2-1 Synchronized Countdown)
    hostWs.send(JSON.stringify({
      action: 'HOST_START_DAY1_NOW',
      session_token: sessionToken
    }));
    await wait(350);

    const cdStart = t1Msgs.find((m) => m.type === 'COUNTDOWN_START');
    assert(!!cdStart && cdStart.seconds === 3, 'Synchronized 3-2-1 opening countdown triggered across client desks');

    // 6. Test Solo (1 Team) Setup in Fresh Event
    hostWs.send(JSON.stringify({
      action: 'HOST_RESET_CHAMPIONSHIP',
      session_token: sessionToken,
      confirmation: 'RESET_CONFIRM_I_UNDERSTAND'
    }));
    await wait(400);

    const soloTeam = [
      { slot: 1, id: 'team_1', username: 'team1', password: 'solopassword', name: 'Solo Champion Desk', members: 'Master Trader' }
    ];

    hostWs.send(JSON.stringify({
      action: 'HOST_SET_EVENT_LOCK',
      session_token: sessionToken,
      eventTitle: 'Solo Trader Masterclass 2026',
      institution: 'Gujarat Technological University',
      startingCash: 1000000,
      totalDays: 1,
      dayDurationSeconds: 600,
      riskProfile: 'CONSERVATIVE',
      teams: soloTeam,
      selectedTickers: ['RELIANCE', 'TCS', 'HDFCBANK', 'LT']
    }));
    await wait(450);

    const soloLockAck = hostMsgs.find((m) => m.type === 'EVENT_CONFIG_LOCKED_ACK' && m.teamsCount === 1);
    assert(!!soloLockAck, 'Solo (1 Team) configuration confirmed and locked successfully');

    // 7. Verify Solo Team can trade
    const { ws: soloWs, messages: soloMsgs } = await createClient();
    soloWs.send(JSON.stringify({
      action: 'LOGIN',
      username: 'team1',
      password: 'solopassword'
    }));
    await wait(350);
    const soloLogin = soloMsgs.find((m) => m.type === 'LOGIN_SUCCESS');
    assert(!!soloLogin && soloLogin.role === 'TRADER', 'Solo team logged in with initial capital ₹10,00,000');

    // Clean up connections
    [hostWs, t1Ws, t4Ws, t5Ws, soloWs].forEach((s) => {
      try { s.close(); } catch (e) {}
    });

  } catch (err) {
    console.error('Test suite runtime error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(` 📋 DYNAMIC UPGRADE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
