# 08 — TEST INFRASTRUCTURE, VERIFICATION & DEPENDENCY AUDIT

> **Auditor Reference Document**: Complete test architecture, verification runs, test harness mechanics, dependencies, and zero-CDN offline compliance for **The Trading Floor Championship 2026**.

---

## 1. Test Harness Architecture

The repository contains two layers of automated testing:
1. **The Canonical Unified Master Runner**: `test_unified_master_flow.js` (Created to replace piecemeal test execution with a deterministic, single-process, 11-phase end-to-end verification).
2. **Legacy Targeted Test Suites**: 7 test scripts targeting specific subsystems.

---

## 2. Canonical Unified Runner: `test_unified_master_flow.js`

### 2.1 Design & Execution Guarantees
- **Port Isolation**: Runs strictly on dedicated port `3099` (`TEST_PORT = 3099`) to prevent any `EADDRINUSE` conflicts with production (`3000`) or development (`3089`).
- **Clean State Shield**: Automatically creates a backup of `data/live_game_state.json` before booting the test server and restores it upon test completion or process exit (`process.on('exit')`, `SIGINT`, `uncaughtException`).
- **Deterministic 11-Phase Lifecycle Flow**: Follows a realistic competition session end-to-end from initial boot through winner announcement and post-competition state reset.

### 2.2 The 11 Verification Phases

```
┌─────────────────────────────────────────────────────────────┐
│             UNIFIED MASTER FLOW TEST PIPELINE               │
├───────┬─────────────────────────────────────────────────────┤
│ PH-01 │ Server Boot & HTTP Health Check                     │
│ PH-02 │ Stock Universe & Configuration Lock Verification     │
│ PH-03 │ Multi-Client WebSocket Authentication               │
│ PH-04 │ Quantitative Parameter & News Privacy Sanitization  │
│ PH-05 │ 3-2-1 Resume Countdown & Market Live Activation     │
│ PH-06 │ Mathematical Order Execution & Financial Accounting │
│ PH-07 │ Circuit Breaker Band Triggers & Counter Liquidity   │
│ PH-08 │ Proportional Dynamic News Scaling & Cognitive Window│
│ PH-09 │ End-of-Day Transition & Daily P&L Carryover        │
│ PH-10 │ Championship Conclusion & 3-Tier Tie-Breaker Logic  │
│ PH-11 │ State Reset, Staging Cleanup & Backup Restoration   │
└───────┴─────────────────────────────────────────────────────┘
```

### 2.3 Verified Test Results
Executed directly in terminal:
```bash
node test_unified_master_flow.js
```
- **Total Assertions**: 36 / 36
- **Passed**: 36 (100%)
- **Failed**: 0
- **Duration**: ~4.2 seconds
- **Exit Code**: 0 (Clean)

---

## 3. Legacy Test Suites Catalog

| File | Focus Area | Assertions | Known Limitation |
| :--- | :--- | :---: | :--- |
| `test_master_suite.js` | Full system regression suite | 85 | Hardcodes port 3000; requires manual server stop |
| `test_unified_master_flow.js` | Unified 11-phase single-process lifecycle | 36 | **Canonical (Recommended)** |
| `test_trading_cards_and_lifecycle_suite.js` | Stock board cards & trading rules | 22 | May reuse dirty server if already running |
| `test_master_projector_and_daily_leaderboard_suite.js` | Projector DOM stability & leaderboards | 18 | Tests DOM string rendering in Node environment |
| `test_master_quantitative_and_security_suite.js` | GBM math, fee deduction, auth isolation | 24 | Requires clean database state |
| `test_master_lifecycle_and_isolation.js` | State machine transitions & role gating | 16 | Collides on port 3089 |
| `test_dynamic_upgrade_suite.js` | Dynamic news scaling & duration changes | 14 | Collides on port 3089 |
| `test_interaction_logic_and_state_machine.js` | Button click event simulations | 20 | Simulated DOM event dispatch |

---

## 4. Dependencies & Runtime Environment

### 4.1 Production Dependencies
The project adheres to an ultra-lean dependency profile documented in `package.json`:

```json
{
  "name": "the-trading-floor",
  "version": "2.6.1",
  "description": "The Trading Floor Championship 2026 - Educational Stock Market Simulation",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node test_unified_master_flow.js",
    "test:all": "node test_unified_master_flow.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "ws": "^8.17.0"
  }
}
```

- **`express` (v4.19.2)**: Lightweight HTTP static file server, CSV export streaming, and REST API router.
- **`ws` (v8.17.0)**: High-performance, RFC 6455 compliant WebSocket server for sub-millisecond market ticks and order routing.
- **Node.js Built-ins**: `fs`, `path`, `crypto`, `http`, `events`.

### 4.2 Zero-CDN Offline Campus Compliance
In college campus environments, Wi-Fi connectivity during large student events is notoriously unpredictable or completely isolated on an offline local area network (LAN).

The application enforces a **Strict Zero-CDN Invariant**:
1. **Typography**: Fonts rely on native system font stacks (`-apple-system`, `BlinkMacSystemFont`, `'Segoe UI'`, `Roboto`, `Helvetica`, `Arial`, `sans-serif`) and monospace fonts for financial data (`'SF Mono'`, `'Consolas'`, `'Liberation Mono'`, `'Courier New'`). Zero remote Google Fonts links exist.
2. **Icons**: All UI icons are either native Unicode emojis (`📈`, `📉`, `⏸️`, `▶️`, `🔒`, `👁️`, `🔔`) or inline SVG path definitions. Zero external FontAwesome or CDN icon stylesheets.
3. **Audio Synthesis**: Sound effects are generated in real-time via the browser's native **Web Audio API** (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`). Zero external MP3 or audio asset downloads over the network.
4. **Charting**: Sparklines and market trend charts are rendered on HTML5 `<canvas>` elements using raw Canvas 2D rendering contexts (`ctx.lineTo()`, `ctx.stroke()`). Zero external Chart.js, Highcharts, or D3.js CDN script tags.

---

## 5. Verification Commands

To verify the complete application state:

```bash
# 1. Run the canonical 11-phase automated test runner
npm test

# 2. Syntax check server and client files
node -c server.js
node -c public/app.js

# 3. Launch the production application locally
npm start
# Terminal outputs:
# ==========================================
# 🏛️  THE TRADING FLOOR CHAMPIONSHIP 2026
# 📡  Local Server running on http://localhost:3000
# ==========================================
```
