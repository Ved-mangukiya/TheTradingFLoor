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
