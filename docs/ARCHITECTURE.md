# SYSTEM ARCHITECTURE — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. High-Level Architecture Overview

The Trading Floor Championship is architected as an offline-first, client-server application built with Node.js, Express, native WebSockets (`ws`), and vanilla HTML5/CSS3/JavaScript.

```
                      +---------------------------------------+
                      |           Node.js Server              |
                      |   Express HTTP (Static + REST API)    |
                      |   WebSocket Server (Port 3000)        |
                      +-------------------+-------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
     Persistent Storage (JSON)                       Live In-Memory State
     ├── data/scenario_live.json                     ├── Companies Universe
     ├── data/scenario_test.json                     ├── Teams & Portfolios
     ├── data/universe_active.json                   ├── Executed Trades Ledger
     └── logs/AUDIT_LOG_*.json                       └── Active News & Clocks
                     |                                         |
         +-----------+-----------------------------------------+-----------+
         |                                 |                               |
+--------v---------+             +---------v--------+            +---------v--------+
|   Host Control   |             |   Trader Desks   |            | Stage Projector  |
|  (Master Matrix) |             |  (Student Teams) |            |  (Full Screen)   |
+------------------+             +------------------+            +------------------+
```

---

## 2. Core Subsystems

### 2.1 Authoritative Market Price Engine
- **Tick Interval**: Runs on an atomic 1500ms `setInterval` loop in `server.js`.
- **Geometric Random Walk with Mean Reversion & Order Flow Impact**:
  $$P_{t+1} = P_t \times \left(1 + \mu \cdot dt + \sigma \cdot \epsilon \cdot \sqrt{dt} - \kappa (P_t - P_{\text{baseline}})\right) + \Delta P_{\text{flow}}$$
  - $\sigma$: Stock-specific volatility factor (default: `0.004` to `0.012`).
  - $\epsilon$: Normal Gaussian perturbation using Box-Muller transform.
  - $\kappa$: Mean reversion force anchoring extreme drifts back towards economic baseline (`0.0004`).
  - $\Delta P_{\text{flow}}$: Instantaneous order-flow liquidity pressure ($+Q \times P \times 2\times 10^{-6}$ on BUY, $-Q \times P \times 2\times 10^{-6}$ on SELL, capped at $\pm 0.8\%$ per trade).
- **Active Transition Shock Engine**: When news breaks, target stocks undergo exponential price adjustments over 30–60 seconds, weighted by each company's $\beta$ (news sensitivity).
- **Circuit Breakers**: Evaluated on every tick. If $|P_t - P_{\text{day\_open}}| / P_{\text{day\_open}} \ge \text{Limit}$ (default: 20%), trading in that stock is immediately frozen, setting `isHalted = true` and broadcasting a circuit breaker alarm.

### 2.2 WebSocket Communication Protocol
All real-time interaction occurs over a persistent WebSocket connection:
- **Authentication**: Clients send `{ action: 'LOGIN', username, password }`. The server validates against registered credentials and returns a 32-character cryptographic session token (`session_token`).
- **Session Continuity**: If a browser tab disconnects or reloads, the client automatically transmits `{ action: 'RESUME_SESSION', session_token }`. The server reconnects the existing session and pushes the latest authoritative state without losing portfolio data.
- **Role-Based Sanitized State Broadcast**:
  - `TRADER`: Receives only tradeable enabled stocks, team's own portfolio/cash, team's own executed trades, public leaderboard, and active news flash. Never receives other teams' private holdings.
  - `PROJECTOR`: Receives public enabled stocks, top 5 leaderboard rankings, and active news flashes.
  - `HOST`: Receives full administrative state including `allCompaniesUniverse` (both enabled and disabled shares), all teams' raw balances, all executed trades, and audit counters.

### 2.3 Offline Institutional Audio Engine (High-Suspense Synthesis)
To operate without internet and without external audio assets:
- Implemented in `public/app.js` using the standard browser **Web Audio API** (`AudioContext`).
- Generates 6 distinct synthetic cues entirely in code to build intense auditorium pressure:
  1. `bell_open` / `bell_close`: Multi-harmonic chime (C5-E5-G5-C6) with exponential decay.
  2. `heavy_news_boom`: Cinematic 90Hz->32Hz sub-bass rumble combined with a high-tension triple sonar alert (520Hz->980Hz).
  3. `emergency_klaxon`: Oscillating 6-burst alternating dual-pitch square-wave alarm (820Hz / 600Hz) triggered during circuit breaker limit halts.
  4. `order_fill`: Mechanical double-register cash execution click (1480Hz & 1960Hz) on filled orders.
  5. `countdown_tick`: High-pressure woodblock tick (920Hz) driving the 3-2-1 resume overlay and final seconds of each day.
  6. `championship_fanfare`: Grand victory fanfare (G4-C5-E5-G5-C6) for the winner podium.

