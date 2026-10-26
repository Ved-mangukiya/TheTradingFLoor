# THE TRADING FLOOR CHAMPIONSHIP 2026 — COMPLETE AUDIT DOSSIER (ALL 10 VOLUMES)

> Consolidated master reference document for Argon 4 review.



================================================================================
<!-- START OF 00_MASTER_INDEX.md -->
================================================================================

# THE TRADING FLOOR CHAMPIONSHIP 2026 — MASTER DOSSIER FOR ARGON 4
## System Architecture, Codebase Audit & Portable Redesign Blueprint

> **DOCUMENT ID**: `ARGON_DOSSIER/00_MASTER_INDEX.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **AUDIT TARGET**: The Trading Floor Championship (Intra-College Real-Time Stock Market Simulation)  
> **AUTHOR / LEAD DEVELOPER**: Ved Maheshbhai Mangukiya (Surat, Gujarat, India)  
> **TARGET AUDIENCE FOR THIS DOSSIER**: Argon 4 (External AI Reviewer & System Architect)  
> **STATUS**: COMPLETED & VERIFIED (36/36 Unified Single-Flow Master Assertions Passing, 100% Core Verification)

---

## 1. Executive Summary & Project Purpose

**The Trading Floor Championship 2026** is an institutional-grade, real-time stock market competition application designed for collegiate business school tournaments, finance clubs, and university festivals.

### Core Simulation Premise
- **Target Participants**: Undergraduate and graduate business students (BBA, B.Com, MBA, Finance).
- **Environment**: High-energy computer lab or campus auditorium running entirely over a **local campus LAN network**.
- **Hardware Profile**: 
  - Host master laptop (Professor, Event Coordinator, or Student Head).
  - 10 to 30 Trader team workstations / student laptops.
  - Main auditorium stage projector (1080p, 720p, or vintage 4:3 1024×768 / 800×600 campus projectors).
  - Dedicated sound system console laptop connected to hall PA speakers.
- **Zero-Internet / Offline-First Invariant**: Campus LANs frequently suffer from firewall blocks, captive portals, or complete WAN outages. The system is engineered to run with **zero external CDN dependencies** (no external Google Fonts, no CDN stylesheets, no external audio files, no remote npm CDNs). All audio is synthesized locally via the HTML5 Web Audio API; all icons are inline SVGs; all charts are rendered via an in-house Canvas 2D Bezier engine.

---

## 2. High-Level Architecture Overview

The application is structured as a tightly coupled, lightweight client-server system:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS SERVER (server.js)                      │
│                                                                        │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ State Machine Engine  │  │ Price Simulation │  │ Order Accounting │  │
│  │ (SETUP -> LIVE -> ...)│  │ (GBM + Shocks)   │  │ (Gross, Fee, Net)│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Circuit Breaker (±20%)│  │ News Scheduler  │  │ Audit & Snapshot │  │
│  │ (Upper/Lower Clamps)  │  │ (Ratios & Window│  │ (JSON/CSV Export)│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│                                    ▲                                   │
│                        Express REST│ & WebSocket (ws)                  │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   HOST WORKSTATION   │  │   TRADER TERMINALS   │  │   STAGE PROJECTOR    │
│   (Role: HOST)       │  │   (Role: TRADER)     │  │   (Role: PROJECTOR)  │
│                      │  │                      │  │                      │
│ • Setup Wizard (1-8) │  │ • Waiting Room       │  │ • 8-Card Auto-Cycle  │
│ • Live Operations Bar│  │ • Stock Grid & Chart │  │ • Spotlight Gain/Loss│
│ • News Control Center│  │ • Buy / Sell Order   │  │ • Breaking News Crawl│
│ • Results & Reset    │  │ • Holdings Drawer    │  │ • Winner Presentation│
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

1. **Backend (`server.js`)**: Single-file Node.js server (~4,770 lines) utilizing `express` for static file serving & REST endpoints, and `ws` for duplex WebSocket message routing. Holds **100% authoritative state**; clients never dictate prices, fills, fees, or valuations.
2. **Frontend (`public/index.html`, `public/app.js`, `public/style.css`)**: Single-page application (~11,430 lines of JS, ~5,000 lines of HTML, ~3,500 lines of CSS). Manages role-based views (`#loginView`, `#hostView`, `#traderView`, `#projectorView`, `#soundConsoleView`, `#winnerPresentationView`).
3. **Data Layer (`data/`)**: Flat-file JSON persistence:
   - `data/universe_active.json`: Current 20-company stock universe baseline.
   - `data/scenario_live.json` / `scenario_test.json`: Full tournament scenarios (macro metadata, baseline shares, multi-day news plan).
   - `data/live_game_state.json`: Crash-recovery state auto-saved every 4 seconds.
   - `data/checkpoints/*.json`: Named and automatic 120-second snapshot checkpoints.
   - `logs/*.json`: Full chronological audit logs.

---

## 3. Dossier Reading Order & Document Map

Argon 4 must review these dossier documents in the following sequence:

```
00_MASTER_INDEX.md  ─────────► Start here for map, scope, and coverage limitations
       │
       ▼
01_ARCHITECTURE.md ─────────► Core technology, directory layout, protocols, entities
       │
       ▼
02_SCREEN_AND_BUTTON_INVENTORY.md ──► Complete UI screens, modals, and button-by-button table
       │
       ▼
03_EVENT_LIFECYCLE.md ──────► Chronological tournament state machine and transitions
       │
       ▼
04_MATHEMATICAL_ENGINE.md ──► Price models, returns, beta, fees, P&L, and tie-breakers
       │
       ▼
05_TIMING_AND_NEWS.md ──────► Dynamic time ratios, reading windows, news publication
       │
       ▼
06_SECURITY_AND_DATA_FLOW.md ► Authentication, token registry, parameter sanitization
       │
       ▼
07_DEFECT_REGISTER.md ──────► Discovered defects, design weaknesses, and subtle risks
       │
       ▼
08_TESTS_AND_DEPENDENCIES.md ► Unified single-flow test suite, commands, dependencies
       │
       ▼
09_REDESIGN_CONSTRAINTS.md ──► Non-negotiable invariants and boundaries for redesign
```

### Document Summary Guide
| File | Focus Area | Key Contents for Argon 4 |
|---|---|---|
| **`01_ARCHITECTURE.md`** | System Architecture | Dependency versions, entry points, REST endpoints, WebSocket schema, authoritative state locations. |
| **`02_SCREEN_AND_BUTTON_INVENTORY.md`** | UI & Interactions | Every screen, modal, and button with exact DOM IDs, click handlers, WebSocket actions, and downstream effects. |
| **`03_EVENT_LIFECYCLE.md`** | State Machine | 10 tournament lifecycle states, transition matrix, countdowns, conclusion gating, and reset mechanics. |
| **`04_MATHEMATICAL_ENGINE.md`** | Financial Math | Geometric Brownian motion, smoothstep trajectories, 10 bps fee accounting, daily vs cumulative P&L. |
| **`05_TIMING_AND_NEWS.md`** | Clocks & News | Dynamic schedule scaling ($t_i = D \times p_i$), reading windows ($W(D)$), one-time publication idempotency, 12-hour AM/PM format. |
| **`06_SECURITY_AND_DATA_FLOW.md`** | Security & Privacy | Token authorization, role gating, sanitization of $\beta$ and $\sigma$, 60s news impact reveal model. |
| **`07_DEFECT_REGISTER.md`** | Audit Findings | Confirmed bugs, design weaknesses, subtle race conditions, and architectural debt. |
| **`08_TESTS_AND_DEPENDENCIES.md`** | QA Infrastructure | `test_unified_master_flow.js` (11 phases, 36 assertions), legacy suites, portable Node launcher. |
| **`09_REDESIGN_CONSTRAINTS.md`** | Guardrails | Non-negotiable competition invariants and guidelines for modernizing into a modular architecture. |

---

## 4. Codebase Inspection & Coverage Map

Every file in the repository was examined directly from disk:

| Directory / File | Size (Bytes) | Lines | Inspection Level | Notes & Role |
|---|---|---|---|---|
| `server.js` | 183,016 | 4,773 | **100% Exhaustive** | Authoritative backend, WebSocket router, price engine, accounting. |
| `public/app.js` | 516,562 | 11,435 | **100% Exhaustive** | Frontend controller, DOM event listeners, canvas charts, sound synth. |
| `public/index.html` | 349,267 | 4,942 | **100% Exhaustive** | Complete DOM tree: 656 IDs, 6 primary views, 22 modals/overlays. |
| `public/style.css` | 87,796 | 3,510 | **High (Structural)** | Design tokens, responsive grids (16:9, 4:3, mobile), animations. |
| `data/universe_active.json` | 13,185 | 522 | **100% Exhaustive** | Active 20-company baseline universe (NSE/BSE Indian companies). |
| `data/scenario_live.json` | 28,798 | 850 | **100% Exhaustive** | Default 3-day scenario with news plan, sector weights, macro rules. |
| `data/scenario_test.json` | 5,564 | 180 | **100% Exhaustive** | Fast 2-day test scenario for automated verification suites. |
| `test_unified_master_flow.js` | 43,638 | 884 | **100% Exhaustive** | Canonical 11-phase state-machine test runner on isolated port 3099. |
| `package.json` | 1,260 | 27 | **100% Exhaustive** | Version `2.6.1`, npm scripts (`test`, `test:unified`, `test:legacy`). |
| `README.md` | 27,108 | 740 | **High (Contextual)** | Host operations guide, physical room setup, rules summary. |
| `AGENTS.md` | 6,827 | 185 | **High (Contextual)** | Development invariants, offline zero-CDN rules, common pitfalls. |
| `docs/*.md` (28 files) | ~110,000 | ~3,200 | **High (Reference)** | Feature-specific architecture notes, business rules, design system. |
| `tasks/*.md` (2 files) | ~37,000 | ~350 | **100% Exhaustive** | Verified status log and active operational invariants. |

### Known Limitations of the Inspection
- **Hardware Variation**: Testing was performed on Windows 11 with Node.js v20.11.0. Behavior on ultra-low-end campus hardware (e.g., dual-core Celeron with 4GB RAM) was modeled via CPU throttling rather than physical legacy hardware.
- **WebSocket Socket Concurrency**: Automated tests run up to 10 concurrent WebSocket connections. A 30-team competition with 30 trader laptops, 2 projectors, and 1 host laptop (~33 concurrent connections) was validated through connection loops, but not in a 1,000-socket stress test.

---

## 5. Essential Source Files for Argon 4

If Argon 4 cannot receive the full repository at once, the user should provide these **four essential files** in priority order:

1. **`server.js`** (Core backend, REST handlers, WebSocket actions, financial math, state machine).
2. **`public/app.js`** (Client SPA controller, WebSocket listeners, UI view rotators, trade handlers).
3. **`public/index.html`** (DOM structure, view containers, modals, form inputs, button IDs).
4. **`test_unified_master_flow.js`** (Authoritative behavioral contract and verification test suite).

---

## 6. How Argon 4 Should Use This Dossier

1. **Do not guess variable names or message formats**: Consult `01_ARCHITECTURE.md` and `06_SECURITY_AND_DATA_FLOW.md` for exact WebSocket actions and state fields.
2. **Do not infer UI behavior without checking handlers**: Cross-reference any button in `02_SCREEN_AND_BUTTON_INVENTORY.md` to see its exact listener in `public/app.js` and downstream operation in `server.js`.
3. **Do not alter mathematical equations**: The formulas in `04_MATHEMATICAL_ENGINE.md` are locked educational competition standards.
4. **Review `07_DEFECT_REGISTER.md` before planning the redesign**: It documents all known race conditions, DOM coupling issues, and structural debt that should be cleaned up during modernization.

Proceed to **`ARGON_DOSSIER/01_ARCHITECTURE.md`**.


<!-- END OF 00_MASTER_INDEX.md -->


================================================================================
<!-- START OF 01_ARCHITECTURE.md -->
================================================================================

# ARCHITECTURE & TECHNICAL MAP
## Technology Stack, Directory Layout, Communication Protocols & Data Entities

> **DOCUMENT ID**: `ARGON_DOSSIER/01_ARCHITECTURE.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **AUDIT TARGET**: The Trading Floor Championship (Node.js + Vanilla JS SPA)  
> **PRIMARY FILES**: [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js), [public/index.html](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/index.html)

---

## 1. Technology Stack & Dependencies

### Runtime Environment
- **Platform**: Node.js (Active compatibility: v18.x to v22.x; packaged portable binary: Node v20.11.0 in `tools/node.exe`).
- **Operating Systems**: Windows 10/11, macOS, Linux (Debian/Ubuntu/CentOS).
- **Network Model**: Local Area Network (LAN) HTTP/WebSocket server. Local host binds to `0.0.0.0` and auto-detects IPv4 interface for LAN distribution.

### Production Dependencies (`package.json`)
The application is intentionally minimal to ensure high reliability and zero supply-chain vulnerabilities:
```json
{
  "dependencies": {
    "express": "^4.19.2",
    "ws": "^8.18.0"
  }
}
```
- **`express` (v4.19.2)**: Lightweight HTTP web server handling static asset delivery (`public/`), RESTful data exports, and initial health checks.
- **`ws` (v8.18.0)**: High-performance, RFC-6455 compliant WebSocket server running on the shared HTTP server port.

### Client-Side Stack (Zero-Framework / Zero-CDN)
- **HTML**: Semantic HTML5 with custom ARIA attributes and embedded SVG icon definitions.
- **CSS**: Vanilla CSS3 with CSS Custom Properties (CSS variables) implementing a luxury "Ivory & Warm Paper" financial theme. Responsive flexbox and CSS Grid.
- **JavaScript**: Vanilla ES6+ without Babel or bundlers.
- **Charting Engine**: Custom Canvas 2D engine (`window.TFCharts`) implementing monotone cubic Bezier splines and auto-scaling sparklines. Zero dependencies on Chart.js or D3.
- **Audio Synthesizer**: Native Web Audio API audio synthesis generating institutional bells, trading pings, circuit klaxons, and fanfare chords directly from oscillators and gain envelopes. Zero MP3/WAV dependencies.

---

## 2. Application Entry Points

1. **Production / Live LAN Server**:
   ```powershell
   node server.js live
   # Or via double-clicking Launch_The_Trading_Floor.bat
   ```
   - Defaults to port `3000` (or `process.env.PORT`).
   - Detects the local LAN IPv4 address (e.g. `http://192.168.1.45:3000`).
   - Loads baseline data from `data/universe_active.json` or `data/scenario_live.json`.
   - Attempts state restoration from `data/live_game_state.json` if recovering from a crash.
2. **Automated Testing Server**:
   ```powershell
   node server.js test
   ```
   - Operates in strict test mode (`activeScenarioMode = 'test'`).
   - Loads `data/scenario_test.json`.
   - Never mutates or overwrites `data/universe_active.json` on disk.
