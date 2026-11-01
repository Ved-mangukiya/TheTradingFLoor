/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * MATHEMATICAL MARKET & PRICE ENGINE (server/market_engine.js)
 *
 * Implements:
 * - Seedable Mulberry32 PRNG (cryptographic random seed per run by default,
 *   or deterministic seed when configured for reproducible testing/audits).
 * - Multi-factor log-return price evolution:
 *     Company Return = Market Factor + Sector Factor + Idiosyncratic Volatility Shock
 *                      + Randomized-Phase Intraday Wave + Mean Reversion + Event Smoothstep.
 * - Smoothstep shock interpolation & directional circuit breaker clamping.
 */

'use strict';

const crypto = require('crypto');

/**
 * Generates a fresh 32-bit unsigned integer seed from cryptographic entropy.
 */
function generateCryptoSeed() {
  return crypto.randomBytes(4).readUInt32LE(0);
}

/**
 * Creates a fast, high-quality Mulberry32 PRNG instance from a 32-bit integer seed.
 */
function createSeededRng(seed) {
  let state = (seed >>> 0) || generateCryptoSeed();
  return function nextFloat() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard smoothstep polynomial: S(u) = 3*u^2 - 2*u^3 for u in [0, 1].
 */
function smoothstep(u) {
  const clamped = Math.max(0, Math.min(1, u));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Box-Muller transform for zero-mean standard Gaussian variate using provided rng.
 */
function randomGaussian(mean = 0, stdev = 1, rng = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

/**
 * Clamp numeric value between min and max bounds, guarding against NaN/Infinity.
 */
function clamp(val, min, max) {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Assigns independent per-run wave phases and frequencies to each stock
 * so repeated runs never exhibit hardcoded directional openings.
 */
function initializeStockStochastics(companies, rng = Math.random) {
  (companies || []).forEach((stock) => {
    stock.trendPhase = rng() * Math.PI * 2;
    stock.trendFreq = 0.010 + rng() * 0.025;
    stock.sentimentBias = 0;
  });
}

/**
 * Computes a single multi-factor market step across all enabled stocks.
 * Factors:
 *  1. Market-wide systemic influence (18% weight, beta-scaled)
 *  2. Sector-level correlated influence (22% weight)
 *  3. Company-specific idiosyncratic Gaussian shock (45% weight) + unbiased micro-drift
 *  4. Randomized-phase cyclical intraday wave (20% weight)
 *  5. Gentle mean reversion toward dayOpenPrice
 */
function computeMultiFactorStep(stock, context) {
  const {
    rng = Math.random,
    elapsedSeconds = 0,
    marketShockZ = 0,
    sectorShockZ = 0
  } = context || {};

  const baseVol = clamp(parseFloat(stock.volatility_factor) || 0.004, 0.0005, 0.05);
  const beta = clamp(parseFloat(stock.beta) || 1.0, 0.1, 3.5);
  const effectiveVol = Math.max(0.0035, baseVol * beta * 1.5);

  // 1. Market-wide systemic influence (18% weight, beta-scaled)
  const marketReturn = marketShockZ * baseVol * beta * 0.18;

  // 2. Sector-level correlated influence (22% weight)
  const sectorReturn = sectorShockZ * effectiveVol * 0.22;

  // 3. Company-specific idiosyncratic Gaussian shock (45% weight) + unbiased micro-drift
  const idioZ = randomGaussian(0, 1, rng);
  const idioReturn = idioZ * effectiveVol * 0.45;
  const microReturn = (rng() - 0.50) * effectiveVol * 0.25;

  // 4. Intraday cyclical wave with per-run randomized phase (20% weight)
  const phase = typeof stock.trendPhase === 'number' ? stock.trendPhase : 0;
  const freq = typeof stock.trendFreq === 'number' ? stock.trendFreq : 0.018;
  const waveReturn = Math.cos(elapsedSeconds * freq + phase) * effectiveVol * 0.20;

  // 5. Gentle mean-reversion toward dayOpenPrice
  const refOpen = stock.dayOpenPrice || stock.base_price || stock.currentPrice || 100;
  const reversionPull = -0.00015 * ((stock.currentPrice - refOpen) / Math.max(1, refOpen));

  const totalLogReturn = marketReturn + sectorReturn + idioReturn + microReturn + waveReturn + reversionPull;
  const rawNextPrice = stock.currentPrice * Math.exp(clamp(totalLogReturn, -0.08, 0.08));

  const minBound = Math.max(0.05, parseFloat(stock.min_price) || 1);
  const maxBound = parseFloat(stock.max_price) || 500000;
  return +clamp(rawNextPrice, minBound, maxBound).toFixed(2);
}

/**
 * Unified Order-Flow Price Impact Calculator (used identically by BUY, SELL, and LIQUIDATE_ALL).
 * Prevents arbitrary minimum jumps while scaling smoothly with order value and share quantity.
 */
function calculateOrderFlowImpact(stock, quantity, side) {
  const price = Number(stock.currentPrice) || 100;
  const qty = Math.max(1, Number(quantity) || 1);
  const grossValue = qty * price;
  // Proportional liquidity impact: 0.0002% per rupee of gross value + lot pressure, capped at 0.6% per order
  const rawPct = Math.min(0.006, Math.max(0.0002, (grossValue * 0.0000002) + (qty / 500) * 0.0005));
  const delta = +(price * rawPct).toFixed(2);
  return side === 'BUY' ? delta : -delta;
}

module.exports = {
  generateCryptoSeed,
  createSeededRng,
  smoothstep,
  randomGaussian,
  clamp,
  initializeStockStochastics,
  computeMultiFactorStep,
  calculateOrderFlowImpact
};
