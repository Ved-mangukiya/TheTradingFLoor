# AGENTS.md — PERMANENT INSTRUCTIONS FOR AI DEVELOPMENT

> **AUTHORITATIVE REPOSITORY INSTRUCTION**: All future AI coding agents (Gemini, Claude, GPT, Antigravity, Cursor) working on **The Trading Floor Championship 2026** MUST read and strictly adhere to this file and `README.md` before making any code modifications.

---

## 1. MANDATORY PROTOCOL BEFORE MODIFYING CODE

1. **Read Core Specifications First**:
   - `README.md` — The complete user manual and operational architecture.
   - `docs/PRODUCT_SPEC.md` — Core vision, simulation mechanics, and competition format.
   - `docs/USER_FLOWS.md` — Complete step-by-step journeys for Host, Traders, and Projector.
   - `docs/BUSINESS_RULES.md` — Order execution, valuation, fees, circuit breakers, and scoring formulas.
   - `docs/ARCHITECTURE.md` — Express backend, WebSocket protocol, client SPA, and offline engine.
   - `docs/DESIGN_SYSTEM.md` — Ivory luxury styling, palette, typography, and contrast rules.
   - `docs/SHARE_MANAGEMENT.md` — The dynamic share universe, templates, and active market builder.
   - `tasks/CURRENT_STATUS.md` & `tasks/NEXT_SESSION.md` — Current verified status and next tasks.

2. **Inspect the Real Working Code**:
   - Never assume previous sessions finished or left tasks in a working state without checking the actual filesystem.
   - Inspect `server.js`, `public/index.html`, `public/app.js`, and `data/` before proposing or generating changes.

3. **Preserve Established Working Invariants**:
   - **Offline-First Zero-CDN Invariant**: Local college LAN events often run with zero internet connection. All styling, SVG icons, fonts, and the Web Audio API institutional sound synthesizer MUST operate locally without remote CDN script or link tags.
   - **Authoritative Server Math**: All prices, orders, cash deductions, fee calculations, holdings, circuit breaker halts, and rankings are calculated and enforced strictly on the Node.js server. The client is a reactive view only.
   - **Rate Limiting & Anti-Spam**: A 200ms debounce per team session prevents double-click spam.
   - **Formula Injection Protection**: In all CSV exports, any value starting with `=`, `+`, `-`, or `@` is prepended with `'` to prevent spreadsheet formula execution.

---

## 2. STRICT OPERATIONAL RULES FOR AI AGENTS

1. **Never Claim a Feature Works Without Testing It**:
   - You MUST run `npm test` (or `node tests/test_unified_master_flow.js`) and `node -c` to verify changes.
   - Never report tests or features as "passing" or "complete" without executing them in the terminal.

2. **No Unnecessary Rewrites or Duplications**:
   - Do NOT rewrite working modules from scratch. Enhance, fix, and extend the existing codebase.
   - Do NOT add external dependencies (npm libraries) unless explicitly authorized and documented in `docs/DEPENDENCIES.md`. The project relies cleanly on `express` and `ws`.

3. **Maintain Backward Compatibility**:
   - Respect saved competition state in `data/universe_active.json` and `logs/`.
   - Dynamic holding alignment: When new shares are added or duplicated, initialize team holdings (`holdings[ticker] = 0`, `avgBuyPrice[ticker] = 0`) to prevent runtime `undefined` errors.

4. **Synchronize Documentation with Code**:
   - Whenever behavior, actions, or schemas change, update the relevant files in `docs/` and `tasks/`.
   - Be transparent: Disclose any known limitations, defects, or incomplete items in `tasks/NEXT_SESSION.md` and `docs/KNOWN_ISSUES.md`.

---

## 3. CORE ARCHITECTURAL INVARIANTS

1. **One Business Action = One Entry Point**: Never create duplicate buttons across tabs for the same action (e.g., pausing, resuming, resetting). Market operations reside canonically on the Live Market Operations Bar.
2. **Authoritative Server Math**: All prices, orders, cash deductions, fee calculations, holdings, circuit breaker halts, and rankings are calculated and enforced strictly on the Node.js server. The client is a reactive view only.
3. **Disaster Recovery & Safe Checkpoint Restoring**: State restorations (crash recovery or manual checkpoint restore) MUST ALWAYS initialize `gameState.isPaused = true` so the market waits safely for the Host to hit `▶ Resume 3-2-1`.
4. **Projector Zero-Scroll Pagination**: The stock board divides into readable pages (default 8 per page, $4 \times 2$ grid) rotating every 8s. Cards on the active page update in-place without resetting rotation timers. Top Gainer and Top Loser spotlight cards evaluate across all active companies and stay permanently visible.
5. **News Secrecy & 60-Second Reveal**: News impacts are masked by default (`[🔒 Private Price Impact Details Hidden]`). When revealed by the host, they automatically hide after 60s or upon tab navigation. Trader and projector terminals NEVER receive private impact percentages.
6. **Rate Limiting & Anti-Spam**: A 200ms debounce per team session prevents double-click spam.
7. **Formula Injection Protection**: In all CSV exports, any value starting with `=`, `+`, `-`, or `@` is prepended with `'` to prevent spreadsheet formula execution.
8. **Directional Circuit Breakers & Stock Isolation**: Upper circuit (+20%) restricts BUY and permits SELL; Lower circuit (-20%) restricts SELL and permits BUY; counter-directional order flow injects recovery liquidity; background price loop requires 0.8% buffer before mean-reversion unhalt. A stock-level halt NEVER freezes the wider market.
9. **Explicit Day State Machine**: Day conclusion sets `status = 'DAY_COMPLETED'`, shows `#traderDayCompletedOverlay` and `#projDayCompletedBanner` with audited daily snapshot, and never displays ambiguous "Paused by Host" banners. Balances and holdings carry over into subsequent days.

---

## 4. COMMON PITFALLS & GOTCHAS

- **Order Debounce Timing in Tests**: In automated WebSocket testing scripts, always add an artificial delay (`await new Promise(r => setTimeout(r, 250))`) between consecutive orders from the same session to respect the 200ms server debounce.
- **Enabled Stocks Filtering**: Traders and projectors only receive stocks where `isEnabled !== false`. Hosts receive `allCompaniesUniverse` so they can manage disabled/excluded stocks.
- **Projector DOM Stability**: Do NOT rebuild projector card DOM nodes on every tick. Rebuilding destroys canvas contexts and causes visual flickering. Only rebuild when the page flips or when active tickers change.
- **Batch Files & Non-Technical Users**: The primary users are college professors, organizers, and student coordinators. Launchers (`Launch_The_Trading_Floor.bat`) must provide clear, human-readable terminal output, auto-detect `%~dp0tools\node.exe`, and support zero-config startup.
- **Full Verification Before Commits**: Always run `npm run test:all` (or `npm test`) to ensure all 85 test scenarios pass before reporting work as complete.
