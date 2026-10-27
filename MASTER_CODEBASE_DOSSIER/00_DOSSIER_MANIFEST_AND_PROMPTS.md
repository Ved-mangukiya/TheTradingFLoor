# THE TRADING FLOOR CHAMPIONSHIP 2026 — MASTER CODEBASE DOSSIER
========================================================================================
COMPLETE 9-FILE SYSTEM PACKAGE FOR HIGH-CONTEXT AI ANALYSIS (ARGON / CLAUDE / GEMINI)
========================================================================================

This dossier contains the **entire, uncompressed, production-ready codebase** of The Trading Floor Championship 2026 packaged into **under 10 files** (exactly 9 files). 
Every byte of logic, HTML markup, CSS styling, backend servers, state machine modules, market simulations, and test contracts is included.

---

## 📁 DOSSIER FILE MANIFEST (9 FILES TOTAL)

| # | Filename | Description | Content / Modules Included |
| :---: | :--- | :--- | :--- |
| **00** | `00_DOSSIER_MANIFEST_AND_PROMPTS.md` | Master Index & Execution Plan | File manifest, token analysis, and the 3 sequential copy-paste prompts. |
| **01** | `01_SYSTEM_SPECS_AND_ARCHITECTURE.md` | System Specs & Rules SSOT | `AGENTS.md`, `PRODUCT_SPEC.md`, `BUSINESS_RULES.md`, `EVENT_LIFECYCLE.md`, `ARCHITECTURE.md`, `KNOWN_ISSUES.md`, `CURRENT_STATUS.md`. |
| **02** | `02_BACKEND_SERVER_CORE.js` | Master Node.js Server | Full verbatim `server.js` (~193 KB): Express HTTP routes, WebSocket server, authoritative market loop, circuit breakers, order processing, backups. |
| **03** | `03_BACKEND_MODULES_AND_CONFIG.js` | Subsystem Modules & Config | `package.json` + `server/state_machine.js`, `accounting.js`, `market_engine.js`, `news_scheduler.js`, `persistence.js`, `sanitizer.js`. |
| **04** | `04_FRONTEND_MARKUP_INDEX.html` | Master Client Markup | Full verbatim `public/index.html` (~349 KB): Host Dashboard, Trader Desk, Projector Display, all modals, dialogs, overlays, SVGs. |
| **05** | `05_FRONTEND_STYLES_STYLE.css` | Complete Theme & Layouts | Full verbatim `public/style.css` (~92 KB): Ivory luxury design system, typography, responsive breakpoints, cards, tables, overlays, modal backdrops. |
| **06** | `06_FRONTEND_APP_CORE.js` | Master Client Application Logic | `public/js/state_guard.js` + full verbatim `public/app.js` (~565 KB): WebSocket listeners, trading logic, projector cycle, Web Audio sound engine, action contract locks. |
| **07** | `07_MARKET_DATA_AND_GAME_STATE.json` | Market Universe & Scenarios | `data/universe_active.json`, `data/scenario_live.json`, and authoritative game state schemas. |
| **08** | `08_TEST_SUITES_AND_CONTRACTS.js` | Verification Suites | `tests/test_chunk4_action_contracts.js`, `tests/test_master_lifecycle_and_isolation.js`, `tests/test_dynamic_upgrade_suite.js`. |

---

## 🧠 CONTEXT & MEMORY RECALL FEASIBILITY

- **Total Codebase Size**: ~1.45 MB of raw text.
- **Estimated Token Count**: ~340,000 to 360,000 tokens.
- **Feasibility with a 1M+ Token Window**: **100% FEASIBLE**. 
  - A 1,000,000 token context window leaves over **600,000 tokens of headroom**.
  - Modern frontier models demonstrate near-perfect (>99%) needle-in-a-haystack recall across 1M tokens.
  - Because all 9 files are loaded into active attention simultaneously, the model can cross-reference:
    1. DOM button IDs in `04_FRONTEND_MARKUP_INDEX.html`
    2. Click listeners and WebSocket emissions in `06_FRONTEND_APP_CORE.js`
    3. Server state machine transitions and broadcast messages in `02_BACKEND_SERVER_CORE.js`
    4. CSS modal container overflow properties in `05_FRONTEND_STYLES_STYLE.css`
    5. Test contract assertions in `08_TEST_SUITES_AND_CONTRACTS.js`

---

