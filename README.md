# THE TRADING FLOOR CHAMPIONSHIP 2026 📈
### Institutional-Grade Offline Stock Market Simulator for College Competitions

> **A Complete, Portable, 100% Offline Trading Platform**  
> Engineered specifically for collegiate business conclaves, finance festivals, and high-school investment challenges. Operates entirely over a local Wi-Fi router or campus LAN with **zero internet connection required**.

---

## TABLE OF CONTENTS
1. [What This Software Is](#1-what-this-software-is)
2. [Lead Developer & System Architect](#-lead-developer--system-architect)
3. [Key Tournament Features](#2-key-tournament-features)
3. [Interface Previews & Live Roles](#3-interface-previews--live-roles)
4. [System Requirements](#4-system-requirements)
5. [One-Time Installation Instructions (Windows)](#5-one-time-installation-instructions-windows)
6. [Exact Commands & 1-Click Launchers](#6-exact-commands--1-click-launchers)
7. [Finding the Host Local Network (LAN) Address](#7-finding-the-host-local-network-lan-address)
8. [How Teams Connect via LAN / Wi-Fi](#8-how-teams-connect-via-lan--wi-fi)
9. [How to Configure a Competition](#9-how-to-configure-a-competition)
10. [Team Management & Credential Slips](#10-team-management--credential-slips)
11. [Market Builder & Share Universe Manager](#11-market-builder--share-universe-manager)
12. [Running the Live Event (Start, Pause, Resume, Advance Day, Crown Winners)](#12-running-the-live-event)
13. [Exporting Results & Marksheets](#13-exporting-results--marksheets)
14. [Backing Up and Restoring Competition Data](#14-backing-up-and-restoring-competition-data)
15. [Troubleshooting & Common Errors](#15-troubleshooting--common-errors)
16. [How to Reset a Practice Round Safely](#16-how-to-reset-a-practice-round-safely)
17. [Demonstrating to HOD & Faculty via Web Link (GitHub Pages & Cloud)](#17-demonstrating-to-hod--faculty-via-web-link)
18. [Advanced Documentation Index](#18-advanced-documentation-index)

---

## 1. WHAT THIS SOFTWARE IS
**The Trading Floor Championship 2026** is a standalone, server-authoritative stock market exchange simulator. It turns any ordinary laptop into a high-speed institutional stock exchange that hosts dozens of competing student teams over local Wi-Fi. 

Participants trade real-time simulated blue-chip equities across Indian economic sectors (IT, Banking, Automotive, Energy, FMCG, Pharmaceuticals). Prices move organically using a mean-reverting geometric random walk model, responding to breaking economic news shocks, sector developments, and circuit breaker trading halts.

---

## 👨‍💻 LEAD DEVELOPER & SYSTEM ARCHITECT

### **Ved Maheshbhai Mangukiya**
**Lead Developer, Chief System Architect & Sole Creator**  
*Pursuing Bachelor of Business Administration (BBA) • Gujarat Technological University • Surat, Gujarat, India*

> **Architectural Statement**: Independently conceived, architected, and coded from the ground up by **Ved Maheshbhai Mangukiya**, this platform establishes a standard of financial simulation software unprecedented in collegiate competitions worldwide. Operating with 100% offline autonomy over local campus Wi-Fi, it features sub-millisecond server-authoritative liquidity execution, algorithmic Web Audio API DSP synthesis, automated circuit breaker halting, dual-buffer balance reconciliation, and real-time multi-terminal WebSocket synchronization without a single external cloud dependency.

---

## 2. KEY TOURNAMENT FEATURES
- **🏛️ Market Builder & Universe Manager**: Host controls which shares trade. Enable, disable, edit starting prices, duplicate shares, randomize prices ($\pm 10\%$), or apply 1-click presets without writing code.
- **⚡ Synchronized 3-2-1 Resume Countdown**: When the host unpauses, a dramatic 3-second visual countdown freezes orders until the exact opening bell chimes across all screens.
- **🚨 Automated Circuit Breakers**: Any stock moving $\ge 20\%$ from its day open reference price halts automatically with an institutional alarm, preventing runaway crashes.
- **📢 Breaking News Flashover**: Scheduled macro shocks and custom host breaking news alerts pop up across all trader screens with audio siren cues.
- **🏆 Grand Finale Winner Podium**: Synchronized podium ceremony celebrating 1st (Gold), 2nd (Silver), and 3rd (Bronze) teams with animated confetti and fanfare.
- **🔊 100% Offline Audio Synthesizer**: Programmatic Web Audio API sounds for opening bells, circuit alarms, sirens, and victory fanfare. Zero external MP3 files needed.
- **🛡️ Anti-Tamper & Security**: Authoritative server validation, 200ms order rate limiting, role-based access control, and formula injection protection in CSV exports.

---

## 3. INTERFACE PREVIEWS & LIVE ROLES
The application operates four coordinated experiences from a single server:

1. **Host Control Centre (`?role=host&pass=host2026`)**:
   - Master 4-Hub architecture:
     - **🏠 1. Home**: Next Step guidance card, interactive readiness checklist, connected terminals monitor, live audit feed.
     - **⚙️ 2. Event**: 6-step guided wizard (Details → Teams → Companies → Schedule → News Plan → Review & Lock) with automatic lock and pre-start unlock safeguard.
     - **📈 3. Live Market**: Single Market Operations Bar (Resume 3-2-1, Pause, Blackout, Conclude), stock boards, News Control Centre with 60-second privacy countdown, and live trade stream.
     - **🖥️ 4. Stage & Results**: Projector scene remote (Auto-Cycle / Fixed Screen), Winner Presentation remote, Venue Sound Console channel controls, audited reports, and Safe Championship Reset card.

2. **Student Trading Desk (`?role=trader&team=team1&pass=trade100`)**:
   - Stock cards with live tick prices, day open/high/low, and smooth Bezier sparklines.
   - Non-blocking institutional breaking news wire toast with 15-second animated progress bar.
   - 1-click Order Ticket with quantity presets and live fee/cash impact calculation.
   - Real-time portfolio valuation, cash balance, and executed trade receipts.

3. **Stage Auditorium Projector (`?role=projector&pass=screen2026`)**:
   - High-contrast auditorium display legible from 50 feet away in 1080p and 4K.
   - Auto-cycle rotation through Market Board, Real Indices (`NIFTY_TF20`, `BANK_TF`, `IT_TF`, `AUTO_TF`), Macro Sector Strategy, Standings, and News.
   - Embedded full-screen Winner Reveal stage (`Bronze → Silver → Champion → Podium → Standings`).

4. **Venue Sound Console (`?role=sound&pass=sound2026`)**:
   - Dedicated audio client for sound laptop plugged into auditorium PA speakers.
   - Role-isolated: strictly audio cue playback, zero administrative host privileges.
   - 1-click Host Audio Self-Test integration and 100% offline Web Audio API institutional synthesis.

---

## 4. SYSTEM REQUIREMENTS

### Host Computer (Server)
- **OS**: Windows 10/11, macOS, or Linux.
- **Software**: Node.js LTS (v18.x or v20.x recommended, minimum v16.0.0).
- **RAM**: Minimum 2 GB.
- **Network**: Wi-Fi adapter or Ethernet port connected to a local router or mobile hotspot.

### Student Client Devices
- Any laptop, PC, Chromebook, or tablet with a modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari, Brave).

---

## 5. ONE-TIME INSTALLATION INSTRUCTIONS (WINDOWS)

1. **Install Node.js** (if not already installed):
   - Download the LTS installer from [https://nodejs.org/](https://nodejs.org/).
   - Run the installer and accept all defaults.
2. **Download / Extract Repository**:
   - Download this repository as a ZIP and extract it to a folder (e.g. `C:\TheTradingFloor\`).
3. **That's it!** You are ready to launch.

---

## 6. EXACT COMMANDS & 1-CLICK LAUNCHERS

### Option A: The Easiest Way (1-Click Desktop Launcher)
Double-click **`Launch_The_Trading_Floor.bat`** in the repository root.
- Automatically verifies Node.js is installed.
- Automatically installs required dependencies (`npm install`) if missing.
- Detects your computer's local Wi-Fi IP address.
- Launches the server and automatically opens the Host Controller in your default web browser.

### Option B: Command Line (NPM Scripts)
Open Command Prompt or PowerShell in the project directory:
```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start the live championship server
npm start

# 3. Or start dry-run test mode (fictional mock companies)
npm run start:test

# 4. Run automated test suite
npm test
```

---

## 7. FINDING THE HOST LOCAL NETWORK (LAN) ADDRESS

`Launch_The_Trading_Floor.bat` prints your LAN address automatically on startup.

To find it manually on Windows:
1. Press `Win + R`, type `cmd`, and press Enter.
2. Type `ipconfig` and press Enter.
3. Look for **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g. `192.168.1.35`).

---

## 8. HOW TEAMS CONNECT VIA LAN / WI-FI

1. Connect the host computer and all student laptops to the **same Wi-Fi network** (or a phone hotspot).
2. Tell student teams to open Chrome or Edge and navigate to:
   ```
   http://<HOST_IP>:3000/
   ```
   *(Example: `http://192.168.1.35:3000/`)*
3. Teams log in using their assigned team credentials (e.g. Username: `team1` / Password: `trade100`).

---

## 9. HOW TO CONFIGURE A COMPETITION

1. Open the Host Controller (`http://localhost:3000/?role=host`).
2. Click **⚙️ Settings** in the top navigation bar.
3. Set your competition parameters:
   - **Championship Title**: e.g., *"National College Trading Fest 2026"*
   - **Trading Days**: Default 3 days (1 to 5).
   - **Day Duration**: Default 30 minutes (configurable from 5 to 60 minutes).
   - **Starting Cash**: Default ₹5,00,000 (configurable from ₹50,000 to ₹1,00,00,000).
   - **Circuit Breaker Limit**: Default 20% (bounds: 5% to 50%).
   - **Transaction Brokerage Fee**: Default 0 bps (bounds: 0 to 100 bps; 10 bps = 0.10%).
4. Click **Save & Broadcast Settings**. All connected terminals update immediately.

---

## 10. TEAM MANAGEMENT & CREDENTIAL SLIPS

1. In the Host Controller, click **👥 Teams Setup**.
2. **Quick Presets**: Click **4 Teams**, **8 Teams**, **12 Teams**, or **16 Teams** to instantly generate roster rows.
3. **Customize Roster**: Type actual college team names (e.g. *"IIM Bangalore Bulls"*, *"SRCC Titans"*) and participant member names.
4. **Print Credentials**: Click **Export CSV** to download `teams_roster.csv` containing usernames and passwords to print or hand out to teams.
5. Click **Apply & Save Roster**.

---

## 11. MARKET BUILDER & SHARE UNIVERSE MANAGER

Click the **🏛️ Market Builder (Share Universe)** subtab in the Host Controller:

- **Apply Curated Presets**:
  - **Balanced Market**: Diversified 6-company mix across IT, Banking, Energy, and Auto.
  - **High Volatility**: Fast-paced round with elevated volatility ($\sigma = 0.008$) and high news sensitivity ($\beta = 1.6$).
  - **Tech & Auto Focus**: Enables tech and auto blue-chips while disabling other sectors.
  - **Defensive & Value**: Slower, stable round focusing on Banking and FMCG.
  - **Enable All**: Activates all 12 registered companies.
- **Randomize Starting Prices**: Click **🎲 Randomize Prices (±10%)** to introduce new baseline prices so repeat rounds cannot be anticipated.
- **Toggle Stock Tradeability**: Click the **● Active in Market / ○ Disabled** badge on any row to instantly hide or reveal that stock from student trading desks.
- **Add New Company**: Click **+ Add New Company** to introduce campus sponsors, IPOs, or custom equities.
- **Export Universe**: Click **Export Universe (JSON)** or **Export Universe (CSV)** for faculty records.

---

## 12. RUNNING THE LIVE EVENT

```
Step 1: HOST clicks "▶ Resume (3-2-1)" ➔ 3-second countdown chimes ➔ Trading is LIVE
Step 2: Host injects breaking news shocks via "⚡ News Control Deck"
Step 3: If circuit breaker halts occur, Host inspects and clicks "Release Halt"
Step 4: At round end, Host clicks "⏭ Next Day" to advance Day 1 ➔ Day 2 ➔ Day 3
Step 5: At Day 3 finish, Host clicks "🏆 Crown Winners" ➔ Podium Ceremony activates
```

1. **Start / Resume**: Click **▶ Resume (3-2-1)**. The 3-second countdown prepares students, followed by institutional opening chimes.
2. **Pause**: Click **⏸ Pause** if instructions need to be given. Order execution freezes immediately.
3. **Breaking News**: Under **⚡ News Control Deck**, click **Trigger** on scheduled news or click **+ Create Breaking News** to draft a custom shock.
4. **Advancing Days**: Click **⏭ Next Day**. Today's prices lock as reference points, and the next day begins.
5. **Grand Finale**: Click **🏆 Crown Winners**. The synchronized podium modal appears across all student laptops and the projector screen with victory fanfare and confetti.

---

## 13. EXPORTING RESULTS & MARKSHEETS

Navigate to the **📥 Reports & CSV Exports** tab in the Host Controller:
- **📊 Final Standings (CSV)**: Complete ranking table with starting capital, cash balance, equity, net worth, and return %.
- **📝 Executed Trades Log (CSV)**: Every transaction executed by all teams with millisecond timestamps, prices, and fees.
- **🛡️ Audit Timeline (CSV)**: Chronological history of pauses, resumes, halts, news, and logins.
- **💾 Raw Audit Master (JSON)**: Complete uncompressed JSON audit ledger.

---

## 14. DISASTER RECOVERY CHECKPOINTS & INSTANT GAME RESTORE

The Trading Floor Championship 2026 features an institutional-grade disaster recovery and checkpoint system:

- **Automatic Checkpoints**: Every 120 seconds during live trading, the server saves an automated full-state snapshot (`checkpoint_DayX_..._auto.json`) in `data/checkpoints/`.
- **Manual Instant Checkpoint**: In the Host panel under **`🖥️ 4. Stage & Results`**, click **`💾 Save Instant Checkpoint Now`** to create an immediate recovery point.
- **One-Click Instant Restore**: Find any checkpoint in the table and click **`🔄 Restore`**. The server immediately loads the exact portfolio cash, holdings, trades, and stock prices.
- **Upload Backup File**: Click **`📂 Upload Backup File`** to load any `.json` backup file directly from your pen drive.
- **Safe Continuity Invariant**: Restoring keeps all student, projector, and sound windows connected (zero re-logins needed). The market safely restores in a **`PAUSED`** state so the host can click **`▶ Resume 3-2-1`** when ready!

---

## 15. JIOFIBER OFFLINE ROUTER EVENT CONFIGURATION

Using a standalone JioFiber router as an offline local Wi-Fi hub is the most reliable setup for college auditoriums:

1. **Factory Reset**: Hold the back reset pin for 15 seconds until lights blink.
2. **Admin Panel**: Connect via LAN/Wi-Fi to `http://192.168.29.1` (Username `admin`, Password `Jiocentrum`).
3. **Wi-Fi SSID & Password**: Name it `TheTradingFloor` (WPA2-PSK: `tradingfloor2026`). Keep 5 GHz enabled for zero radio interference.
4. **MANDATORY: Disable AP Isolation**: Ensure **AP Isolation / Client Isolation / Station Separation** is **DISABLED** so student laptops can connect to the host IP.
5. **Max Clients**: In DHCP settings, set Max Clients to **64** and lease time to 1 day (`86400`s).
6. **"No Internet" Prompt**: Because there is no yellow fiber cable plugged in at the college, laptops and smartphones will display *"Wi-Fi has no internet connection. Stay connected?"* — All teams **MUST click "Yes / Stay Connected"**.

---

## 16. HOW TO RESET A CHAMPIONSHIP SAFELY

To reset after practice rounds or start a fresh tournament:
1. In the Host Controller, go to **`🖥️ 4. Stage & Results`** -> scroll to **Safe Championship Reset Card**.
2. Type the confirmation phrase: **`RESET CHAMPIONSHIP`** (or `RESET`).
3. Click **💥 Reset Entire Championship**.
4. The server cleanly resets to Day 1 Standby, clears active trades and temporary timers, and sends a full-screen notification to all connected trader screens:
   *"The host has reset the competition. You have been logged out. Please wait for the host to set up a new event."*
5. All historical audit logs and finalized CSV reports in `logs/` are permanently preserved.

---

## 17. DEMONSTRATING TO HOD & FACULTY VIA WEB LINK

While the **actual event day operates 100% offline on a dedicated local Wi-Fi router / LAN**, you can demonstrate the complete system to college leadership (HOD, Dean, Faculty Coordinators) using any of the following browser-based methods:

### Method A: GitHub Pages Interactive Showcase (Recommended for WhatsApp/Email)
- **Live URL**: `https://ved-mangukiya.github.io/TheTradingFLoor/`
- **How it works**:
  - Automatically deployed on every `git push origin main` via GitHub Actions (`.github/workflows/deploy-pages.yml`).
  - When opened in any desktop or mobile browser without a local server, it activates the **Client-Side Interactive Showcase Engine**.
  - Includes **1-Click Demo Launchers** directly on the login screen:
    - `👑 Open Event Host Control Panel`
    - `📊 Open Big Screen Auditorium Projector`
    - `💻 Open Trader Desk (Team 1 • ₹10L Cash)`
  - Includes a floating top demo switcher bar (`✦ HOD PREVIEW • INTERACTIVE DEMO`) allowing seamless switching between Host, Projector, Trader, and Winner Stage views.
  - Realistic 2-second micro-ticks update all 20 Indian listed companies with live sparklines, order execution, breaking news toasts, and sound effects.

### Method B: Instant 10-Second Live Tunnel (`Create_Live_Demo_Link.bat`)
- Double-click **`Create_Live_Demo_Link.bat`** on your laptop.
- It starts the local server and generates an instant public HTTPS link (powered by Cloudflare Tunnel, e.g. `https://xxxx.trycloudflare.com`).
- Share this link with your HOD during a presentation so they can interact with your real running server from their own phone or laptop.

### Method C: 1-Click Free Cloud Server (`render.yaml`)
- The repository includes a `render.yaml` blueprint.
- Connect your GitHub repo to [Render.com](https://render.com) (Free tier) to host the full Node.js + WebSocket server online permanently (e.g. `https://thetradingfloor.onrender.com`).
- GitHub Pages can also connect to this cloud backend by passing `?server=wss://your-app.onrender.com`.

> **⚠️ EVENT DAY ASSURANCE**: None of these preview modes alter the local LAN architecture. On competition day, you simply run `Launch_The_Trading_Floor.bat` on the offline venue laptop. All student laptops connect over local Wi-Fi with 0 internet dependence.

---

## 18. ADVANCED DOCUMENTATION INDEX

All comprehensive system specifications are permanently version-controlled in the repository:

- [`AGENTS.md`](AGENTS.md) — Authoritative instructions for future AI coding agents.
- [`CHANGELOG.md`](CHANGELOG.md) — Chronological record of major releases, bug fixes, and features.
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Complete product vision and feature requirements.
- [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) — Step-by-step user journeys for Host, Traders, and Projector.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Technical architecture, WebSocket contracts, and audio synthesizer.
- [`docs/EVENT_LIFECYCLE.md`](docs/EVENT_LIFECYCLE.md) — Complete state machine, allowed transitions, and timers.
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) — Order execution, valuation, fees, circuit breakers, and scoring.
- [`docs/NEWS_ENGINE.md`](docs/NEWS_ENGINE.md) — Automated news plans, smoothstep engine, and 60s privacy countdown.
- [`docs/REAL_COMPANY_DATA.md`](docs/REAL_COMPANY_DATA.md) — 20 verified Indian listed NSE public companies catalogue.
- [`docs/MULTI_DAY_CHAMPIONSHIP.md`](docs/MULTI_DAY_CHAMPIONSHIP.md) — Multi-day event transitions and inter-day continuity.
- [`docs/DAILY_LEADERBOARD.md`](docs/DAILY_LEADERBOARD.md) — Daily vs cumulative championship standings formulas.
- [`docs/PROJECTOR_CYCLE.md`](docs/PROJECTOR_CYCLE.md) — Zero-scroll automatic stock board pagination, top movers, and winner reveal.
- [`docs/RESET_AND_RECOVERY.md`](docs/RESET_AND_RECOVERY.md) — Reset vs New Event vs Server Restart vs Checkpoint Restore.
- [`docs/MARKET_INDICES.md`](docs/MARKET_INDICES.md) — NIFTY_TF20 and sector benchmark index methodologies.
- [`docs/SECURITY.md`](docs/SECURITY.md) — LAN trust model, role-based access control, and sanitization.
- [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) — Runtime dependencies audit and zero-bloat philosophy.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — 48-scenario automated master test suite and manual QA matrix.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — Common operational issues, JioFiber tips, and fixes.
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) — Verified boundaries and workarounds.
- [`tasks/CURRENT_STATUS.md`](tasks/CURRENT_STATUS.md) — Verified implementation status and test logs.
- [`tasks/NEXT_SESSION.md`](tasks/NEXT_SESSION.md) — Future development roadmap and tasks.