3. **Frontend Client Entry**:
   - Web browser navigates to `http://<host-ip>:<port>/`.
   - Browser loads `public/index.html`, which imports `public/style.css` and `public/app.js`.
   - `public/app.js` establishes an immediate WebSocket connection to `ws://<host-ip>:<port>/`.

---

## 3. Directory & File Structure

```
d:\01_Coding Projects\2. College & School\TheTradingFLoor\
├── server.js                        # Complete backend: WebSocket router, price engine, REST APIs (4,773 lines)
├── package.json                     # Project manifest and test runner scripts
├── package-lock.json                # Locked dependency tree
├── README.md                        # Event coordinator and user manual
├── AGENTS.md                        # Architectural guidelines and permanent rules
├── CHANGELOG.md                     # Version history log
├── Launch_The_Trading_Floor.bat     # Windows batch launcher (auto-detects local tools/node.exe)
├── Create_Live_Demo_Link.bat        # Localhost tunnel script for off-campus demos
├── Pack_Portable_USB_Zip.bat        # USB distribution packager
├── test_unified_master_flow.js      # Canonical 11-phase state-machine test runner (Port 3099)
│
├── public/                          # Client-side web application
│   ├── index.html                   # Single-Page Application DOM tree (656 element IDs, 4,942 lines)
│   ├── app.js                       # Client controller, WebSocket handler, Canvas charts (11,435 lines)
│   └── style.css                    # Ivory design system, typography, responsive grids (3,510 lines)
│
├── data/                            # Persistent and baseline data files
│   ├── universe_active.json         # Active 20-company Indian enterprise stock universe
│   ├── scenario_live.json           # Default 3-day competition scenario with news plan
│   ├── scenario_test.json           # Fast 2-day scenario for automated test runs
│   ├── live_game_state.json         # Real-time state snapshot (auto-saved every 4s, crash recovery)
│   └── checkpoints/                 # Disaster recovery snapshots (auto-checkpoint every 120s)
│
├── docs/                            # Deep-dive architecture and domain specification docs (28 files)
│   ├── ARCHITECTURE.md              # Technical topology and network layer
│   ├── BUSINESS_RULES.md            # Formulas, fee accounting, circuit breakers, P&L rules
│   ├── NEWS_ENGINE.md               # Dynamic schedule scaling, reading windows, news templates
│   ├── SHARE_MANAGEMENT.md          # Universe management, editing, and duplication rules
│   └── PRODUCT_SPEC.md              # High-level competition vision and formats
│
├── tasks/                           # Verification tracking and backlog
│   ├── CURRENT_STATUS.md            # Comprehensive system status and verified features
│   └── NEXT_SESSION.md              # Invariant rules and pending enhancements
│
├── tools/                           # Standalone tools and bundled binaries
│   ├── node.exe                     # Bundled portable 64-bit Node.js v20.11.0 runtime for USB keys
│   ├── find_duplicate_ids.js        # DOM ID uniqueness auditor
│   └── inspect_projector.js         # Projector DOM validation helper
│
└── logs/                            # Real-time trade ledger and audit logs
    └── AUDIT_LOG_*.json             # Immutable chronological session event logs
```

---

## 4. Frontend-to-Backend Communication Protocol

The application uses two distinct communication channels:

```
┌────────────────────────────────────────────────────────┐
│                        CLIENT                          │
└────────────┬───────────────────────────────▲───────────┘
             │                               │
  HTTP GET   │ REST Requests                 │ Realtime Bi-Directional
  HTTP POST  │ (Snapshots, Exports, Backups) │ WebSocket Messages (JSON)
             ▼                               │
┌────────────────────────────────────────────┴───────────┐
│                        SERVER                          │
└────────────────────────────────────────────────────────┘
```

1. **HTTP REST Endpoints**: Used for initial health checks, file-based backup/restore, and large tabular CSV/JSON data exports (to prevent WebSocket payload blocking).
2. **WebSocket Connection**: Persistent full-duplex JSON stream (`ws://`) used for all real-time interactions (logins, orders, price ticks, circuit alarms, news flashes, pause/resume, countdowns, and projector synchronization).

---

## 5. Complete REST API Endpoint Catalogue

All REST routes are defined in `server.js` (lines 4446–4735):

| Method | Endpoint | Authorization | Description & Payload |
|---|---|---|---|
| `GET` | `/api/health` | Public | Returns server health, uptime, and scenario mode: `{ status: "ONLINE", uptime: 123.4, mode: "live" }`. |
| `GET` | `/api/event-status` | Public | Public setup status: `{ status, configLocked, title, startingCash, totalDays, currentDay }`. |
| `GET` | `/api/team-investments` | **Host Token** | Complete financial breakdown of all teams (cash, cost basis, market value, net worth). |
| `GET` | `/api/team-investments/:teamId` | **Host Token** | Granular investment breakdown for a single team (individual stock holdings, avg buy price, P&L). |
| `GET` | `/api/audit-log` | **Host Token** | In-memory chronological audit log array. |
| `GET` | `/api/export/standings` | **Host Token** | Audited CSV download of final championship rankings (`Rank,Team ID,Team Name,Net Worth,...`). |
| `GET` | `/api/export/trades` | **Host Token** | Audited CSV download of all executed orders (`Trade Seq,Time,Day,Team,Ticker,Type,Qty,Price,Fee,...`). |
| `GET` | `/api/export/audit-csv` | **Host Token** | Audited CSV download of all system audit events (`Seq,Timestamp,Event,Details`). |
| `GET` | `/api/export/universe` | **Host Token** | Complete JSON export of active companies, base prices, lot sizes, and fundamentals. |
| `GET` | `/api/export/universe-csv` | **Host Token** | Tabular CSV export of stock universe. |
| `GET` | `/api/results-snapshot` | **Host Token** | Official finalized championship results JSON snapshot. |
| `GET` | `/api/market-indices` | Public | Live benchmark indices: `{ NIFTY_TF20: { value: 10452.1, changePct: 4.52 } }`. |
| `GET` | `/api/sector-allocations` | Public | Privacy-safe macro sector allocations across all desks (no individual desk leakage). |
| `GET` | `/api/anchor-commentary` | Public | AI/Macro anchor commentary prompts for event hosts. |
| `GET` | `/api/projector-state` | Public | Current auditorium projector display mode, active page, and spotlight stocks. |
| `GET` | `/api/daily-snapshot/:day` | Public | Official locked snapshot for a completed trading day. |
| `GET` | `/api/backup` | **Host Token** | Downloadable JSON bundle of entire tournament state for USB export. |
| `POST` | `/api/restore` | **Host Token** | Upload endpoint for restoring state from an exported backup JSON file. |
| `GET` | `/api/checkpoints` | **Host Token** | List of all auto-saved and manual recovery checkpoints in `data/checkpoints/`. |

---

## 6. Complete WebSocket Message Protocol

### Client-to-Server Inbound Actions (Handled in `server.js` `ws.on('message')`)

| Action Name | Permitted Roles | Description & Required Parameters |
|---|---|---|
| `LOGIN` | Any | Authenticate terminal: `{ username, password }`. |
| `RESUME_SESSION` | Any | Re-attach disconnected socket: `{ session_token }`. |
| `LOGOUT` | Any | Invalidate active session token. |
| `ORDER` | `TRADER` | Submit trade order: `{ session_token, ticker, type: "BUY"\|"SELL", quantity }`. |
| `LIQUIDATE_ALL` | `TRADER` | Emergency portfolio exit: `{ session_token }`. Sells all open positions at market. |
| `HOST_UPDATE_EVENT_CONFIG` | `HOST` | Update event title, days, cash, fees, and circuit limits prior to lock. |
| `HOST_SET_EVENT_LOCK` | `HOST` | Authoritatively lock event configuration and open team logins. |
| `HOST_UNLOCK_EVENT_CONFIG` | `HOST` | Safely unlock configuration (permitted only before trading starts). |
| `HOST_CONFIGURE_TEAMS` | `HOST` | Update team names, passwords, and desk rosters before lock. |
| `HOST_ADD_SHARE` | `HOST` | Add custom company to universe before lock. |
| `HOST_EDIT_SHARE` | `HOST` | Edit company fundamentals, lot presets, or base prices. |
| `HOST_DUPLICATE_SHARE` | `HOST` | Clone an existing company before lock. |
| `HOST_DELETE_SHARE` | `HOST` | Remove a company before lock. |
| `HOST_TOGGLE_SHARE` | `HOST` | Temporarily disable/enable trading on a stock during live session. |
| `HOST_RECALCULATE_SCHEDULE` | `HOST` | Dynamically scale news schedule based on new session duration. |
| `HOST_RESUME_COUNTDOWN` | `HOST` | Trigger 3-2-1 countdown to resume market or start Day 1. |
| `HOST_PAUSE` | `HOST` | Instantly freeze market trading: `{ pauseMode: "VISIBLE_FROZEN"\|"BLACKOUT" }`. |
| `HOST_EMERGENCY_STOP` | `HOST` | Instantly halt all trading floor activity with audible siren. |
| `HOST_TRIGGER_NEWS` | `HOST` | Immediately trigger a scheduled news event by ID. |
| `HOST_PUBLISH_NEWS_NOW` | `HOST` | Publish an unannounced scheduled news item immediately. |
| `HOST_CREATE_CUSTOM_NEWS` | `HOST` | Inject custom breaking news shock: `{ headline, ticker, deltaPct, durationSec }`. |
| `HOST_CANCEL_NEWS` | `HOST` | Cancel a scheduled news event before it fires. |
| `HOST_EDIT_NEWS` | `HOST` | Edit a scheduled news headline or delay offset before lock. |
| `HOST_TRIGGER_CIRCUIT_BREAKER` | `HOST` | Manually test/force a circuit halt: `{ ticker, direction: "UPPER"\|"LOWER" }`. |
| `HOST_RELEASE_CIRCUIT_BREAKER` | `HOST` | Manually release a circuit halt on a stock: `{ ticker }`. |
| `HOST_SECTOR_HALT` | `HOST` | Halt all stocks belonging to a specified sector. |
| `HOST_CONCLUDE_DAY` | `HOST` | Authoritatively conclude current trading day, freeze portfolios, lock daily snapshot. |
| `HOST_START_NEXT_DAY` | `HOST` | Advance competition from concluded day to Day $N+1$ Standby. |
| `HOST_ADD_DAY` | `HOST` | Extend competition duration by adding Day $N+1$. |
| `HOST_CONCLUDE_CHAMPIONSHIP` | `HOST` | Conclude final day, freeze all trading permanently, lock championship podium. |
| `HOST_START_WINNER_PRESENTATION`| `HOST` | Launch 6-stage ceremonial projector podium reveal. |
| `HOST_SET_PRESENTATION_SCENE` | `HOST` | Advance presentation scene (`SCENE_BRONZE`, `SCENE_SILVER`, `SCENE_CHAMPION`, etc.). |
| `HOST_EXIT_WINNER_PRESENTATION` | `HOST` | Return projector to standard rotating board. |
| `HOST_UPDATE_PROJECTOR_MODE` | `HOST` | Set projector mode (`AUTO_CYCLE`, `FIXED_BOARD`, `LEADERBOARD`, `NEWS_WALL`). |
| `HOST_SET_PROJECTOR_BOARD_PAGE` | `HOST` | Manually jump projector board to Page $P$. |
| `HOST_TOGGLE_PROJECTOR_BOARD_PAUSE`| `HOST` | Pause/resume auto-cycling rotation on projector. |
| `HOST_TEST_SOUND_CUE` | `HOST` | Trigger test sound tone on Hall Sound System: `{ cueName, category }`. |
| `HOST_UPDATE_AUDIO_SETTINGS` | `HOST` | Set master volume and category audio toggles. |
| `HOST_RESET_ENTIRE_CHAMPIONSHIP`| `HOST` | Full tournament wipe requiring phrase confirmation: `{ confirmation: "RESET" }`. |
| `HOST_INITIALIZE_NEW_CHAMPIONSHIP`| `HOST` | Re-initialize tournament state with new parameters. |
| `HOST_CREATE_CHECKPOINT` | `HOST` | Create manual snapshot checkpoint. |
| `HOST_RESTORE_CHECKPOINT` | `HOST` | Restore competition from saved checkpoint file. |

### Server-to-Client Outbound Broadcasts

| Broadcast Type | Recipients | Description |
|---|---|---|
| `PUBLIC_EVENT_STATUS` | Fresh/Public Sockets | Setup progress, lock status, and event title. |
| `EVENT_CONFIG_LOCKED` | All Clients | Real-time signal that setup is locked and team logins are active. |
| `TICK_UPDATE` | Authenticated Clients | 1-second price ticks, percent changes, volume, high/low, and portfolio equity. |
| `COUNTDOWN_START` | Authenticated Clients | 3-2-1 resume countdown start with exact server epoch timestamp. |
| `COUNTDOWN_TICK` | Authenticated Clients | Seconds remaining in countdown (3, 2, 1). |
| `COUNTDOWN_CANCELLED` | Authenticated Clients | Countdown aborted due to host pause. |
| `MARKET_RESUMED` | Authenticated Clients | Market trading is live. |
| `MARKET_PAUSED` | Authenticated Clients | Market trading is paused (`pauseMode`). |
| `EMERGENCY_STOP` | Authenticated Clients | Full-floor emergency stop screen. |
| `CIRCUIT_BREAKER_ALERT` | Authenticated Clients | Stock has breached $\pm 20\%$ limit and is halted. |
| `CIRCUIT_RECOVERY_ALERT`| Authenticated Clients | Stock has been released from circuit halt. |
| `NEWS_FLASH` | Authenticated Clients | Breaking news announcement banner (Host receives private impact details; non-hosts receive neutral text). |
| `DAY_CONCLUDED` | Authenticated Clients | Daily session concluded with audited daily rankings and closing prices. |
| `DAY_TRANSITION` | Authenticated Clients | Advancing to Day $N+1$ Standby. |
| `CHAMPIONSHIP_CONCLUDED` | Authenticated Clients | Tournament ended with official final winner standings. |
| `PROJECTOR_STATE_UPDATE`| Projector / Host | Projector rotation page, active scene, and duration updates. |
| `PRESENTATION_SCENE_UPDATE`| Projector / Host | Winner ceremony stage update (`BRONZE`, `SILVER`, `CHAMPION`, etc.). |
| `AUDIO_CUE` | Sound Console | Sound trigger command dispatched to hall audio synthesizer. |
| `CHAMPIONSHIP_RESET` | All Clients | Tournament wiped by host; forces trader terminals to logout overlay. |

---

## 7. Authoritative Data Entities & In-Memory Schemas

All master entities reside in `server.js`:

### 1. `gameState` (Authoritative Game State)
```javascript
{
  eventId: "EVT_1792316217757_4TGVVW", // Cryptographic UUID/ID per event run
  stateVersion: 1,                      // Incremented on reset/recovery
  title: "The Trading Floor Championship 2026",
  institution: "Gujarat Technological University",
  status: "LIVE",                       // SETUP, STANDBY, COUNTDOWN, LIVE, PAUSED, DAY_COMPLETED, CHAMPIONSHIP_CONCLUDED, RESET
  configLocked: true,                   // True = Settings frozen, team logins open
  currentDay: 1,                        // 1-indexed active trading day
  totalDays: 2,                         // Total scheduled tournament days
  dayDurationSeconds: 1800,             // Length of trading day (e.g. 1800s = 30m)
  elapsedSeconds: 412,                  // Active trading seconds elapsed in current day
  isPaused: false,                      // Market trading frozen flag
  pauseMode: "NONE",                    // NONE, VISIBLE_FROZEN, BLACKOUT, RECOVERY
  startingCash: 500000,                 // Initial virtual cash per desk (₹5,00,000)
  transactionFeeBps: 10,                // 10 bps = 0.10% transaction fee
  circuitBreakerPercent: 20,            // ±20% daily circuit breaker band
  tickIntervalMs: 1000,                 // 1000ms background price engine tick
  scheduledStartTime: "09:30 AM",       // Human-readable 12-hour start time
  activeNewsFlash: null,                // Currently active breaking news item
  dailyLeaderboards: { "day_1": { ... } }, // Immutable finalized daily snapshots
  projectorState: { mode: "AUTO_CYCLE", boardPage: 1, sceneDurationSeconds: 12 },
  presentationState: { active: false, scene: "SCENE_INTRO" }
}
```

### 2. `companies` (Stock Universe Array)
```javascript
[
  {
    ticker: "RELIANCE",
    name: "Reliance Industries",
    sector: "Energy & Conglomerate",
    base_price: 2950.00,
    currentPrice: 2964.50,
    dayOpenPrice: 2950.00,        // IMMUTABLE baseline for daily circuit breaker
    previousClosePrice: 2950.00,
    dayHigh: 2980.00,
    dayLow: 2942.00,
    week52High: 3217.00,
    week52Low: 2220.00,
    lot_presets: [1, 5, 10],
    beta: 1.05,                   // SENSITIVE: CAPM sensitivity (Host only)
    volatility_factor: 0.0022,    // SENSITIVE: Idiosyncratic noise amplitude (Host only)
    isHalted: false,
    haltDirection: null,          // "UPPER" or "LOWER"
    isEnabled: true,              // True = visible and tradeable
    activeTransition: null,       // Ongoing smoothstep shock transition object
    history: [{ time: 0, price: 2950.00 }, ...]
  }
]
```

### 3. `teams` (Desk Registry Object)
```javascript
{
  "team_1": {
    id: "team_1",
    name: "Dalal Street Titans",
    username: "team1",
    password: "trade100",
    members: "Aarav Sharma, Diya Patel",
    cash: 492100.50,
    startingCash: 500000.00,
    dayOpeningPortfolioValue: 500000.00, // Locked at start of day for Daily P&L
    holdings: { "RELIANCE": 10, "TATAMOTORS": 0 },
    avgBuyPrice: { "RELIANCE": 2950.00, "TATAMOTORS": 0 },
    realizedPnl: 1450.00,
    tradeCount: 3
  }
}
```

### 4. `newsEvents` (Scheduled News Plan)
```javascript
[
  {
    event_id: "EVT_D1_01",
    day: 1,
    relative_position: 0.15,      // 15% of session duration (invariant across duration changes)
    trigger_second: 270,          // Calculated: round(1800 * 0.15)
    reading_duration_sec: 25,     // Cognitive reading window (12s, 18s, 22s, or 25s)
    type: "SECTOR",
    headline: "Commercial Vehicle Scrappage Incentives Announced",
    simple_explanation: "Favorable policy support for domestic commercial vehicle manufacturers.",
    impacts: {                    // SENSITIVE: Price shock parameters (Host only)
      "TATAMOTORS": { base_pct: 11.5, duration_sec: 45 }
    },
    triggered: false,
    impactsApplied: false,
    phase: "SCHEDULED"            // SCHEDULED, READING, REACTING, IMPACT_COMPLETE
  }
]
```

---

## 8. Main Domain Services & Calculation Engines

1. **Stochastic Price Engine (`server.js` lines 1450–1560)**:
   - Evaluates on a 1-second interval (`tickIntervalMs = 1000`).
   - Implements zero-drift geometric Brownian motion during quiet trading.
   - Computes continuous cubic Hermite spline ("smoothstep") trajectories during news shocks.
   - Enforces automatic $\pm 20\%$ circuit breaker bounds.
2. **Order Execution & Financial Accounting Engine (`server.js` lines 2470–2715)**:
   - Calculates gross transaction value, 10 bps fee deductions, and cash balances.
   - Enforces 200ms anti-spam debounce per session.
   - Rejects overbuying (cash shortfall) and overselling (insufficient shares).
   - Rejects orders violating upper/lower circuit halts.
3. **Dynamic Schedule Scaling & News Engine (`server.js` lines 865–980, 1075–1175)**:
   - Proportional trigger offset recalculation ($t_i = D \times p_i$).
   - Human cognitive reading window calculation ($W(D)$ step function).
   - Feasibility validation (positive offsets, buffer to closing bell, $\ge 60\text{s}$ spacing).
   - Idempotent news trigger execution via `firedNewsEventsPerDay` Map.
4. **Projector Zero-Scroll Pagination Engine (`public/app.js` lines 3910–4150)**:
   - Partitions universe into 8-card responsive pages ($4 \times 2$ grid).
   - Rotates pages every 8 seconds without destroying DOM canvas contexts or causing visual flicker.
   - Spotlights Top Gainer and Top Loser globally across the entire active universe.
5. **Institutional Audio Synthesizer Engine (`public/app.js` lines 650–950)**:
   - Uses Web Audio API `AudioContext` with custom additive synthesis.
   - Produces 8 distinct audio cues: Market Open Bell, Market Close Bell, Order Filled Beep, Circuit Klaxon, Breaking News Fanfare, Emergency Siren, Countdown Tick, Winner Fanfare.
   - Operates 100% locally without external audio media files.

Proceed to **`ARGON_DOSSIER/02_SCREEN_AND_BUTTON_INVENTORY.md`**.


<!-- END OF 01_ARCHITECTURE.md -->


================================================================================
<!-- START OF 02_SCREEN_AND_BUTTON_INVENTORY.md -->
================================================================================

# SCREEN & INTERACTION INVENTORY
## Complete Screen Catalogue, Modal Registry & Button-by-Button Interaction Map

> **DOCUMENT ID**: `ARGON_DOSSIER/02_SCREEN_AND_BUTTON_INVENTORY.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **PRIMARY FILES**: [public/index.html](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/index.html), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js), [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js)

---

## 1. Complete Screen & View Catalogue

The frontend is a Single-Page Application (SPA) where only one primary view is visible at any time (`display: block` vs `display: none`), managed via `switchView(viewId)` in `public/app.js`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                               VIEW ROUTER                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌──────────────┬────────────────┼──────────────┬────────────────┐
    ▼              ▼                ▼              ▼                ▼
#loginView    #hostView       #traderView    #projectorView   #soundConsoleView
(Auth/Roles)  (Host Matrix)   (Student Desk) (Auditorium 4:3) (Hall PA System)
```

### 1. `#loginView` — Universal Terminal Gateway
- **Intended User**: All participants, Host, Projector operator, Sound engineer.
- **Entry Conditions**: Default landing view on fresh browser load or after terminal logout/reset.
- **Visible Information**: Competition title, GTU affiliation badge, real-time connection status pill, role selector pills (Host, Projector, Trader Desk, Winner Stage, Sound), username & password inputs, login error banner.
- **Gating**: Trader logins are strictly disabled until the Host completes and locks the setup wizard (`gameState.configLocked === true`).

### 2. `#hostView` — Host Master Control Matrix
- **Intended User**: Event Coordinator, Professor, Student Head.
- **Structure**: Divided into **4 Primary Navigation Hubs**:
  1. **`🏠 1. Home` (`#hostTabContentHome`)**: Real-time tournament heartbeat, terminal connection monitor (connected traders, projector, sound), 5-point Readiness Checklist, dynamic "Next Step" action card.
  2. **`⚙️ 2. Event Setup` (`#hostTabContentSetup` / `#eventSetupView`)**: 8-step guided configuration wizard (`1. Event Details -> 2. Teams Roster -> 3. Stock Universe -> 4. Rules & Limits -> 5. Schedule & Timing -> 6. News Timeline -> 7. Projector & Sound -> 8. Review & Lock`).
  3. **`📈 3. Live Market` (`#hostTabContentMarket`)**: The operational hub during live competition. Features the canonical **Live Market Operations Bar** (`▶ Resume 3-2-1`, `⏸ Pause`, `🕶️ Blackout`, `🏁 Conclude Session`, `🛑 Emergency Stop`), News Control Center with 60-second privacy reveal, live trade feed, and stock board.
  4. **`🖥️ 4. Stage & Results` (`#hostTabContentProjector`)**: Auditorium Projector Remote (Auto-Cycle / Fixed Screen / Board Page Selector), Team Investment Analytics, Sound Console controls, Disaster Recovery & Checkpoint Matrix, Leaderboard, CSV/JSON exports, and Tournament Reset card.

### 3. `#traderView` — Student Trader Terminal
- **Intended User**: Student trading teams (16 to 30 teams, 2 traders per desk).
- **Structure**:
  - **Header Bar**: Team name, desk ID (`team_1`), available cash, portfolio market value, total net worth, realized P&L, daily return %.
  - **Pre-Market Waiting Room Overlay (`#traderWaitingRoomOverlay`)**: Full-screen luxury card shown during `STANDBY`, displaying scheduled 12-hour AM/PM opening time and trading rules.
  - **Market Tab (`#traderTabContentMarket`)**: Active stock card grid, search bar, sector filter pills, Top Gainer / Loser sort options.
  - **Positions Tab (`#traderTabContentPositions`)**: Granular open position table with quantity, average buy price, current market price, and unrealized P&L. Includes quick "Sell" and "Liquidate All" actions.
  - **Trades Tab (`#traderTabContentTrades`)**: Chronological audit log of executed orders.
  - **Day Completed Overlay (`#traderDayCompletedOverlay`)**: Full-screen modal elevated to `z-index: 10000` with daily ranking, net worth, and waiting-for-host indicator.

### 4. `#projectorView` — Auditorium Stage Projector
- **Intended User**: Large auditorium audience, spectators, faculty jury.
- **Structure**:
  - **Persistent Spotlight Bar**: Top Percentage Gainer, Top Percentage Loser, Market Breadth (Advancing / Declining / Unchanged).
  - **Zero-Scroll Stock Board**: 8-card responsive grid ($4 \times 2$) rotating every 8 seconds across multiple pages. Supports vintage 4:3 campus projectors (1024×768 / 800×600) without horizontal scrollbars.
  - **Auditorium Hero Countdown (`#countdownOverlay`)**: Giant pulsating 3-2-1 countdown overlay.
  - **Breaking News Crawl Overlay (`#newsFlashModal`)**: Full-screen breaking wire banner with neutral headline.
  - **Ceremonial Winner Stage (`#winnerPresentationView`)**: 6-stage presentation reveal (`INTRO` -> `BRONZE` -> `SILVER` -> `CHAMPION` -> `PODIUM` -> `LEADERBOARD`).

### 5. `#soundConsoleView` — Hall PA Sound System Console
- **Intended User**: Auditorium audio technician.
- **Structure**: Master volume slider, mute toggle, category volume sliders (Lifecycle Bells, News Fanfare, Circuit Alarms, Ceremony Trumpets), test tone soundboard, and live WebSocket audio listener.

---

## 2. Modal, Overlay & Dialog Registry

All 22 dialogs and overlays defined in `public/index.html`:

| Modal ID | Purpose & Trigger | Roles Visible To | Key Interactive Controls |
|---|---|---|---|
| `#tradeModal` | Buy/Sell Order Entry (clicking stock card). | `TRADER` | Quantity stepper (`-`, `+`, `Max`), Gross value, 10 bps fee preview, Confirm button. |
| `#detailsModal` | Fundamentals & 52-Week Range modal. | `TRADER`, `HOST` | Face value, market cap, P/E, 52W bar, summary. |
| `#fullChartModal` | Interactive Bezier Canvas Chart. | `TRADER`, `HOST` | High-FPS Canvas 2D chart with historical price ticks. |
| `#liquidateModal` | Emergency exit confirmation dialog. | `TRADER` | Cancel, `btnConfirmLiquidate` (`LIQUIDATE_ALL`). |
| `#modalConcludeDay` | Day conclusion confirmation dialog. | `HOST` | Daily snapshot notice, Confirm Day Conclusion. |
| `#modalStartNextDay`| Advance to Day $N+1$ confirmation dialog. | `HOST` | Advance to Day $N+1$ Standby, Schedule Timer. |
| `#modalAddDay` | Extend tournament by adding Day $N+1$. | `HOST` | Add Day button. |
| `#modalFinishEvent` | Championship finalization confirmation. | `HOST` | Confirm Final Championship Conclusion. |
| `#modalEmergencyStop`| Floor-wide Emergency Stop confirmation. | `HOST` | Red Emergency Stop trigger button. |
| `#resetChampionshipModal`| Permanent tournament wipe modal. | `HOST` | Strict confirmation input (`"RESET"`), wipe button. |
| `#championshipWizardModal`| Fast tournament re-initialization wizard. | `HOST` | Title, cash, days, duration, fee, circuit band. |
| `#shareEditorModal` | Add/Edit company fundamentals modal. | `HOST` | Ticker, name, sector, price, collapsible Advanced Settings ($\beta$, $\sigma$). |
| `#teamSetupModal` | Team names and passwords editor. | `HOST` | 16-team table with custom names and passwords. |
| `#eventSettingsModal`| Global parameters editor modal. | `HOST` | Title, starting cash, fees, circuit limit inputs. |
| `#scheduleEventModal`| Timed auto-start scheduler modal. | `HOST` | Scheduled start clock, duration, confirm button. |
| `#teamInvestmentDetailModal`| Detailed single-team analytics modal. | `HOST` | Holdings table, avg buy price, trade order history. |
| `#rulesHelpModal` | Rules & scoring formula documentation. | `TRADER`, `HOST` | Tabs explaining order rules, fees, circuit breaks. |
| `#clientResetModal`| Full-screen lockout shown when host resets. | `TRADER`, `PROJECTOR`| Acknowledgment button redirecting to login. |
| `#newsFlashModal` | Breaking news broadcast banner overlay. | All | Auto-dismisses after reading window expires. |
| `#countdownOverlay`| 3-2-1 Synchronized resume countdown. | All | 3-2-1 animated sequence. |
| `#softPauseOverlay`| Semi-transparent market pause banner. | `TRADER` | Notice that trading is paused by host. |
| `#blackoutOverlay` | Full blackout screen during private pause. | All | Black screen hiding all market boards. |

