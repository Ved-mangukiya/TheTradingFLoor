const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'MASTER_CODEBASE_DOSSIER');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Building MASTER_CODEBASE_DOSSIER in:', outDir);

function readFileSafe(relPath) {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  console.warn('File not found:', fullPath);
  return '';
}

// -------------------------------------------------------------
// 1. FILE 01: SYSTEM SPECS AND ARCHITECTURE
// -------------------------------------------------------------
console.log('Generating 01_SYSTEM_SPECS_AND_ARCHITECTURE.md...');
const agentsMd = readFileSafe('AGENTS.md');
const readmeMd = readFileSafe('README.md');
const productSpec = readFileSafe('docs/PRODUCT_SPEC.md');
const businessRules = readFileSafe('docs/BUSINESS_RULES.md');
const eventLifecycle = readFileSafe('docs/EVENT_LIFECYCLE.md');
const architecture = readFileSafe('docs/ARCHITECTURE.md');
const designSystem = readFileSafe('docs/DESIGN_SYSTEM.md');
const knownIssues = readFileSafe('docs/KNOWN_ISSUES.md');
const currentStatus = readFileSafe('tasks/CURRENT_STATUS.md');

const file01Content = `# THE TRADING FLOOR CHAMPIONSHIP — MASTER ARCHITECTURE & SPECIFICATION DOSSIER
========================================================================================
SINGLE SOURCE OF TRUTH: SYSTEM ARCHITECTURE, RULES, STATE MACHINES & DEFECT REGISTER
========================================================================================

> This master document combines all architectural constraints, business formulas, event lifecycles, 
> network protocols, and known boundaries into a single consolidated reference for deep AI analysis (Argon / Claude / Gemini).

---

# SECTION 1: CORE ARCHITECTURAL INVARIANTS (FROM AGENTS.MD)

` + agentsMd + `

---

# SECTION 2: SYSTEM USER MANUAL & REPOSITORY MAP (FROM README.MD)

` + readmeMd + `

---

# SECTION 3: PRODUCT SPECIFICATIONS & CHAMPIONSHIP MECHANICS

` + productSpec + `

---

# SECTION 4: AUTHORITATIVE BUSINESS RULES & MATHEMATICAL ENGINE

` + businessRules + `

---

# SECTION 5: EVENT LIFECYCLE & STATE MACHINE SPECIFICATION

` + eventLifecycle + `

---

# SECTION 6: SYSTEM ARCHITECTURE & NETWORK PROTOCOLS

` + architecture + `

---

# SECTION 7: LUXURY DESIGN SYSTEM & VISUAL TOKENS

` + designSystem + `

---

# SECTION 8: VERIFIED SYSTEM BOUNDARIES & DEFECT REGISTER

` + knownIssues + `

---

# SECTION 9: CURRENT VERIFIED SYSTEM STATUS & ACTION LOG

` + currentStatus + `
`;

fs.writeFileSync(path.join(outDir, '01_SYSTEM_SPECS_AND_ARCHITECTURE.md'), file01Content, 'utf8');

// -------------------------------------------------------------
// 2. FILE 02: BACKEND SERVER CORE (server.js)
// -------------------------------------------------------------
console.log('Generating 02_BACKEND_SERVER_CORE.js...');
const serverJs = readFileSafe('server.js');
const file02Content = `/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP — BACKEND SERVER CORE
 * File: server.js
 * Pure Node.js + Express + WebSocket (ws) | Zero External Dependencies
 * Zero CDN | Authoritative State Machine | Real-time Market Price Loop
 * Directional Circuit Breakers | Automated Backups | Audit Trail
 * ============================================================================
 */

` + serverJs;
fs.writeFileSync(path.join(outDir, '02_BACKEND_SERVER_CORE.js'), file02Content, 'utf8');

