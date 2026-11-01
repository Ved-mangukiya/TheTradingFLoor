/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * PHASE 1 SIMULATION & SYNCHRONIZATION VERIFICATION SUITE
 * File: tests/test_phase1_simulation_and_sync.js
 */

const assert = require('assert');
const {
  createSeededRng,
  generateCryptoSeed,
  randomGaussian,
  clamp,
  initializeStockStochastics,
  computeMultiFactorStep,
  calculateOrderFlowImpact
} = require('../server/market_engine');
const {
  syncDerivedStateFlags,
  validateActionEligibility
} = require('../server/state_machine');

console.log('\n======================================================================');
console.log(' 🧪 RUNNING PHASE 1 SIMULATION & SYNCHRONIZATION SUITE');
console.log('======================================================================\n');

// [SIM-01]: Deterministic Seed Reproducibility
console.log('[SIM-01] Identically seeded runs produce 100% bit-for-bit reproducible trajectories');
const seed = 20261018;
const rngA = createSeededRng(seed);
const rngB = createSeededRng(seed);

const sequenceA = [];
const sequenceB = [];
for (let i = 0; i < 50; i++) {
  sequenceA.push(rngA());
  sequenceB.push(rngB());
}
assert.deepStrictEqual(sequenceA, sequenceB, 'Mulberry32 PRNG must be 100% bit-for-bit reproducible with same seed');
console.log('  ✓ PASS [SIM-01]: Deterministic seed reproducibility verified\n');

// [SIM-02]: Elimination of Fixed idx * 1.73 Directional Bias
console.log('[SIM-02] Independent per-run stochastic phases eliminate fixed opening bias');
const testCompanies = [
  { ticker: 'RELIANCE', currentPrice: 2850, dayOpenPrice: 2850, volatility_factor: 0.005, beta: 1.1, sector: 'Energy' },
  { ticker: 'TATAMOTORS', currentPrice: 960, dayOpenPrice: 960, volatility_factor: 0.006, beta: 1.25, sector: 'Automobile' },
  { ticker: 'MARUTI', currentPrice: 12400, dayOpenPrice: 12400, volatility_factor: 0.004, beta: 0.9, sector: 'Automobile' },
  { ticker: 'HDFCBANK', currentPrice: 1680, dayOpenPrice: 1680, volatility_factor: 0.004, beta: 1.0, sector: 'Banking' }
];

let tataUpCount = 0;
const RUNS = 40;
for (let r = 0; r < RUNS; r++) {
  const localRng = createSeededRng(generateCryptoSeed());
  initializeStockStochastics(testCompanies, localRng);
  const nextPrice = computeMultiFactorStep(testCompanies[1], {
    rng: localRng,
    elapsedSeconds: 1,
    marketShockZ: 0,
    sectorShockZ: 0
  });
  if (nextPrice >= testCompanies[1].dayOpenPrice) tataUpCount++;
}

// In the old hardcoded idx*1.73 model, TATAMOTORS always moved downward (0% up).
// With stochastic phase initialization, it should be balanced (~30% to 70%).
assert.ok(tataUpCount > 5 && tataUpCount < (RUNS - 5), `TATAMOTORS up count (${tataUpCount}/${RUNS}) must be balanced, not deterministic`);
console.log(`  ✓ PASS [SIM-02]: Stochastic wave phase verified (TATAMOTORS rose ${tataUpCount}/${RUNS} times)\n`);

// [SIM-03]: Extreme Shock Boundary Clamping
console.log('[SIM-03] Extreme shocks respect min_price / max_price bounds');
const pennyStock = {
  ticker: 'PENNY',
  currentPrice: 2.50,
  dayOpenPrice: 2.50,
  min_price: 1.00,
  max_price: 50.00,
  volatility_factor: 0.05,
  beta: 3.0
};
const crashPrice = computeMultiFactorStep(pennyStock, {
  rng: () => 0.0001,
  elapsedSeconds: 10,
  marketShockZ: -5.0,
  sectorShockZ: -5.0
});
assert.ok(crashPrice >= 1.00, `Crashed price ${crashPrice} must respect min_price bound 1.00`);
assert.ok(Number.isFinite(crashPrice), 'Price must be a finite number');
console.log(`  ✓ PASS [SIM-03]: Boundary clamping verified (Price clamped cleanly at ₹${crashPrice})\n`);

// [SIM-04]: Unified Order-Flow Impact
console.log('[SIM-04] Unified order-flow impact across BUY and SELL');
const stockA = { currentPrice: 1000 };
const buyImpact = calculateOrderFlowImpact(stockA, 100, 'BUY');
const sellImpact = calculateOrderFlowImpact(stockA, 100, 'SELL');

assert.ok(buyImpact > 0, 'BUY impact must be positive');
assert.ok(sellImpact < 0, 'SELL impact must be negative');
assert.strictEqual(buyImpact, -sellImpact, 'BUY and SELL impacts must be symmetric for equal size');
assert.ok(buyImpact <= 1000 * 0.006 + 0.05, 'Impact must be bounded within 0.6% limit');
console.log(`  ✓ PASS [SIM-04]: Symmetric order flow impact verified (+₹${buyImpact} / ₹${sellImpact})\n`);

// [LFC-01]: Lifecycle Action-Eligibility and Monotonic stateVersion
console.log('[LFC-01] Lifecycle Action-Eligibility & Monotonic stateVersion');
const gsSetup = { status: 'SETUP', configLocked: false, isPaused: true, isConcluded: false, currentDay: 1, totalDays: 3, elapsedSeconds: 0 };
const newsInSetup = validateActionEligibility(gsSetup, 'HOST_TRIGGER_NEWS');
assert.strictEqual(newsInSetup.allowed, false, 'News trigger must be rejected during SETUP');

const gsLive = { status: 'LIVE', configLocked: true, isPaused: false, isConcluded: false, currentDay: 1, totalDays: 3, elapsedSeconds: 50 };
const newsInLive = validateActionEligibility(gsLive, 'HOST_TRIGGER_NEWS');
assert.strictEqual(newsInLive.allowed, true, 'News trigger must be allowed during LIVE');

const initialVersion = gsLive.stateVersion || 1;
syncDerivedStateFlags(gsLive);
assert.strictEqual(gsLive.stateVersion, initialVersion + 1, 'stateVersion must monotonically increment');
console.log('  ✓ PASS [LFC-01]: Centralized action eligibility and monotonic stateVersion verified\n');

console.log('======================================================================');
console.log(' 🏆 ALL 5 PHASE 1 SUITE ASSERTIONS PASSED WITH 100% SUCCESS!');
console.log('======================================================================\n');

