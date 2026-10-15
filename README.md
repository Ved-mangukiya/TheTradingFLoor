# THE TRADING FLOOR CHAMPIONSHIP 2026 📈
### Institutional-Grade Offline Stock Market Simulator for College Competitions

> **A Complete, Portable, 100% Offline Trading Platform**  
> Engineered specifically for collegiate business conclaves, finance festivals, and high-school investment challenges. Operates entirely over a local Wi-Fi router or campus LAN with **zero internet connection required**.

---

## TABLE OF CONTENTS
1. [What This Software Is](#1-what-this-software-is)
2. [Key Tournament Features](#2-key-tournament-features)
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
17. [Advanced Documentation Index](#17-advanced-documentation-index)

---

## 1. WHAT THIS SOFTWARE IS
**The Trading Floor Championship 2026** is a standalone, server-authoritative stock market exchange simulator. It turns any ordinary laptop into a high-speed institutional stock exchange that hosts dozens of competing student teams over local Wi-Fi. 

Participants trade real-time simulated blue-chip equities across Indian economic sectors (IT, Banking, Automotive, Energy, FMCG, Pharmaceuticals). Prices move organically using a mean-reverting geometric random walk model, responding to breaking economic news shocks, sector developments, and circuit breaker trading halts.

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
The application operates three coordinated interfaces from a single URL:

1. **Host Matrix Controller (`?role=host`)**:
   - Master controls: Start, Pause, Resume, Next Day, Crown Winners.
   - Tabs: Stock Engine & Halts, Market Builder, News Wire Deck, Live Standings, Real-Time Trades, Reports.
2. **Trader Team Desk (`?role=trader` or default `/`)**:
   - Stock cards with live tick prices, day open/high/low, and smooth Bezier sparklines.
   - 1-click Order Ticket modal with quantity presets (Max Buy, Max Sell, 1, 5, 10, 50, 100).
   - Real-time portfolio valuation, cash balance, and executed trade receipts.
3. **Stage Projector View (`?role=projector`)**:
   - High-contrast auditorium display legible from 50 feet away.
   - Top 5 live championship standings and 12-company ticker board.

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

## 14. BACKING UP AND RESTORING COMPETITION DATA

- **Live Snapshot API**: Visit `http://localhost:3000/api/backup?token=<HOST_TOKEN>` to download a complete tournament state snapshot.
- **Restoration API**: Send a `POST` request to `http://localhost:3000/api/restore` with the backup JSON to restore an interrupted tournament.
- **File Backups**: All active universe changes save automatically to `data/universe_active.json`. All audit records save to `logs/`.

---

## 15. TROUBLESHOOTING & COMMON ERRORS

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Node is not recognized"** | Node.js not installed | Download and install Node.js LTS from [nodejs.org](https://nodejs.org/). |
| **Port 3000 in use (`EADDRINUSE`)** | Another instance running | Close other CMD windows or run `npx kill-port 3000`. |
| **Student laptops cannot connect** | Windows Firewall or AP Isolation | Allow Node.js on Private Networks in Windows Firewall. If using campus Wi-Fi with client isolation, switch to a mobile phone hotspot. |
| **Orders rejected / Market frozen** | Market is paused | Click **▶ Resume (3-2-1)** in the Host Control Panel. |
| **Stock shows HALTED** | 20% Circuit Breaker hit | In **📈 Stock Engine & Halts**, click **Release Halt** next to the stock. |
| **No sound playing** | Browser autoplay policy | Click anywhere on the browser window once to allow Web Audio playback. |
| **Student closed browser tab** | Accidental closure | Reopen the browser and visit `http://<HOST_IP>:3000/`. Session token restores portfolio automatically. |

---

## 16. HOW TO RESET A PRACTICE ROUND SAFELY

To reset after a practice round:
1. In the Host Controller, click **🏛️ Market Builder** -> **↺ Reset to Baseline**.
2. Click **👥 Teams Setup** -> check **"Reset existing cash balances to Starting Cash"** -> click **Apply & Save Roster**.
3. All team cash balances return to ₹5,00,000, holdings clear to 0, and the trade counter resets cleanly.

---

## 17. ADVANCED DOCUMENTATION INDEX

All comprehensive system specifications are permanently version-controlled in the repository:

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Complete product vision and feature requirements.
- [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) — Step-by-step user journeys for Host, Traders, and Projector.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Technical architecture, WebSocket contracts, and audio synthesizer.
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) — Order execution, valuation, fees, circuit breakers, and scoring.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — Warm ivory luxury palette, typography, and UI tokens.
- [`docs/SHARE_MANAGEMENT.md`](docs/SHARE_MANAGEMENT.md) — Stock universe schema, presets, and price randomization.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — Complete TypeScript schemas for all entities.
- [`docs/SECURITY.md`](docs/SECURITY.md) — LAN trust model, role-based access control, and sanitization.
- [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) — Runtime dependencies audit and zero-bloat philosophy.
- [`docs/TOOLS.md`](docs/TOOLS.md) — Software prerequisites, launchers, and Git workflow.
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — 24-scenario test matrix and acceptance criteria.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — Common operational issues and fixes.
- [`docs/BACKUP_AND_RESTORE.md`](docs/BACKUP_AND_RESTORE.md) — Complete backup and restoration procedures.
- [`docs/SHARE_CONFIGURATION_GUIDE.md`](docs/SHARE_CONFIGURATION_GUIDE.md) — Practical guide for designing tournament rounds.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architectural decision records (ADRs).
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) — Verified boundaries and workarounds.
- [`docs/RESEARCH_LOG.md`](docs/RESEARCH_LOG.md) — Mathematical drift models and financial references.
- [`tasks/CURRENT_STATUS.md`](tasks/CURRENT_STATUS.md) — Verified implementation status.
- [`tasks/NEXT_SESSION.md`](tasks/NEXT_SESSION.md) — Future development roadmap and tasks.