// -------------------------------------------------------------
// 3. FILE 03: BACKEND MODULES AND CONFIG
// -------------------------------------------------------------
console.log('Generating 03_BACKEND_MODULES_AND_CONFIG.js...');
const pkgJson = readFileSafe('package.json');
const serverStateMachine = readFileSafe('server/state_machine.js');
const serverAccounting = readFileSafe('server/accounting.js');
const serverMarketEngine = readFileSafe('server/market_engine.js');
const serverNewsScheduler = readFileSafe('server/news_scheduler.js');
const serverPersistence = readFileSafe('server/persistence.js');
const serverSanitizer = readFileSafe('server/sanitizer.js');

const file03Content = `/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP — BACKEND MODULES & CONFIGURATION
 * Contains: package.json + modular server subsystems from /server directory
 * ============================================================================
 */

// ============================================================================
// 1. PACKAGE.JSON CONFIGURATION & DEPENDENCIES
// ============================================================================
/*
` + pkgJson + `
*/

// ============================================================================
// 2. SERVER / STATE_MACHINE.JS
// ============================================================================
` + serverStateMachine + `

// ============================================================================
// 3. SERVER / ACCOUNTING.JS
// ============================================================================
` + serverAccounting + `

// ============================================================================
// 4. SERVER / MARKET_ENGINE.JS
// ============================================================================
` + serverMarketEngine + `

// ============================================================================
// 5. SERVER / NEWS_SCHEDULER.JS
// ============================================================================
` + serverNewsScheduler + `

// ============================================================================
// 6. SERVER / PERSISTENCE.JS
// ============================================================================
` + serverPersistence + `

// ============================================================================
// 7. SERVER / SANITIZER.JS
// ============================================================================
` + serverSanitizer;

fs.writeFileSync(path.join(outDir, '03_BACKEND_MODULES_AND_CONFIG.js'), file03Content, 'utf8');

// -------------------------------------------------------------
// 4. FILE 04: FRONTEND MARKUP (index.html)
// -------------------------------------------------------------
console.log('Generating 04_FRONTEND_MARKUP_INDEX.html...');
const indexHtml = readFileSafe('public/index.html');
const file04Content = `<!--
============================================================================
THE TRADING FLOOR CHAMPIONSHIP — MASTER FRONTEND MARKUP
File: public/index.html
Contains: 
- Public Landing & Auth Screens (Trader / Host / Projector / Sound Console)
- Host Control Center & Live Market Operations Bar
- Trader Cockpit (Market Board, Order Modal, Holdings, Performance)
- Projector Arena Display (8-Card Rotating Grid, Ribbon, Spotlight, Leaderboard)
- Sound Console & Institutional Audio Synthesizer
- Informative State Overlays (Standby, Pause, Blackout, Day Completed, Countdown)
============================================================================
-->

` + indexHtml;
fs.writeFileSync(path.join(outDir, '04_FRONTEND_MARKUP_INDEX.html'), file04Content, 'utf8');

// -------------------------------------------------------------
// 5. FILE 05: FRONTEND STYLES (style.css)
// -------------------------------------------------------------
console.log('Generating 05_FRONTEND_STYLES_STYLE.css...');
const styleCss = readFileSafe('public/style.css');
const file05Content = `/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP — COMPLETE FRONTEND STYLESHEET
 * File: public/style.css
 * Theme: Warm Ivory Pastel Luxury Financial Terminal | Zero External Fonts/CDNs
 * Contains: Design Tokens, Layouts, Cards, Overlays, Modals, Responsive Breakpoints
 * ============================================================================
 */

` + styleCss;
fs.writeFileSync(path.join(outDir, '05_FRONTEND_STYLES_STYLE.css'), file05Content, 'utf8');

// -------------------------------------------------------------
// 6. FILE 06: FRONTEND APP CORE (app.js + state_guard.js)
// -------------------------------------------------------------
console.log('Generating 06_FRONTEND_APP_CORE.js...');
const stateGuardJs = readFileSafe('public/js/state_guard.js');
const appJs = readFileSafe('public/app.js');

