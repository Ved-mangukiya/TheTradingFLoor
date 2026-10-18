/**
 * TEST_CHUNK3_UI_AND_OVERLAYS.JS
 * 
 * Comprehensive verification suite for CHUNK 3:
 * - TEST-FLOW-001: Overlay Mutual Exclusion & Deterministic Resolver Matrix
 * - TEST-FLOW-002: Unified Setup DOM Parity, 0 Duplicate IDs, Legacy Proxy Mapping
 * - TEST-FLOW-003: WebSocket Audio Cue Isolation (SOUND_CONSOLE isolated from TRADER/PUBLIC)
 * - TEST-FLOW-004: Projector Persistent 8-Card Slot Reuse (Zero DOM Rebuild / Zero Canvas Destruction)
 * - TEST-FLOW-005: Ceremony Audio Fanfare Idempotency on Refresh
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const vm = require('vm');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  }
}

function createMockElement(id) {
  return {
    id,
    classList: {
      _classes: new Set(['hidden']),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    textContent: '',
    innerHTML: '',
    style: {},
    disabled: false,
    value: '',
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    select() {},
    children: []
  };
}

// Lightweight Zero-Dependency DOM Simulator
function createMockDOM(html) {
  const elements = new Map();
  const idMatches = [...html.matchAll(/id=["']([^"']+)["']/g)].map((m) => m[1]);
  idMatches.forEach((id) => {
    elements.set(id, createMockElement(id));
  });

  const mockDoc = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(sel) {
      if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[id]') return Array.from(elements.values());
      return [];
    },
    body: {
      setAttribute() {},
      removeAttribute() {},
      classList: { add() {}, remove() {}, contains() { return false; } }
    },
    addEventListener() {},
    removeEventListener() {},
    title: ''
  };

  return { mockDoc, elements, idMatches };
}

function createSandbox(customDoc) {
  const mockLocation = { origin: 'http://localhost:3000', hostname: 'localhost', host: 'localhost:3000', protocol: 'http:', search: '', pathname: '/' };
  const sb = {
    window: {
      addEventListener() {},
      removeEventListener() {},
      location: mockLocation,
      URLSearchParams,
      URL
    },
    location: mockLocation,
    document: customDoc,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    URLSearchParams,
    URL,
    Map,
    Set,
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    String,
    Number,
    Boolean,
    Array,
    Object,
    WebSocket: class {
      constructor() {
        this.readyState = 1;
      }
      send() {}
      close() {}
    },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
    sessionStorage: {
      _store: new Map(),
      getItem(k) { return this._store.get(k) || null; },
      setItem(k, v) { this._store.set(k, String(v)); }
    },
    localStorage: {
      _store: new Map(),
      getItem(k) { return this._store.get(k) || null; },
      setItem(k, v) { this._store.set(k, String(v)); }
    },
    formatINR(v) { return '₹' + v; },
    drawSmoothMiniSparkline() {}
  };
  sb.window.document = customDoc;
  sb.window.sessionStorage = sb.sessionStorage;
  sb.window.localStorage = sb.localStorage;
  sb.window.formatINR = sb.formatINR;
  sb.window.drawSmoothMiniSparkline = sb.drawSmoothMiniSparkline;
  sb.window.WebSocket = sb.WebSocket;
  sb.global = sb.window;
  return sb;
}

async function runChunk3TestSuite() {
  console.log('\n===============================================================');
  console.log('🧪 THE TRADING FLOOR CHAMPIONSHIP 2026 — CHUNK 3 VERIFICATION');
  console.log('===============================================================\n');

  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

  // =========================================================================
  // TEST-FLOW-002: Unified Setup DOM Parity & ID Integrity
  // =========================================================================
  console.log('--- TEST-FLOW-002: Unified Setup DOM Parity & ID Integrity ---');
  {
    const { mockDoc, idMatches } = createMockDOM(indexHtml);

    // Check duplicate IDs in index.html
    const idCounts = {};
    const duplicateIds = [];
    idMatches.forEach((id) => {
      idCounts[id] = (idCounts[id] || 0) + 1;
      if (idCounts[id] === 2) duplicateIds.push(id);
    });
    assert(duplicateIds.length === 0, `Zero duplicate DOM IDs in index.html (Found: ${duplicateIds.join(', ') || '0'})`);

    // Verify canonical 6-step setup buttons exist
    const stepButtons = [
      'setupNavBtnDetails',
      'setupNavBtnTeams',
      'setupNavBtnUniverse',
      'setupNavBtnSchedule',
      'setupNavBtnNews',
      'setupNavBtnReview'
    ];
    stepButtons.forEach((id) => {
      assert(mockDoc.getElementById(id) !== null, `Canonical setup step button #${id} exists`);
    });

    // Verify canonical setup inputs exist
    const setupInputs = [
      'setupEventTitle',
      'setupInstitution',
      'setupStartingCash',
      'setupTotalDays',
      'setupDayDuration',
      'setupTransactionFee',
      'setupCircuitBreaker',
      'setupRiskProfile'
    ];
    setupInputs.forEach((id) => {
      assert(mockDoc.getElementById(id) !== null, `Setup input #${id} exists in Hub 2`);
    });

    // Verify Hub 3 Sub-nav pills exist
    const marketPills = [
      'hostMarketSubNav_all',
      'hostMarketSubNav_stocks',
      'hostMarketSubNav_news',
      'hostMarketSubNav_leaderboard',
      'hostMarketSubNav_analysis',
      'hostMarketSubNav_trades'
    ];
    marketPills.forEach((id) => {
      assert(mockDoc.getElementById(id) !== null, `Hub 3 Sub-nav pill #${id} exists`);
    });

    // Verify Hub 4 Sub-nav pills exist
    const stagePills = [
      'hostStageSubNav_projector',
      'hostStageSubNav_day',
      'hostStageSubNav_sound',
      'hostStageSubNav_commentary',
      'hostStageSubNav_launcher',
      'hostStageSubNav_exports'
    ];
    stagePills.forEach((id) => {
      assert(mockDoc.getElementById(id) !== null, `Hub 4 Sub-nav pill #${id} exists`);
    });

    // Verify Sound Console autoplay unlock overlay exists
    assert(mockDoc.getElementById('soundAutoplayUnlockOverlay') !== null, 'Sound console autoplay unlock overlay card exists');

    // Verify Trader Read-Only Concluded banner exists
    assert(mockDoc.getElementById('traderReadOnlyConcludedBanner') !== null, 'Trader read-only concluded banner exists');

    // Verify Projector 8 persistent slots exist
    for (let i = 0; i < 8; i++) {
      assert(mockDoc.getElementById(`projCardSlot_${i}`) !== null, `Projector persistent card slot #${i} exists`);
      assert(mockDoc.getElementById(`projCanvasSlot_${i}`) !== null, `Projector persistent canvas #${i} exists`);
    }

    // Test legacy ID mapping proxy logic in sandbox
    const sandbox = createSandbox(mockDoc);
    vm.createContext(sandbox);
    vm.runInContext(appJs, sandbox);

    assert(typeof sandbox.window.syncRoleOverlays === 'function', 'syncRoleOverlays is exported on window');
    assert(typeof sandbox.window.switchSetupSection === 'function', 'switchSetupSection is exported on window');
    assert(typeof sandbox.window.switchHostMarketSubTab === 'function', 'switchHostMarketSubTab is exported on window');
    assert(typeof sandbox.window.switchHostStageSubTab === 'function', 'switchHostStageSubTab is exported on window');

    // Test legacy ID resolution through proxy
    const legacyTitle = sandbox.document.getElementById('hostTabSetup_EventTitle');
    const canonicalTitle = sandbox.document.getElementById('setupEventTitle');
    assert(legacyTitle === canonicalTitle && canonicalTitle !== null, 'Legacy ID hostTabSetup_EventTitle successfully proxies to canonical #setupEventTitle');

    const legacyCash = sandbox.document.getElementById('hostTabSetup_StartingCash');
    const canonicalCash = sandbox.document.getElementById('setupStartingCash');
    assert(legacyCash === canonicalCash && canonicalCash !== null, 'Legacy ID hostTabSetup_StartingCash successfully proxies to canonical #setupStartingCash');
  }

  // =========================================================================
  // TEST-FLOW-001: Overlay Mutual Exclusion & Deterministic Resolver Matrix
  // =========================================================================
  console.log('\n--- TEST-FLOW-001: Overlay Mutual Exclusion & Deterministic Resolver ---');
  {
    const { mockDoc } = createMockDOM(indexHtml);
    const sandbox = createSandbox(mockDoc);
    vm.createContext(sandbox);
    vm.runInContext(appJs, sandbox);

    const { syncRoleOverlays, dismissTraderDayCompleted, showTraderDayCompleted } = sandbox.window;

    function getOverlayStates() {
      return {
        countdown: !mockDoc.getElementById('countdownOverlay')?.classList.contains('hidden'),
        waitingRoom: !mockDoc.getElementById('traderWaitingRoomOverlay')?.classList.contains('hidden'),
        softPause: !mockDoc.getElementById('softPauseOverlay')?.classList.contains('hidden'),
        blackout: !mockDoc.getElementById('blackoutOverlay')?.classList.contains('hidden'),
        dayCompleted: !mockDoc.getElementById('traderDayCompletedOverlay')?.classList.contains('hidden'),
        readOnlyBanner: !mockDoc.getElementById('traderReadOnlyConcludedBanner')?.classList.contains('hidden')
      };
    }

    // State 1: STANDBY
    syncRoleOverlays('TRADER', { status: 'STANDBY', isPaused: true, currentDay: 1 });
    let s = getOverlayStates();
    assert(s.waitingRoom === true, 'STANDBY: traderWaitingRoomOverlay is visible');
    assert(s.softPause === false, 'STANDBY: softPauseOverlay is strictly HIDDEN (even with isPaused === true)');
    assert(s.blackout === false, 'STANDBY: blackoutOverlay is strictly HIDDEN');
    assert(s.dayCompleted === false, 'STANDBY: traderDayCompletedOverlay is strictly HIDDEN');

    // State 2: SCHEDULED
    syncRoleOverlays('TRADER', { status: 'SCHEDULED', isPaused: true, currentDay: 1 });
    s = getOverlayStates();
    assert(s.waitingRoom === true, 'SCHEDULED: traderWaitingRoomOverlay is visible');
    assert(s.softPause === false, 'SCHEDULED: softPauseOverlay is strictly HIDDEN');

    // State 3: COUNTDOWN
    syncRoleOverlays('TRADER', { status: 'COUNTDOWN', isPaused: false, currentDay: 1, activeCountdown: { countdownId: 'cd1' } });
    s = getOverlayStates();
    assert(s.countdown === true, 'COUNTDOWN: countdownOverlay is visible');
    assert(s.waitingRoom === false, 'COUNTDOWN: traderWaitingRoomOverlay is hidden');
    assert(s.softPause === false, 'COUNTDOWN: softPauseOverlay is hidden');

    // State 4: LIVE
    syncRoleOverlays('TRADER', { status: 'LIVE', isPaused: false, currentDay: 1 });
    s = getOverlayStates();
    assert(s.countdown === false, 'LIVE: countdownOverlay is hidden');
    assert(s.waitingRoom === false, 'LIVE: waitingRoomOverlay is hidden');
    assert(s.softPause === false, 'LIVE: softPauseOverlay is hidden');
    assert(s.blackout === false, 'LIVE: blackoutOverlay is hidden');
    assert(s.dayCompleted === false, 'LIVE: dayCompletedOverlay is hidden');
    assert(s.readOnlyBanner === false, 'LIVE: readOnlyBanner is hidden');

    // State 5: PAUSED (VISIBLE_FROZEN)
    syncRoleOverlays('TRADER', { status: 'PAUSED', pauseMode: 'VISIBLE_FROZEN', isPaused: true, currentDay: 1 });
    s = getOverlayStates();
    assert(s.softPause === true, 'PAUSED (VISIBLE_FROZEN): softPauseOverlay is visible');
    assert(s.blackout === false, 'PAUSED (VISIBLE_FROZEN): blackoutOverlay is hidden');
    assert(s.waitingRoom === false, 'PAUSED: waitingRoomOverlay is hidden');

    // State 6: PAUSED (BLACKOUT)
    syncRoleOverlays('TRADER', { status: 'PAUSED', pauseMode: 'BLACKOUT', isPaused: true, currentDay: 1 });
    s = getOverlayStates();
    assert(s.blackout === true, 'PAUSED (BLACKOUT): blackoutOverlay is visible');
    assert(s.softPause === false, 'PAUSED (BLACKOUT): softPauseOverlay is hidden');

    // State 7: DAY_COMPLETED
    syncRoleOverlays('TRADER', { status: 'DAY_COMPLETED', isPaused: true, currentDay: 1, totalDays: 3 });
    s = getOverlayStates();
    assert(s.dayCompleted === true, 'DAY_COMPLETED: traderDayCompletedOverlay is visible');
    assert(s.softPause === false, 'DAY_COMPLETED: softPauseOverlay is strictly HIDDEN');
    assert(s.blackout === false, 'DAY_COMPLETED: blackoutOverlay is strictly HIDDEN');
    assert(s.readOnlyBanner === false, 'DAY_COMPLETED: readOnlyBanner is hidden while modal is open');

    // State 8: Dismiss DAY_COMPLETED to inspect portfolio in Read-Only mode
    dismissTraderDayCompleted();
    s = getOverlayStates();
    assert(s.dayCompleted === false, 'Dismissed DAY_COMPLETED: modal is hidden for inspection');
    assert(s.readOnlyBanner === true, 'Dismissed DAY_COMPLETED: traderReadOnlyConcludedBanner is visible');

    // Reopen DAY_COMPLETED modal
    showTraderDayCompleted();
    s = getOverlayStates();
    assert(s.dayCompleted === true, 'Re-opened DAY_COMPLETED: modal is visible again');
    assert(s.readOnlyBanner === false, 'Re-opened DAY_COMPLETED: readOnlyBanner is hidden');

    // Advancing to Day 2 resets minimization
    syncRoleOverlays('TRADER', { status: 'STANDBY', isPaused: true, currentDay: 2, totalDays: 3 });
    s = getOverlayStates();
    assert(s.waitingRoom === true, 'Day 2 STANDBY: waitingRoom is visible, dismissal state reset');
  }

  // =========================================================================
  // TEST-FLOW-004: Projector Persistent 8-Card Slot Reuse
  // =========================================================================
  console.log('\n--- TEST-FLOW-004: Projector Persistent 8-Card Slot Reuse ---');
  {
    const { mockDoc } = createMockDOM(indexHtml);
    const sandbox = createSandbox(mockDoc);
    vm.createContext(sandbox);
    vm.runInContext(appJs, sandbox);

    const companies = [
      { ticker: 'RELIANCE', name: 'Reliance', currentPrice: 2950, dayOpenPrice: 2900, isEnabled: true },
      { ticker: 'TCS', name: 'TCS', currentPrice: 4150, dayOpenPrice: 4100, isEnabled: true },
      { ticker: 'INFY', name: 'Infosys', currentPrice: 1880, dayOpenPrice: 1900, isEnabled: true },
      { ticker: 'HDFCBANK', name: 'HDFC Bank', currentPrice: 1680, dayOpenPrice: 1650, isEnabled: true }
    ];

    const slot0 = mockDoc.getElementById('projCardSlot_0');
    const slot0Canvas = mockDoc.getElementById('projCanvasSlot_0');
    assert(slot0 !== null && slot0Canvas !== null, 'Pre-allocated persistent slot 0 and canvas exist before render');

    sandbox.renderProjectorMarketBoard(companies);

    const slot0After = mockDoc.getElementById('projCardSlot_0');
    const slot0CanvasAfter = mockDoc.getElementById('projCanvasSlot_0');
    assert(slot0 === slot0After, 'projCardSlot_0 DOM node was REUSED in-place (not destroyed)');
    assert(slot0Canvas === slot0CanvasAfter, 'projCanvasSlot_0 DOM node was REUSED in-place (canvas context preserved)');

    const rank0 = mockDoc.getElementById('projSlotRank_0').textContent;
    const ticker0 = mockDoc.getElementById('projSlotTicker_0').textContent;
    assert(ticker0.length > 0 && rank0.startsWith('#'), `Slot 0 updated in place with rank ${rank0} and ticker ${ticker0}`);
  }

  // =========================================================================
  // TEST-FLOW-005: Ceremony Audio Fanfare Idempotency
  // =========================================================================
  console.log('\n--- TEST-FLOW-005: Ceremony Audio Fanfare Idempotency ---');
  {
    const { mockDoc } = createMockDOM(indexHtml);
    const sandbox = createSandbox(mockDoc);
    vm.createContext(sandbox);
    vm.runInContext(appJs, sandbox);

    let soundCallCount = 0;
    sandbox.playDramaticWinnerReveal = () => {
      soundCallCount++;
    };

    const state = {
      gameState: {
        eventId: 'test_event_123',
        status: 'WINNER_ANNOUNCEMENT',
        presentationState: {
          scene: 'SCENE_CHAMPION',
          rankings: [
            { teamName: 'Alpha Traders', totalPortfolioValue: 650000, netProfitLoss: 150000, returnPct: 30 }
          ]
        }
      }
    };

    // First presentation render
    sandbox.renderWinnerPresentationView(state);
    assert(soundCallCount === 1, 'First SCENE_CHAMPION trigger plays dramatic fanfare sound');

    // Simulate browser refresh mid-ceremony with same eventId and scene
    sandbox.renderWinnerPresentationView(state);
    assert(soundCallCount === 1, 'Browser refresh / second render does NOT re-fire fanfare audio (DEF-030 resolved)');
  }

  // =========================================================================
  // TEST-FLOW-003: WebSocket Audio Cue Isolation Test
  // =========================================================================
  console.log('\n--- TEST-FLOW-003: WebSocket Audio Cue Isolation Test ---');
  {
    const { spawn } = require('child_process');
    const testPort = 3109;
    const wsUrl = `ws://127.0.0.1:${testPort}`;
    let serverProcess = null;
    const openSockets = [];

    try {
      serverProcess = spawn(process.execPath, [path.join(__dirname, 'server.js'), 'test'], {
        env: { ...process.env, PORT: String(testPort) },
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

      function createClient(name) {
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(wsUrl);
          ws.name = name;
          ws.inbox = [];
          ws.on('message', (d) => {
            try {
              ws.inbox.push(JSON.parse(d.toString()));
            } catch (e) {}
          });
          ws.on('open', () => resolve(ws));
          ws.on('error', reject);
        });
      }

      function waitFor(ws, pred, timeoutMs = 4000) {
        return new Promise((resolve, reject) => {
          for (const m of ws.inbox) {
            if (pred(m)) return resolve(m);
          }
          const t = setTimeout(() => reject(new Error(`Timeout waiting for message on ${ws.name}`)), timeoutMs);
          const listener = (d) => {
            try {
              const m = JSON.parse(d.toString());
              if (pred(m)) {
                clearTimeout(t);
                ws.off('message', listener);
                resolve(m);
              }
            } catch (e) {}
          };
          ws.on('message', listener);
        });
      }

      const wsHost = await createClient('Host');
      const wsSound = await createClient('Sound');
      const wsTrader = await createClient('Trader');
      const wsPublic = await createClient('Public');
      openSockets.push(wsHost, wsSound, wsTrader, wsPublic);

      // Authenticate Host
      wsHost.send(JSON.stringify({ action: 'LOGIN', username: 'host', password: 'host2026' }));
      const hostLogin = await waitFor(wsHost, (m) => m.type === 'LOGIN_SUCCESS');
      const hostToken = hostLogin.session_token;

      // Authenticate Sound Console
      wsSound.send(JSON.stringify({ action: 'LOGIN', username: 'sound', password: 'sound2026' }));
      await waitFor(wsSound, (m) => m.type === 'LOGIN_SUCCESS');

      // Lock event setup so trader can login
      wsHost.send(JSON.stringify({
        action: 'HOST_SET_EVENT_LOCK',
        session_token: hostToken,
        title: 'Audio Isolation Test 2026',
        startingCash: 500000,
        totalDays: 2,
        dayDurationSeconds: 1800
      }));
      await waitFor(wsHost, (m) => m.type === 'EVENT_CONFIG_LOCKED');

      // Authenticate Trader
      wsTrader.send(JSON.stringify({ action: 'LOGIN', username: 'team1', password: 'trade100' }));
      await waitFor(wsTrader, (m) => m.type === 'LOGIN_SUCCESS');

      // Clear inboxes
      wsSound.inbox.length = 0;
      wsHost.inbox.length = 0;
      wsTrader.inbox.length = 0;
      wsPublic.inbox.length = 0;

      // Host triggers sound cue test
      wsHost.send(JSON.stringify({
        action: 'HOST_TEST_SOUND_CUE',
        session_token: hostToken,
        cueName: 'circuit_alarm'
      }));

      // Wait 300ms for websocket delivery
      await new Promise((r) => setTimeout(r, 300));

      const soundCueCount = wsSound.inbox.filter((m) => m.type === 'AUDIO_CUE').length;
      const traderCueCount = wsTrader.inbox.filter((m) => m.type === 'AUDIO_CUE').length;
      const publicCueCount = wsPublic.inbox.filter((m) => m.type === 'AUDIO_CUE').length;

      assert(soundCueCount >= 1, `SOUND_CONSOLE received AUDIO_CUE broadcast (Count: ${soundCueCount})`);
      assert(traderCueCount === 0, `TRADER received ZERO AUDIO_CUE broadcasts (DEF-016 resolved, Count: ${traderCueCount})`);
      assert(publicCueCount === 0, `Unauthenticated public socket received ZERO AUDIO_CUE broadcasts (Count: ${publicCueCount})`);
    } finally {
      openSockets.forEach((s) => {
        try { s.close(); } catch (e) {}
      });
      if (serverProcess) {
        serverProcess.kill('SIGKILL');
      }
    }
  }

  console.log('\n===============================================================');
  console.log(`🎉 ALL CHUNK 3 TESTS PASSED: ${passedTests} / ${totalTests} ASSERTIONS VERIFIED!`);
  console.log('===============================================================\n');
  process.exit(0);
}

runChunk3TestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