---

## 3. Exhaustive Button-by-Button Interaction Table

Every interactive button in the application, traced from DOM ID to server handler:

| Button ID | UI Label | Screen / Container | Preconditions | JS Handler (`app.js`) | WebSocket Action / REST | Server Handler (`server.js`) | Downstream Mutation & Broadcast |
|---|---|---|---|---|---|---|---|
| `#demoPillHost` | `👑 Host Panel` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `host`, password to `host2026`. |
| `#demoPillProjector` | `📊 Projector` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `projector`, password to `screen2026`. |
| `#demoPillTrader` | `💻 Trader Desk` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `team1`, password to `trade100`. |
| `#demoPillWinner` | `🏆 Winner Stage` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `winner`, password to `winner2026`. |
| `#demoPillSound` | `🔊 Sound` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `sound`, password to `sound2026`. |
| `btnLoginSubmit` | `Access Terminal ➔` | `#loginView` | Fields not empty | `handleLoginSubmit()` | `LOGIN` | Lines 2362–2411 | Validates credentials, creates session token, returns `LOGIN_SUCCESS` or `LOGIN_ERROR`. |
| `#hostTabBtnHome` | `🏠 1. Home` | `#hostView` | Host logged in | `switchHostTab('home')` | None (Local DOM) | None | Displays `#hostTabContentHome`, updates navigation bar styling. |
| `#hostTabBtnEvent` | `⚙️ 2. Event` | `#hostView` | Host logged in | `switchHostTab('event')` | None (Local DOM) | None | Displays `#eventSetupView`, updates wizard progress. |
| `#hostTabBtnMarket` | `📈 3. Live Market` | `#hostView` | Host logged in | `switchHostTab('market')`| None (Local DOM) | None | Displays `#hostTabContentMarket`, starts trade stream updates. |
| `#hostTabBtnStage` | `🖥️ 4. Stage & Results`| `#hostView`| Host logged in | `switchHostTab('stage')` | None (Local DOM) | None | Displays `#hostTabContentProjector`, loads analytics. |
| `#btnUnlockEventConfig`| `🔓 Unlock Configuration`| `#hostTabContentHome`| `STANDBY` & elapsed=0 | `hostUnlockConfiguration()` | `HOST_UNLOCK_EVENT_CONFIG` | Lines 3090–3113 | Unlocks setup wizard; sets `configLocked = false`. |
| `#btnNextStepAction` | `⚙️ Go to Event Setup` | `#hostTabContentHome`| Host logged in | `switchHostTab('event')` | None (Local DOM) | None | Jumps host directly to setup wizard tab. |
| `#btnMarketResume` | `▶ Resume 3-2-1` | Live Operations Bar | `PAUSED` or `STANDBY` | `hostResumeMarket()` | `HOST_RESUME_COUNTDOWN` | Lines 3173–3180 | Starts 3-2-1 countdown; broadcasts `COUNTDOWN_START`. |
| `#btnMarketPauseSoft` | `⏸ Pause` | Live Operations Bar | `LIVE` trading | `hostPauseMarket('VISIBLE_FROZEN')` | `HOST_PAUSE` | Lines 3138–3171 | Freezes trading; broadcasts `MARKET_PAUSED`. |
| `#btnMarketPauseBlackout`| `🕶️ Blackout` | Live Operations Bar | `LIVE` trading | `hostPauseMarket('BLACKOUT')` | `HOST_PAUSE` | Lines 3138–3171 | Freezes trading & blacks screen; broadcasts `MARKET_PAUSED`. |
| `#btnMarketCloseSession`| `🏁 Conclude Session` | Live Operations Bar | `LIVE` or `PAUSED` | `openConcludeDayModal()` | `HOST_CONCLUDE_DAY` | Lines 3473–3483 | Concludes day; sets `DAY_COMPLETED`; broadcasts `DAY_CONCLUDED`. |
| `#btnEmergencyStopTrigger`| `🛑 Emergency Stop`| Live Operations Bar | Any active state | `openEmergencyStopModal()`| `HOST_EMERGENCY_STOP` | Lines 3603–3626 | Halts floor; triggers siren; broadcasts `EMERGENCY_STOP`. |
| `#btnRevealPrivateNews` | `👁️ Reveal Details` | News Control Center | Host logged in | `revealPrivateNewsDetails()`| None (Local DOM) | None | Unmasks impact % for 60 seconds with countdown banner. |
| `#btnLockEventSetup` | `🔒 Confirm & Lock` | Setup Step 8 | Valid configuration | `submitLockSetup()` | `HOST_SET_EVENT_LOCK` | Lines 2879–3070 | Locks setup; sets `configLocked = true`; broadcasts `EVENT_CONFIG_LOCKED`. |
| `#btnExecuteTradeOrder`| `Confirm BUY/SELL` | `#tradeModal` | Affordable & unhalted | `submitOrder()` | `ORDER` | Lines 2470–2718 | Validates order; executes fill; broadcasts `TICK_UPDATE`. |
| `#btnLiquidateAll` | `⚡ Liquidate to Cash`| `#traderView` | Has open holdings | `openLiquidateModal()` | None (Local DOM) | None | Opens `#liquidateModal` confirmation dialog. |
| `#btnConfirmLiquidate` | `🚨 Sell Everything` | `#liquidateModal` | Has open holdings | `executeLiquidateAll()` | `LIQUIDATE_ALL` | Lines 2719–2750 | Sells all active positions; broadcasts `PORTFOLIO_LIQUIDATED`. |
| `#btnExecuteStartNextDay`| `▶️ Advance to Standby`| `#modalStartNextDay` | `DAY_COMPLETED` | `executeStartNextDay()` | `HOST_START_NEXT_DAY` | Lines 3486–3563 | Advances to Day $N+1$; broadcasts `DAY_TRANSITION`. |
| `#btnConfirmResetChampionship`| `Permanently Wipe`| `#resetChampionshipModal`| Typed `"RESET"` | `executeResetChampionship()`| `HOST_RESET_ENTIRE_CHAMPIONSHIP`| Lines 4058–4204 | Wipes tournament; generates new `eventId`; broadcasts `CHAMPIONSHIP_RESET`. |
| `#btnProjModeAuto` | `🔄 Auto-Cycle Mode` | Projector Remote | Host logged in | `setProjectorMode('AUTO_CYCLE')`| `HOST_UPDATE_PROJECTOR_MODE`| Lines 3435–3450 | Enables automatic 8-second page rotation on projector. |
| `#btnProjModeFixed` | `📌 Fixed Screen` | Projector Remote | Host logged in | `setProjectorMode('FIXED_BOARD')`| `HOST_UPDATE_PROJECTOR_MODE`| Lines 3435–3450 | Freezes projector display on selected board page. |
| `#btnProjFullscreen` | `⛶ Enter Fullscreen` | Projector Header | Modern browser | `toggleProjectorFullscreen()` | None (Browser API) | None | Requests browser `requestFullscreen()` on `#projectorView`. |
| `#btnProjToggleBoardPause`| `⏸ / ▶` | Projector Header | Host / Projector | `toggleProjectorBoardPause()` | `HOST_TOGGLE_PROJECTOR_BOARD_PAUSE`| Lines 3462–3471 | Pauses/resumes automatic page cycling timer. |
| `#btnUnlockAudio` | `🔊 Unlock Speakers` | `#soundConsoleView` | Browser gesture | `unlockAudioContext()` | None (Web Audio) | None | Resumes suspended `AudioContext` and plays test chime. |

---

## 4. In-Card & Dynamic Table Actions

In addition to static buttons, `public/app.js` generates interactive buttons dynamically:

### Stock Cards (`renderStockCard(stock)`)
- **`Buy` Button**: Triggers `openTradeModal(ticker, 'BUY')`. Populates current price, max affordable shares, fee preview, and opens `#tradeModal`.
- **`Sell` Button**: Triggers `openTradeModal(ticker, 'SELL')`. Populates current shares held, net cash proceeds, fee preview, and opens `#tradeModal`.
- **`Chart` Icon**: Triggers `openFullChartModal(ticker)`. Opens `#fullChartModal` and attaches real-time Canvas 2D tick engine.
- **`Info` (Details) Icon**: Triggers `openDetailsModal(ticker)`. Displays fundamentals and 52-week price bar in `#detailsModal`.

### News Control Center Cards (`renderNewsControlCentre()`)
- **`⚡ Publish Now`**: Triggers `hostPublishNewsNow(eventId)` $\to$ `HOST_PUBLISH_NEWS_NOW`. Server verifies `firedNewsEventsPerDay` to prevent duplicate publishing.
- **`✏️ Edit`**: Triggers `openEditNewsModal(eventId)`. Blocked by server if `gameState.configLocked === true`.
- **`❌ Cancel`**: Triggers `hostCancelNews(eventId)` $\to$ `HOST_CANCEL_NEWS`. Blocked if event is already locked or published.

### Share Universe Catalogue Table (`renderUniverseTable()`)
- **`Toggle Trading` (Eye Icon)**: Triggers `hostToggleShare(ticker)` $\to$ `HOST_TOGGLE_SHARE`. Toggles `c.isEnabled`, preventing new order routing.
- **`Edit Share` (Pencil Icon)**: Opens `#shareEditorModal` with company fundamentals and collapsible Advanced Simulation Settings.
- **`Duplicate Share` (Copy Icon)**: Clones company into universe before setup lock.
- **`Delete Share` (Trash Icon)**: Removes custom stock before setup lock.

Proceed to **`ARGON_DOSSIER/03_EVENT_LIFECYCLE.md`**.


<!-- END OF 02_SCREEN_AND_BUTTON_INVENTORY.md -->


================================================================================
<!-- START OF 03_EVENT_LIFECYCLE.md -->
================================================================================

# EVENT LIFECYCLE & STATE MACHINE
## Complete Tournament Lifecycle, State Transitions & Recovery Workflows

> **DOCUMENT ID**: `ARGON_DOSSIER/03_EVENT_LIFECYCLE.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **PRIMARY FILES**: [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js) (lines 1229–1370, 3130–3610), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js) (lines 6280–6670, 9380–9520)

---

## 1. Finite State Machine (FSM) Overview

The tournament progresses through 8 formal lifecycle states enforced strictly on the server (`gameState.status`):

```
       ┌───────────┐
       │   SETUP   │  (Configuration unlocked, team logins gated)
       └─────┬─────┘
             │  HOST_SET_EVENT_LOCK
             ▼
       ┌───────────┐
       │  STANDBY  │◄────────────────────────────────────────┐
       └─────┬─────┘                                         │
             │  HOST_RESUME_COUNTDOWN                        │
             ▼                                               │
       ┌───────────┐                                         │
       │ COUNTDOWN │  (Authoritative 3-2-1 sequence)         │
             ▼                                               │
       ┌───────────┐  HOST_PAUSE                             │
  ┌───►│   LIVE    ├─────────────┐                           │
  │    └───┬───────┘             ▼                           │
  │        │               ┌───────────┐                     │
  │        │ HOST_RESUME   │  PAUSED   │                     │
  │        └───────────────┤ (Visible/ │                     │
  │                        │  Blackout)│                     │
  │                        └─────┬─────┘                     │
  │                              │                           │
  │  Timer Expiry / Conclude     │                           │
  └──────────────────────────────┼───────────────────────────┤
                                 ▼                           │
                       ┌───────────────────┐                 │
                       │   DAY_COMPLETED   │                 │
                       └─────────┬─────────┘                 │
                                 │                           │
                   ┌─────────────┴─────────────┐             │
      Current < Total Days              Current === Total Days
                   │                           │             │
                   ▼                           ▼             │
             HOST_START_NEXT_DAY   HOST_CONCLUDE_CHAMPIONSHIP│
                   │                           │             │
                   └───────────────────────────┼─────────────┘
                                               ▼
                                   ┌───────────────────────┐
                                   │ CHAMPIONSHIP_CONCLUDED│
                                   └───────────┬───────────┘
                                               │ HOST_START_WINNER_PRESENTATION
                                               ▼
                                   ┌───────────────────────┐
                                   │  WINNER_ANNOUNCEMENT  │ (6-Stage Projector Reveal)
                                   └───────────────────────┘