const file06Content = `/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP — FRONTEND APPLICATION CORE
 * Files: public/js/state_guard.js + public/app.js
 * Contains: WebSocket Client, Reactive UI State, Trading Desk, Host Cockpit, 
 * Projector Engine, Web Audio Sound Synthesizer, Action Contract Locks
 * ============================================================================
 */

// ============================================================================
// 1. PUBLIC / JS / STATE_GUARD.JS
// ============================================================================
` + stateGuardJs + `

// ============================================================================
// 2. PUBLIC / APP.JS (CORE CLIENT SPA LOGIC)
// ============================================================================
` + appJs;

fs.writeFileSync(path.join(outDir, '06_FRONTEND_APP_CORE.js'), file06Content, 'utf8');

// -------------------------------------------------------------
// 7. FILE 07: MARKET DATA AND GAME STATE
// -------------------------------------------------------------
console.log('Generating 07_MARKET_DATA_AND_GAME_STATE.json...');
const universeActive = readFileSafe('data/universe_active.json');
const scenarioLive = readFileSafe('data/scenario_live.json');
const scenarioTest = readFileSafe('data/scenario_test.json');

const file07Content = JSON.stringify({
  _description: "Active simulation universe, scenario news schedule, and baseline schemas",
  universe_active: universeActive ? JSON.parse(universeActive) : {},
  scenario_live: scenarioLive ? JSON.parse(scenarioLive) : {},
  scenario_test: scenarioTest ? JSON.parse(scenarioTest) : {}
}, null, 2);

fs.writeFileSync(path.join(outDir, '07_MARKET_DATA_AND_GAME_STATE.json'), file07Content, 'utf8');

// -------------------------------------------------------------
// 8. FILE 08: TEST SUITES AND CONTRACTS
// -------------------------------------------------------------
console.log('Generating 08_TEST_SUITES_AND_CONTRACTS.js...');
const testUnifiedFlow = readFileSafe('tests/test_unified_master_flow.js');
const testChunk2StateMachine = readFileSafe('tests/test_chunk2_state_machine.js');
const testChunk3UI = readFileSafe('tests/test_chunk3_ui_and_overlays.js');
const testChunk4ActionContracts = readFileSafe('tests/test_chunk4_action_contracts.js');

const file08Content = `/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP — COMPLETE TEST SUITES & CONTRACTS
 * Contains all 4 authoritative automated verification test suites:
 * 1. test_unified_master_flow.js (36 unified master flow assertions)
 * 2. test_chunk2_state_machine.js (Comprehensive state machine & lifecycle)
 * 3. test_chunk3_ui_and_overlays.js (DOM, overlays, zero-scroll & visual contracts)
 * 4. test_chunk4_action_contracts.js (Action contract locks & anti-double-click)
 * ============================================================================
 */

// ============================================================================
// SUITE 1: TEST_UNIFIED_MASTER_FLOW.JS
// ============================================================================
` + testUnifiedFlow + `

// ============================================================================
// SUITE 2: TEST_CHUNK2_STATE_MACHINE.JS
// ============================================================================
` + testChunk2StateMachine + `

// ============================================================================
// SUITE 3: TEST_CHUNK3_UI_AND_OVERLAYS.JS
// ============================================================================
` + testChunk3UI + `

// ============================================================================
// SUITE 4: TEST_CHUNK4_ACTION_CONTRACTS.JS
// ============================================================================
` + testChunk4ActionContracts;

fs.writeFileSync(path.join(outDir, '08_TEST_SUITES_AND_CONTRACTS.js'), file08Content, 'utf8');

