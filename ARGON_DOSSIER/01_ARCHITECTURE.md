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