```

---

## 2. Comprehensive State Transition Matrix

| # | Current State | Triggering Event / Action | Preconditions | Frontend Handler (`app.js`) | Backend Handler (`server.js`) | Persistence | Resulting State | Realtime Broadcast | Screens Affected |
|---|---|---|---|---|---|---|---|---|---|
| **T01** | `None` | Server Boot (`node server.js live`) | Clean startup or recovery file exists | N/A | Lines 4725–4750 | Loads `live_game_state.json` or scenario | `SETUP` or Restored | None | All |
| **T02** | `SETUP` | `HOST_SET_EVENT_LOCK` | $\ge 4$ stocks, valid title, teams configured | `submitLockSetup()` | Lines 2879–3070 | `saveLiveGameState()`, `saveUniverseToDisk()` | `STANDBY` (`configLocked = true`) | `EVENT_CONFIG_LOCKED`, `PUBLIC_EVENT_STATUS` | Login screen opens logins; Host shows locked badge. |
| **T03** | `STANDBY` | `HOST_UNLOCK_EVENT_CONFIG` | Pre-trading only (`elapsedSeconds === 0`) | `hostUnlockConfiguration()` | Lines 3090–3113 | `saveLiveGameState()` | `SETUP` (`configLocked = false`) | `PUBLIC_EVENT_STATUS` | Setup wizard inputs re-enable. |
| **T04** | `STANDBY` / `PAUSED` | `HOST_RESUME_COUNTDOWN` | Not concluding, no active countdown | `hostResumeMarket()` | Lines 2123–2160, 3173–3180 | In-memory countdown | `COUNTDOWN` | `COUNTDOWN_START` (3s) | All screens display hero 3-2-1 overlay. |
| **T05** | `COUNTDOWN` | `HOST_PAUSE` | Active countdown in progress | `hostPauseMarket()` | Lines 3138–3150 | In-memory | `PAUSED` | `COUNTDOWN_CANCELLED`, `MARKET_PAUSED` | Countdown overlay dismisses instantly; pause overlay shows. |
| **T06** | `COUNTDOWN` | Timer Expiry (3000ms elapsed) | Host did not pause during 3-2-1 | Handled via countdown tick callback | Lines 2145–2160 | `saveLiveGameState()` | `LIVE` (`isPaused = false`) | `MARKET_RESUMED` | Overlays clear; trade modals and buttons activate. |
| **T07** | `LIVE` | `HOST_PAUSE` | Market currently trading | `hostPauseMarket(mode)` | Lines 3138–3170 | `saveLiveGameState()` | `PAUSED` (`isPaused = true`) | `MARKET_PAUSED` | Trader orders blocked; soft pause or blackout overlay shows. |
| **T08** | `LIVE` | `HOST_EMERGENCY_STOP` | Any live trading | `openEmergencyStopModal()` | Lines 3603–3626 | `saveLiveGameState()` | `PAUSED` (`pauseMode = 'BLACKOUT'`) | `EMERGENCY_STOP` | Audible klaxon sounds; red emergency stop screen displayed. |
| **T09** | `LIVE` / `PAUSED` | Timer Expiration (`elapsedSeconds >= dayDurationSeconds`) | Automatic end-of-session | Clock tick loop evaluates duration | Lines 1229–1370 (`concludeCurrentDay(true)`) | Locks daily snapshot to `dailyLeaderboards` | `DAY_COMPLETED` (`isPaused = false`) | `BELL_EVENT` (Close), `DAY_CONCLUDED` | `#traderDayCompletedOverlay` displays daily rankings. |
| **T10** | `LIVE` / `PAUSED` | `HOST_CONCLUDE_DAY` | Manual host conclusion | `openConcludeDayModal()` | Lines 3473–3483 (`concludeCurrentDay(false)`) | Locks daily snapshot to `dailyLeaderboards` | `DAY_COMPLETED` (`isPaused = false`) | `BELL_EVENT` (Close), `DAY_CONCLUDED` | Host operations bar locks; `#traderDayCompletedOverlay` displays. |
| **T11** | `DAY_COMPLETED` | `HOST_START_NEXT_DAY` | `currentDay < totalDays` | `executeStartNextDay()` | Lines 3486–3563 | Locks Day $N$ close as Day $N+1$ baseline | `STANDBY` (Day $N+1$, `elapsed = 0`) | `DAY_TRANSITION`, `DAY_ADVANCED` | Day flips to $N+1$; waiting room reappears; holdings preserved. |
| **T12** | `DAY_COMPLETED` | `HOST_ADD_DAY` | Day completed | `executeAddDay()` | Lines 3565–3581 | Increments `totalDays` | `DAY_COMPLETED` (New total) | `DAY_ADDED` | Tournament extended by 1 day; news balanced. |
| **T13** | `DAY_COMPLETED` | `HOST_CONCLUDE_CHAMPIONSHIP` | `currentDay === totalDays` | `openFinishEventModal()` | Lines 4006–4046 | Generates `finalResultsSnapshot` | `CHAMPIONSHIP_CONCLUDED` | `CHAMPIONSHIP_CONCLUDED` | Trading locked permanently; official podium created. |
| **T14** | `CHAMPIONSHIP_CONCLUDED` | `HOST_START_WINNER_PRESENTATION`| Host logged in | `startWinnerPresentation()` | Lines 3352–3381 | In-memory presentation state | `WINNER_ANNOUNCEMENT` | `PROJECTOR_STATE_UPDATE`, `PRESENTATION_SCENE_UPDATE` | Projector transitions to 6-stage ceremonial stage. |
| **T15** | `WINNER_ANNOUNCEMENT` | `HOST_SET_PRESENTATION_SCENE` | Presentation active | `setPresentationScene(scene)` | Lines 3395–3433 | In-memory scene state | `WINNER_ANNOUNCEMENT` | `PRESENTATION_SCENE_UPDATE` | Projector displays Bronze, Silver, Champion, Podium, Leaderboard. |
| **T16** | `Any` | `HOST_RESET_ENTIRE_CHAMPIONSHIP`| Confirmation `"RESET"` provided | `executeResetChampionship()` | Lines 4058–4204 | Unlinks `live_game_state.json`; creates fresh `eventId` | `RESET` $\to$ `STANDBY` (Day 1) | `CHAMPIONSHIP_RESET`, `CHAMPIONSHIP_RESET_ACK` | Traders logged out to `#clientResetModal`; Host returned to Step 1. |

---

## 3. Detailed Step-by-Step User Journey

### Phase 1: Server Startup & Crash Recovery
1. The coordinator double-clicks `Launch_The_Trading_Floor.bat`.
2. The batch script detects local `%~dp0tools\node.exe` or system `node`, launching `server.js live`.
3. The server inspects `data/live_game_state.json`:
   - If present and valid (from a server power outage or accidental terminal close), the engine **restores all balances, holdings, elapsed clocks, and daily snapshots cleanly**, setting `isPaused = true` and `pauseMode = 'RECOVERY'`. The market waits safely for the Host to resume.
   - If absent, it loads baseline `data/universe_active.json` with 20 real Indian enterprises in state `SETUP`.
4. The server prints the local LAN IP (e.g. `http://192.168.1.45:3000`) for auditorium screens and student desks.

### Phase 2: Host Event Setup Wizard
1. The Host navigates to `http://localhost:3000` and logs in as `host` / `host2026`.
2. The Host enters `⚙️ Event Setup` (`#eventSetupView`) and configures:
   - **Step 1 (Details)**: Event Title, Institution (`SSASIT / GTU`), Starting Cash (`₹5,00,000`).
   - **Step 2 (Teams)**: 16 trading desks, team names, custom desk passwords.
   - **Step 3 (Universe)**: Selects participating stocks from the 20-company catalogue.
   - **Step 4 (Rules)**: Transaction fees (default 10 bps), Circuit breaker band ($\pm 20\%$).
   - **Step 5 (Schedule)**: Selects session duration (e.g., 30 minutes or 45 minutes). The dynamic schedule engine automatically recalculates all news trigger offsets proportionally.
   - **Step 6 (News Plan)**: Reviews auto-generated news timeline with exact 12-hour AM/PM trigger clocks.
   - **Step 7 (Stage & Audio)**: Sets default projector page cycle duration (8s) and sound levels.
   - **Step 8 (Review & Lock)**: Automatic validation verifies completeness. Clicking `🔒 Lock Configuration` transitions the event to `STANDBY`.

### Phase 3: Team Login & Pre-Market Waiting Room
1. As soon as setup is locked, `EVENT_CONFIG_LOCKED` broadcasts live across the LAN.
2. Unauthenticated student workstations dynamically update their login screens from amber ("Setup in Progress") to emerald ("Logins Open").
3. Teams log in using their assigned credentials (`team1` / `trade100`).
4. Upon successful login, trader terminals display the full-screen **Pre-Market Waiting Room Card (`#traderWaitingRoomOverlay`)**, showing:
   - Scheduled opening clock: `"Scheduled Open: 09:30 AM"`.
   - Team allocation: `"Allocated Capital: ₹5,00,000.00"`.
   - Key trading rules and circuit breaker guidelines.
   - Orders submitted during `STANDBY` are strictly rejected by the server.

### Phase 4: Market Opening & 3-2-1 Countdown
1. In the Host Live Market tab, the Live Market Operations Bar displays `▶ Resume 3-2-1`.
2. The Host clicks `▶ Resume 3-2-1`.
3. The server broadcasts `COUNTDOWN_START` (`seconds: 3`).
4. An authoritative 3-second animated sequence triggers simultaneously across all student desks and the auditorium projector, while the sound system plays synchronized countdown pings.
5. Upon zero, the server transitions state to `LIVE`, triggers the Market Open Bell chime, and trading begins.

### Phase 5: Live Trading & News Shocks
1. Traders enter Buy and Sell orders. Server executes orders with exact 10 bps fee accounting, updating cash, holdings, and portfolio valuations in real time.
2. When a scheduled news event reaches its trigger offset:
   - Server broadcasts `NEWS_FLASH` and plays breaking news fanfare.
   - Non-host screens receive neutral wire headlines and enter the **Cognitive Reading Window** (12s to 25s) with zero immediate price movement.
   - When the reading window expires, the price engine executes a smoothstep price trajectory ($3u^2 - 2u^3$) toward target prices.
   - If a stock reaches $\pm 20\%$, directional circuit breakers clamp the price, rejecting further trend-following orders while allowing counter-flow liquidity orders.

### Phase 6: Session Conclusion & Daily Results
1. When session time expires (or Host clicks `🏁 Conclude Session`):
   - Server transitions state to `DAY_COMPLETED`.
   - Market Close Bell chimes across the hall.
   - All open order routing is immediately blocked.
   - Server locks the daily snapshot: Day Opening Valuation, Closing Valuation, Daily P&L, Cumulative P&L, Daily Rank, and Rank Delta ($\Delta$).
   - Student desks display `#traderDayCompletedOverlay` with verified daily standings.
   - The auditorium projector displays the full-floor daily leaderboard.

### Phase 7: Next-Day Transition & Holdings Carry-Over
1. The Host clicks `▶️ Advance to Standby`.
2. The server advances `gameState.currentDay` to Day $N+1$ and resets `elapsedSeconds = 0`.
3. **Carry-Over Invariant**: All team cash balances and stock holdings are preserved without reset. The closing portfolio value of Day 1 becomes the authoritative `dayOpeningPortfolioValue` for Day 2.
4. Traders return to the Pre-Market Waiting Room, ready for Day 2 opening.

### Phase 8: Grand Finale & 6-Stage Winner Ceremony
1. Following the conclusion of the final scheduled day (e.g. Day 2 of 2), the Host clicks `🏁 Finalize Championship`.
2. Server transitions to `CHAMPIONSHIP_CONCLUDED` and generates `finalResultsSnapshot`.
3. The Host clicks `🏆 Launch Winner Presentation`.
4. The auditorium projector enters the cinematic 6-stage presentation:
   - `SCENE_INTRO`: Dramatic title card with orchestral fanfare.
   - `SCENE_BRONZE`: 3rd Place Team reveal with net worth and member names.
   - `SCENE_SILVER`: 2nd Place Team reveal.
   - `SCENE_CHAMPION`: Grand Champion reveal with trumpet fanfare and celebratory animations.
   - `SCENE_PODIUM`: Complete 1st, 2nd, and 3rd place podium graphics.
   - `SCENE_LEADERBOARD`: Complete 16-team final tournament standings.
5. The Host downloads audited CSV reports (`/api/export/standings`, `/api/export/trades`).

Proceed to **`ARGON_DOSSIER/04_MATHEMATICAL_ENGINE.md`**.


<!-- END OF 03_EVENT_LIFECYCLE.md -->


================================================================================
<!-- START OF 04_MATHEMATICAL_ENGINE.md -->
================================================================================

# MATHEMATICAL ENGINE & FINANCIAL SIMULATION MODEL
## Exact Quantitative Formulas, Accounting Equations & Statistical Processes

