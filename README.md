# The Trading Floor - Championship 2026 📈

Institutional-grade, low-latency, real-time LAN stock market simulation platform engineered for college and high school trading championships, business fests, and auditorium competitions.

---

## 🏛️ Design System: Premium White, Warm Ivory & Pastel Luxury

The platform has been redesigned from the ground up with an institutional financial luxury theme:
- **Warm Ivory Background**: `#F8F5EF`
- **Pure White Cards & Surfaces**: `#FFFFFF` / `#FFFDF9`
- **Forest Green & Charcoal Typography**: `#263D35` / `#292D2B`
- **Champagne Gold Accents**: `#B49A70` / `#F4EFE6`
- **Pastel Sage & Pale Blue Panels**: `#E3EBE3` / `#E7EDF5`
- **High-Contrast Market Colors**: Positive Green `#218653` / Negative Rose `#C64B4B`
- **100% Offline-First (Zero CDN Dependency)**: Runs reliably on closed local Wi-Fi networks without internet access. All fonts, styles, and audio synthesizers are self-contained.

---

## ⚡ Instant Quick-Start (1-Click Launchers)

### 🧪 1. Dry-Run Sandbox Test Mode
Double-click `Start_Test_Scenario.bat`:
1. **Auto-Installs Dependencies**: Verifies `node_modules` and runs `npm install` automatically if missing (`express`, `ws`).
2. **Boots Sandbox Engine**: Loads `scenario_test.json` with fictitious blue-chips & early shocks.
3. **Opens 3 Synchronized Windows Automatically**:
   - **Tab 1: Host Control Centre** (`?autologin=host`) — Tournament operations & settings.
   - **Tab 2: Stage Projector** (`?autologin=projector`) — High-visibility auditorium board.
   - **Tab 3: Team 1 Trading Desk** (`?autologin=team1`) — Live order book, sparkline charts, and wire feed.

### 🏆 2. Official Championship Live Mode
Double-click `Start_Live_Scenario.bat`:
1. Loads official `scenario_live.json` (Tata Motors EV, Maruti, TCS, Infosys, HDFC Bank, Bajaj Finance, Adani Green, Sun Pharma).
2. Initializes official 3-day timeline with macro and sector shocks.
3. Opens the universal login portal (`http://localhost:3000`).

---

## 🎯 Key System Features

### 1. Host Control Centre
- **Market Control**: Instant emergency pause, 3-2-1 synchronized countdown resume, advance trading round.
- **Custom Breaking News Composer**: Create and broadcast breaking news live during the event with custom headline, explanation, target stock/all, impact % (+/-), and shock duration.
- **Circuit Breakers**: Automatic halt when any stock hits ±20% (or configurable threshold) with host unhalt override.
- **Dynamic Team Setup**:
  - Presets for 4, 8, 12, 16, or custom number of teams.
  - Custom team names, participating student member rosters, and passwords.
  - Export team rosters as CSV.
- **Customizable Event Settings**: Event title, round duration, total days, circuit breaker %, starting virtual capital, and transaction brokerage fee (basis points).
- **Comprehensive Reports & Audits**:
  - **Final Standings CSV** (`/api/export/standings`) with Excel BOM and formula injection protection.
  - **Executed Trades CSV** (`/api/export/trades`) with timestamps, prices, and fee tracking.
  - **Audit Timeline CSV** (`/api/export/audit-csv`) recording administrative actions.
  - **Raw Audit Log JSON** (`/api/audit-log`).

### 2. Student Trading Desk
- **Market Trading Desk Tab**: 8 stock cards with live prices, percentage change, organic Bezier spline canvas sparklines, quick lot buttons (`BUY +1`, `+10`, `+50`, etc.), and Custom Trade modal.
- **Interactive Trade Modal**: Dynamic quantity selector, gross value, transaction fee preview, expected cash impact, and single-click execution.
- **My Portfolio Positions Tab**: Detailed breakdown of held stocks, quantity, average cost basis, current market price, total value, and unrealized profit/loss.
- **Trade Order History Tab**: Audited chronological log of all trades executed by the team.
- **Live Market Wire**: Real-time breaking news wire with timestamps and sector context.
- **Competition Rules & Help Centre**: Integrated plain-language guide for students.

### 3. Public Stage Projector View
- Designed for large auditorium projection screens and last-bench readability.
- 34px bold tickers, 38px high-contrast prices, and smooth spline canvas sparklines.
- Live clock, day badge, and status indicator (`ACTIVE TRADING` / `MARKET PAUSED`).
- Bottom breaking news marquee ticker.
- Fullscreen mode (`F11` or on-screen toggle).