### 2.4 Data Persistence, Crash Recovery & Host Tournament Reset
- **Live Crash Recovery Auto-Save**: In active live mode, the engine automatically serializes the full in-memory state (`gameState`, `companies`, `teams`, `executedTrades`, `tradeSeqCounter`, `newsEvents`, `USERS`) to `data/live_game_state.json` every 4 seconds and immediately upon critical events (trades, news, circuit breaker, day transition).
  - **Reboot Resumption**: If the server crashes or restarts, it detects `live_game_state.json`, restores portfolios, prices, and trade logs, and automatically sets `gameState.isPaused = true`. The Host simply opens the Host Panel and presses "▶ Resume".
- **Safe Championship Reset & Setup Wizard**:
  - `HOST_RESET_ENTIRE_CHAMPIONSHIP`: Enforces high-friction typing security (`"RESET"` required). Destroys `live_game_state.json`, disconnects all student sessions, broadcasts `CHAMPIONSHIP_RESET`, and launches the Host Setup Wizard.
  - `HOST_INITIALIZE_NEW_CHAMPIONSHIP`: Configures tournament parameters (title, starting cash, days, session duration, transaction fees, circuit breaker band), custom team roster (names, usernames, passwords, student members), and tradeable share universe.
- **Active Share Universe**: Stored in `data/universe_active.json`. Created or modified whenever the host adds, edits, toggles, duplicates, or randomizes shares.
- **Audit Ledger**: Stored in `logs/AUDIT_LOG_<timestamp>.json`. Written periodically and on every trade/pause/halt event using non-blocking asynchronous disk writes.
- **Full State Backup & Restore API**:
  - `GET /api/backup`: Serializes game state, teams, companies, and executed trades into a complete JSON snapshot.
  - `POST /api/restore`: Ingests a previously exported snapshot and re-establishes server state cleanly.

### 2.5 High-Performance Institutional Charting Engine (`TFCharts`)
Operating strictly under the **Offline-First Zero-CDN Invariant**, charting is handled by a bespoke vanilla Canvas 2D engine unified directly within `public/app.js` and styled in `public/style.css`:
- **Monotone Cubic Splines (Fritsch-Carlson)**: Unlike standard Catmull-Rom or Bezier curves which notoriously overshoot market peaks and troughs, monotone tangents guarantee the price curve never dips below the true low or breaches the true high.
- **HiDPI Screen Scaling**: Automatically rescales backing store based on `window.devicePixelRatio`, preventing blurry lines on Retina, Apple Silicon, and 4K auditorium projectors.
- **Shared 60 FPS RAF Loop**: Single `requestAnimationFrame` loop driven by an internal `Map` registry. Automatically cleans up event listeners and unregisters canvases when removed from the DOM.
- **Component Signatures**:
  1. `drawSmoothMiniSparkline(canvasId, history, dayOpenPrice, isUp)`: Renders market cards with green/red gradient area fill, dashed Day Open baseline, and continuous harmonic pulse dot on the latest price tick.
  2. `drawInteractiveMainChart(canvasId, stock, containerElement)`: High-fidelity interactive chart modal with snapping hover crosshair, floating coordinates tooltip, Day High/Low dashed guides, Day Open right-axis badge, live price pill, and prominent `TRADING HALTED` banner. Automatically resizes via `ResizeObserver`.
  3. `drawPortfolioEquityCurve(canvasId, equityHistory, opts)`: Real-time team net worth tracker against the ₹5,00,000 baseline, featuring dual-zone P&L fills (green profit zone / red drawdown zone) and live `IN PROFIT` / `DRAWDOWN` badges.
  4. **Auditorium Projector Variant (`.tf-projector`)**: High-contrast, double-thickness typography and canvas scaling engineered for 50-foot viewing distances.

---

## 3. System Designer & Lead Architect

- **Creator & Lead System Architect**: **Ved Mangukiya**
- **Academic Program**: Pursuing Bachelor of Business Administration (BBA)
- **University**: Gujarat Technological University (GTU)
- **Location**: Surat, Gujarat, India
- **Engineering Benchmark**: Conceived, engineered, and optimized end-to-end from first principles with zero external framework bloat, zero CDN reliance, sub-millisecond server-authoritative liquidity execution, programmatic Web Audio synthesis, and crash-resilient deterministic state restoration. A system architecture unprecedented in collegiate financial simulations worldwide.
