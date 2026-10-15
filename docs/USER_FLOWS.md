# USER FLOWS & JOURNEYS — THE TRADING FLOOR CHAMPIONSHIP 2026

This document details the end-to-end user journeys for the Competition Host, Student Trader Teams, and the Stage Projector.

---

## 1. Host Journey: Pre-Event Setup & Configuration

```mermaid
graph TD
    A[Launch_The_Trading_Floor.bat] --> B[Host Opens localhost:3000/?role=host]
    B --> C[Auto Login as Master Control]
    C --> D[Open Market Builder Tab]
    D --> E{Curate Universe}
    E -->|Apply Preset| F[Balanced / High Vol / Tech-Auto]
    E -->|Custom Editing| G[Add New Share / Toggle Active / Edit Beta]
    E -->|Price Randomization| H[Randomize Base Prices +/-10%]
    F & G & H --> I[Save Universe to data/universe_active.json]
    I --> J[Open Team Setup Modal]
    J --> K[Configure Team Names, Rosters, and Passwords]
    K --> L[Open Event Settings]
    L --> M[Set Day Duration, Starting Cash, Circuit Breaker %]
    M --> N[Ready for Tournament Launch]
```

1. **Launch**: Organizer double-clicks `Launch_The_Trading_Floor.bat`. The script starts the Node server, detects the LAN IP address (e.g., `192.168.1.45`), and automatically opens `http://localhost:3000/?role=host`.
2. **Curate Market Universe**:
   - Host clicks the **🏛️ Market Builder (Share Universe)** subtab.
   - Host selects an appropriate preset (e.g., Balanced Market) or customizes which stocks are tradeable.
   - Host can optionally click **🎲 Randomize Prices (±10%)** to ensure participants cannot rely on pre-memorized price sheets.
3. **Configure Teams & Roster**:
   - Host clicks **👥 Teams Setup** on the top header.
   - Host selects 4, 8, 12, or 16 teams preset or manually types college team names and student member names.
   - Host clicks **Export CSV** to print team credential slips (Username / Password).
4. **Configure Rules**:
   - Host clicks **⚙️ Settings** to customize day duration (e.g., 20 mins), starting cash (₹5,00,000), circuit breaker limit (20%), and brokerage fee (e.g., 10 bps).

---

## 2. Trader Team Journey: Registration & Live Execution

```mermaid
graph TD
    A[Student opens http://LAN_IP:3000/] --> B[Enters Team Username & Password]
    B --> C[Server Validates & Returns Session Token]
    C --> D[Trader Desk Displays Tradeable Blue-Chips]
    D --> E[Click Buy / Sell on Company Card]
    E --> F[Order Ticket Modal Opens]
    F --> G[Select Quantity or MAX BUY / MAX SELL]
    G --> H[Click Execute Market Order]
    H --> I[Server Authoritatively Validates Cash/Holdings/Halt]
    I -->|Valid| J[Instant Execution & Fill Toast]
    I -->|Invalid| K[Rejection Notice & Explanation]
    J --> L[Cash Balance, Portfolio, and Log Update Real-time]
```

1. **Connection**: Students open Chrome or Edge on their laptops and navigate to `http://<HOST_IP>:3000/`.
2. **Authentication**: Students enter their assigned team credentials (e.g. `team1` / `trade100`). The server returns an authenticated session token stored in `sessionStorage`.
3. **Market Analysis**: The team monitors live stock cards showing real-time price ticks, % change from day open, Bezier sparklines, and 52-week fundamental metrics.
4. **Order Placement**:
   - Clicking **Buy** or **Sell** opens the Order Ticket modal.
   - Students enter share quantity or click quick presets (`Max Buy`, `Max Sell`, `+10`, `+50`).
   - The ticket displays live gross value, transaction brokerage fee, and remaining cash preview.
   - Clicking **Execute Order** transmits the order over WebSocket to the server.
5. **Confirmation**: A green toast confirms execution (`BUY 50 RELIANCE filled at ₹2,845.20`). Available cash and positions update instantly.

