# CONTRIBUTING TO THE TRADING FLOOR CHAMPIONSHIP

Thank you for contributing to **The Trading Floor Championship 2026**. This document outlines the development workflow, architectural principles, testing procedures, and code standards for maintaining the platform.

---

## 1. Quick Development Setup

1. **Prerequisites**:
   - Node.js LTS (v18.x or v20.x recommended)
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
   # Live scenario mode (real blue-chips & secret shocks)
   npm start

   # Or dry-run test mode (fictional mock companies)
   npm run start:test
   ```

4. **Open Terminals**:
   - Host Controller: `http://localhost:3000/?role=host` (Username: `host` / Password: `host2026`)
   - Stage Projector: `http://localhost:3000/?role=projector` (Username: `projector` / Password: `screen2026`)
   - Team Terminal: `http://localhost:3000/` (Username: `team1` / Password: `trade100`)

---

## 2. Architecture & File Layout

- `server.js` — Authoritative Node.js/Express & WebSocket server. Handles market math, orders, circuit breakers, news propagation, and audit logging.
- `public/index.html` — Universal single-page application (SPA) containing Trader Desk, Host Controller, Projector View, and modals.
- `public/style.css` — 100% offline-ready CSS implementing the ivory luxury financial terminal design system. Zero external CDN dependencies.
- `public/app.js` — Client WebSocket controller, state updates, chart renderer, and Web Audio API synthesizer.
- `data/` — Static baseline scenarios (`scenario_live.json`, `scenario_test.json`) and active persisted universe (`universe_active.json`).
- `logs/` — Millisecond-accurate JSON and CSV audit logs generated on each run.
- `docs/` — Permanent technical documentation suite.

---

## 3. Contribution Guidelines & Invariants

1. **Zero External CDN Policy**:
   Never add `<script src="https://...">` or `<link href="https://fonts.googleapis.com...">` tags. The application must run in an auditorium or exam hall with zero internet connection.
2. **Server Authoritative Engine**:
   Never calculate prices, cash balances, or trade outcomes in client JavaScript. All orders must flow through `server.js` WebSocket actions.
3. **Run Automated Tests Before Committing**:
   ```bash
   npm test
   ```
   Ensure all automated assertions pass without error.
4. **Submitting Changes**:
   - Create a clean descriptive commit message (e.g., `feat: add custom sector halt controls`).
   - Update `CHANGELOG.md` and any affected files in `docs/`.
