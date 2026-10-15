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
   - You MUST run `node test_master_suite.js` or `node -c` to verify changes.
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

## 3. COMMON PITFALLS & GOTCHAS

- **Order Debounce Timing in Tests**: In automated WebSocket testing scripts, always add an artificial delay (`await new Promise(r => setTimeout(r, 250))`) between consecutive orders from the same session to respect the 200ms server debounce.
- **Enabled Stocks Filtering**: Traders and projectors only receive stocks where `isEnabled !== false`. Hosts receive `allCompaniesUniverse` so they can manage disabled/excluded stocks.
- **Batch Files & Non-Technical Users**: The primary users are college professors, organizers, and student coordinators. Launchers (`Launch_The_Trading_Floor.bat`) must provide clear, human-readable terminal output and zero-config browser startup.