### 4. Championship Finale & Winner Podium
- Triggered by host when all rounds finish or via the "Crown Winners" command.
- **3-Tier Podium**:
  - 🥇 **1st Place (Gold)** with floating trophy, team name, member roster, final net worth, and return %.
  - 🥈 **2nd Place (Silver)** with runner-up honors.
  - 🥉 **3rd Place (Bronze)** with third-place honors.
- Celebratory falling confetti burst and Web Audio API synthesized fanfare chords.
- Full verified standings table for all participating teams.

---

## 🔐 Credentials & Session Security

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Host Control** | `host` | `host2026` | Pause / Resume, News creation, Halts, Team setup, Event settings, CSV exports, Podium ceremony. |
| **Stage Projector** | `projector` | `screen2026` | Public high-visibility auditorium display, ticker, news marquee. |
| **Trader Teams** | `team1` .. `team16` | `trade100` .. `trade1600` | Private trading desk, buy/sell orders, portfolio valuation, trade history. |

---

## 🧪 Automated Verification Suite

Run the comprehensive master automated test suite to verify all engine calculations, orders, and security rules:

```bash
node test_master_suite.js
```

### Verified Workflows (19 / 19 Tests Passed):
- Server health and JSON scenario validation.
- Secure authentication & rejection of bad passwords.
- Host, Projector, and Trader team logins with 32-character session tokens.
- Reconnection and session resumption.
- Order rejection during market pause.
- Synchronized 3-2-1 countdown resumption.
- Buy orders: cash deduction, holdings increase, average acquisition price.
- Sell orders: cash credit, holdings reduction, realized profit/loss.
- Rejection of overselling (insufficient shares).
- Rejection of overbuying (insufficient cash).
- Team account isolation (trades of Team 1 never contaminate Team 2).
- Breaking news shock and lerp price engine transitions.
- Host event configuration updates.
- Host championship conclusion & winner calculations.
- CSV Standings export with Excel BOM.
- CSV Trade History export.
- Rejection of unauthorized downloads (403 Forbidden).

---

## 🌐 Connecting Participant Devices over Local Wi-Fi (No Internet Needed)

1. Connect the host computer and student laptops/phones to the same Wi-Fi router (or mobile hotspot).
2. When `server.js` starts, check the console output for the LAN IP:
   ```
   • Router LAN URL: http://192.168.X.X:3000
   ```
3. Students and projectors navigate to that URL on Chrome, Safari, Edge, or Brave.
4. Distribute credentials (`team1` / `trade100`, etc.) to each team.

---

## 📁 Architecture & File Structure

```
TheTradingFLoor/
├── Start_Test_Scenario.bat       <-- 1-click test launcher (auto-installs & opens 3 tabs)
├── Start_Live_Scenario.bat       <-- 1-click event-day launcher
├── the-trading-floor.zip         <-- Portable complete distribution archive
├── server.js                     <-- Express + WebSocket simulation engine & CSV endpoints
├── package.json                  <-- Project configuration (express, ws)
├── README.md                     <-- Comprehensive operational manual
├── test_master_suite.js          <-- 19-stage automated test suite
├── data/
│   ├── scenario_live.json        <-- Official event companies and macro shocks
│   └── scenario_test.json        <-- Dry-run calibration scenario
├── public/
│   ├── index.html                <-- Universal SPA (Login, Trader, Host, Projector)
│   ├── style.css                 <-- Luxury ivory & pastel Vanilla CSS design system
│   └── app.js                    <-- Client routing, Web Audio API synth, canvas sparklines
└── logs/                         <-- Auto-generated millisecond-accurate audit logs
```

---

## 📋 Event-Day Host Checklist

1. [ ] **Pre-Event Test**: Run `Start_Test_Scenario.bat` 1 hour before the competition to confirm audio, screen resolution, and network connections.
2. [ ] **LAN Connection**: Confirm host laptop is connected to the auditorium Wi-Fi or router via Ethernet. Note the LAN IP.
3. [ ] **Projector Setup**: Open `http://localhost:3000/?autologin=projector` on the display laptop connected to the auditorium projector and press `F11` for full screen.
4. [ ] **Team Handout**: Share team usernames and passwords with registered teams.
5. [ ] **Event Start**: Host logs in, confirms teams and settings, and clicks `▶ Resume (3-2-1)`.
6. [ ] **Grand Finale**: At the end of Day 3, click `🏆 Crown Winners` to launch the 3-tier podium ceremony.
7. [ ] **Export Records**: Download the Final Standings CSV and Executed Trades CSV from the Host Panel for faculty records.
