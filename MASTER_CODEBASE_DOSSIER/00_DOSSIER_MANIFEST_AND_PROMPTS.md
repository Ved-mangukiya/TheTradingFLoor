# THE TRADING FLOOR CHAMPIONSHIP — MASTER CODEBASE DOSSIER
========================================================================================
COMPLETE 10-FILE SYSTEM DOSSIER OPTIMIZED FOR ARGON 4 / CLAUDE / GEMINI PRO
========================================================================================

This dossier packages the **entire, uncompressed, production-ready codebase** of The Trading Floor Championship into a clean, numbered 10-file suite (00 through 09).
Every single line of backend logic, client SPA markup, luxury CSS styling, state machines, market simulation formulas, active universe data, automated test suites, and visual card stock references is included verbatim.

---

## 📁 COMPLETE DOSSIER FILE MANIFEST (10 FILES)

| File | Filename | Size | Purpose & Content Summary |
| :---: | :--- | :--- | :--- |
| **00** | `00_DOSSIER_MANIFEST_AND_PROMPTS.md` | ~12 KB | Master Index, Token Feasibility Analysis, and 3 Sequential Copy-Paste Prompts for Argon 4. |
| **01** | `01_SYSTEM_SPECS_AND_ARCHITECTURE.md` | ~120 KB | Unified SSOT: `AGENTS.md`, `README.md`, `PRODUCT_SPEC.md`, `BUSINESS_RULES.md`, `EVENT_LIFECYCLE.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `KNOWN_ISSUES.md`, `CURRENT_STATUS.md`. |
| **02** | `02_BACKEND_SERVER_CORE.js` | ~205 KB | Authoritative Node.js Server (`server.js`): Express HTTP, WebSocket server, 1000ms price loop, directional circuit breakers, news transitions, audit logging, disaster recovery. |
| **03** | `03_BACKEND_MODULES_AND_CONFIG.js` | ~25 KB | Subsystem Modules: `package.json` + `server/state_machine.js`, `accounting.js`, `market_engine.js`, `news_scheduler.js`, `persistence.js`, `sanitizer.js`. |
| **04** | `04_FRONTEND_MARKUP_INDEX.html` | ~375 KB | Master SPA Markup (`public/index.html`): Host Control Center, Trader Cockpit, Projector Arena (8-card rotating grid), Sound Console, all overlays, modals, and embedded luxury SVGs. |
| **05** | `05_FRONTEND_STYLES_STYLE.css` | ~138 KB | Complete Design System (`public/style.css`): Warm Ivory Pastel Luxury palette, typography, high-contrast WCAG AAA inks, cards, tables, modals, overlays, responsive breakpoints. |
| **06** | `06_FRONTEND_APP_CORE.js` | ~635 KB | Client Application Logic (`public/js/state_guard.js` + `public/app.js`): WebSocket sync, order dispatch, projector cycle, Web Audio synthesizer, action contract locks, state machine views. |
| **07** | `07_MARKET_DATA_AND_GAME_STATE.json` | ~50 KB | Active Market Universe (`data/universe_active.json`), live news schedule (`data/scenario_live.json`), and test scenarios. |
| **08** | `08_TEST_SUITES_AND_CONTRACTS.js` | ~100 KB | All 4 Authoritative Test Suites: `test_unified_master_flow.js`, `test_chunk2_state_machine.js`, `test_chunk3_ui_and_overlays.js`, and `test_chunk4_action_contracts.js` (100% passing). |
| **09** | `09_VISUAL_CARD_STOCK_REFERENCE.html` | ~125 KB | Visual Design Reference (`card.html`): v4 Projector-Grade Card Stock Suite, guilloche security patterns, 3D parallax tilt, metallic foil seals, and letterpress typography. |

---

## 🧠 CONTEXT & TOKEN FEASIBILITY FOR ARGON 4 / CLAUDE / GEMINI

- **Total Uncompressed File Size**: ~1.78 MB of raw text.
- **Estimated Total Token Count**: ~380,000 to 420,000 tokens.
- **Feasibility**:
  - **Argon / Claude 3.7 / Gemini Pro (1M to 2M token window)**: **100% FEASIBLE**.
  - Leaves **600,000+ tokens of free headroom** in a 1M window for thorough analysis, reasoning, and generating drop-in replacement code.
  - Feeding these 10 files gives the AI complete, un-truncated visibility into:
    1. Every HTML tag and button ID in `04_FRONTEND_MARKUP_INDEX.html`.
    2. Every DOM listener and WebSocket dispatch in `06_FRONTEND_APP_CORE.js`.
    3. Every server route, timer, and circuit breaker in `02_BACKEND_SERVER_CORE.js`.
    4. Every CSS class and token in `05_FRONTEND_STYLES_STYLE.css`.
    5. The authoritative test contracts in `08_TEST_SUITES_AND_CONTRACTS.js`.
    6. The visual target aesthetic in `09_VISUAL_CARD_STOCK_REFERENCE.html`.

---

## 🚀 HOW TO USE THIS DOSSIER WITH ARGON 4

1. Copy or upload the files in `MASTER_CODEBASE_DOSSIER/` to your chat session with Argon 4.
2. Use the 3 ready-made prompts below sequentially in the same conversation:

---

### PROMPT 1: CODEBASE INGESTION & ARCHITECTURAL AUDIT
```markdown
### ============================================================================
### PROMPT 1: CODEBASE INGESTION, ARCHITECTURAL AUDIT & STATE MACHINE VERIFICATION
### ============================================================================

