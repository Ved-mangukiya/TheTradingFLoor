# THE TRADING FLOOR — DATABASE ARCHITECTURE & STATE PERSISTENCE

This directory (`data/`) contains the authoritative JSON datasets, schemas, and live persistence states for **The Trading Floor Championship 2026**.

---

## 1. PREVIEW WEBSITE VS. MAIN EVENT HOSTING (CLEAR SEPARATION)

| Attribute | 🌐 Preview Website (Web Showcase) | 🏛️ Main Event Hosting (Live LAN Platform) |
| :--- | :--- | :--- |
| **Primary Use Case** | Instant presentation to HOD, Dean, faculty, and student recruiters online. | Real-time live execution of the multi-team championship in the auditorium. |
| **Hosting Environment** | Public web via GitHub Pages (`https://ved-mangukiya.github.io/TheTradingFLoor/`). | Local venue laptop over closed Wi-Fi / campus LAN (zero internet needed). |
| **Server Requirement** | **Zero Server Required** (runs 100% inside any browser via client JavaScript). | **Node.js Local Server** (`server.js`) listening on port 3000. |
| **Web Entry Point** | [`public/index.html`](../public/index.html) (deployed automatically via GitHub Pages). | [`public/index.html`](../public/index.html) (served by Express on `http://localhost:3000/`). |
| **Database Source** | Built-in showcase engine (`MOCK_COMPANIES_BASE` in [`public/app.js`](../public/app.js)). | Authoritative server files in `data/` (`scenario_live.json`, `universe_active.json`). |
| **How to Launch** | Visit GitHub Pages URL or open `public/index.html?demo=1`. | Double-click `Launch_The_Trading_Floor.bat`. |

---

## 2. REPOSITORY DATA FILES EXPLAINED

### 1. `scenario_live.json` — The Official Production Tournament Database
- **Role**: The Single Source of Truth (SSOT) loaded when running `Launch_The_Trading_Floor.bat` (`server.js live`).
- **Contents**:
  - 20 verified real-world Indian listed NSE equities across 8 economic sectors (Reliance, Tata Motors, TCS, HDFC Bank, Infosys, etc.).
  - Default starting cash: ₹5,00,000 per team.
  - Multi-day tournament schedule (3 days, 1800s per day).
  - Pre-seeded scheduled macroeconomic news shocks and traffic-light alerts.
  - Pre-registered credentials for 16 teams, host, projector, sound console, and winner stage.

### 2. `universe_active.json` — Dynamic Host Runtime Universe
- **Role**: Created and updated in real time whenever the Host modifies the stock market universe via the **Market Builder** tab on the Host Operations Desk.
- **Contents**: Stores custom added companies, randomized prices, toggled active/inactive stock flags, and updated lot sizes.
- **Priority**: When present, `server.js` prioritizes `universe_active.json` over static scenario files so host customizations are never lost.

### 3. `scenario_test.json` — Automated Testing Sandbox Database
- **Role**: Lightweight 8-company sandbox used exclusively by the automated verification suite (`npm test` / `node test_master_suite.js`).
- **Guarantee**: Automated tests execute strictly inside `scenario_test.json` so test runs never alter or pollute your official live championship records.

### 4. `checkpoints/` — Disaster Recovery Point-in-Time Backups
- **Role**: Automatic rolling snapshots taken every 120 seconds during live market sessions, plus manual backups created when the host clicks *Save Checkpoint*.
- **Recovery Invariant**: Any restored state automatically initializes `isPaused = true` so the market waits safely for the Host to hit `▶ Resume 3-2-1`.

---

## 3. WHY THERE IS ONLY ONE CANONICAL `index.html`

- The entire application (Trader Desk, Host Command Centre, Stage Projector, Sound Console, Waiting Room, and Showcase Demo) is unified inside **[`public/index.html`](../public/index.html)**.
- Previous duplicate root index files have been permanently removed to eliminate any ambiguity.
- When `Launch_The_Trading_Floor.bat` runs, Express serves [`public/index.html`](../public/index.html) as the root URL (`http://localhost:3000/`).
- When GitHub Pages runs, it automatically deploys [`public/`](../public/) directly to the web.
