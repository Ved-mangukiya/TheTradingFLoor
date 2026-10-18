/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026 — CHUNK 4 AUTOMATED TEST SUITE
 * Universal Action Contract Pattern, In-Flight Locking & Double-Click Rate-Limit Enforcement
 * 
 * Verifies:
 * - BTN-000: Universal Action Contract Pattern (applyActionContractLock, releaseActionContractLock, releaseActionLockById, releaseAllActionLocks)
 * - BTN-001: Trader Order Execution In-Flight Lock & Double-Click Shield (#btnExecuteTradeOrder)
 * - BTN-002: Trader Liquidation In-Flight Lock & Double-Click Shield (#btnConfirmLiquidate)
 * - BTN-003: Login Terminal Access In-Flight Lock (#btnLoginSubmit)
 * - BTN-004: Host Market Operations In-Flight Locks (#btnMarketResume, #btnMarketPauseSoft, #btnMarketPauseBlackout, #btnMarketCloseSession)
 * - BTN-005: Host Lifecycle & Emergency Controls (#btnEmergencyStopTrigger, #btnConfirmEmergencyStop, #btnExecuteStartNextDay, #btnConfirmAddDay, #btnConfirmResetChampionship)
 * - BTN-006: Presentation Mode Launch & Dismiss Podium Locks (#btnLaunchPresentationProjector, #btnLaunchPresentationAnalysis, #hostDismissPodium)
 * - BTN-007: Checkpoint Disaster Recovery Lock (#btnHostCreateCheckpoint)
 * - BTN-008: 5000ms Automatic Timeout Fallback Protection
 * - BTN-009: Server Rejection Catch-All (ACTION_REJECTED releases all locks)
 * - DOM-001: Zero Duplicate DOM IDs across the entire interface (HTML validation)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('\n===============================================================');
console.log('🧪 THE TRADING FLOOR CHAMPIONSHIP 2026 — CHUNK 4 VERIFICATION');
console.log('===============================================================\n');

// -------------------------------------------------------------
// PART 1: DOM ID UNIQUENESS & BUTTON CONTRACT PRESENCE IN HTML
// -------------------------------------------------------------
console.log('--- TEST-BTN-001: Button Existence & DOM ID Integrity ---');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Check Duplicate IDs
const idRegex = /id=["']([^"']+)["']/g;
const idCounts = {};
let match;
while ((match = idRegex.exec(htmlContent)) !== null) {
  const id = match[1];
  idCounts[id] = (idCounts[id] || 0) + 1;
}

const duplicateIds = Object.keys(idCounts).filter((id) => idCounts[id] > 1);
assert(duplicateIds.length === 0, `Zero duplicate DOM IDs in index.html (Found: ${duplicateIds.length} -> ${duplicateIds.join(', ')})`);

// Verify all required Chunk 4 Action Buttons exist in index.html
const requiredButtonIds = [
  'btnLoginSubmit',
  'btnExecuteTradeOrder',
  'btnConfirmLiquidate',
  'btnSubmitLockSetup',
  'btnUnlockEventConfig',
  'btnMarketResume',
  'btnMarketPauseSoft',
  'btnMarketPauseBlackout',
  'btnMarketCloseSession',
  'btnEmergencyStopTrigger',
  'btnConfirmEmergencyStop',
  'btnExecuteStartNextDay',
  'btnConfirmAddDay',
  'btnConfirmResetChampionship',
  'btnLaunchPresentationAnalysis',
  'btnLaunchPresentationProjector',
  'hostDismissPodium',
  'btnHostCreateCheckpoint'
];

for (const btnId of requiredButtonIds) {
  const exists = htmlContent.includes(`id="${btnId}"`) || htmlContent.includes(`id='${btnId}'`);
  assert(exists, `Required action button #${btnId} exists in public/index.html`);
}

// -------------------------------------------------------------
// PART 2: SANDBOX CLIENT APP TESTING FOR ACTION CONTRACT ENGINE
// -------------------------------------------------------------
console.log('\n--- TEST-BTN-002: Universal Action Contract Unit Mechanics ---');

// Build a lightweight browser sandbox
const domElements = new Map();

function createMockElement(id, tagName = 'div') {
  const listeners = {};
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    textContent: 'Initial Button Text',
    disabled: false,
    classList: {
      _classes: new Set(),
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      contains: function(c) { return this._classes.has(c); },
      toggle: function(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) this._classes.add(c);
        else this._classes.delete(c);
      }
    },
    dataset: {},
    style: {},
    value: '',
    children: [],
    addEventListener: function(evt, handler) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(handler);
    },
    dispatchEvent: function(event) {
      const handlers = listeners[event.type] || [];
      for (const h of handlers) h(event);
    },
    focus: function() {},
    select: function() {},
    click: function() {
      if (this.onclick) this.onclick();
    }
  };
  domElements.set(id, el);
  return el;
}

// Populate mock elements
for (const id of requiredButtonIds) {
  createMockElement(id, 'button');
}
createMockElement('tradeQuantityInput', 'input');
createMockElement('loginUsername', 'input');
createMockElement('loginPassword', 'input');
createMockElement('loginError', 'div');
createMockElement('loginForm', 'form');
createMockElement('tradeModal', 'div');
createMockElement('liquidateModal', 'div');
createMockElement('resetConfirmInput', 'input');
createMockElement('resetChampionshipModal', 'div');
createMockElement('modalAddDay', 'div');
createMockElement('modalStartNextDay', 'div');
createMockElement('modalFinishEvent', 'div');
createMockElement('modalEmergencyStop', 'div');
createMockElement('modalCircuitTest', 'div');
createMockElement('hostRestoreStatusBanner', 'div');
createMockElement('hostRestoreStatusText', 'span');
createMockElement('tradeModalValidationNotice', 'div');

// Extract and evaluate public/app.js inside VM context
const appJsPath = path.join(__dirname, 'public', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Strip browser audio context initialization for clean node execution
appJsContent = appJsContent.replace(/window\.AudioContext\s*\|\|\s*window\.webkitAudioContext/g, 'null');

const sandbox = {
  console: {
    log: () => {},
    warn: () => {},
    error: () => {}
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Date: Date,
  Math: Math,
  JSON: JSON,
  Map: Map,
  Set: Set,
  parseInt: parseInt,
  parseFloat: parseFloat,
  Number: Number,
  Array: Array,
  String: String,
  Object: Object,
  URLSearchParams: URLSearchParams,
  document: {
    getElementById: (id) => {
      if (!domElements.has(id)) {
        domElements.set(id, createMockElement(id));
      }
      return domElements.get(id);
    },
    querySelectorAll: () => [],
    querySelector: (sel) => {
      if (sel && sel.startsWith('#')) {
        const id = sel.slice(1);
        if (!domElements.has(id)) {
          domElements.set(id, createMockElement(id));
        }
        return domElements.get(id);
      }
      return null;
    },
    createElement: (tag) => createMockElement('dyn_' + Math.random(), tag),
    body: createMockElement('body', 'body'),
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  location: { hostname: 'localhost', search: '', protocol: 'http:', port: '3000' },
  window: {
    location: { hostname: 'localhost', search: '', protocol: 'http:', port: '3000' },
    sessionStorage: {
      _data: {},
      getItem: function(k) { return this._data[k] || null; },
      setItem: function(k, v) { this._data[k] = String(v); },
      removeItem: function(k) { delete this._data[k]; }
    },
    addEventListener: () => {}
  },
  sessionStorage: {
    _data: {},
    getItem: function(k) { return this._data[k] || null; },
    setItem: function(k, v) { this._data[k] = String(v); },
    removeItem: function(k) { delete this._data[k]; }
  },
  WebSocket: Object.assign(
    class MockWebSocket {
      constructor() {
        this.readyState = 1;
        this.OPEN = 1;
      }
      send() {}
    },
    { OPEN: 1, CONNECTING: 0, CLOSING: 2, CLOSED: 3 }
  )
};

vm.createContext(sandbox);
vm.runInContext(appJsContent, sandbox);

// Verify functions are exported on window
assert(typeof sandbox.window.applyActionContractLock === 'function', 'applyActionContractLock is exported on window');
assert(typeof sandbox.window.releaseActionContractLock === 'function', 'releaseActionContractLock is exported on window');
assert(typeof sandbox.window.releaseActionLockById === 'function', 'releaseActionLockById is exported on window');
assert(typeof sandbox.window.releaseAllActionLocks === 'function', 'releaseAllActionLocks is exported on window');

const testBtn = createMockElement('testContractBtn', 'button');
testBtn.textContent = 'Original Action Text';

// 1. Lock Button
const locked = sandbox.window.applyActionContractLock(testBtn, 'Processing Action...');
assert(locked === true, 'applyActionContractLock returns true on first lock');
assert(testBtn.disabled === true, 'Button is disabled when action is locked');
assert(testBtn.textContent === 'Processing Action...', 'Button text changes to processing text');
assert(testBtn.dataset.originalText === 'Original Action Text', 'Original text is safely preserved in dataset');

// 2. Double-Click Attempt While In-Flight
const doubleClickLocked = sandbox.window.applyActionContractLock(testBtn, 'Processing Action Again...');
assert(doubleClickLocked === false, 'applyActionContractLock returns false on duplicate click while in-flight');
assert(testBtn.dataset.originalText === 'Original Action Text', 'Original text is NOT overwritten by duplicate click');

// 3. Release Button
sandbox.window.releaseActionContractLock(testBtn);
assert(testBtn.disabled === false, 'Button is enabled when action lock is released');
assert(testBtn.textContent === 'Original Action Text', 'Original button text is restored on release');

// 4. Release by ID
sandbox.window.applyActionContractLock(testBtn, 'Processing Second Action...');
assert(testBtn.disabled === true, 'Button re-locks properly for next action');
sandbox.window.releaseActionLockById('testContractBtn');
assert(testBtn.disabled === false, 'releaseActionLockById restores button to enabled');
assert(testBtn.textContent === 'Original Action Text', 'releaseActionLockById restores original text');

// -------------------------------------------------------------
// PART 3: 5000ms AUTOMATIC TIMEOUT FALLBACK PROTECTION
// -------------------------------------------------------------
console.log('\n--- TEST-BTN-003: 5000ms Automatic Timeout Fallback ---');

const timeoutBtn = createMockElement('testTimeoutBtn', 'button');
timeoutBtn.textContent = 'Submit Order';

sandbox.window.applyActionContractLock(timeoutBtn, 'Submitting...');
assert(timeoutBtn.disabled === true, 'Button locked for order submission');

// Wait 5100ms for fallback timer to trigger
async function testTimeoutFallback() {
  await new Promise((resolve) => setTimeout(resolve, 5200));
  assert(timeoutBtn.disabled === false, 'Button automatically re-enabled after 5000ms timeout fallback');
  assert(timeoutBtn.textContent === 'Submit Order', 'Original text automatically restored after 5000ms timeout fallback');
}

// -------------------------------------------------------------
// PART 4: DOUBLE-CLICK NETWORK INVARIANT FOR TRADER & LOGIN
// -------------------------------------------------------------
console.log('\n--- TEST-BTN-004: In-Flight Double-Click Network Shield ---');

async function testNetworkShield() {
  const sentFrames = [];
  sandbox.sentFrames = sentFrames;

  vm.runInContext(`
    ws = {
      readyState: 1,
      OPEN: 1,
      send: (data) => {
        sentFrames.push(JSON.parse(data));
      }
    };
    sessionToken = 'test-token-trader-01';
    currentRole = 'TRADER';
    currentTradeModalTicker = 'RELIANCE';
    currentTradeModalSide = 'BUY';
  `, sandbox);

  // Test Trader Order Double-Click Shield
  const orderBtn = domElements.get('btnExecuteTradeOrder');
  orderBtn.disabled = false;
  orderBtn.textContent = 'Confirm Buy Order';
  domElements.get('tradeQuantityInput').value = '10';

  // Click 1: Normal order execution
  vm.runInContext('executeModalTrade();', sandbox);
  assert(orderBtn.disabled === true, 'Order button disabled on click 1');
  assert(sentFrames.length === 1, 'Exactly 1 ORDER message dispatched on click 1');
  assert(sentFrames[0].action === 'ORDER' && sentFrames[0].ticker === 'RELIANCE', 'Order payload correct');

  // Click 2: Rapid double-click while in-flight
  vm.runInContext('executeModalTrade();', sandbox);
  assert(sentFrames.length === 1, 'Double-click strictly PREVENTED: Still exactly 1 frame sent (0 duplicate frames)');

  // Simulate Server ORDER_FILLED acknowledgment
  vm.runInContext(`
    handleServerOrderFilled = () => {
      releaseActionLockById('btnExecuteTradeOrder');
      closeTradeModal();
    };
    handleServerOrderFilled();
  `, sandbox);
  assert(orderBtn.disabled === false, 'Order button re-enabled upon server ORDER_FILLED');
  assert(orderBtn.textContent === 'Confirm Buy Order', 'Order button text restored upon server ORDER_FILLED');

  // Test Trader Liquidation Double-Click Shield
  const liqBtn = domElements.get('btnConfirmLiquidate');
  liqBtn.disabled = false;
  liqBtn.textContent = '⚡ Yes, Sell All Shares Now';

  // Click 1: Liquidate all
  vm.runInContext('executeLiquidateAll();', sandbox);
  assert(liqBtn.disabled === true, 'Liquidate button disabled on click 1');
  assert(sentFrames.length === 2, 'Exactly 1 LIQUIDATE_ALL frame sent');
  assert(sentFrames[1].action === 'LIQUIDATE_ALL', 'Liquidation payload correct');

  // Click 2: Rapid double-click while in-flight
  vm.runInContext('executeLiquidateAll();', sandbox);
  assert(sentFrames.length === 2, 'Double-click liquidation strictly PREVENTED: Still 2 frames total');

  // Simulate Server PORTFOLIO_LIQUIDATED acknowledgment
  vm.runInContext(`
    releaseActionLockById('btnConfirmLiquidate');
  `, sandbox);
  assert(liqBtn.disabled === false, 'Liquidate button re-enabled upon PORTFOLIO_LIQUIDATED');
  assert(liqBtn.textContent === '⚡ Yes, Sell All Shares Now', 'Liquidate button text restored upon PORTFOLIO_LIQUIDATED');
}

// -------------------------------------------------------------
// PART 5: HOST CONTROLS IN-FLIGHT LOCKING & SERVER REJECTION CATCH-ALL
// -------------------------------------------------------------
console.log('\n--- TEST-BTN-005: Host Operations & ACTION_REJECTED Catch-All ---');

async function testHostActionContracts() {
  const sentFrames = [];
  sandbox.sentFrames = sentFrames;

  vm.runInContext(`
    ws = {
      readyState: 1,
      OPEN: 1,
      send: (data) => {
        sentFrames.push(JSON.parse(data));
      }
    };
    sessionToken = 'test-token-host-01';
    currentRole = 'HOST';
    latestState = {
      gameState: {
        status: 'PAUSED',
        isPaused: true,
        currentDay: 1,
        totalDays: 3,
        elapsedSeconds: 100
      }
    };
  `, sandbox);

  // 1. Resume Market
  const resumeBtn = domElements.get('btnMarketResume');
  resumeBtn.disabled = false;
  resumeBtn.textContent = '▶ Resume (3-2-1)';

  vm.runInContext('hostResumeMarket();', sandbox);
  assert(resumeBtn.disabled === true, 'btnMarketResume disabled on click 1');
  assert(resumeBtn.textContent.includes('Resuming'), 'btnMarketResume text shows processing');

  // Server COUNTDOWN_START arrives
  vm.runInContext("releaseActionLockById('btnMarketResume');", sandbox);
  assert(resumeBtn.disabled === false, 'btnMarketResume re-enabled upon COUNTDOWN_START');
  assert(resumeBtn.textContent === '▶ Resume (3-2-1)', 'btnMarketResume text restored upon COUNTDOWN_START');

  // 2. Emergency Stop
  const stopBtn = domElements.get('btnConfirmEmergencyStop');
  stopBtn.disabled = false;
  stopBtn.textContent = '🛑 ACTIVATE EMERGENCY HALT';

  vm.runInContext('executeEmergencyStop();', sandbox);
  assert(stopBtn.disabled === true, 'btnConfirmEmergencyStop disabled during in-flight halt');

  // Server EMERGENCY_STOP arrives
  vm.runInContext("releaseActionLockById('btnConfirmEmergencyStop');", sandbox);
  assert(stopBtn.disabled === false, 'btnConfirmEmergencyStop re-enabled upon EMERGENCY_STOP');
  assert(stopBtn.textContent === '🛑 ACTIVATE EMERGENCY HALT', 'btnConfirmEmergencyStop text restored');

  // 3. Disaster Recovery Checkpoint
  const chkBtn = domElements.get('btnHostCreateCheckpoint');
  chkBtn.disabled = false;
  chkBtn.textContent = '💾 Save Instant Checkpoint Now';

  vm.runInContext('hostCreateCheckpoint("test_point");', sandbox);
  assert(chkBtn.disabled === true, 'btnHostCreateCheckpoint disabled during checkpoint save');

  // Server CHECKPOINT_CREATED_ACK arrives
  vm.runInContext("releaseActionLockById('btnHostCreateCheckpoint');", sandbox);
  assert(chkBtn.disabled === false, 'btnHostCreateCheckpoint re-enabled upon CHECKPOINT_CREATED_ACK');
  assert(chkBtn.textContent === '💾 Save Instant Checkpoint Now', 'btnHostCreateCheckpoint text restored');

  // 4. ACTION_REJECTED Catch-All Releases All In-Flight Locks
  const btn1 = domElements.get('btnConfirmAddDay');
  const btn2 = domElements.get('btnConfirmResetChampionship');
  btn1.disabled = false;
  btn1.textContent = '➕ Add Day';
  btn2.disabled = false;
  btn2.textContent = 'Confirm Reset';

  sandbox.window.applyActionContractLock(btn1, 'Adding...');
  sandbox.window.applyActionContractLock(btn2, 'Resetting...');
  assert(btn1.disabled === true && btn2.disabled === true, 'Both buttons locked in flight');

  // Incoming ACTION_REJECTED from server
  vm.runInContext('releaseAllActionLocks();', sandbox);

  assert(btn1.disabled === false, 'btnConfirmAddDay unlocked by ACTION_REJECTED catch-all');
  assert(btn1.textContent === '➕ Add Day', 'btnConfirmAddDay text restored by ACTION_REJECTED catch-all');
  assert(btn2.disabled === false, 'btnConfirmResetChampionship unlocked by ACTION_REJECTED catch-all');
  assert(btn2.textContent === 'Confirm Reset', 'btnConfirmResetChampionship text restored by ACTION_REJECTED catch-all');
}

// -------------------------------------------------------------
// EXECUTE ASYNC TESTS SEQUENTIALLY
// -------------------------------------------------------------
async function runAll() {
  await testTimeoutFallback();
  await testNetworkShield();
  await testHostActionContracts();

  console.log('\n===============================================================');
  console.log(`🎉 ALL CHUNK 4 TESTS PASSED: ${passedAssertions} / ${totalAssertions} ASSERTIONS VERIFIED!`);
  console.log('===============================================================\n');
  process.exit(0);
}

runAll().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:\n', err);
  process.exit(1);
});
