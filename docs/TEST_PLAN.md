# COMPREHENSIVE TEST PLAN & VERIFICATION MATRIX — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Overview
This test plan defines the automated and manual verification procedures for validating **The Trading Floor Championship 2026**. All 24 core tournament scenarios must pass before deploying the platform in live collegiate competitions.

---

## 2. Test Execution Matrix (24 Core Scenarios)

| ID | Category | Test Scenario | Expected Outcome | Verification Method |
| :---: | :--- | :--- | :--- | :--- |
| **01** | Setup | Fresh repository installation | `npm install` runs cleanly without native compile errors. | Automated (`npm install`) |
| **02** | Setup | Zero undocumented dependencies | Runs solely with `express` and `ws` listed in `package.json`. | Automated (`node server.js`) |
| **03** | Auth | Host authentication & initialization | `LOGIN` with `host` / `host2026` grants `HOST` session token. | Automated WebSocket test |
| **04** | Universe | Host adds brand-new share | Stock is appended, saved to disk, and team holdings initialized to 0. | Automated test (`HOST_ADD_SHARE`) |
| **05** | Universe | Host disables share from market | Stock marked `isEnabled = false`, hidden from teams, orders rejected. | Automated test (`HOST_TOGGLE_SHARE`) |
| **06** | Universe | Host activates market presets | Selected template (e.g. Balanced, High Vol) sets tradeable status. | Automated test (`HOST_APPLY_MARKET_TEMPLATE`) |
| **07** | Network | Team connects over LAN IP | Connects to `http://<LAN_IP>:3000/` and renders login screen. | Manual LAN browser check |
| **08** | Trading | Valid buy order execution | Cash deducted, holdings increased, average buy price recalculated. | Automated WebSocket test |
| **09** | Trading | Valid sell order execution | Holdings deducted, cash credited, realized P&L updated. | Automated WebSocket test |
| **10** | Validation| Insufficient cash rejection | Order rejected with `"Insufficient virtual cash balance."` | Automated WebSocket test |
| **11** | Validation| Insufficient holdings rejection | Order rejected with `"Insufficient share quantity held."` | Automated WebSocket test |
| **12** | Security | Rapid duplicate order spam | Orders submitted <200ms are throttled with rate-limit error. | Automated WebSocket test |
| **13** | Market | Halted stock trade attempt | Order rejected with `"Trading halted on {TICKER} due to circuit breaker."` | Automated WebSocket test |
| **14** | Shocks | Breaking news price transition | Target stock moves towards target over specified duration. | Automated WebSocket test |
| **15** | Circuit | Circuit breaker auto-activation | Price movement $\ge 20\%$ triggers halt, sets `isHalted = true`, alarms chime. | Automated test |
| **16** | Scoring | Portfolio & leaderboard math | Net Worth = Cash + Equity; sorted descending by Net Worth. | Automated math test |
| **17** | Recovery | Disconnection & reconnection | Client reconnects with `RESUME_SESSION` without losing session state. | Automated test |
| **18** | Persistence| Server restart & universe recovery | Restarts with preserved active universe from `universe_active.json`. | Automated file inspection |
| **19** | Export | Audit exports & formula injection | JSON and CSV exports contain valid records without formula injection. | Automated HTTP GET test |
| **20** | RBAC | Unauthorized host actions blocked | Trader session attempting `HOST_PAUSE` is ignored/rejected. | Automated WebSocket test |
| **21** | UI | Destructive action confirmation | Modals require explicit browser confirmation before resets/halts. | Manual browser test |
| **22** | Ceremony| Tournament conclusion & podium | Host crowns winners; 3-tier podium displays with fanfare. | Manual / Automated test |
| **23** | Projector| Projector view privacy check | Projector view displays top-5 rankings without exposing credentials. | Manual browser check |
| **24** | Offline | Zero external internet requirement | Disconnect Wi-Fi WAN; entire tournament functions 100% locally. | Manual disconnected test |

---

## 3. Automated Test Suites & Commands

The project maintains three comprehensive automated test suites providing 100% end-to-end verification without requiring internet connectivity:

### 3.1 Test Suites Overview

| Suite | File | Tests | Purpose & Coverage |
| :--- | :--- | :---: | :--- |
| **Unified Master Flow Suite** | `tests/test_unified_master_flow.js` | **36** | Complete single-flow chronological end-to-end verification covering all 11 lifecycle phases on port 3099. |
| **Master Regression Suite** | `tests/test_master_suite.js` | **52** | Spawns isolated test server on port 3088. Tests end-to-end authentication, setup lock, order accounting, team isolation, rate limiting, share manager, news shocks, CSV sanitization, disaster recovery, market indices, and winner ceremonies. |
| **Dynamic Upgrade & Lifecycle** | `tests/test_dynamic_upgrade_suite.js` | **10** | Verifies team investment analytics REST endpoints, lifecycle controls (`HOST_EMERGENCY_STOP`, `HOST_CONCLUDE_DAY`, `HOST_ADD_DAY`), news idempotency, and final review state. |
| **Trading Cards & Lifecycle Suite** | `tests/test_trading_cards_and_lifecycle_suite.js` | **24** | Verifies universe filtering (sectors, search, gainers/losers), real-time order affordability & shortfall messages, directional circuit breakers (upper/lower gating & recovery), and Day 1 ➔ Day 2 transitions with snapshot locking. |
| **UI & Overlays Suite** | `tests/test_chunk3_ui_and_overlays.js` | **89** | Verifies DOM parity, zero duplicate IDs, role overlay mutual exclusion, and projector slot reuse. |
| **Action Contracts Suite** | `tests/test_chunk4_action_contracts.js` | **64** | Verifies double-click button locking, 5000ms timeout fallbacks, and ACTION_REJECTED unlocking. |

### 3.2 Exact Execution Commands

```bash
# Run the primary master test suite (52 tests)
npm test

# Run all 3 test suites sequentially (85 tests)
npm run test:all

# Run the trading cards, filters & circuit breaker suite (24 tests)
npm run test:cards

# Run the dynamic upgrade & analytics suite (9 tests)
npm run test:upgrade
```

### 3.3 Sample Verified Test Output (`npm test`)

```
================================================================
 🧪 STARTING TRADING FLOOR CHAMPIONSHIP AUTOMATED VERIFICATION
================================================================
[STAGE 1] System Health & Rest Endpoints
  ✓ PASS: Server health verified. Active scenario: test, Companies: 8
[STAGE 2] Authentication & Security Verification
  ✓ PASS: Host authenticated. Session token generated (32-char hex).
  ✓ PASS: Team login correctly gated on server before event setup is locked.
  ✓ PASS: Host confirmed & locked authoritative event setup.
  ✓ PASS: Trader Team 1 authenticated after setup lock. Initial cash: ₹500000
[STAGE 3] Market Clock & State Transitions
  ✓ PASS: Order correctly rejected while market is in paused state.
  ✓ PASS: Host triggered resume countdown with authoritative server target timestamp.
[STAGE 4] Trade Execution & Portfolio Valuation
  ✓ PASS: Buy executed: 10 APEXAUTO @ ₹800.00.
  ✓ PASS: Sell executed: 4 APEXAUTO @ ₹800.10.
  ✓ PASS: Oversell rejected: Insufficient shares.
  ✓ PASS: Overbuy rejected: Insufficient cash.
  ✓ PASS: Team isolation verified (zero cross-contamination).
...
================================================================
 📋 TEST SUITE SUMMARY: 52 PASSED, 0 FAILED
================================================================
```
