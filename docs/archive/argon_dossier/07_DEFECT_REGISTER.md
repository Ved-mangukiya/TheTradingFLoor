# 07 — EVIDENCE-BASED DEFECT & TECHNICAL DEBT REGISTER

> **Auditor Reference Document**: Complete audit catalog of confirmed bugs, design weaknesses, race conditions, and architectural debt identified during deep inspection of **The Trading Floor Championship 2026**.

---

## 1. Defect Classification Summary

| ID | Title | Category | Severity | Primary Source |
| :--- | :--- | :--- | :---: | :--- |
| **DEF-01** | Dual DOM Hierarchy & Namespace Collisions | Confirmed Bug / Design Weakness | **HIGH** | `public/index.html`, `public/app.js` |
| **DEF-02** | Monolithic Code Duplication (`formatClock12H`) | Confirmed Bug | **LOW** | `public/app.js:2203`, `public/app.js:4948` |
| **DEF-03** | In-Memory Session Invalidation on Restart | Confirmed Bug / Architecture | **MEDIUM** | `server.js:2381-2455` |
| **DEF-04** | Client-Side News Masking for Host | Design Weakness / Security | **MEDIUM** | `public/app.js:7700-7750` |
| **DEF-05** | Uncapped Canvas Sparkline Redraw & Memory Leak | Design Weakness / Performance | **MEDIUM** | `public/app.js:3380-3490` |
| **DEF-06** | Test Suite Port Collision & Dirty Server Re-use | Confirmed Bug (Tests) | **HIGH** | `test_dynamic_upgrade_suite.js:21` |
| **DEF-07** | Stale Active Countdown Timer on Socket Drop | Likely Bug / State Machine | **MEDIUM** | `server.js:2540-2565` |
| **DEF-08** | Race Hazard Between Polling Fallback & WebSocket Push | Design Weakness | **MEDIUM** | `public/app.js:1560-1610` |
| **DEF-09** | Winner Fanfare Audio Re-firing on Screen Refresh | Confirmed Bug / Presentation | **LOW** | `public/app.js:5200-5280` |
| **DEF-10** | Global 200ms Order Debounce Across Distinct Stocks | Design Weakness / UX | **LOW** | `server.js:2618-2624` |
| **DEF-11** | IEEE 754 Precision Drift in Weighted Avg Buy Price | Edge-Case Risk | **LOW** | `server.js:2650-2660` |
| **DEF-12** | Extreme Short-Duration News Schedule Stacking | Edge-Case Risk | **MEDIUM** | `server.js:968-977` |
| **DEF-13** | Monolithic Inline CSS Injection in JavaScript Strings | Architectural Debt | **LOW** | `public/app.js` (throughout) |
| **DEF-14** | Missing Rate Limiting on REST API Endpoints | Security Concern | **MEDIUM** | `server.js:2050-2180` |
| **DEF-15** | Monolithic File Coupling (11,435 line Client Script) | Architectural Debt | **HIGH** | `public/app.js`, `server.js` |
| **DEF-16** | Unhandled QuotaExceeded on Safari LocalStorage | Edge-Case Risk | **LOW** | `public/app.js:1410-1425` |
| **DEF-17** | AudioContext Autoplay Policy Lockout on Standalone Displays | UX / Environment | **LOW** | `public/app.js:300-340` |
| **DEF-18** | Projector Card DOM Rebuilding Page Flicker | Cosmetic / Visual | **LOW** | `public/app.js:3820-3910` |

---

## 2. Detailed Issue Reports