// -------------------------------------------------------------
// 9. FILE 09: VISUAL CARD STOCK REFERENCE (card.html)
// -------------------------------------------------------------
console.log('Generating 09_VISUAL_CARD_STOCK_REFERENCE.html...');
const cardHtml = readFileSafe('card.html');
const file09Content = `<!--
============================================================================
THE TRADING FLOOR CHAMPIONSHIP — VISUAL DESIGN REFERENCE (ARGON OUTPUT)
File: card.html (v4 Projector-Grade Card Stock Suite)
Contains:
- Physical Card-Stock Architecture (.paper, .back.s1, .back.s2)
- Security Guilloche Pattern (.guil) + 3D Parallax Tilt
- Letterpress Dotted Financial Ledger + Segmented Money Bar
- 64-Point Scalloped Metallic Foil Seal + Canvas Foil Flecks
- Slide-Up Read-Only Portfolio Sheet (.sheet) with Interactive Donut
- High-Contrast WCAG AAA Projector-Safe Typography and Colors
Use this file as a visual design reference and mood board for polishing
the application UI/UX across all views.
============================================================================
-->

` + cardHtml;
fs.writeFileSync(path.join(outDir, '09_VISUAL_CARD_STOCK_REFERENCE.html'), file09Content, 'utf8');

// -------------------------------------------------------------
// 10. FILE 00: DOSSIER MANIFEST AND PROMPTS
// -------------------------------------------------------------
console.log('Generating 00_DOSSIER_MANIFEST_AND_PROMPTS.md...');

const p1 = `### ============================================================================
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
- Verification of mathematical formulas against real-world institutional standards.`;

const p2 = `### ============================================================================
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
- Actionable UI/UX implementation plan mapping the design language from 09_VISUAL_CARD_STOCK_REFERENCE.html directly into the application's real stylesheets and components.`;

const p3 = `### ============================================================================
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
- Verbatim, production-grade code changes with exact line numbers and integration steps.`;

