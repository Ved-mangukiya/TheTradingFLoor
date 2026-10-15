# RESEARCH LOG & TECHNICAL REFERENCES — THE TRADING FLOOR CHAMPIONSHIP 2026

This document records the mathematical models, institutional financial standards, and technical references integrated into The Trading Floor Championship.

---

## 1. Mathematical & Financial Market Modeling

### 1.1 Geometric Brownian Motion with Ornstein-Uhlenbeck Mean Reversion
- **Reference**: Black-Scholes & Vasicek Financial Drift Models.
- **Implementation**: Box-Muller transform generates normal random perturbations ($\epsilon \sim \mathcal{N}(0, 1)$), integrated with mean-reversion drift:
  $$dP_t = \theta (\mu - P_t) dt + \sigma P_t dW_t$$
- **Verification Status**: VERIFIED in `server.js` price simulation loop. Stocks maintain authentic volatility without unbounded drift.

### 1.2 BSE / NSE Circuit Breaker Standards
- **Reference**: Securities and Exchange Board of India (SEBI) Equity Circuit Filter Guidelines.
- **Implementation**: Intraday reference price check triggered if price moves $\pm 20\%$ from Day Open.
- **Verification Status**: VERIFIED in `test_master_suite.js` (Test #11).

---

## 2. Web Technologies & Audio Synthesis

### 2.1 Web Audio API Zero-Asset Synthesizer
- **Reference**: W3C Web Audio API Specification (`AudioContext`, `OscillatorNode`, `GainNode`).
- **Implementation**: Programmatic frequency synthesis for institutional bells (triangle wave harmonics), news sirens (frequency modulated sawtooth), and alarms (square wave bursts).
- **Verification Status**: VERIFIED across Chrome, Edge, and Firefox without external audio files.

### 2.2 Cubic Bezier Spline Sparkline Rendering
- **Reference**: Catmull-Rom & Cubic Bezier Curve Spline Smoothing Algorithms.
- **Implementation**: Computes control points ($cp_1, cp_2$) for each price coordinate to draw smooth continuous curves with gradient area fills on an HTML5 `<canvas>`.
- **Verification Status**: VERIFIED in `public/app.js` (`drawSmoothBezierSparkline`).