> **DOCUMENT ID**: `ARGON_DOSSIER/04_MATHEMATICAL_ENGINE.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **PRIMARY FILES**: [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js) (lines 1450–1560, 2470–2720, 1229–1370), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js) (lines 2190–2410)

---

## 1. Background Stochastic Price Engine

During periods without active news shocks, stock prices follow a discrete-time approximation of an unbiased geometric Brownian motion (GBM) with zero mean drift:

```
Source: server.js lines 1450–1510
Function: updateMarketPrices()
Call Frequency: Every 1,000 ms (tickIntervalMs = 1000)
```

### Formula
$$P_{t+1} = P_t \times \exp\left( -\frac{1}{2}\sigma_{\text{eff}}^2 + \sigma_{\text{eff}} \cdot Z_t \right)$$

Where:
- $P_t$: Current market price of the stock.
- $\sigma_{\text{eff}}$: Effective per-tick volatility factor, defined as:
  $$\sigma_{\text{eff}} = \text{stock.volatility\_factor} \times \sqrt{\text{stock.beta}}$$
  *(Typical range: $0.0020$ to $0.0045$, equivalent to $0.20\%\text{--}0.45\%$ standard deviation per second).*
- $Z_t \sim \mathcal{N}(0, 1)$: Standard normal random variable generated via the Box-Muller transform:
  $$Z_t = \sqrt{-2 \ln(U_1)} \cdot \cos(2\pi U_2), \quad U_1, U_2 \sim \mathcal{U}(0, 1)$$
- $-\frac{1}{2}\sigma_{\text{eff}}^2$: Itô calculus convexity correction drift, ensuring the expected price is strictly unbiased:
  $$\mathbb{E}[P_{t+1} \mid P_t] = P_t$$
  *(Guarantees no artificial upward or downward price drift during quiet trading).*

### Precision & Clamping Bounds
$$P_{t+1} = \operatorname{clamp}\left( P_{t+1}, \text{stock.min\_price}, \text{stock.max\_price} \right)$$
$$P_{t+1} = \frac{\operatorname{round}(P_{t+1} \times 100)}{100} \quad \text{(Rounded strictly to 2 decimal places / paise)}$$

---

## 2. Smoothstep News Shock Trajectory Engine

When a scheduled or breaking news shock targets a stock, price movement does not snap instantaneously. Instead, it follows a continuous cubic Hermite polynomial ("smoothstep") curve:

```
Source: server.js lines 1480–1525
Function: updateMarketPrices() -> stock.activeTransition
Transition Duration: 15s to 60s (calibrated per news event)
```

### Mathematical Formulation
Let $t$ be the current server epoch time in milliseconds, $t_0$ be transition start time, and $T$ be total shock duration:

1. **Normalized Progress ($u$)**:
   $$u = \operatorname{clamp}\left( \frac{t - t_0}{T}, 0, 1 \right)$$

2. **Cubic Hermite Spline ($s(u)$)**:
   $$s(u) = 3u^2 - 2u^3$$
   - Boundary Values: $s(0) = 0, \quad s(1) = 1$.
   - First Derivatives: $s'(0) = 0, \quad s'(1) = 0$.
   - **Economic Justification**: Zero initial slope ($s'(0) = 0$) ensures prices begin moving smoothly without an instantaneous step-function spike. Zero terminal slope ($s'(1) = 0$) ensures prices glide gently into their new post-shock equilibrium without overshoot oscillations.

3. **Trajectory Price ($P(t)$)**:
   $$P(t) = P_0 + (P_{\text{target}} - P_0) \cdot s(u)$$
   Where:
   - $P_0$: Initial price at the exact moment the reaction phase began.
   - $P_{\text{target}} = P_0 \times (1 + I_{\text{stock}})$: Terminal shock target price.
   - $I_{\text{stock}}$: Sector- and beta-adjusted price impact percentage.

4. **Non-Snapping Invariant on Overlapping Shocks**:
   If a new shock arrives while a transition is already active, the new trajectory re-anchors to $P_0 = P_{\text{current}}$, completely eliminating discontinuous price jumps.

---

## 3. CAPM Beta & Volatility Multiplication

Individual stock sensitivity to broader macroeconomic and sector events is scaled by the CAPM Beta ($\beta$):

```
Source: server.js lines 990–1040
Function: calculateSectorShockImpact()
```

### Stock-Specific News Impact Formula
$$I_{\text{stock}} = I_{\text{base}} \times \left( 1 + (\beta - 1) \times 0.5 \right)$$

Where:
- $I_{\text{base}}$: Base impact percentage defined in the news template (e.g., $+10.0\%$).
- $\beta$: Company CAPM Beta sensitivity:
  - If $\beta = 1.0$: $I_{\text{stock}} = I_{\text{base}} \times 1.0 = +10.0\%$.
  - If $\beta = 1.40$ (High beta, e.g. Tech/Auto): $I_{\text{stock}} = +10.0\% \times (1 + 0.20) = +12.0\%$.
  - If $\beta = 0.70$ (Defensive, e.g. FMCG/Pharma): $I_{\text{stock}} = +10.0\% \times (1 - 0.15) = +8.5\%$.

---

## 4. Directional Circuit Breakers & Counter-Flow Liquidity

To emulate modern exchange mechanisms (NSE/BSE) and prevent runaway market failure, individual stocks have strict $\pm 20\%$ price circuit bands:

```
Source: server.js lines 1175–1225, 2520–2575
Threshold: gameState.circuitBreakerPercent (Default: 20%)
```

### Circuit Band Thresholds
$$P_{\text{upper}} = \operatorname{round}\left( P_{\text{day\_open}} \times \left(1 + \frac{\text{cbPct}}{100}\right), 2 \right)$$
$$P_{\text{lower}} = \operatorname{round}\left( P_{\text{day\_open}} \times \left(1 - \frac{\text{cbPct}}{100}\right), 2 \right)$$

> **CRITICAL INVARIANT**: $P_{\text{day\_open}}$ is **STRICTLY IMMUTABLE** throughout the trading day. Manual unhalts or sector releases NEVER reset $P_{\text{day\_open}} = P_{\text{current}}$.

### Directional Order Restrictions
- **Upper Circuit Halt ($P \ge P_{\text{upper}}$)**:
  - `haltDirection = "UPPER"`
  - **BUY orders are STRICTLY REJECTED**:
    *"Upper circuit ceiling reached (₹X.XX). Buying is restricted under market rules."*
  - **SELL orders are PERMITTED**: Traders holding stock can sell, injecting downward recovery liquidity into the order book.
- **Lower Circuit Halt ($P \le P_{\text{lower}}$)**:
  - `haltDirection = "LOWER"`
  - **SELL orders are STRICTLY REJECTED**:
    *"Lower circuit floor reached (₹X.XX). Selling is restricted under market rules."*
  - **BUY orders are PERMITTED**: Bargain-seeking traders can buy, injecting upward recovery liquidity into the order book.
- **Stock Isolation Invariant**: A circuit halt on one stock NEVER halts the wider market or freezes other active stocks.

---

## 5. Order Execution & Financial Accounting

All transaction accounting is executed server-side with exact floating-point rounding guards:

```
Source: server.js lines 2470–2715
Transaction Fee: gameState.transactionFeeBps (Default: 10 bps = 0.10%)
```

### 1. Buy Order Execution
For an order to buy $Q$ shares at current market price $P$:
1. **Gross Transaction Value**:
   $$\text{Gross} = Q \times P$$
2. **Transaction Fee (10 bps)**:
   $$\text{Fee} = \operatorname{round}\left( \text{Gross} \times \frac{\text{feeBps}}{10,000}, 2 \right)$$
3. **Total Cash Deduction**:
   $$\text{Total Deducted} = \text{Gross} + \text{Fee}$$
4. **Cash Validation Guard**:
   $$\text{If } \text{cash} < \text{Total Deducted} \implies \text{REJECT ORDER (Insufficient Cash)}$$
5. **Weighted Average Buy Price ($\bar{P}$)**:
   $$\bar{P}_{\text{new}} = \operatorname{round}\left( \frac{H_{\text{old}} \times \bar{P}_{\text{old}} + Q \times P}{H_{\text{old}} + Q}, 2 \right)$$
6. **Balance Updates**:
   $$\text{cash} \leftarrow \text{cash} - \text{Total Deducted}$$
   $$H_{\text{ticker}} \leftarrow H_{\text{ticker}} + Q$$

### 2. Sell Order Execution
For an order to sell $Q$ shares at current market price $P$:
1. **Share Validation Guard**:
   $$\text{If } H_{\text{ticker}} < Q \implies \text{REJECT ORDER (Insufficient Shares)}$$
2. **Gross Transaction Value**:
   $$\text{Gross} = Q \times P$$
3. **Transaction Fee (10 bps)**:
   $$\text{Fee} = \operatorname{round}\left( \text{Gross} \times \frac{\text{feeBps}}{10,000}, 2 \right)$$
4. **Net Cash Proceeds**:
   $$\text{Net Proceeds} = \text{Gross} - \text{Fee}$$
5. **Realized Profit/Loss ($\text{P\&L}_{\text{realized}}$)**:
   $$\text{Trade Realized P\&L} = Q \times (P - \bar{P}_{\text{old}}) - \text{Fee}$$
   $$\text{realizedPnl} \leftarrow \text{realizedPnl} + \text{Trade Realized P\&L}$$
6. **Balance Updates**:
   $$\text{cash} \leftarrow \text{cash} + \text{Net Proceeds}$$
   $$H_{\text{ticker}} \leftarrow H_{\text{ticker}} - Q$$
   *(If $H_{\text{ticker}} = 0$, then $\bar{P}_{\text{ticker}} \leftarrow 0$).*

---

## 6. Portfolio Valuation, Daily P&L & Cumulative P&L

The system maintains strict isolation between **Daily P&L** (performance within the active session) and **Cumulative P&L** (overall tournament standing):

```
Source: server.js lines 1240–1285, 1575–1630
```

### Core Equations
1. **Portfolio Market Value**:
   $$\text{Portfolio Value} = \sum_{k \in \text{Enabled Stocks}} \left( H_k \times P_k \right)$$

2. **Total Net Worth**:
   $$\text{Net Worth} = \text{Cash} + \text{Portfolio Value}$$

3. **Cumulative Tournament P&L**:
   $$\text{Cumulative P\&L} = \text{Net Worth} - \text{Starting Cash}$$
   $$\text{Cumulative Return \%} = \frac{\text{Cumulative P\&L}}{\text{Starting Cash}} \times 100$$
   *(Starting cash is typically ₹5,00,000).*

4. **Daily Session P&L**:
   $$\text{Daily P\&L} = \text{Net Worth} - \text{Day Opening Portfolio Value}$$
   $$\text{Daily Return \%} = \frac{\text{Daily P\&L}}{\text{Day Opening Portfolio Value}} \times 100$$

### Multi-Day Baseline Carry-Over Invariant
When advancing from Day $N$ to Day $N+1$ via `HOST_START_NEXT_DAY`:
$$\text{DayOpeningPortfolioValue}_{N+1} = \text{ClosingPortfolioValue}_N$$
This ensures:
- Day 2 starts with $\text{Daily P\&L} = ₹0.00$.
- Cumulative P&L accurately retains all historical gains/losses.
- Cash and stock holdings are completely preserved without liquidation.

---

## 7. Leaderboard Ranking & Deterministic Tie-Breakers

To prevent jitter on projectors and student terminals, standings are sorted using a 4-tier deterministic tie-breaking hierarchy:

```
Source: server.js lines 1285–1295
```

### Sorting Algorithm
1. **Primary Key**: `Daily P&L` (or `Net Worth` for cumulative standings) descending.
2. **Secondary Tie-Breaker**: `Return %` descending.
3. **Tertiary Tie-Breaker**: `Available Cash` descending (more liquid portfolio wins).
4. **Quaternary Tie-Breaker**: `Trade Count` ascending (fewer trades implies higher efficiency).
5. **Final Fallback**: Alphabetical by `teamId`.

### Rank Delta ($\Delta$)
$$\text{Rank Delta} = \text{Previous Day Rank} - \text{Current Day Rank}$$
- Positive ($\Delta > 0$): Gained ranks (rendered with green upward triangle `▲`).
- Negative ($\Delta < 0$): Lost ranks (rendered with red downward triangle `▼`).
- Zero ($\Delta = 0$): Position maintained (rendered with gray dash `—`).

---

## 8. Market Breadth & NIFTY_TF20 Index Calculation

```
Source: server.js lines 1585–1640
```

### 1. Market Breadth Counter
- **Advancing Stocks**: $\sum [\text{stock.currentPrice} > \text{stock.dayOpenPrice}]$
- **Declining Stocks**: $\sum [\text{stock.currentPrice} < \text{stock.dayOpenPrice}]$
- **Unchanged Stocks**: $\sum [\text{stock.currentPrice} = \text{stock.dayOpenPrice}]$

### 2. NIFTY_TF20 Benchmark Index
Base Value: $10,000.00$ points at tournament open.
$$\text{Index Value}_t = 10,000 \times \frac{\sum_{k} \left( P_{k, t} \times W_k \right)}{\sum_{k} \left( P_{k, \text{open}} \times W_k \right)}$$
Where $W_k$ is the market-cap weight derived from company fundamentals.

Proceed to **`ARGON_DOSSIER/05_TIMING_AND_NEWS.md`**.


<!-- END OF 04_MATHEMATICAL_ENGINE.md -->


================================================================================
<!-- START OF 05_TIMING_AND_NEWS.md -->
================================================================================

# 05 — TIMING, CLOCKS, DYNAMIC SCHEDULING & NEWS ENGINE

> **Auditor Reference Document**: Complete timing specifications, clock synchronization, cognitive reading windows, dynamic schedule scaling formulas, and news publication lifecycle for **The Trading Floor Championship 2026**.

---

## 1. Engine Clocks & Server Tick Loops

The simulation runs on two primary server-side interval timers hosted in [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js):

### 1.1 The 1-Second Master Game Clock (`1000ms`)
*Location*: [server.js:1375-1416](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L1375-L1416)

```javascript
setInterval(() => {
  // 1. Check for Scheduled Event Auto-Start
  if (gameState.status === 'SCHEDULED' && gameState.scheduledStartTime) {
    const targetMs = new Date(gameState.scheduledStartTime).getTime();
    if (!isNaN(targetMs)) {
      if (Date.now() >= targetMs) {
        gameState.status = 'COUNTDOWN';
        startResumeCountdown('SCHEDULED_TIMER');
      } else {
        broadcastTick();
      }
    }
  }

  if (gameState.isPaused || gameState.isConcluded || gameState.status === 'DAY_COMPLETED' || gameState.status !== 'LIVE') return;

  gameState.elapsedSeconds++;

  // 2. News Event Triggers & Phase Transitions
  newsEvents.forEach((ev) => {
    if (!ev.triggered && !ev.cancelled && ev.day === gameState.currentDay && ev.trigger_second === gameState.elapsedSeconds) {
      triggerNewsEvent(ev, 'AUTO_CLOCK');
    }
    // Transition from READING to REACTING when decision deadline expires
    if (ev.triggered && !ev.cancelled && ev.phase === 'READING' && gameState.elapsedSeconds >= (ev.reactionStartSecond || (ev.trigger_second + 25))) {
      ev.phase = 'REACTING';
      applyNewsImpactsToStocks(ev);
      broadcastAudioCue('reaction_start_chime', 'news', { event_id: ev.event_id, headline: ev.headline });
      broadcastAll({ type: 'NEWS_REACTION_START', event_id: ev.event_id, headline: ev.headline });
    }
  });

  // 3. Automatic Day Clock Expiration
  if (gameState.elapsedSeconds >= gameState.dayDurationSeconds) {
    recordAuditEvent('DAY_CLOSE_CLOCK_EXPIRED', { day: gameState.currentDay, elapsed: gameState.elapsedSeconds });
    concludeCurrentDay(true);
  }
}, 1000);
```

### 1.2 The High-Frequency Price Generation Loop (`250ms`)
*Location*: [server.js:1418-1540](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L1418-L1540)
- Ticks every $250\text{ ms}$ (4 frames per second).
- Evaluates active cubic Hermite transitions (`s(u) = 3u^2 - 2u^3`).
- Applies GBM stochastic drift ($\sigma_{\text{eff}} \times Z$).
- Enforces $\pm 20\%$ circuit breaker bands and monitors mean-reverting unhalt liquidity.
- Broadcasts `TICK_UPDATE` payload to all active clients.

---

## 2. Dynamic Schedule Ratio Engine

When a host configures or adjusts the trading day duration ($D$), news events cannot be placed at fixed static seconds. A 30-minute schedule would break if scaled down to a 5-minute express heat.

The server uses a **proportional ratio formula** to map event positions across any chosen session length:

$$t_i = \operatorname{round}(D \times p_i)$$

Where:
- $D =$ Day duration in seconds (`dayDurationSeconds`).
- $p_i =$ Relative position fraction ($0.10 \le p_i \le 0.90$).
- $t_i =$ Calculated trigger second (`trigger_second`).

### 2.1 Implementation Code
*Location*: [server.js:938-982](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L938-L982)

```javascript
function recalculateNewsScheduleForDuration(newDurationSeconds) {
  if (!Array.isArray(newsEvents) || newsEvents.length === 0) return;
  const oldDuration = gameState.dayDurationSeconds || 1800;
  const readingSec = getReadingWindowForDuration(newDurationSeconds);
  const minSeparationSec = 60;

  const eventsByDay = {};
  newsEvents.forEach((ev) => {
    const d = ev.day || 1;
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  });

  Object.values(eventsByDay).forEach((dayEvents) => {
    dayEvents.sort((a, b) => (a.trigger_second || 0) - (b.trigger_second || 0));
    let lastTrigger = 0;

    dayEvents.forEach((ev, idx) => {
      let p_i = ev.relative_position;
      if (p_i === undefined || p_i === null) {
        p_i = (ev.trigger_second || (idx + 1) * 300) / oldDuration;
        p_i = Math.max(0.10, Math.min(0.90, p_i));
      }
      ev.relative_position = p_i;

      // Proportional ratio formula: t_i = round(D * p_i)
      let targetSec = Math.round(newDurationSeconds * p_i);

      // Enforce minimum separation constraint (>= 60s from prior news)
      if (idx > 0 && targetSec < lastTrigger + minSeparationSec) {
        targetSec = lastTrigger + minSeparationSec;
      }

      // Bound within session end
      const maxAllowed = Math.max(minSeparationSec, newDurationSeconds - readingSec - 25);
      if (targetSec > maxAllowed) {
        targetSec = maxAllowed;
      }

      ev.trigger_second = targetSec;
      ev.reading_duration_sec = readingSec;
      lastTrigger = targetSec;
    });
  });

  recordAuditEvent('NEWS_SCHEDULE_SCALED', {
    oldDuration,
    newDuration: newDurationSeconds,
    recalculatedEventsCount: newsEvents.length
  });
}
```

---

## 3. Cognitive Reading Windows ($W(D)$)

In physical collegiate competitions, students need sufficient time to read headlines, analyze sectoral implications, and execute strategic trades before market prices move.

The engine scales the **Reading & Discussion Window** ($W$) dynamically using a step function based on day duration:

$$W(D) = \begin{cases} 
12\text{ seconds} & \text{if } D \le 300\text{ s (5 mins)} \\
18\text{ seconds} & \text{if } 300 < D \le 600\text{ s (10 mins)} \\
22\text{ seconds} & \text{if } 600 < D \le 1200\text{ s (20 mins)} \\
25\text{ seconds} & \text{if } D > 1200\text{ s (30+ mins)}
\end{cases}$$

*Location*: [server.js:886-891](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L886-L891)

```javascript
function getReadingWindowForDuration(durationSec) {
  if (durationSec <= 300) return 12;
  if (durationSec <= 600) return 18;
  if (durationSec <= 1200) return 22;
  return 25;
}
```

---

## 4. Schedule Feasibility Constraints

To prevent overlapping shocks or unreadable schedules, the engine runs feasibility validation against 3 physical invariants:

1. **No Pre-Market Triggers**: $t_i > 0$.
2. **Session Boundary**: $t_i + W(D) + T_{\text{shock}} \le D$, where $T_{\text{shock}} = 25\text{ s}$.
3. **Minimum Inter-News Separation**: $t_{i} - t_{i-1} \ge 60\text{ seconds}$.

*Location*: [server.js:894-936](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L894-L936)

```javascript
function validateScheduleFeasibility(events, dayDurationSeconds) {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: true, issues: [], summary: 'No events scheduled' };
  }
  const minSeparationSec = 60;
  const issues = [];
  const eventsByDay = {};

  events.forEach((ev) => {
    const d = ev.day || 1;
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  });

  Object.entries(eventsByDay).forEach(([day, dayEvents]) => {
    dayEvents.sort((a, b) => (a.trigger_second || 0) - (b.trigger_second || 0));
    for (let i = 0; i < dayEvents.length; i++) {
      const cur = dayEvents[i];
      const trig = cur.trigger_second || 0;
      const readSec = cur.reading_duration_sec || 20;

      if (trig <= 0) {
        issues.push(`Day ${day} event "${cur.event_id}" scheduled before trading starts (${trig}s).`);
      }
      if (trig + readSec + 25 > dayDurationSeconds) {
        issues.push(`Day ${day} event "${cur.event_id}" expires after trading day closes (${trig + readSec + 25}s > ${dayDurationSeconds}s).`);
      }
      if (i > 0) {
        const prev = dayEvents[i - 1];
        const gap = trig - (prev.trigger_second || 0);
        if (gap < minSeparationSec) {
          issues.push(`Day ${day} events "${prev.event_id}" and "${cur.event_id}" overlap or have insufficient reading separation (${gap}s < ${minSeparationSec}s).`);
        }
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    summary: issues.length === 0 ? '✓ Schedule feasible: all events fit with valid reading windows and separation' : issues.join('; ')
  };
}
```

---

## 5. The 5-Phase News Lifecycle

News events follow a deterministic 5-phase finite state machine:

```
  [SCHEDULED]
       │
       ▼ (clock reaches trigger_second)
   [READING]  ◄── Audio: heavy_news_boom
       │          Duration: W(D) seconds (12s to 25s)
       │          Traders see neutral headline only
       │          Target prices remain static (zero shock)
       ▼ (elapsedSeconds >= reactionStartSecond)
  [REACTING]  ◄── Audio: reaction_start_chime
       │          Duration: 20-25 seconds
       │          Smoothstep price transition active: s(u) = 3u^2 - 2u^3
       │          Target price delta unfolds continuously
       ▼ (transition finishes)
   [SETTLED]  ◄── Target price reached
       │          Normal GBM stochastic fluctuations resume
       ▼ (next news or day conclusion)
  [ARCHIVED]  ◄── Stored in gameState.newsHistory
```

### 5.1 Idempotency & Per-Day Registry
To prevent duplicate triggers caused by clock re-synchronization or host pausing, every triggered event is recorded in a per-day registry map:

```javascript
const firedKey = `day_${gameState.currentDay}_${eventObj.event_id}`;
if (firedNewsEventsPerDay.has(firedKey)) {
  return false; // Already fired today - strictly idempotent
}
firedNewsEventsPerDay.set(firedKey, true);
```

---

## 6. Clock Formatting & 12-Hour AM/PM Standards

All presentation screens, waiting room timers, and audit logs display real-world timestamps formatted in human-readable 12-hour AM/PM notation.

*Location*: [public/app.js:2203-2219](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L2203-L2219)

```javascript
function formatClock12H(dateOrIso, includeSeconds = false) {
  if (!dateOrIso) return '—';
  if (typeof dateOrIso === 'string' && (dateOrIso.includes('AM') || dateOrIso.includes('PM')) && !dateOrIso.includes('T')) {
    return dateOrIso;
  }
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (isNaN(d.getTime())) return String(dateOrIso);
  const options = {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit'
  };
  if (includeSeconds) {
    options.second = '2-digit';
  }
  return d.toLocaleTimeString('en-US', options);
}
```

*(Note: See [DEF-02](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/ARGON_DOSSIER/07_DEFECT_REGISTER.md) regarding duplicate definition of this function at line 4948).*


<!-- END OF 05_TIMING_AND_NEWS.md -->


================================================================================
<!-- START OF 06_SECURITY_AND_DATA_FLOW.md -->
================================================================================

# 06 — PRIVACY, SECURITY BOUNDARIES & DATA FLOW ARCHITECTURE

> **Auditor Reference Document**: Complete security model, session authentication tokens, role-based permission matrix, parameter sanitization rules, 60-second host privacy reveal model, and anti-formula injection safeguards for **The Trading Floor Championship 2026**.

---

## 1. Authentication & Session Registry

The application uses an in-memory cryptographically secure session token mechanism:

### 1.1 Token Generation
*Location*: [server.js:2381-2392](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2381-L2392)

Upon successful credential validation via WebSocket `LOGIN` action:
```javascript
const token = crypto.randomBytes(16).toString('hex');
const sessionObj = {
  token,
  role: userRecord.role,
  id: userRecord.id,
  name: userRecord.name,
  username: userRecord.username,
  members: userRecord.members || '',
  lastOrderAt: 0
};
sessions.set(token, sessionObj);
ws.session = sessionObj;
```

Tokens are returned to the client in `LOGIN_SUCCESS` and persisted in browser `localStorage.getItem('ttfc_session_token')`.

### 1.2 Session Resumption & Validation
*Location*: [server.js:2415-2446](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2415-L2446)
- Clients reconnecting send `RESUME_SESSION` with `session_token`.
- If found in `sessions` Map, `ws.session` is re-bound to the socket.
- If not found (e.g. server restart), server replies with `{ type: 'SESSION_EXPIRED' }`, clearing browser `localStorage` and routing the user to `#loginView`.

---

## 2. Role Permission Matrix

The application identifies 4 distinct client roles with strict permission boundaries:

| Capability / Action | `HOST` | `TRADER` | `PROJECTOR` | `SOUND_CONSOLE` |
| :--- | :---: | :---: | :---: | :---: |
| **Market Lifecycle Control** (Start, Pause, Resume, Conclude) | ✅ Yes | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Event Configuration & Universe Builder** | ✅ Yes | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Order Placement** (BUY, SELL) | ❌ No | ✅ Yes (Own Team) | ❌ Blocked | ❌ Blocked |
| **Portfolio & Holdings Visibility** | ✅ All Teams | ✅ Own Team Only | ❌ Public Index Only | ❌ No |
| **Stock Quantitative Parameters** ($\beta$, $\sigma$) | ✅ Visible | ❌ Sanitized / Stripped | ❌ Sanitized / Stripped | ❌ No |
| **Unpublished / Future News Events** | ✅ Visible | ❌ Sanitized / Stripped | ❌ Sanitized / Stripped | ❌ No |
| **Private News Impact Deliberations** | ✅ Hidden by Default (Revealable for 60s) | ❌ Stripped from Payload | ❌ Stripped from Payload | ❌ No |
| **Public Stock Tickers & Prices** | ✅ Visible | ✅ Visible | ✅ Visible | ❌ Background Only |
| **Full Leaderboard Standings** | ✅ Visible | ✅ Visible (Rank/P&L) | ✅ Paginated Display | ❌ No |
| **Web Audio API Synthesizer Playback** | ❌ Muted | ❌ Muted | ❌ Muted | ✅ Active Sound Engine |

---

## 3. Pre-Market Setup Gating

To prevent premature trading and data leakage before the Host finalizes company selections, day durations, and initial allocations, a strict login gate is enforced on the server:

*Location*: [server.js:2372-2379](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2372-L2379)

```javascript
// TRADER login gating: Teams cannot log in until host completes and locks event setup
if (userRecord.role === 'TRADER' && !gameState.configLocked) {
  ws.send(JSON.stringify({
    type: 'LOGIN_ERROR',
    message: 'The host is preparing the event. Team login will open once setup is complete.'
  }));
  return;
}
```

If a host unlocks configuration or resets the competition while teams are logged in, resumed sessions are also immediately invalidated:

*Location*: [server.js:2422-2430](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2422-L2430)

---

## 4. Sensitive Parameter Sanitization (`getSanitizedPublicState`)

State broadcasts are strictly filtered on the Node.js server before serialization into WebSocket frames.

*Location*: [server.js:1871-1980](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L1871-L1980)

### 4.1 Company Parameter Stripping
Stock volatility factors ($\sigma$) and CAPM betas ($\beta$) govern the price shock engine. If leaked to trader terminals, quantitative students could reverse-engineer market sensitivity before news arrives:

```javascript
companies: enabledStocks.map((c) => ({
  ticker: c.ticker,
  name: c.name,
  sector: c.sector,
  exchange: c.exchange || 'NSE',
  currency: c.currency || 'INR',
  base_price: c.base_price,
  currentPrice: c.currentPrice,
  dayOpenPrice: c.dayOpenPrice,
  dayHigh: c.dayHigh,
  dayLow: c.dayLow,
  // Host receives proprietary parameters; non-host payloads completely omit them
  ...(isHost ? { beta: c.beta, volatility_factor: c.volatility_factor } : {}),
  isHalted: c.isHalted,
  haltDirection: c.haltDirection,
  fundamentals: c.fundamentals,
  history: c.history.slice(-180)
}))
```

### 4.2 News Impact Stripping
When news flashes trigger or historical news is distributed:
```javascript
// Sanitize newsHistory: strip private 'impacts' from non-host screens
const sanitizedNewsHistory = gameState.newsHistory.map((n) => {
  if (isHost) return n;
  const clean = { ...n };
  delete clean.impacts;
  return clean;
});
```

And on real-time news push:
```javascript
if (client.session && client.session.role === 'HOST') {
  client.send(JSON.stringify({ type: 'NEWS_FLASH', news: newsRecord }));
} else {
  const publicNews = { ...newsRecord };
  delete publicNews.impacts;
  client.send(JSON.stringify({ type: 'NEWS_FLASH', news: publicNews }));
}
```

Traders and projectors receive **only** the textual headline, categorization badge, and cognitive reading countdown.

### 4.3 Portfolio Privacy Isolation
Trader clients receive strictly isolated portfolio payloads:
```javascript
if (role === 'TRADER' && teams[teamId]) {
  payload.portfolio = { ...t, holdingsValue, netWorth, pnlPct, unrealizedPnl };
  payload.teamTrades = executedTrades
    .filter((tr) => tr.teamId === teamId)
    .slice(-30)
    .reverse();
}
```
No team can inspect another team's cash balance, specific stock quantities, or transaction audit trail over the network wire.

---

## 5. Host 60-Second Privacy Reveal Safeguard

In collegiate competition halls, the Host's laptop is frequently connected to an external display, projector, or video stream. If upcoming news impacts or target multipliers were visible on the Host News Tab by default, participants glancing at the host desk would gain unfair insider advantages.

### 5.1 Architecture
*Location*: [public/app.js:7700-7750](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L7700-L7750) and [public/app.js:9556-9618](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L9556-L9618)

1. **Default Masked State**: Impacts are masked behind an ivory placeholder:
   `[🔒 Private Price Impact Details Hidden • Fairness Safeguard]`
2. **Explicit Reveal Trigger**: Clicking `#btnRevealPrivateNews` unmasks the details and starts a 60-second countdown.
3. **Auto-Hide Timer**:
   ```javascript
   hostRevealSecondsLeft = 60;
   hostRevealCountdownTimer = setInterval(() => {
     hostRevealSecondsLeft--;
     if (hostRevealSecondsLeft <= 0) {
       hidePrivateNewsDetailsNow();
     }
   }, 1000);
   ```
4. **Instant Invalidation**: Navigating away from the news tab immediately clears the timer and re-engages the mask.

---

## 6. CSV Formula Injection Protection

Spreadsheet applications (Excel, Google Sheets, LibreOffice Calc) interpret leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) as formula expressions or DDE commands, creating code execution or data exfiltration risks when event hosts download competition reports.

The server enforces formula escaping on all exported CSV columns:

*Location*: [server.js:98-107](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L98-L107)

```javascript
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}
```

Any cell starting with a formula trigger character is neutralized by prepending an apostrophe (`'`).


<!-- END OF 06_SECURITY_AND_DATA_FLOW.md -->


================================================================================
<!-- START OF 07_DEFECT_REGISTER.md -->
================================================================================

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


<!-- END OF 07_DEFECT_REGISTER.md -->


================================================================================
<!-- START OF 08_TESTS_AND_DEPENDENCIES.md -->
================================================================================

# 08 — TEST INFRASTRUCTURE, VERIFICATION & DEPENDENCY AUDIT

> **Auditor Reference Document**: Complete test architecture, verification runs, test harness mechanics, dependencies, and zero-CDN offline compliance for **The Trading Floor Championship 2026**.

---

## 1. Test Harness Architecture

The repository contains two layers of automated testing:
1. **The Canonical Unified Master Runner**: `test_unified_master_flow.js` (Created to replace piecemeal test execution with a deterministic, single-process, 11-phase end-to-end verification).
2. **Legacy Targeted Test Suites**: 7 test scripts targeting specific subsystems.

---

## 2. Canonical Unified Runner: `test_unified_master_flow.js`

### 2.1 Design & Execution Guarantees
- **Port Isolation**: Runs strictly on dedicated port `3099` (`TEST_PORT = 3099`) to prevent any `EADDRINUSE` conflicts with production (`3000`) or development (`3089`).
- **Clean State Shield**: Automatically creates a backup of `data/live_game_state.json` before booting the test server and restores it upon test completion or process exit (`process.on('exit')`, `SIGINT`, `uncaughtException`).
- **Deterministic 11-Phase Lifecycle Flow**: Follows a realistic competition session end-to-end from initial boot through winner announcement and post-competition state reset.

### 2.2 The 11 Verification Phases

```
┌─────────────────────────────────────────────────────────────┐
│             UNIFIED MASTER FLOW TEST PIPELINE               │
├───────┬─────────────────────────────────────────────────────┤
│ PH-01 │ Server Boot & HTTP Health Check                     │
│ PH-02 │ Stock Universe & Configuration Lock Verification     │
│ PH-03 │ Multi-Client WebSocket Authentication               │
│ PH-04 │ Quantitative Parameter & News Privacy Sanitization  │
│ PH-05 │ 3-2-1 Resume Countdown & Market Live Activation     │
│ PH-06 │ Mathematical Order Execution & Financial Accounting │
│ PH-07 │ Circuit Breaker Band Triggers & Counter Liquidity   │
│ PH-08 │ Proportional Dynamic News Scaling & Cognitive Window│
│ PH-09 │ End-of-Day Transition & Daily P&L Carryover        │
│ PH-10 │ Championship Conclusion & 3-Tier Tie-Breaker Logic  │
│ PH-11 │ State Reset, Staging Cleanup & Backup Restoration   │
└───────┴─────────────────────────────────────────────────────┘
```

### 2.3 Verified Test Results
Executed directly in terminal:
```bash
node test_unified_master_flow.js
```
- **Total Assertions**: 36 / 36
- **Passed**: 36 (100%)
- **Failed**: 0
- **Duration**: ~4.2 seconds
- **Exit Code**: 0 (Clean)

---

## 3. Legacy Test Suites Catalog

| File | Focus Area | Assertions | Known Limitation |
| :--- | :--- | :---: | :--- |
| `test_master_suite.js` | Full system regression suite | 85 | Hardcodes port 3000; requires manual server stop |
| `test_unified_master_flow.js` | Unified 11-phase single-process lifecycle | 36 | **Canonical (Recommended)** |
| `test_trading_cards_and_lifecycle_suite.js` | Stock board cards & trading rules | 22 | May reuse dirty server if already running |
| `test_master_projector_and_daily_leaderboard_suite.js` | Projector DOM stability & leaderboards | 18 | Tests DOM string rendering in Node environment |
| `test_master_quantitative_and_security_suite.js` | GBM math, fee deduction, auth isolation | 24 | Requires clean database state |
| `test_master_lifecycle_and_isolation.js` | State machine transitions & role gating | 16 | Collides on port 3089 |
| `test_dynamic_upgrade_suite.js` | Dynamic news scaling & duration changes | 14 | Collides on port 3089 |
| `test_interaction_logic_and_state_machine.js` | Button click event simulations | 20 | Simulated DOM event dispatch |

---

## 4. Dependencies & Runtime Environment

### 4.1 Production Dependencies
The project adheres to an ultra-lean dependency profile documented in `package.json`:

```json
{
  "name": "the-trading-floor",
  "version": "2.6.1",
  "description": "The Trading Floor Championship 2026 - Educational Stock Market Simulation",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node test_unified_master_flow.js",
    "test:all": "node test_unified_master_flow.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "ws": "^8.17.0"
  }
}
```

- **`express` (v4.19.2)**: Lightweight HTTP static file server, CSV export streaming, and REST API router.
- **`ws` (v8.17.0)**: High-performance, RFC 6455 compliant WebSocket server for sub-millisecond market ticks and order routing.
- **Node.js Built-ins**: `fs`, `path`, `crypto`, `http`, `events`.

### 4.2 Zero-CDN Offline Campus Compliance
In college campus environments, Wi-Fi connectivity during large student events is notoriously unpredictable or completely isolated on an offline local area network (LAN).

The application enforces a **Strict Zero-CDN Invariant**:
1. **Typography**: Fonts rely on native system font stacks (`-apple-system`, `BlinkMacSystemFont`, `'Segoe UI'`, `Roboto`, `Helvetica`, `Arial`, `sans-serif`) and monospace fonts for financial data (`'SF Mono'`, `'Consolas'`, `'Liberation Mono'`, `'Courier New'`). Zero remote Google Fonts links exist.
2. **Icons**: All UI icons are either native Unicode emojis (`📈`, `📉`, `⏸️`, `▶️`, `🔒`, `👁️`, `🔔`) or inline SVG path definitions. Zero external FontAwesome or CDN icon stylesheets.
3. **Audio Synthesis**: Sound effects are generated in real-time via the browser's native **Web Audio API** (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`). Zero external MP3 or audio asset downloads over the network.
4. **Charting**: Sparklines and market trend charts are rendered on HTML5 `<canvas>` elements using raw Canvas 2D rendering contexts (`ctx.lineTo()`, `ctx.stroke()`). Zero external Chart.js, Highcharts, or D3.js CDN script tags.

---

## 5. Verification Commands

To verify the complete application state:

```bash
# 1. Run the canonical 11-phase automated test runner
npm test

# 2. Syntax check server and client files
node -c server.js
node -c public/app.js

# 3. Launch the production application locally
npm start
# Terminal outputs:
# ==========================================
# 🏛️  THE TRADING FLOOR CHAMPIONSHIP 2026
# 📡  Local Server running on http://localhost:3000
# ==========================================
```


<!-- END OF 08_TESTS_AND_DEPENDENCIES.md -->


================================================================================
<!-- START OF 09_REDESIGN_CONSTRAINTS.md -->
================================================================================

# 09 — REDESIGN CONSTRAINTS, COMPETITION INVARIANTS & MODULARIZATION BLUEPRINT

> **Auditor Reference Document**: Non-negotiable core invariants, competition rules, technical constraints, and architectural modularization blueprint for future refactoring and redesign by **Argon 4**.

---

## 1. Non-Negotiable Core Invariants

Any future refactoring or UI redesign conducted by Argon 4 MUST strictly preserve these 10 authoritative system invariants:

### 1. Authoritative Server Math
- **Zero Client Trust**: All stock prices, order validations, cash deductions, transaction fee deductions, holdings updates, circuit breaker triggers, portfolio net worths, P&L numbers, and leaderboard rankings are computed and enforced **strictly on the Node.js server**.
- The client terminal is a reactive presentation view only. No client calculation may ever dictate execution pricing or portfolio balances.

### 2. Offline-First Zero-CDN Operation
- **Zero Remote Dependencies**: The competition must be capable of running flawlessly in an isolated collegiate computer lab or hall with **zero internet connectivity**.
- No external CDNs (`cdnjs`, `unpkg`, `jsdelivr`), no remote web fonts (`Google Fonts`), no external icon fonts (`FontAwesome`), and no remote audio assets.
- Styling must use native CSS3, icons must use native SVG or Unicode, charts must use native Canvas 2D, and sound must use the browser's built-in **Web Audio API**.

### 3. Directional Circuit Breakers & Stock Isolation
- Circuit bands trigger at $\pm 20\%$ from the day's opening price (`dayOpenPrice`).
- **Directional Restrictions**:
  - **Upper Circuit (+20%)**: Restricts `BUY` orders; permits `SELL` orders.
  - **Lower Circuit (-20%)**: Restricts `SELL` orders; permits `BUY` orders.
- **Counter-Directional Liquidity Recovery**: Counter-orders immediately shift stock price away from the circuit band.
- **Stock-Level Isolation**: Halting a single company **never freezes the wider market**. Other stocks and market clocks continue trading unimpeded.

### 4. Explicit Multi-Day State Machine & Daily P&L Carryover
- Days progress cleanly: `STANDBY` $\to$ `COUNTDOWN` $\to$ `LIVE` $\to$ `DAY_COMPLETED` $\to$ `LIVE (Day 2)` $\to$ `CHAMPIONSHIP_CONCLUDED`.
- Cash and share holdings **carry over** into subsequent days.
- **Valuation Integrity**:
  - `Daily P&L` compares current net worth against `dayOpeningValuation`.
  - `Cumulative P&L` compares current net worth against the initial `startingCash`.

### 5. News Secrecy & 60-Second Host Privacy Reveal
- Non-host sockets (`TRADER`, `PROJECTOR`, `SOUND_CONSOLE`) must **never** receive raw price impact percentages, target price multipliers, company betas ($\beta$), or volatility factors ($\sigma$).
- On Host terminals, news impact details must remain masked by default (`🔒 Private Price Impact Details Hidden`), auto-hiding after 60 seconds if unmasked.

### 6. Order Debounce & Anti-Spam Gating
- Minimum 200ms debounce between order submissions per team session to prevent accidental double-clicks or automated keystroke script spam.

### 7. Spreadsheet Formula Injection Defense
- In all exported CSV files (leaderboards, trade audit logs, portfolio snapshots), any cell string starting with `=`, `+`, `-`, `@`, `\t`, or `\r` must be prepended with an apostrophe (`'`).

### 8. Projector Zero-Scroll Pagination & DOM Stability
- The big-screen stock board must divide into readable pages (8 stocks per page, $4 \times 2$ grid) rotating on a configurable 8-second interval.
- Cards on the active page must update in-place without destroying and recreating canvas contexts or causing visible screen flicker.

### 9. Dedicated Sound Console Role
- Web Audio API sound synthesis is isolated to a specialized `SOUND_CONSOLE` client role connected to venue loudspeakers. Host and Trader terminals default to muted to avoid cacophony in the competition hall.

### 10. Disaster Recovery & Safe State Restorations
- Restoring from checkpoint or crash recovery files must always initialize in `isPaused = true` state. The market must never spontaneously start live trading without explicit Host command.

---

## 2. Recommended Modularization Blueprint for Argon 4

The primary architectural weakness of the current codebase is monolithic coupling ([DEF-15](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/ARGON_DOSSIER/07_DEFECT_REGISTER.md): `public/app.js` is 11,435 lines; `server.js` is 4,773 lines).

Argon 4 is advised to restructure the codebase into clean, decoupled ES6 modules and domain services while preserving the existing API contracts:

### 2.1 Backend Architecture Blueprint (`server/`)

```
server/
├── index.js                     <-- HTTP & WebSocket bootstrap (<150 lines)
├── config/
│   ├── constants.js             <-- Circuit breaker %, fee bps, default durations
│   └── templates.js             <-- News templates & sector universe presets
├── domain/
│   ├── gbm_engine.js            <-- Discrete GBM tick, Box-Muller, cubic Hermite
│   ├── circuit_breaker.js       <-- Upper/Lower band monitoring & recovery
│   ├── order_matcher.js         <-- Cash validation, fees, weighted avg buy price
│   └── valuation.js             <-- Net worth, Daily/Cumulative P&L, tie-breakers
├── lifecycle/
│   ├── state_machine.js         <-- Event state FSM (SETUP -> LIVE -> CONCLUDED)
│   ├── game_clock.js            <-- 1s master clock & 250ms price tick loop
│   └── dynamic_scheduler.js     <-- Proportional news ratios & reading windows
├── network/
│   ├── session_store.js         <-- Crypto session tokens & role gating
│   ├── ws_router.js             <-- Action dispatch table & message handlers
│   └── state_sanitizer.js       <-- Public vs Host payload filtering
└── persistence/
    ├── file_store.js            <-- State checkpointing & crash recovery
    └── audit_logger.js          <-- Append-only NDJSON & CSV export generator
```

### 2.2 Frontend Architecture Blueprint (`public/src/`)

```
public/
├── index.html                   <-- Semantic layout shells & modal mount points
├── css/
│   ├── design_tokens.css        <-- Ivory, Forest, Gold, Monospace variables
│   ├── components.css           <-- Cards, tables, badges, buttons, modals
│   └── views.css                <-- View-specific responsive layouts
└── js/
    ├── main.js                  <-- App entry point & WebSocket connection manager
    ├── state/
    │   └── store.js             <-- Reactive client state store
    ├── audio/
    │   └── sound_synthesizer.js <-- Web Audio API institutional sound engine
    ├── views/
    │   ├── login_view.js        <-- Team & Host authentication screen
    │   ├── host/                <-- Host operational dashboard & tabs
    │   │   ├── market_ops.js    <-- Start/Pause/Conclude operations bar
    │   │   ├── stock_universe.js<-- Universe builder & stock editor
    │   │   ├── news_wire.js     <-- News manager & 60s reveal toggle
    │   │   └── audit_tab.js     <-- Live trade ledger & CSV export triggers
    │   ├── trader/              <-- Trading desk view
    │   │   ├── order_pad.js     <-- BUY/SELL buttons, lot selector, validation
    │   │   └── portfolio.js     <-- Cash, holdings, realized/unrealized P&L
    │   ├── projector/           <-- Presentation & hall display
    │   │   ├── stock_board.js   <-- 8-stock paginated cards & sparklines
    │   │   ├── leaderboards.js  <-- Live podium & rank standings
    │   │   └── news_headline.js <-- Breaking news banners & reading countdown
    │   └── winner/              <-- Olympic-style winner presentation showcase
    └── utils/
        ├── formatters.js        <-- formatClock12H, currency, percentage
        └── canvas_charts.js     <-- High-performance dirty-checked sparklines
```

---

## 3. UI Design System Tokens (The "Ivory Luxury" Aesthetic)

Argon 4 must adhere to the institutional, clean, Ivy League financial exchange aesthetic defined in `docs/DESIGN_SYSTEM.md`:

```css
:root {
  /* Core Luxury Palette */
  --bg-ivory: #FDFBF7;           /* Warm, premium archival paper background */
  --bg-cream: #F7F4EC;           /* Card containers & recessed panels */
  --border-subtle: #E2DDD3;      /* Crisp, subtle dividing borders */
  
  /* Primary Institutional Tones */
  --forest-primary: #1B4332;     /* Prestigious Oxford/Ivy forest green */
  --forest-hover: #143526;
  --text-primary: #1C2421;       /* Deep charcoal body text */
  --text-muted: #52615B;         /* Secondary labels and captions */
  
  /* Accent & Status Colors */
  --gold-accent: #D4AF37;        /* Champion medal, rank 1, spotlight highlight */
  --silver-accent: #A8A9AD;      /* Rank 2 */
  --bronze-accent: #CD7F32;      /* Rank 3 */
  
  /* Financial Market Indicators */
  --price-up: #2D6A4F;           /* Institutional green (positive returns) */
  --price-down: #9B111E;         /* Crimson red (negative returns) */
  --circuit-halt: #C0392B;       /* Circuit breaker border & flashing badge */
  
  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-serif: "Georgia", "Times New Roman", serif; /* Prestigious headings */
  --font-mono: "SF Mono", "Consolas", "Liberation Mono", monospace; /* Numbers, prices */
}
```

---

## 4. Verification Check Before Accepting Any Redesign

Before concluding any refactor or redesign, Argon 4 must verify:
1. `npm test` passes 36/36 assertions without errors on port 3099.
2. `node -c server.js` and `node -c public/app.js` report zero syntax errors.
3. Zero external `<link>` or `<script>` tags pointing to remote HTTP/HTTPS domains.
4. All CSV downloads pass `sanitizeCsvCell` protection.
5. All 6 SPA views navigate cleanly without page reloads.


<!-- END OF 09_REDESIGN_CONSTRAINTS.md -->