## 🎯 THE 3 SEQUENTIAL PROMPTS (READY TO COPY & PASTE)

Use these 3 prompts in the exact order below within the same chat conversation:

```markdown
### ============================================================================
### PROMPT 1: ARCHITECTURAL DEEP-DIVE, BUTTON STATE-MACHINE & TIMEOUT BUG
### ============================================================================

You are an elite principal software architect and systems engineer reviewing the complete codebase of "The Trading Floor Championship 2026", an offline-first financial market simulation platform.

I have uploaded the entire production codebase across 8 companion files (01_SYSTEM_SPECS_AND_ARCHITECTURE.md through 08_TEST_SUITES_AND_CONTRACTS.js). Please ingest and index every function, DOM element, WebSocket handler, and CSS rule across both client and server.

Before recommending code changes, conduct a rigorous diagnostic audit focused specifically on the following operational flaws:

1. THE "REQUEST TIMED OUT" BUG ROOT CAUSE:
   - In 06_FRONTEND_APP_CORE.js (lines ~12140-12180), examine applyActionContractLock() and its 5000ms timer that fires showOrderToast('Request timed out. Please retry.', false).
   - Trace which action buttons invoke or are affected by this lock. Identify why this timeout occurs (e.g. missing releaseActionLockById calls in WebSocket message handlers, mismatched event names, asynchronous drops, or lack of response payloads from 02_BACKEND_SERVER_CORE.js).
   - Pinpoint every code path that can leave a button permanently locked or trigger false "Request timed out" toasts.

2. HOST PANEL BUTTON FLOW & THE "ONE BUTTON" STATE MACHINE:
   - Currently, the Host interface has multiple confusing and duplicate buttons across tabs (e.g. #btnMarketPauseSoft, #btnMarketPauseBlackout, #btnHostPauseSoft, #btnHostPauseBlackout, #btnMarketResume).
   - The host can accidentally double-click pause, or struggle to know whether the market is paused, soft-frozen, or blacked out.
   - Design a clean, bulletproof Singular Action State Machine:
     * In LIVE state: Display exactly ONE primary action button: [ ⏸ Pause Market ] (with an integrated clean mode selector for Soft Freeze vs Blackout).
     * The moment the market enters PAUSED: The Pause button IMMEDIATELY hides/morphs into [ ▶ Resume Market (3-2-1) ] in the exact same slot. The host cannot double-click Pause because the Pause button is physically absent in PAUSED state!
     * When Resumed, it runs the 3-2-1 countdown and morphs back to Pause.
     * Ensure Blackout mode acts as a clean, predictable toggle that never gets stuck in corrupted overlay states or conflicts with Soft Pause.

3. PAUSE & BLACKOUT OVERLAY SYNC FLAW:
   - Trace syncRoleOverlays() in 06_FRONTEND_APP_CORE.js and server.js lines 3270-3315.
   - Check how #blackoutOverlay and #softPauseOverlay behave on Trader screens and Projector screens when switching between LIVE, PAUSED (VISIBLE_FROZEN), and PAUSED (BLACKOUT).
   - Identify why overlays get stuck, flicker, or fail to dismiss cleanly upon market resume.

Deliverable for Prompt 1:
- A clear diagnostic report explaining exactly what is broken in the current code and why.
- The architectural state-machine specification for the new Singular Action Market Operations Bar.
- The exact resolution plan for eliminating the "Request timed out" bug forever.
```

---