### DEF-01: Dual DOM Hierarchy & Namespace Collisions
- **Category**: Confirmed Bug / Design Weakness
- **Severity**: **HIGH**
- **Affected Feature**: Event Configuration, Stock Universe Builder, Setup Locking
- **Source File & Function**: [public/index.html:120-410](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/index.html#L120-L410), [public/app.js:650-890](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L650-L890)
- **Evidence**:
  The application renders setup forms in two separate views:
  1. `#eventSetupView` (standalone pre-event wizard view).
  2. `#hostTabContentSetup` (in-tab setup editor inside the Host Dashboard).
  Historically, 21 elements shared identical IDs (e.g., `inputStartingCash`, `selectDayDuration`, `tableStockUniverse`). While patched by prefixing `hostTabSetup_`, both DOM trees remain in the document. A query like `document.getElementById('selectDayDuration')` targets the standalone wizard even when the user is interacting with the host tab, causing silent synchronization failures if not guarded.
- **Root Cause**: Incomplete migration from a multi-page setup wizard to an embedded host management tab.
- **Proposed Repair**: Consolidate setup into a single reusable component/template or conditionally mount the setup container into the active parent container.
- **Regression Tests Needed**: Verify changes to duration, cash, or active stocks save identically from both wizard and host tab.

---

### DEF-02: Monolithic Code Duplication (`formatClock12H`)
- **Category**: Confirmed Bug / Code Quality
- **Severity**: **LOW**
- **Affected Feature**: Timestamp formatting across host, trader, and projector terminals
- **Source File & Function**: [public/app.js:2203-2219](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L2203-L2219) and [public/app.js:4948-4964](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L4948-L4964)
- **Evidence**:
  `formatClock12H` is defined twice with identical signatures in `public/app.js`:
  ```javascript
  // Line 2203
  function formatClock12H(dateOrIso, includeSeconds = false) { ... }
  // Line 4948
  function formatClock12H(dateOrIso, includeSeconds = false) { ... }
  ```
- **Root Cause**: Copy-paste during expansion of the Projector presentation module in an 11,000-line monolithic script.
- **Proposed Repair**: Delete the duplicate definition at line 4948; place all formatting utilities in a shared `utils/formatters.js` module.

---

### DEF-03: In-Memory Session Invalidation on Unclean Restart
- **Category**: Confirmed Bug / Architecture
- **Severity**: **MEDIUM**
- **Affected Feature**: Reconnection and Crash Recovery
- **Source File & Function**: [server.js:52](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L52), [server.js:2381-2446](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2381-L2446)
- **Evidence**:
  Sessions are held in an in-memory Map: `const sessions = new Map();`. While `saveStateToDisk` serializes `gameState`, `teams`, `companies`, and `executedTrades`, the `sessions` map is not serialized to disk. If the Node.js process restarts unexpectedly, all active `ttfc_session_token` tokens become unknown. When clients attempt `RESUME_SESSION`, the server responds with `SESSION_EXPIRED`, forcing all 30+ team laptops to manually log in again during an active live event.
- **Root Cause**: Session tokens were treated as transient WebSocket attachments rather than persistent event state.
- **Proposed Repair**: Serialize the `sessions` map into `data/sessions_active.json` or append session records into `live_game_state.json`.
- **Regression Tests Needed**: Disconnect server mid-session, restart process, verify client auto-resumes without credential re-entry.

---

### DEF-04: Client-Side News Masking for Host
- **Category**: Design Weakness / Security
- **Severity**: **MEDIUM**
- **Affected Feature**: Host News Wire Privacy
- **Source File & Function**: [public/app.js:7700-7750](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L7700-L7750), [public/app.js:9556-9618](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L9556-L9618)
- **Evidence**:
  The 60-second host privacy mask is implemented on the frontend. While non-host sockets are stripped of impacts by the server, the Host client receives the full `impacts` object in its WebSocket state regardless of whether the mask is toggled. An observer with browser DevTools open on the host laptop can read all upcoming price shocks before their scheduled trigger time.
- **Root Cause**: Privacy protection was designed as an anti-shoulder-surfing visual safeguard rather than a cryptographic/server-gated disclosure.
- **Proposed Repair**: Require an explicit WebSocket action `REQUEST_NEWS_IMPACT_REVEAL` from the host to fetch raw impact deltas on demand, with server-enforced 60-second expiration.

---

### DEF-05: Uncapped Canvas Sparkline Redraw & Memory Growth
- **Category**: Design Weakness / Performance
- **Severity**: **MEDIUM**
- **Affected Feature**: Stock Board Sparkline Charts (Host, Trader, Projector)
- **Source File & Function**: [public/app.js:3380-3490](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L3380-L3490)
- **Evidence**:
  Canvas 2D contexts for stock sparklines are obtained and cleared continuously on every tick. On low-spec laptops with 20 stocks rendering simultaneously at 1-second intervals, CPU usage rises linearly over multi-hour events due to continuous path drawing and garbage generation (`beginPath()`, `stroke()`, `arc()`).
- **Proposed Repair**: Implement dirty-checking: only redraw sparklines when `stock.currentPrice` has actually changed from the previous tick or when the price history array length increases.

---

### DEF-06: Test Suite Port Collision & Dirty Server Re-use
- **Category**: Confirmed Bug (Tests)
- **Severity**: **HIGH**
- **Affected Feature**: Automated QA and CI/CD
- **Source File & Function**: `test_dynamic_upgrade_suite.js:21`, `test_master_lifecycle_and_isolation.js:18`
- **Evidence**:
  Multiple test suites hardcode port 3089 (`TEST_PORT = 3089`). When executed in sequence or in parallel, the second suite crashes with `EADDRINUSE`. Furthermore, `ensureServerRunning()` in legacy suites reuses an existing process without verifying whether it is running clean or mutated state from a previous day.
- **Proposed Repair**: Deprecate legacy piecemeal suites in favor of `test_unified_master_flow.js` which runs an isolated server on port 3099 with automatic child process cleanup on exit.

---

### DEF-07: Stale Active Countdown Timer on Socket Drop
- **Category**: Likely Bug / State Machine
- **Severity**: **MEDIUM**
- **Affected Feature**: 3-2-1 Resume Countdown
- **Source File & Function**: [server.js:2540-2565](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2540-L2565)
- **Evidence**:
  `startResumeCountdown` initiates a 3-second countdown timer. If the Host triggers a pause or disconnects immediately after hitting resume, `activeCountdown` continues to decrement on the server unless explicitly cancelled. If an invalid state transition occurs, the server flips to `LIVE` even if the Host intended to halt.
- **Proposed Repair**: Add an explicit `cancelResumeCountdown()` call to `PAUSE_MARKET` and `DISCONNECT` handlers.

---

### DEF-08: Race Hazard Between Polling Fallback & WebSocket Push
- **Category**: Design Weakness
- **Severity**: **MEDIUM**
- **Affected Feature**: Realtime Synchronization
- **Source File & Function**: [public/app.js:1560-1610](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L1560-L1610)
- **Evidence**:
  `public/app.js` runs a background HTTP fetch poll if the WebSocket connection drops. When the WebSocket reconnects, an in-flight HTTP request may resolve *after* a newer WebSocket `TICK_UPDATE` has already been processed, resulting in temporary UI state rollback (flickering backwards by 1 tick).
- **Proposed Repair**: Track `stateVersion` or `serverTimeMs`. Reject any payload whose timestamp or version is strictly less than the currently rendered state.

---

### DEF-09: Winner Fanfare Audio Re-firing on Screen Refresh
- **Category**: Confirmed Bug / Presentation
- **Severity**: **LOW**
- **Affected Feature**: Winner Announcement Ceremony
- **Source File & Function**: [public/app.js:5200-5280](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L5200-L5280)
- **Evidence**:
  When a host or projector terminal refreshes during Rank 1 reveal, `presentationState` restores the current rank index, but the presentation logic evaluates `revealRank(1)` as a new event, re-triggering the full brass fanfare audio synthesizer even though the ceremony is already in progress.
- **Proposed Repair**: Track `hasPlayedAudio` flag in `presentationState` or verify rank state before playing audio cue.

---

### DEF-10: Global 200ms Order Debounce Across Distinct Stocks
- **Category**: Design Weakness / UX
- **Severity**: **LOW**
- **Affected Feature**: Order Execution
- **Source File & Function**: [server.js:2618-2624](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2618-L2624)
- **Evidence**:
  The 200ms anti-spam debounce is tracked globally per team: `ws.session.lastOrderAt = now`. If a team places an order on Stock A and immediately attempts to place an order on Stock B 150ms later, the second order is rejected with `ORDER_REJECTED: Please wait a moment between orders`.
- **Proposed Repair**: Track debounce per ticker: `ws.session.lastOrderAtByTicker[ticker] = now`.

---

### DEF-11: IEEE 754 Precision Drift in Weighted Avg Buy Price
- **Category**: Edge-Case Risk
- **Severity**: **LOW**
- **Affected Feature**: Portfolio Valuation & Order Execution
- **Source File & Function**: [server.js:2650-2660](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2650-L2660)
- **Evidence**:
  Weighted average price calculation:
  `avgBuyPrice = +((oldAvg * oldQty + gross) / newQty).toFixed(2);`
  Repeated additions of small quantities over hundreds of trades can introduce minor rounding discrepancies compared to calculating directly from the raw transaction ledger: `sum(qty * price) / totalQty`.
- **Proposed Repair**: Derive average buy price from authoritative executed trade entries or keep integer paise representation internally.

---

### DEF-12: Extreme Short-Duration News Schedule Stacking
- **Category**: Edge-Case Risk
- **Severity**: **MEDIUM**
- **Affected Feature**: Dynamic Schedule Scaling
- **Source File & Function**: [server.js:968-977](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L968-L977)
- **Evidence**:
  In `recalculateNewsScheduleForDuration`, if duration is set to a very short time (e.g. 180s) with 4 news events, `maxAllowed = Math.max(minSeparationSec, newDurationSeconds - readingSec - 25)` clamps multiple events to the exact same second, causing them to fire simultaneously.
- **Proposed Repair**: When duration is reduced below threshold, automatically drop or cull excess events to satisfy $N \le \lfloor D / 90 \rfloor$.

---

### DEF-13: Monolithic Inline CSS Injection in JavaScript Strings
- **Category**: Architectural Debt
- **Severity**: **LOW**
- **Affected Feature**: Frontend Architecture & Styling
- **Source File & Function**: `public/app.js` (thousands of occurrences)
- **Evidence**:
  Large sections of DOM templates in `public/app.js` inject raw inline CSS strings:
  `style="padding: 8px 10px; color: var(--text-muted); font-size: 11px;"`. This prevents modular theming, increases bundle size to 516 KB, and hinders maintainability.
- **Proposed Repair**: Migrate inline styles to CSS utility classes in `public/style.css`.

---

### DEF-14: Missing Rate Limiting on REST Endpoints
- **Category**: Security Concern
- **Severity**: **MEDIUM**
- **Affected Feature**: HTTP API (`/api/universe/active`, `/api/state`, `/export-csv`)
- **Source File & Function**: [server.js:2050-2180](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2050-L2180)
- **Evidence**:
  While WebSocket actions enforce a 200ms debounce, HTTP endpoints lack rate limiting. An automated script or curious student hammering `/api/state` or `/export-csv` can consume significant Node.js event loop capacity.
- **Proposed Repair**: Add an in-memory IP token bucket rate limiter middleware for all `/api/*` and `/export-csv` routes.

---

### DEF-15: Monolithic File Coupling
- **Category**: Architectural Debt
- **Severity**: **HIGH**
- **Affected Feature**: Maintainability, Testability, Code Quality
- **Source File & Function**: `public/app.js` (11,435 lines), `server.js` (4,773 lines)
- **Evidence**:
  All client logic (host tabs, trading desk, projector views, sound synthesizer, modals, charts) resides in a single 11,435-line JavaScript file. All backend logic (GBM math, WebSocket router, REST API, state persistence, CSV exporter, audio triggers) resides in a single 4,773-line file.
- **Proposed Repair**: Modularize frontend into ES6 modules (`modules/host/`, `modules/trader/`, `modules/projector/`, `modules/audio/`) and backend into services (`services/market_engine.js`, `services/order_router.js`, `services/state_store.js`).

---

### DEF-16: Unhandled QuotaExceeded on Safari LocalStorage
- **Category**: Edge-Case Risk
- **Severity**: **LOW**
- **Affected Feature**: Client Session Storage
- **Source File & Function**: [public/app.js:1410-1425](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L1410-L1425)
- **Evidence**:
  Calls to `localStorage.setItem('ttfc_session_token', token)` are made without wrapping in `try...catch`. In Safari private browsing or restricted browser environments, accessing `localStorage` throws an exception, halting script execution.
- **Proposed Repair**: Wrap all `localStorage` access in safe utility helpers with in-memory fallback.

---

### DEF-17: AudioContext Autoplay Policy Lockout on Standalone Displays
- **Category**: UX / Environment
- **Severity**: **LOW**
- **Affected Feature**: Web Audio API Sound Synthesizer
- **Source File & Function**: [public/app.js:300-340](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L300-L340)
- **Evidence**:
  If the sound console is launched on an unattended presentation computer, modern Chromium browsers prevent the Web Audio API context from transitioning to `'running'` state without a prior user gesture (click or keypress), causing initial sound cues to fail silently.
- **Proposed Repair**: Display a prominent `"Click to Initialize Sound Engine"` overlay modal on `#soundConsoleView` until unlocked.

---

### DEF-18: Projector Card DOM Rebuilding Page Flicker
- **Category**: Cosmetic / Visual
- **Severity**: **LOW**
- **Affected Feature**: Projector Stock Grid Pagination
- **Source File & Function**: [public/app.js:3820-3910](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L3820-L3910)
- **Evidence**:
  When the projector 8-second pagination timer advances to the next page, existing card DOM nodes are destroyed and reconstructed via `innerHTML`. This causes visual flashing and destroys active CSS transition animations.
- **Proposed Repair**: Implement smooth CSS opacity cross-fades or pre-render card containers and toggle visibility classes.
