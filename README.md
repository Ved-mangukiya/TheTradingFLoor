# THE TRADING FLOOR CHAMPIONSHIP
### Institutional-Grade Offline Stock Market Simulator for College Competitions

> **A Complete, Portable, 100% Offline Trading Simulation Platform**  
> Engineered specifically for collegiate business conclaves, finance festivals, and institutional investment challenges. Operates entirely over a local Wi-Fi router or campus LAN with **zero external internet connection required**.

---

## TABLE OF CONTENTS
1. [Platform Overview](#1-platform-overview)
2. [Lead Developer & System Architect](#2-lead-developer--system-architect)
3. [Key Championship Features](#3-key-championship-features)
4. [Terminal Desks & Access Credentials](#4-terminal-desks--access-credentials)
5. [System Requirements & Zero-CDN Architecture](#5-system-requirements--zero-cdn-architecture)
6. [1-Click Launchers & Setup](#6-1-click-launchers--setup)
7. [LAN Deployment & Connecting Trader Devices](#7-lan-deployment--connecting-trader-devices)
8. [Event Configuration & Guided Setup Hub](#8-event-configuration--guided-setup-hub)
9. [Share Universe & Market Builder](#9-share-universe--market-builder)
10. [Real-World Live Financial News System](#10-real-world-live-financial-news-system)
11. [Running the Live Market Operations](#11-running-the-live-market-operations)
12. [Multi-Day Tournament & Daily Snapshots](#12-multi-day-tournament--daily-snapshots)
13. [Auditorium Projector & Sound Console](#13-auditorium-projector--sound-console)
14. [Grand Finale Ceremonial Winner Reveal](#14-grand-finale-ceremonial-winner-reveal)
15. [Audited Exports, Marksheets & Formula Protection](#15-audited-exports-marksheets--formula-protection)
16. [Disaster Recovery & Checkpoints](#16-disaster-recovery--checkpoints)
17. [Troubleshooting & Verification](#17-troubleshooting--verification)
18. [Documentation Index](#18-documentation-index)

---

## 1. PLATFORM OVERVIEW
**The Trading Floor Championship** is a standalone, server-authoritative stock market exchange simulator. It transforms an ordinary laptop into a high-speed institutional exchange hosting dozens of competing student teams over local Wi-Fi.

Participants execute live orders across blue-chip Indian equities (IT, Banking, Automotive, Energy, FMCG, Pharmaceuticals). Prices evolve dynamically through a server-authoritative stochastic engine responding to breaking financial news, sector-wide macroeconomic shocks, and directional circuit breakers.

---

## 2. LEAD DEVELOPER & SYSTEM ARCHITECT

| Role | Details |
| :--- | :--- |
| **Architect & Lead Developer** | **Ved Mangukiya** |
| **Academic Program** | Bachelor of Business Administration (BBA Hons.) |
| **Institution** | Shri Swami Atmanand Saraswati Institute of Technology (SSASIT), Surat |
| **Affiliation** | Gujarat Technological University (GTU Code: 076) |
| **System Vision** | High-performance, offline-first collegiate technology with institutional UX standards |

---

## 3. KEY CHAMPIONSHIP FEATURES

- **100% Offline-First (Zero CDN)**: Runs cleanly in auditoriums or campus networks with zero active internet connection. All CSS, local SVG icons, typography, and procedural audio operate locally from disk.
- **Authoritative Server Math**: Order books, cash balances, weighted portfolio valuations, 10 bps transaction fees, circuit breakers, and leaderboard rankings are computed and enforced strictly on Node.js.
- **Directional Circuit Breakers (±20%)**: Upper circuit freezes BUY orders while allowing SELL liquidation; lower circuit freezes SELL orders while permitting recovery BUY flow. Unhalting requires an authoritative 0.8% price buffer.
- **Real-World Live News Feeds**: Authenticated Indian Equities RSS integration (Google News / NSE / custom APIs) with genuine publication timestamps, real publisher sources (*The Economic Times*, *Reuters*, *Mint*, *Moneycontrol*), financial sentiment parsing, and transparent offline disk caching.
- **Dynamic Multi-Day Lifecycle**: Fully supports multi-day championships with overnight portfolio carry-over, daily opening baselines, and locked daily P&L snapshots.
- **Zero-Scroll Stage Projector**: 8-card responsive pagination rotating every 8s, top gainer/loser persistent spotlights, animated price tickers, and ceremonial reveal sequences.
- **Web Audio Sound Console**: Built-in institutional sound synthesizer delivering trading bells, countdown chimes, circuit alarms, breaking news klaxons, and victory fanfares without external audio files.
- **Enterprise Action Contract Locks**: In-flight debounce prevents double-click order duplicates; 5000ms safety timeout auto-unlocks UI on network dropouts.
- **Disaster Recovery**: Automatic state persistence every 4s, auto-checkpoints every 120s, and instant crash recovery restoring active sessions safely in paused state.

---

## 4. TERMINAL DESKS & ACCESS CREDENTIALS

All roles connect through a single unified web portal. Default credentials provide direct access:

| Desk / Terminal | Purpose | Default URL | Username | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Host Matrix** | Complete championship orchestrator | `http://localhost:3000/?role=host` | `host` | `host` |
| **Stage Projector** | Auditorium big-screen presentation | `http://localhost:3000/?role=projector` | `projector` | `screen` |
| **Sound Console** | Dedicated remote audio technician | `http://localhost:3000/?role=sound` | `sound` | `sound` |
| **Winner Stage** | Ceremony podium display | `http://localhost:3000/?role=winner` | `winner` | `winner` |
| **Trader Desks** | 16 competing student teams | `http://<LAN_IP>:3000/` | `team1` .. `team16` | `trade100` .. `trade1600` |

*Note: All credentials can be customized in Event Setup before locking the championship.*

---

## 5. SYSTEM REQUIREMENTS & ZERO-CDN ARCHITECTURE

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **Runtime**: Node.js v18 LTS or higher (v20+ recommended)
- **Dependencies**: Only 2 production packages (`express` and `ws`)
- **Zero Remote Dependencies**: Zero CDN links, zero Google Fonts, zero external media calls. All assets are served strictly from the local `public/` directory.

---

## 6. 1-CLICK LAUNCHERS & SETUP

### Windows 1-Click Launch
Double-click `Launch_The_Trading_Floor.bat` in the repository root.
- Automatically verifies Node.js runtime (or downloads portable Node LTS).
- Installs production dependencies if missing.
- Launches the server and opens the Host Operations Matrix in your default browser.

### Manual Terminal Commands
```powershell
# 1. Install dependencies
npm install

# 2. Boot production simulation (Live Mode)
npm start

# 3. Boot with specific port or test scenario
node server.js live 3000
node server.js test 3099
```

---

## 7. LAN DEPLOYMENT & CONNECTING TRADER DEVICES

1. **Connect All Devices to Same Wi-Fi / Router**:
   Connect the Host laptop and participant smartphones/laptops to the same Wi-Fi router. Internet access is **not required**.
2. **Read the Local Router LAN URL**:
   The server startup banner prints the exact LAN address:
   ```
   • Router LAN URL: http://192.168.1.15:3000
   ```
3. **Distribute URL & Credentials**:
   Participants open `http://<ROUTER_LAN_IP>:3000` on their mobile or laptop browser and sign in with their team username and password.

---

## 8. EVENT CONFIGURATION & GUIDED SETUP HUB

Before opening trading, the Host orchestrates the tournament using Hub 2 (Event Setup):

1. **Step 1: Event Details**: Set Championship Title, Host Institution, Starting Cash (default ₹5,00,000), and Transaction Fee (default 10 bps).
2. **Step 2: Circuit Breakers & Risk**: Configure directional limits (default 20%).
3. **Step 3: Tournament Days & Duration**: Choose total days (1–5) and trading duration per day (default 30 minutes / 1800s).
4. **Step 4: Breaking News Schedule**: Review automatically balanced news timeline across all days with 25s reading windows.
5. **Step 5: Teams Roster & Credentials**: Add or edit team names and credentials; export printable credential slips.
6. **Step 6: Review & Lock**: Review full configuration and click `🔒 Confirm & Lock Event Setup`. Once locked, participant logins open and the market advances to **Day 1 Standby**.

---

## 9. SHARE UNIVERSE & MARKET BUILDER

The simulation features 20 verified Indian corporate equities across high-impact economic sectors:

- **Information Technology**: TCS, Infosys (INFY), Wipro (WIPRO), HCL Technologies (HCLTECH)
- **Banking & Finance**: HDFC Bank (HDFCBANK), ICICI Bank (ICICIBANK), State Bank of India (SBIN), Kotak Mahindra (KOTAKBANK), Axis Bank (AXISBANK), Bajaj Finance (BAJFINANCE)
- **Automotive & Industrials**: Tata Motors (TATAMOTORS), Maruti Suzuki (MARUTI), Larsen & Toubro (LT)
- **Energy & Conglomerates**: Reliance Industries (RELIANCE), Adani Enterprises (ADANIENT), Adani Ports (ADANIPORTS)
- **Consumer & Healthcare**: ITC Limited (ITC), Bharti Airtel (AIRTEL), Sun Pharma (SUNPHARMA), Titan Company (TITAN)

Hosts can toggle constituent shares on/off or create custom campus stocks before locking setup.

---

## 10. REAL-WORLD LIVE FINANCIAL NEWS SYSTEM

The platform includes an authenticated live financial news integration engine:
- **Live Market Feed**: Pulls real-world financial news from Google News Financial RSS / NSE feeds.
- **Genuine Source Transparency**: Shows authentic publishers (*The Economic Times*, *Reuters*, *Mint*, *Moneycontrol*) and actual publication timestamps.
- **Dynamic Stock Ticker Mapping**: Automatically correlates headlines with active market tickers (e.g. `RELIANCE`, `TCS`, `TATAMOTORS`).
- **Offline Disk Cache**: Caches fetched news to `data/real_news_cache.json` with genuine cache age, guaranteeing complete offline reliability during campus conclaves.
- **Host Broadcast to Market**: Event hosts can select any real-world breaking story and broadcast it to the trading floor with simulated price shocks.

---

## 11. RUNNING THE LIVE MARKET OPERATIONS

The Host Operations Desk provides a singular, non-duplicated Operations Bar:

- **Launch Day 1 (3-2-1)**: Initiates synchronized 3-second countdown across all screens and rings the opening bell.
- **Soft Pause (Prices Visible)**: Freezes order submissions while keeping live prices and charts visible.
- **Blackout Pause (Blind)**: Freezes trading and conceals stock prices for high-tension strategy breaks.
- **Resume Market (3-2-1)**: Authoritative countdown brings all screens back into live trading seamlessly.
- **Emergency Halt**: Instantly stops the entire exchange with audio alarm klaxons during unexpected hall announcements.

---

## 12. MULTI-DAY TOURNAMENT & DAILY SNAPSHOTS

At the end of each session:
1. Host clicks `🔔 Conclude Day N`.
2. Official closing prices freeze, daily P&L is calculated independently from cash additions, and an immutable daily audit snapshot is stored.
3. Trader screens display the Day Completed audited balance overlay.
4. Host clicks `▶ Open Day N+1` to carry over team portfolios into the next trading day.

---

## 13. AUDITORIUM PROJECTOR & SOUND CONSOLE

- **Auditorium Projector (`/?role=projector`)**: Rotates 8 stocks per page every 8 seconds without page-flipping flickering. Shows persistent Top Gainer and Top Loser cards, rolling market index tickers, and breaking news banners.
- **Web Audio Sound Console (`/?role=sound`)**: Dedicated remote audio technician interface with independent volume controls and individual cue testing for opening bells, countdown ticks, news alarms, and ceremony fanfares.

---

## 14. GRAND FINALE CEREMONIAL WINNER REVEAL

When the final tournament day concludes:
1. Host clicks `🏆 Launch Winner Ceremony`.
2. Projector transitions into full ceremonial presentation mode.
3. Host orchestrates the 6-stage progressive reveal:
   - **Scene 1**: Championship Concluded Title & Celebration
   - **Scene 2**: Top 10 to 4th Place Roll of Honour
   - **Scene 3**: 🥉 2nd Runner-Up (Bronze)
   - **Scene 4**: 🥈 1st Runner-Up (Silver)
   - **Scene 5**: 🥁 Dramatic Drumroll
   - **Scene 6**: 🥇 Champion Announcement with Fireworks Fanfare

---

## 15. AUDITED EXPORTS, MARKSHEETS & FORMULA PROTECTION

The platform provides complete post-event compliance exports via Host Hub 5:
- **Leaderboard Standings CSV**: Team rankings, starting cash, final portfolio value, ROI %, and trade counts.
- **Daily Performance Audit CSV**: Daily P&L breakdown and day-by-day rank trajectory.
- **Complete Trade Audit Log CSV**: Timestamped record of every transaction across the championship.
- **Full Championship State JSON**: Machine-readable snapshot for permanent institutional archiving.
- **Formula Injection Protection**: Any value beginning with `=`, `+`, `-`, or `@` is prepended with `'` to prevent spreadsheet code execution.

---

## 16. DISASTER RECOVERY & CHECKPOINTS

- **Auto-Save**: Active game state saves every 4 seconds to `data/live_game_state.json`.
- **Auto-Checkpoints**: Deep checkpoints generate every 120 seconds in `data/checkpoints/`.
- **Manual Checkpoints**: Host can create named checkpoints before major tournament milestones.
- **Crash Recovery**: If the host laptop experiences power interruption, the server reboots and safely restores the active session in **PAUSED** state.

---

## 17. TROUBLESHOOTING & VERIFICATION

### Automated Self-Test Suite
Run the comprehensive 195-point test suite:
```powershell
# Run all tests
npm test
npm run test:all

# Verify zero duplicate DOM IDs
npm run test:ids
```

### Common Checks
- **Port In Use (EADDRINUSE)**: Terminate stale node process: `taskkill /F /IM node.exe`
- **Trader Cannot Connect**: Verify device is connected to the same Wi-Fi router and Windows Firewall permits Node.js incoming connections.

---

## 18. DOCUMENTATION INDEX

All operational specifications and engineering contracts are maintained in `docs/`:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Node.js engine, WebSocket protocol, and client state machine.
- [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) — Order execution, valuation math, circuit breakers, and fees.
- [USER_FLOWS.md](docs/USER_FLOWS.md) — Complete walkthroughs for Host, Traders, and Projector.
- [SECURITY.md](docs/SECURITY.md) — Authentication, rate limiting, and parameter isolation.
- [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — Warm Ivory luxury design system, typography, and contrast rules.
- [NEWS_ENGINE.md](docs/NEWS_ENGINE.md) — Scenario news timing and real-world RSS integration.
- [SOUND_CONSOLE.md](docs/SOUND_CONSOLE.md) — Procedural Web Audio API sound generator.
- [BACKUP_AND_RESTORE.md](docs/BACKUP_AND_RESTORE.md) — Checkpoint creation, crash recovery, and export audits.
- [CHANGELOG.md](CHANGELOG.md) — Chronological release history up to v2.7.0.
