/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * MATHEMATICAL MARKET & PRICE ENGINE (server/market_engine.js)
 *
 * Implements smoothstep shock interpolation, Gaussian random walk,
 * and circuit breaker clamping utilities.
 */

'use strict';

/**
 * Standard smoothstep polynomial: S(u) = 3*u^2 - 2*u^3 for u in [0, 1].
 * Yields continuous zero first-derivatives at both endpoints (S'(0)=0, S'(1)=0).
 */
function smoothstep(u) {
  const clamped = Math.max(0, Math.min(1, u));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Box-Muller transform for zero-mean standard Gaussian variate.
 */
function randomGaussian(mean = 0, stdev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

/**
 * Clamp numeric value between min and max bounds.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

module.exports = {
  smoothstep,
  randomGaussian,
  clamp
};