```markdown
### ============================================================================
### PROMPT 2: UI/UX MASTER POLISH, ZERO VERTICAL SCROLL IN POPUPS & HOST WORKFLOW
### ============================================================================

Now that we have diagnosed the architectural state machine and timeout mechanisms, let's overhaul the user interface and visual ergonomics.

Our core non-negotiable requirement:
"ZERO VERTICAL SCROLL IN ANY POPUP, MODAL, OR DIALOG."
During a fast-paced live championship, professors and student coordinators must NEVER have to awkwardly scroll inside a modal popup. Every dialog must fit completely and gracefully within the viewport (supporting standard 1366x768 laptop screens up to 4K displays).

Please audit and redesign the UI based on 04_FRONTEND_MARKUP_INDEX.html and 05_FRONTEND_STYLES_STYLE.css:

1. ZERO-SCROLL MODAL & POPUP ARCHITECTURE:
   - Audit every modal and dialog in the application:
     * #eventSetupModal (Event & Championship Configuration)
     * #adminAuditModal / #orderReceiptModal
     * #newsDetailsModal (News Control & Private Impacts)
     * #traderDayCompletedOverlay & #dailyLeaderboardModal
     * Confirmation dialogs (#btnConfirmEmergencyStop, reset modals, etc.)
   - Replace rigid vertical stacking with responsive, multi-column grid layouts:
     * Set max-height: calc(100vh - 48px), display: flex; flex-direction: column;.
     * Headers and action footers remain fixed at the top and bottom.
     * Modal body uses dense 2-column or 3-column auto-packing with compact form controls, crisp typography, and optimized padding so all content fits on 768p viewports with overflow-y: hidden.

2. HOST OPERATIONS BAR & COCKPIT REDESIGN:
   - Redesign the Live Market Operations Bar into an executive "Air Traffic Control" console:
     * Prominent Singular Action Button ([ ⏸ Pause Market ] <-> [ ▶ Resume Market 3-2-1 ]).
     * Clean status pill indicator showing: Status (LIVE / PAUSED / COUNTDOWN), Active Day, Remaining Time, and Trading Mode.
     * Cleanly grouped secondary actions: Conclude Day, Add Day, Emergency Stop.
     * Eliminate visual noise, cluttered redundant buttons, and tab-hopping.

3. PRESERVING THE "IVORY LUXURY" DESIGN SYSTEM:
   - Ensure all modifications strictly adhere to the offline-first Ivory Luxury theme defined in 01_SYSTEM_SPECS_AND_ARCHITECTURE.md (champagne gold accents, deep obsidian borders, high contrast ratios, Web Audio API sound feedback).
   - Zero external CDNs, fonts, or scripts.

Deliverable for Prompt 2:
- The complete CSS rules and structural HTML adjustments to eliminate vertical scroll in all modals.
- The visual and component layout for the unified Host Cockpit.
- Verification that all layouts fit within standard 1366x768 and 1920x1080 screens without scrollbars.
```

---

```markdown
### ============================================================================
### PROMPT 3: DEEP BUG HUNTER & MASTER PRODUCTION CODEBASE HARDENING
### ============================================================================

Now execute the complete implementation and deep bug hunt across the entire codebase.

Like subtle, elusive edge-case bugs that human reviewers routinely miss (e.g. asynchronous race conditions, type-coercion bugs, silent promise drops, or stale closures):
Examine the interaction between 02_BACKEND_SERVER_CORE.js, 03_BACKEND_MODULES_AND_CONFIG.js, and 06_FRONTEND_APP_CORE.js.

1. THE "HUMAN-BLIND" EDGE CASES AUDIT:
   - Floating-Point Circuit Breaker Boundary Math:
     * Inspect price bounds: upperCircuit = round(dayOpenPrice * 1.20) and lowerCircuit = round(dayOpenPrice * 0.80).
     * Check if rapid micro-tick fluctuations or order execution math can bypass the circuit breaker or cause rounding drift across multiple days.
   - Client-Server State Desynchronization:
     * Check what happens if a trader places an order while the server has JUST received HOST_PAUSE in the exact same millisecond. Does the client show success while the server rejects?
     * Inspect RESUME_SESSION token reconnection logic. If a student's Wi-Fi blips and reconnects, are WebSocket event listeners re-bound multiple times? Does this cause duplicate sound playback or duplicate toasts?
   - Memory Leak & Timer Accumulation:
     * Check inFlightActionButtons Map, firedNewsEventsPerDay Map, and rolling price coordinate history. Are old timers and objects cleanly garbage-collected when days advance or championships reset?
   - Order Queue Debounce:
     * Verify whether the 200ms per-session debounce in server.js can be circumvented via multiple concurrent browser tabs from the same team.

2. COMPLETE PRODUCTION-READY CODE IMPLEMENTATION:
   - Provide the complete, drop-in replacement code for:
     a) The Host Cockpit Singular Action Button & State Machine in index.html and app.js.
     b) The bug-free Action Contract Lock engine (eliminating "Request timed out" false alarms).
     c) The Zero-Scroll CSS rules for all modals in style.css.
     d) The hardened WebSocket and state transition handlers in server.js.
   - Ensure all 86 automated test contracts in 08_TEST_SUITES_AND_CONTRACTS.js continue to pass with 100% compliance.

Deliverable for Prompt 3:
- Full, verbatim, ready-to-paste code replacements with precise line references and explanations.
```
