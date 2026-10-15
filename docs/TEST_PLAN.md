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

## 3. Running the Automated Test Suite

The automated test suite is located in `test_master_suite.js`.

To run:
```bash
npm test
```

Expected output:
```
======================================================================
  THE TRADING FLOOR CHAMPIONSHIP 2026 -- MASTER AUTOMATED TEST SUITE
======================================================================
[TEST 1] HTTP Static Server & Health Check ... PASS
[TEST 2] Host Authentication & Session Token Generation ... PASS
[TEST 3] Trader Authentication (team1) ... PASS
[TEST 4] Market Pause & Order Rejection While Paused ... PASS
[TEST 5] Market Resume via 3-2-1 Countdown Protocol ... PASS
[TEST 6] Valid BUY Order Execution & Cash/Holdings Accounting ... PASS
[TEST 7] Valid SELL Order Execution & Realized P&L Accounting ... PASS
[TEST 8] Insufficient Cash Order Rejection ... PASS
[TEST 9] Insufficient Holdings Order Rejection ... PASS
[TEST 10] Rate Limiting & Rapid Order Spam Protection ... PASS
[TEST 11] Circuit Breaker Auto-Trigger & Trading Halt Rejection ... PASS
[TEST 12] Circuit Breaker Release by Host ... PASS
[TEST 13] Host Custom Breaking News Injection & Price Impact ... PASS
[TEST 14] Dynamic Share Universe: Add New Stock ... PASS
[TEST 15] Dynamic Share Universe: Disable Stock & Trade Rejection ... PASS
[TEST 16] Dynamic Share Universe: Re-enable Stock & Execution ... PASS
[TEST 17] Dynamic Share Universe: Apply Template & Export Endpoints ... PASS
[TEST 18] Millisecond Audit Logging & CSV Export Sanitization ... PASS
[TEST 19] Client Reconnection & Session Continuity ... PASS
======================================================================
  SUMMARY: ALL TESTS PASSED SUCCESSFULLY (19/19)
======================================================================
```
