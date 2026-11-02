# CONTRIBUTING TO THE TRADING FLOOR CHAMPIONSHIP

Thank you for contributing to **The Trading Floor Championship**. This document outlines the development workflow, architectural invariants, testing procedures, and standards for maintaining the platform.

---

## 1. Quick Development Setup

1. **Prerequisites**:
   - Node.js LTS (v18.x or higher)
   - Git
   - A modern web browser (Chrome, Edge, Firefox, or Safari)

2. **Clone & Install**:
   ```bash
   git clone https://github.com/Ved-mangukiya/TheTradingFLoor.git
   cd TheTradingFLoor
   npm install
   ```

3. **Run Development Server**:
   ```bash
   # Boot Live Simulation Mode (real Indian blue-chips & real news engine)
   npm start

   # Or boot Test Scenario Mode
   npm run start:test
   ```

4. **Access Terminal Desks**:
   - **Host Matrix**: `http://localhost:3000/?role=host` (Username: `host` / Password: `host`)
   - **Stage Projector**: `http://localhost:3000/?role=projector` (Username: `projector` / Password: `screen`)
   - **Audio Engineer Console**: `http://localhost:3000/?role=sound` (Username: `sound` / Password: `sound`)
   - **Ceremony Podium**: `http://localhost:3000/?role=winner` (Username: `winner` / Password: `winner`)
   - **Trader Teams**: `http://localhost:3000/` (Username: `team1`..`team16` / Password: `trade100`..`trade1600`)

---

## 2. Core Architecture & Repository Layout

- `server.js` — Authoritative Node.js/Express & WebSocket server. Handles market math, orders, circuit breakers, news propagation, and audit logging.
- `server/real_news_feed.js` — Real-world live financial news engine with Indian Equities Google News RSS parsing, ticker mapping, and offline disk caching.
- `server/state_machine.js` — Canonical event state transitions, lifecycle guards, and action eligibility validators.
- `server/logger.js` — Clean terminal telemetry and structured system debug logger.
- `public/index.html` — Universal single-page application (SPA) containing Trader Desk, Host Controller, Projector View, and modals.
- `public/style.css` — 100% offline-ready CSS implementing the ivory luxury financial terminal design system. Zero external CDN dependencies.
- `public/app.js` — Client WebSocket controller, state updates, chart renderer, and Web Audio API synthesizer.
- `data/` — Static baseline scenarios (`scenario_live.json`), active persisted universe (`universe_active.json`), and offline news cache (`real_news_cache.json`).
- `logs/` — Millisecond-accurate JSON and CSV audit logs generated on each championship run.
- `docs/` — Permanent technical documentation suite.
- `tests/` — Automated end-to-end integration test suites (195 verified assertions).

---

## 3. Mandatory Architectural Invariants

1. **Zero External CDN Policy**:
   Never add `<script src="https://...">` or `<link href="https://fonts.googleapis.com...">` tags. The application must operate flawlessly in an auditorium or campus network with zero internet connection.
2. **Server-Authoritative Engine**:
   Never calculate prices, cash deductions, fee deductions, holdings, or leaderboard ranks on client JavaScript. All orders must flow through `server.js` WebSocket actions.
3. **One Business Action = One Entry Point**:
   Never create duplicate buttons across tabs for the same operational action. Market operations reside canonically on the Live Market Operations Bar.
4. **Formula Injection Protection**:
   In all CSV exports, any value starting with `=`, `+`, `-`, or `@` must be prepended with `'` to prevent spreadsheet formula execution.
5. **Rate Limiting & Anti-Spam**:
   Maintain 200ms debounce per team session and universal client-side action locks to prevent duplicate order frames.
6. **Timelessness Invariant**:
   Never hardcode specific calendar years into UI headers, footers, documentation titles, or terminal outputs. The software must remain timeless across all academic years.

---

## 4. Verification & Testing

Always execute the automated verification test suite before committing code:

```bash
# Run the complete test suite (195 assertions)
npm test
npm run test:all

# Verify zero duplicate DOM element IDs in public/index.html
npm run test:ids

# Check syntax of server and client files
node -c server.js
node -c public/app.js
```
All assertions must pass cleanly with zero errors before submitting pull requests.