You are an elite principal software architect, financial systems engineer, and UI/UX expert reviewing "The Trading Floor Championship", an institutional-grade, offline-first stock market simulation engine.

I have provided the complete codebase dossier across 9 files (01_SYSTEM_SPECS_AND_ARCHITECTURE.md through 09_VISUAL_CARD_STOCK_REFERENCE.html). Ingest and analyze every module, function, DOM element, WebSocket event, and CSS rule across both client and server.

Please conduct an architectural audit focusing on:
1. THE 1000ms PRICE ENGINE & MATHEMATICAL RIGOR:
   - Verify the 5-component drift formula in 02_BACKEND_SERVER_CORE.js:
     * Gaussian noise (Box-Muller transform Z ~ N(0,1)).
     * Beta and volatility scaling (sigma_eff = max(0.0035, sigma_base * beta * 1.5)).
     * Micro-drift (zero-bias random walk).
     * Cyclical intraday wave (cosine harmonic).
     * Fundamental mean reversion (-0.00015 * (P - P_day_open)).
   - Verify dynamic order impact (liquidity pressure on buy/sell).
   - Verify news shock smoothstep transition (u = clamp((t - t0)/T, 0, 1), s(u) = 3u^2 - 2u^3).
   - Verify directional circuit breaker limits (+-20%) and the 0.8% mean-reversion unhalt threshold.

2. HOST COCKPIT & CLIENT-SERVER STATE MACHINE:
   - Verify the singular market operations flow: LIVE -> PAUSED (VISIBLE_FROZEN or BLACKOUT) -> 3-2-1 RESUMPTION -> LIVE.
   - Verify the Day conclusion state machine (status = 'DAY_COMPLETED', audit snapshot, carry-over to Day 2).
   - Ensure action contract locks prevent double-click order spam and eliminate race conditions.

Deliverable for Prompt 1:
- Comprehensive diagnostic report on the engine architecture and state machine integrity.
- Verification of mathematical formulas against real-world institutional standards.
```

---

### PROMPT 2: VISUAL BRAND IDENTITY & CARD-STOCK LUXURY DESIGN SYSTEM OVERHAUL
```markdown
### ============================================================================
### PROMPT 2: VISUAL BRAND IDENTITY & CARD-STOCK LUXURY DESIGN SYSTEM OVERHAUL
### ============================================================================

Now that the architecture and mathematical engine are verified, let's examine the visual design system across the application.

We have a dedicated visual design reference file: 09_VISUAL_CARD_STOCK_REFERENCE.html (v4 Projector-Grade Card Stock Suite).
This file contains the physical card-stock aesthetic, security guilloche patterns, 3D parallax tilt, letterpress dotted financial ledgers, segmented money bars, 64-point metallic foil seals, and WCAG AAA high-contrast projector typography.

Please review 04_FRONTEND_MARKUP_INDEX.html, 05_FRONTEND_STYLES_STYLE.css, 06_FRONTEND_APP_CORE.js, and 09_VISUAL_CARD_STOCK_REFERENCE.html:

1. CARD DESIGN & TACTILE MICRO-ANIMATIONS:
   - How can we infuse the card-stock architecture from 09_VISUAL_CARD_STOCK_REFERENCE.html into:
     a) Trader market cards and order modals.
     b) Projector stock cards (8-card rotating grid with top gainer/loser spotlights).
     c) Informative state overlays (#countdownOverlay, #softPauseOverlay, #blackoutOverlay, #traderWaitingRoomOverlay, #traderDayCompletedOverlay).
   - Ensure cards have subtle, smooth hover micro-animations on interactive screens (Trader and Host), while Projector mode maintains an automated, smooth carousel with no cursor.

2. ZERO-SCROLL MODAL GUARANTEE:
   - Ensure all modals (#tradeModal, #fullNewsModal, #portfolioDetailModal, #eventConfigModal) fit 100% within the viewport without awkward internal vertical scrollbars, even on 1366x768 laptop screens.
   - Confirm equal button heights, balanced two-column cockpit layouts, and flush baselines.

Deliverable for Prompt 2:
- Actionable UI/UX implementation plan mapping the design language from 09_VISUAL_CARD_STOCK_REFERENCE.html directly into the application's real stylesheets and components.
```

---

### PROMPT 3: READY-TO-PASTE PRODUCTION CODE IMPLEMENTATION
```markdown
### ============================================================================
### PROMPT 3: READY-TO-PASTE PRODUCTION CODE IMPLEMENTATION
### ============================================================================

Based on the audit from Prompt 1 and the design system plan from Prompt 2:

Provide the exact, complete, drop-in replacement code for:
1. Any required CSS updates in public/style.css (preserving the Warm Ivory Luxury palette, high-contrast typography, and tactile card stock aesthetics).
2. Any required UI enhancements in public/index.html and public/app.js.
3. Ensure all 4 automated test suites in 08_TEST_SUITES_AND_CONTRACTS.js continue to pass with 100% compliance:
   - test_unified_master_flow.js
   - test_chunk2_state_machine.js
   - test_chunk3_ui_and_overlays.js
   - test_chunk4_action_contracts.js

Deliverable for Prompt 3:
- Verbatim, production-grade code changes with exact line numbers and integration steps.
```