---

## 3. Host Journey: Live Tournament Operation

1. **Opening Bell**: Host clicks **▶ Resume (3-2-1)**. A synchronized 3-second countdown displays across all team screens and the projector, concluding with institutional open bell chimes.
2. **Managing Halts**: If high volatility triggers a 20% price movement, the stock automatically halts with an alarm sound. Host can inspect the halt on the **📈 Stock Engine & Halts** tab and click **Release Halt** when ready.
3. **Breaking News Injection**:
   - Host navigates to **⚡ News Control Deck**.
   - Host clicks **Trigger** on pre-scheduled shocks (e.g. `TCS Q2 Mega Deal`) or clicks **+ Create Breaking News** to draft a custom market shock with custom target ticker, % delta, and duration.
   - Breaking news flashes on all team terminals with a siren audio cue.
4. **Advancing Rounds**: At the end of Day 1, host clicks **⏭ Next Day**. Day 1 closes, current prices freeze as reference points, and Day 2 begins.

---

## 4. Finale & Post-Event Reporting Journey

1. **Championship Conclusion**: At the end of Day 3, host clicks **🏆 Crown Winners**.
2. **Podium Ceremony**:
   - The synchronized Grand Finale Winner Podium modal launches on all screens with confetti and fanfare.
   - Gold (#1), Silver (#2), and Bronze (#3) teams are displayed with verified total net worth and return %.
3. **Audit Export**: Host navigates to **📥 Reports & CSV Exports** and downloads:
   - `Standings CSV` (Official team marksheet and ranking).
   - `Trades Log CSV` (Timestamped ledger of every transaction).
   - `Audit Log JSON` (Complete institutional audit trail).

---

## 5. Host Reset, Setup Wizard & Crash Recovery Flows

### 5.1 Safe Championship Reset Journey
1. **Initiation**: Host clicks **⚠️ Reset Game** on the top command ribbon.
2. **Security Confirmation**:
   - The **Reset Entire Championship** modal appears with a danger warning.
   - The **Permanently Wipe & Reset** button is strictly locked until the Host types `"RESET"`.
3. **Execution**:
   - Once `"RESET"` is typed and confirmed, the server deletes `live_game_state.json`.
   - The server broadcasts `CHAMPIONSHIP_RESET` to all connected screens. All student desks and projectors are immediately logged out and returned to the authentication terminal.
   - The Host Control Panel launches the **New Championship Setup Wizard**.

### 5.2 3-Step Setup Wizard Journey
1. **Step 1: Event Brand & Rules**: Configure Championship Title, Starting Cash per Team, Trading Days, Session Duration, Brokerage Fees (bps), and Circuit Breaker Limits.
2. **Step 2: Team Roster Builder**: Click quick count presets (4, 8, 12, 16, or 24 teams) or dynamically add rows to configure Team Names, Usernames, Passwords/PINs, and Student Members.
3. **Step 3: Share Universe Selection**: Check/uncheck companies or click presets (Balanced Mix, Top 6 Only, All 12).
4. **Launch**: Click **🚀 Initialize & Launch New Championship**. The exchange engine resets prices to baseline, configures team registries, saves state to disk, and places the market in a clean paused state ready for Host Resume.

### 5.3 Crash Recovery & Mid-Game Resumption Flow
1. **Periodic Auto-Save**: In active live mode, the server automatically flushes the entire state to `data/live_game_state.json` every 4 seconds and immediately after every trade, news shock, or circuit halt.
2. **Crash Resumption**: If the server process or computer abruptly restarts mid-event:
   - Upon launching `node server.js live`, the engine detects `live_game_state.json`.
   - All portfolios, current prices, price histories, and trade logs are restored 100% intact.
   - The market is automatically locked in `isPaused = true`.
   - The Host simply re-opens the Host Panel and clicks **▶ Resume (3-2-1)** to continue the tournament seamlessly without lost data.