const manifestContent = `# THE TRADING FLOOR CHAMPIONSHIP — MASTER CODEBASE DOSSIER
========================================================================================
COMPLETE 10-FILE SYSTEM DOSSIER OPTIMIZED FOR ARGON 4 / CLAUDE / GEMINI PRO
========================================================================================

This dossier packages the **entire, uncompressed, production-ready codebase** of The Trading Floor Championship into a clean, numbered 10-file suite (00 through 09).
Every single line of backend logic, client SPA markup, luxury CSS styling, state machines, market simulation formulas, active universe data, automated test suites, and visual card stock references is included verbatim.

---

## 📁 COMPLETE DOSSIER FILE MANIFEST (10 FILES)

| File | Filename | Size | Purpose & Content Summary |
| :---: | :--- | :--- | :--- |
| **00** | \`00_DOSSIER_MANIFEST_AND_PROMPTS.md\` | ~12 KB | Master Index, Token Feasibility Analysis, and 3 Sequential Copy-Paste Prompts for Argon 4. |
| **01** | \`01_SYSTEM_SPECS_AND_ARCHITECTURE.md\` | ~120 KB | Unified SSOT: \`AGENTS.md\`, \`README.md\`, \`PRODUCT_SPEC.md\`, \`BUSINESS_RULES.md\`, \`EVENT_LIFECYCLE.md\`, \`ARCHITECTURE.md\`, \`DESIGN_SYSTEM.md\`, \`KNOWN_ISSUES.md\`, \`CURRENT_STATUS.md\`. |
| **02** | \`02_BACKEND_SERVER_CORE.js\` | ~205 KB | Authoritative Node.js Server (\`server.js\`): Express HTTP, WebSocket server, 1000ms price loop, directional circuit breakers, news transitions, audit logging, disaster recovery. |
| **03** | \`03_BACKEND_MODULES_AND_CONFIG.js\` | ~25 KB | Subsystem Modules: \`package.json\` + \`server/state_machine.js\`, \`accounting.js\`, \`market_engine.js\`, \`news_scheduler.js\`, \`persistence.js\`, \`sanitizer.js\`. |
| **04** | \`04_FRONTEND_MARKUP_INDEX.html\` | ~375 KB | Master SPA Markup (\`public/index.html\`): Host Control Center, Trader Cockpit, Projector Arena (8-card rotating grid), Sound Console, all overlays, modals, and embedded luxury SVGs. |
| **05** | \`05_FRONTEND_STYLES_STYLE.css\` | ~138 KB | Complete Design System (\`public/style.css\`): Warm Ivory Pastel Luxury palette, typography, high-contrast WCAG AAA inks, cards, tables, modals, overlays, responsive breakpoints. |
| **06** | \`06_FRONTEND_APP_CORE.js\` | ~635 KB | Client Application Logic (\`public/js/state_guard.js\` + \`public/app.js\`): WebSocket sync, order dispatch, projector cycle, Web Audio synthesizer, action contract locks, state machine views. |
| **07** | \`07_MARKET_DATA_AND_GAME_STATE.json\` | ~50 KB | Active Market Universe (\`data/universe_active.json\`), live news schedule (\`data/scenario_live.json\`), and test scenarios. |
| **08** | \`08_TEST_SUITES_AND_CONTRACTS.js\` | ~100 KB | All 4 Authoritative Test Suites: \`test_unified_master_flow.js\`, \`test_chunk2_state_machine.js\`, \`test_chunk3_ui_and_overlays.js\`, and \`test_chunk4_action_contracts.js\` (100% passing). |
| **09** | \`09_VISUAL_CARD_STOCK_REFERENCE.html\` | ~125 KB | Visual Design Reference (\`card.html\`): v4 Projector-Grade Card Stock Suite, guilloche security patterns, 3D parallax tilt, metallic foil seals, and letterpress typography. |

---

## 🧠 CONTEXT & TOKEN FEASIBILITY FOR ARGON 4 / CLAUDE / GEMINI

- **Total Uncompressed File Size**: ~1.78 MB of raw text.
- **Estimated Total Token Count**: ~380,000 to 420,000 tokens.
- **Feasibility**:
  - **Argon / Claude 3.7 / Gemini Pro (1M to 2M token window)**: **100% FEASIBLE**.
  - Leaves **600,000+ tokens of free headroom** in a 1M window for thorough analysis, reasoning, and generating drop-in replacement code.
  - Feeding these 10 files gives the AI complete, un-truncated visibility into:
    1. Every HTML tag and button ID in \`04_FRONTEND_MARKUP_INDEX.html\`.
    2. Every DOM listener and WebSocket dispatch in \`06_FRONTEND_APP_CORE.js\`.
    3. Every server route, timer, and circuit breaker in \`02_BACKEND_SERVER_CORE.js\`.
    4. Every CSS class and token in \`05_FRONTEND_STYLES_STYLE.css\`.
    5. The authoritative test contracts in \`08_TEST_SUITES_AND_CONTRACTS.js\`.
    6. The visual target aesthetic in \`09_VISUAL_CARD_STOCK_REFERENCE.html\`.

---

## 🚀 HOW TO USE THIS DOSSIER WITH ARGON 4

1. Copy or upload the files in \`MASTER_CODEBASE_DOSSIER/\` to your chat session with Argon 4.
2. Use the 3 ready-made prompts below sequentially in the same conversation:

---

### PROMPT 1: CODEBASE INGESTION & ARCHITECTURAL AUDIT
\`\`\`markdown
` + p1 + `
\`\`\`

---

### PROMPT 2: VISUAL BRAND IDENTITY & CARD-STOCK LUXURY DESIGN SYSTEM OVERHAUL
\`\`\`markdown
` + p2 + `
\`\`\`

---

### PROMPT 3: READY-TO-PASTE PRODUCTION CODE IMPLEMENTATION
\`\`\`markdown
` + p3 + `
\`\`\`
`;

fs.writeFileSync(path.join(outDir, '00_DOSSIER_MANIFEST_AND_PROMPTS.md'), manifestContent, 'utf8');

console.log('\nMaster Dossier build completed successfully!');
const files = fs.readdirSync(outDir);
console.log('Files generated (' + files.length + ' files):');
files.forEach((f) => {
  const stat = fs.statSync(path.join(outDir, f));
  console.log(' - ' + f + ' (' + (stat.size / 1024).toFixed(1) + ' KB)');
});

