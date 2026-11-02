# THE TRADING FLOOR CHAMPIONSHIP — MASTER ARCHITECTURE & SPECIFICATION DOSSIER
========================================================================================
SINGLE SOURCE OF TRUTH: SYSTEM ARCHITECTURE, RULES, STATE MACHINES & DEFECT REGISTER
========================================================================================

> This master document combines all architectural constraints, business formulas, event lifecycles, 
> network protocols, and known boundaries into a single consolidated reference for deep AI analysis (Argon / Claude / Gemini).

---

# SECTION 1: CORE ARCHITECTURAL INVARIANTS (FROM AGENTS.MD)

# AGENTS.md — PERMANENT INSTRUCTIONS FOR AI DEVELOPMENT

> **AUTHORITATIVE REPOSITORY INSTRUCTION**: All future AI coding agents (Gemini, Claude, GPT, Antigravity, Cursor) working on **The Trading Floor Championship** MUST read and strictly adhere to this file and `README.md` before making any code modifications.

---

## 1. MANDATORY PROTOCOL BEFORE MODIFYING CODE

1. **Read Core Specifications First**:
   - `README.md` — The complete user manual and operational architecture.
   - `docs/PRODUCT_SPEC.md` — Core vision, simulation mechanics, and competition format.
   - `docs/USER_FLOWS.md` — Complete step-by-step journeys for Host, Traders, and Projector.
   - `docs/BUSINESS_RULES.md` — Order execution, valuation, fees, circuit breakers, and scoring formulas.
   - `docs/ARCHITECTURE.md` — Express backend, WebSocket protocol, client SPA, and offline engine.
   - `docs/DESIGN_SYSTEM.md` — Ivory luxury styling, palette, typography, and contrast rules.
   - `docs/SHARE_MANAGEMENT.md` — The dynamic share universe, templates, and active market builder.
   - `tasks/CURRENT_STATUS.md` & `tasks/NEXT_SESSION.md` — Current verified status and next tasks.

2. **Inspect the Real Working Code**:
   - Never assume previous sessions finished or left tasks in a working state without checking the actual filesystem.
   - Inspect `server.js`, `public/index.html`, `public/app.js`, and `data/` before proposing or generating changes.

3. **Preserve Established Working Invariants**:
   - **Offline-First Zero-CDN Invariant**: Local college LAN events often run with zero internet connection. All styling, SVG icons, fonts, and the Web Audio API institutional sound synthesizer MUST operate locally without remote CDN script or link tags.
   - **Authoritative Server Math**: All prices, orders, cash deductions, fee calculations, holdings, circuit breaker halts, and rankings are calculated and enforced strictly on the Node.js server. The client is a reactive view only.
   - **Rate Limiting & Anti-Spam**: A 200ms debounce per team session prevents double-click spam.
   - **Formula Injection Protection**: In all CSV exports, any value starting with `=`, `+`, `-`, or `@` is prepended with `'` to prevent spreadsheet formula execution.

---

## 2. STRICT OPERATIONAL RULES FOR AI AGENTS

1. **Never Claim a Feature Works Without Testing It**:
   - You MUST run `npm test` (or `node tests/test_unified_master_flow.js`) and `node -c` to verify changes.
   - Never report tests or features as "passing" or "complete" without executing them in the terminal.

2. **No Unnecessary Rewrites or Duplications**:
   - Do NOT rewrite working modules from scratch. Enhance, fix, and extend the existing codebase.
   - Do NOT add external dependencies (npm libraries) unless explicitly authorized and documented in `docs/DEPENDENCIES.md`. The project relies cleanly on `express` and `ws`.

3. **Maintain Backward Compatibility**:
   - Respect saved competition state in `data/universe_active.json` and `logs/`.
   - Dynamic holding alignment: When new shares are added or duplicated, initialize team holdings (`holdings[ticker] = 0`, `avgBuyPrice[ticker] = 0`) to prevent runtime `undefined` errors.

4. **Synchronize Documentation with Code**:
   - Whenever behavior, actions, or schemas change, update the relevant files in `docs/` and `tasks/`.
   - Be transparent: Disclose any known limitations, defects, or incomplete items in `tasks/NEXT_SESSION.md` and `docs/KNOWN_ISSUES.md`.

---

## 3. CORE ARCHITECTURAL INVARIANTS

1. **One Business Action = One Entry Point**: Never create duplicate buttons across tabs for the same action (e.g., pausing, resuming, resetting). Market operations reside canonically on the Live Market Operations Bar.
2. **Authoritative Server Math**: All prices, orders, cash deductions, fee calculations, holdings, circuit breaker halts, and rankings are calculated and enforced strictly on the Node.js server. The client is a reactive view only.
3. **Disaster Recovery & Safe Checkpoint Restoring**: State restorations (crash recovery or manual checkpoint restore) MUST ALWAYS initialize `gameState.isPaused = true` so the market waits safely for the Host to hit `▶ Resume 3-2-1`.
4. **Projector Zero-Scroll Pagination**: The stock board divides into readable pages (default 8 per page, $4 \times 2$ grid) rotating every 8s. Cards on the active page update in-place without resetting rotation timers. Top Gainer and Top Loser spotlight cards evaluate across all active companies and stay permanently visible.
5. **News Secrecy & 60-Second Reveal**: News impacts are masked by default (`[🔒 Private Price Impact Details Hidden]`). When revealed by the host, they automatically hide after 60s or upon tab navigation. Trader and projector terminals NEVER receive private impact percentages.
6. **Rate Limiting & Anti-Spam**: A 200ms debounce per team session prevents double-click spam.
7. **Formula Injection Protection**: In all CSV exports, any value starting with `=`, `+`, `-`, or `@` is prepended with `'` to prevent spreadsheet formula execution.
8. **Directional Circuit Breakers & Stock Isolation**: Upper circuit (+20%) restricts BUY and permits SELL; Lower circuit (-20%) restricts SELL and permits BUY; counter-directional order flow injects recovery liquidity; background price loop requires 0.8% buffer before mean-reversion unhalt. A stock-level halt NEVER freezes the wider market.
9. **Explicit Day State Machine**: Day conclusion sets `status = 'DAY_COMPLETED'`, shows `#traderDayCompletedOverlay` and `#projDayCompletedBanner` with audited daily snapshot, and never displays ambiguous "Paused by Host" banners. Balances and holdings carry over into subsequent days.

---

## 4. COMMON PITFALLS & GOTCHAS

- **Order Debounce Timing in Tests**: In automated WebSocket testing scripts, always add an artificial delay (`await new Promise(r => setTimeout(r, 250))`) between consecutive orders from the same session to respect the 200ms server debounce.
- **Enabled Stocks Filtering**: Traders and projectors only receive stocks where `isEnabled !== false`. Hosts receive `allCompaniesUniverse` so they can manage disabled/excluded stocks.
- **Projector DOM Stability**: Do NOT rebuild projector card DOM nodes on every tick. Rebuilding destroys canvas contexts and causes visual flickering. Only rebuild when the page flips or when active tickers change.
- **Batch Files & Non-Technical Users**: The primary users are college professors, organizers, and student coordinators. Launchers (`Launch_The_Trading_Floor.bat`) must provide clear, human-readable terminal output, auto-detect `%~dp0tools\node.exe`, and support zero-config startup.
- **Full Verification Before Commits**: Always run `npm run test:all` (or `npm test`) to ensure all 85 test scenarios pass before reporting work as complete.


---

# SECTION 2: SYSTEM USER MANUAL & REPOSITORY MAP (FROM README.MD)

# THE TRADING FLOOR CHAMPIONSHIP 📈
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
**The Trading Floor Championship** is a standalone, server-authoritative stock market exchange simulator. It turns any ordinary laptop into a high-speed institutional stock exchange that hosts dozens of competing student teams over local Wi-Fi. 

Participants trade real-time simulated blue-chip equities across Indian economic sectors (IT, Banking, Automotive, Energy, FMCG, Pharmaceuticals). Prices move organically using a mean-reverting geometric random walk model, responding to breaking economic news shocks, sector developments, and circuit breaker trading halts.

---

## 👨‍💻 LEAD DEVELOPER & SYSTEM ARCHITECT

### **Ved Mangukiya**
**Lead Developer, Chief System Architect & Sole Creator**  
*Pursuing Bachelor of Business Administration (BBA) • Gujarat Technological University • Surat, Gujarat, India*

> **Architectural Statement**: Independently conceived, architected, and coded from the ground up by **Ved Mangukiya**, this platform establishes a standard of financial simulation software unprecedented in collegiate competitions worldwide. Operating with 100% offline autonomy over local campus Wi-Fi, it features sub-millisecond server-authoritative liquidity execution, algorithmic Web Audio API DSP synthesis, automated circuit breaker halting, dual-buffer balance reconciliation, and real-time multi-terminal WebSocket synchronization without a single external cloud dependency.

---

## 2. KEY TOURNAMENT FEATURES
- **🃏 Paper Trading Cards UX**: Structured information hierarchy inspired by institutional trading cards: distinct identity, live price delta, Day Open reference, position unrealized P&L badges (`+₹Z (+W%)`), embedded quick lot steppers (`+5`, `-5`), and dedicated `Trade` buttons.
- **🔍 Advanced Universe Filtering**: Live search box, clickable dynamic sector chips (`#traderSectorChips`), multi-metric sorter (Gainers, Losers, Price High/Low, Highest Value), and "Holdings Only" filter toggle.
- **🧮 Interactive Trade Modal & Affordability Engine**: Tabbed BUY/SELL switcher, stepper controls, quick lot pills (`+1`..`+100`), budget/holding preset pills (`25%`, `50%`, `75%`, `Max` / `All`), live fee & remaining cash calculation, and educational balance validation shortfalls.
- **🚨 Directional Upper & Lower Circuit Breakers**: Upper circuit (+20%) clamps price, blocks BUY, and permits SELL; Lower circuit (-20%) clamps price, blocks SELL, and permits BUY. Counter-directional order flow injects recovery liquidity; 0.8% drift buffer prevents micro-noise unhalts; strict stock isolation keeps other stocks trading. Immutable $P_{\text{day\_open}}$ reference guarantees integrity.
- **📅 Explicit Day 1 ➔ Day 2 Lifecycle State Machine**: Concluded days enter `DAY_COMPLETED` (distinct from `PAUSED`), displaying high-visibility `#traderDayCompletedOverlay` and `#projDayCompletedBanner` with audited daily leaderboard snapshot; Host primary action opens "Start Day 2" modal directly; balances carry over cleanly. Explicit Host finalization required to conclude tournament.
- **🖥️ Classroom 4:3 Projector Native Layouts**: Specialized aspect-ratio detection (`@media (min-aspect-ratio: 4/3)`) tailored for standard Indian college auditorium projectors (`1024×768` and `800×600`). Native $4 \times 2$ (8 cards) and $3 \times 2$ (6 cards) grids with distance-scaled typography and safe viewing margins.
- **📱 Mobile-First & Tablet Responsive Suite**: Full responsive touch layouts for mobile phone traders (320px–640px) with single-column cards, full-screen order entry modals, and $\ge 44\text{px}$ touch targets.
- **⌨️ Keyboard Shortcuts & Help Modal**: Global `?` key opens the Keyboard Shortcuts Help Modal. Host controls (`Ctrl+Space`, `Ctrl+S`, `Ctrl+D`), Projector controls (`F`, `L`), and Trader order controls (`Enter`, `↑`/`↓`, `Esc`).
- **🔒 RFC 4122 Cryptographic Trade UUIDs**: 128-bit collision-proof `crypto.randomUUID()` trade identifiers with sequential sequence counters for audit clarity.
- **🏛️ Market Builder & Universe Manager**: Host controls which shares trade. Enable, disable, edit starting prices, duplicate shares, randomize prices ($\pm 10\%$), or apply 1-click presets without writing code.
- **⚡ Synchronized 3-2-1 Resume Countdown**: When the host unpauses, a dramatic 3-second visual countdown freezes orders until the exact opening bell chimes across all screens.
- **📢 Breaking News Flashover**: Scheduled macro shocks and custom host breaking news alerts pop up across all trader screens with audio siren cues and 60-second private impact reveal.
- **🏆 Grand Finale Winner Podium**: Synchronized podium ceremony celebrating 1st (Gold), 2nd (Silver), and 3rd (Bronze) teams with animated confetti, screen rumbling, and victory fanfare.
- **🔊 100% Offline Audio Synthesizer**: Programmatic Web Audio API sounds for opening bells, circuit alarms, sirens, and victory fanfare. Zero external MP3 files needed.
- **🛡️ Anti-Tamper & Security**: Authoritative server validation, 200ms order rate limiting, role-based access control with `requireHostAuth` on financial analytics, and formula injection protection in CSV exports.
- **🧪 100% Verified Automated Regression Suite**: Complete end-to-end regression across all stages verified by automated master test suite.

---

### ⌨️ KEYBOARD SHORTCUTS REFERENCE

| Key Shortcut | Role / Context | Action Performed |
| :--- | :--- | :--- |
| <kbd>?</kbd> (Shift + /) | **All Terminals** | Open Interactive Keyboard Shortcuts Help Modal |
| <kbd>Esc</kbd> | **All Terminals** | Close active modal / Exit Projector Terminal |
| <kbd>Enter</kbd> | **Trader Terminal** | Execute Trade (when Trade Modal is open) |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Trader Terminal** | Increase / Decrease Share Quantity |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | **Host Panel** | Pause / Resume Live Market |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | **Host Panel** | Save Instant Named Checkpoint |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | **Host Panel** | Advance to Next Day (when Day is Concluded) |
| <kbd>F</kbd> | **Projector View** | Toggle Fullscreen Mode |
| <kbd>L</kbd> | **Projector View** | Lock / Unlock Projector Terminal Screen |

---

## 3. INTERFACE PREVIEWS & LIVE ROLES
The application operates four coordinated experiences from a single server:

1. **Host Control Centre (`?role=host&pass=host`)**:
   - Master 4-Hub architecture:
     - **🏠 1. Home**: Next Step guidance card, interactive readiness checklist, connected terminals monitor, live audit feed.
     - **⚙️ 2. Event**: 8-step guided wizard (Details → Teams → Companies → Trading Rules → Schedule → News Plan → Projector & Sound → Review & Lock) with automatic lock and pre-start unlock safeguard.
     - **📈 3. Live Market**: Single Market Operations Bar (Resume 3-2-1, Pause, Blackout, Conclude Day, Add Day, Emergency Stop), stock boards, News Control Centre with 60-second privacy countdown, and live trade stream.
     - **🖥️ 4. Stage & Results**: Projector scene remote (Auto-Cycle / Fixed Screen), Team Investment Analytics, Winner Presentation remote, Venue Sound Console channel controls, audited reports, and Safe Championship Reset card.

2. **Student Trading Desk (`?role=trader&team=team1&pass=trade100`)**:
   - Upgraded stock cards with live tick prices, day open/high/low, live sparklines, and active position P&L badges (`+₹Z (+W%)`).
   - Dynamic universe filters: live search, sector dropdown, quick sector chips, multi-metric sorter, and "Holdings Only" checkbox.
   - Non-blocking institutional breaking news wire toast with 15-second animated progress bar.
   - Interactive Trade Modal with tabbed BUY/SELL switcher, quick lot pills, dynamic budget presets (`% cash` / `% held`), and real-time affordability recalculation.
   - Real-time portfolio valuation, cash balance, and executed trade receipts.

3. **Stage Auditorium Projector (`?role=projector&pass=screen`)**:
   - High-contrast auditorium display legible from 50 feet away in 1080p and 4K.
   - Auto-cycle rotation through Market Board (8 cards per page with live ranking badges `#1..#N`), Real Indices (`NIFTY_TF20`, `BANK_TF`, `IT_TF`, `AUTO_TF`), Macro Sector Strategy, Standings, and News.
   - Dedicated `#projDayCompletedBanner` on day conclusion presenting audited daily snapshot without "Market Paused" confusion.
   - Embedded full-screen Winner Reveal stage (`Bronze → Silver → Champion → Podium → Standings`).

4. **Venue Sound Console (`?role=sound&pass=sound`)**:
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

# 4. Run primary automated test suite (52 tests)
npm test

# 5. Run complete 85-scenario regression suite across all 3 suites
npm run test:all

# 6. Run targeted trading cards, filters & circuit breakers suite (24 tests)
npm run test:cards
```

---

## 7. FINDING THE HOST LOCAL NETWORK (LAN) ADDRESS

`Launch_The_Trading_Floor.bat` prints your LAN address automatically on startup.

To find it manually on Windows:
1. Press `Win + R`, type `cmd`, and press Enter.
2. Type `ipconfig` and press Enter.
3. Look for **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g. `192.168.1.35`).

---

## 8. AUTHORITATIVE EVENT LIFECYCLE & WORKFLOW

The championship operates under a strict, authoritative 8-phase operational lifecycle:

```
Server Starts ──> Host Logs In ──> Guided Event Setup Centre ──> Host Configures (16 Teams & Stocks)
                                                                            │
Competition Starts <── Host Panel Activates <── Teams Log In <── Host Confirms & Locks Setup
```

1. **Server Starts**: Node.js boots in `SETUP` mode (`configLocked = false`).
2. **Host Logs In**: When the host logs in, the full Live Host Panel is **not** immediately displayed. Instead, the Host is guided directly into the **Event Setup Centre** (`#eventSetupView`).
3. **Event Setup Configuration**:
   - **Step 1: Event Details & Rules**: Championship title, host university, starting capital (₹1L to ₹10L), competition duration, transaction brokerage fee, and circuit breaker limit (±20%).
   - **Step 2: 16 Teams Roster & Passwords**: Fixed 16-desk capacity. Host can customize team names, student members, generate random 6-digit PINs, reset standard credentials (`trade100`..`trade1600`), copy all 16 credentials to clipboard with 1 click, or download `TheTradingFloor_16_Team_Credentials.csv`.
   - **Step 3: Stock Selection Catalogue**: Searchable catalogue of 20 verified real National Stock Exchange of India (NSE) corporate equities with sector filter pills, search bar, and 1-click presets (`All 20 NSE Stocks`, `Top 12 Diverse Mix`, `Top 8 Mega-Caps`). A minimum of 4 stocks is enforced.
   - **Step 4: Journalistic News Timeline**: Multi-day educational financial news events automatically generated and scheduled based on the selected stocks.
   - **Step 5: Review & Final Lock**: Summary verification tiles and authoritative lock confirmation.
4. **Team Login Gating (Pre-Lock Security)**:
   - **Before setup is confirmed and locked, team logins are strictly rejected by the server**:
     `"The host is preparing the event. Team login will open once setup is complete."`
   - The login screen dynamically shows an **Event Setup in Progress** status banner with live progress details.
5. **Host Confirms & Locks Setup**:
   - The Host reviews the configuration and confirms via the authoritative lock modal.
   - The server validates the setup (title, 16 teams, $\ge 4$ stocks), hashes/activates the 16 team accounts, provisions starting cash, freezes the active stock universe, locks state (`configLocked = true`, `status = 'STANDBY'`), and broadcasts `EVENT_CONFIG_LOCKED`.
6. **Team Credentials & Login Open**:
   - The login screen status banner instantly switches to **🟢 COMPETITION READY • LOGINS OPEN**.
   - All 16 team terminals can now authenticate and access strictly their own isolated portfolio, orders, and cash.
7. **Host Panel Fully Activates**:
   - Only after setup is validated and locked does the full **Live Host Operations Command Centre** become available to the host.
8. **Competition Starts & Live Floor Operations**:
   - The Host initiates trading via `▶ Resume 3-2-1` or schedules the event.
   - Resetting the championship purges old trader sessions with `SESSION_EXPIRED`, unlocks setup, and returns the Host to a clean Event Setup Centre.

---

## 9. HOW TEAMS CONNECT VIA LAN / WI-FI

1. Connect the host computer and all student laptops to the **same Wi-Fi network** (or a local LAN router / phone hotspot).
2. Tell student teams to open Chrome, Edge, or Safari and navigate to:
   ```
   http://<HOST_IP>:3000/
   ```
   *(Example: `http://192.168.1.35:3000/`)*
3. Once the host confirms and locks event setup, teams log in using their assigned team credentials (e.g. Username: `team1` / Password: `trade100` or direct link `http://<HOST_IP>:3000/?team=team1&pass=trade100`).

---

## 10. STOCK SELECTION CATALOGUE & PRESETS

Under Step 3 of the Event Setup Centre, the host selects which verified equities trade during the championship:

- **Catalogue Search & Sector Filtering**: Instant search across 20 verified NSE equities by ticker, corporate name, or sector (Banking, IT, Auto, Energy, Metals, FMCG, Pharma, Conglomerate).
- **Curated 1-Click Presets**:
  - **All 20 NSE Stocks**: Comprehensive institutional market.
  - **Top 12 Diverse Mix**: Curated cross-sector basket across Reliance, TCS, HDFC Bank, Tata Motors, L&T, Infosys, ICICI Bank, ITC, Bajaj Finance, Bharti Airtel, Sun Pharma, and Titan.
  - **Top 8 Mega-Caps**: Focus round on the largest blue-chips by market capitalization.
  - **Deselect All**: Resets to minimum required 4 stocks for custom selection.
- **Stock Universe Immutability**: Once setup is locked, the selected stock universe remains fixed throughout the competition to ensure audited academic integrity.

---

## 11. RUNNING THE LIVE EVENT

```
Step 1: HOST clicks "▶ Resume (3-2-1)" ➔ 3-second synchronized countdown chimes ➔ Trading is LIVE
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

The Trading Floor Championship features an institutional-grade disaster recovery and checkpoint system:

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
3. **Wi-Fi SSID & Password**: Name it `TheTradingFloor` (WPA2-PSK: `tradingfloor`). Keep 5 GHz enabled for zero radio interference.
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

### Method B: Instant 10-Second Live Tunnel (`Launch_The_Trading_Floor.bat`)
- Double-click **`Launch_The_Trading_Floor.bat`** on your laptop.
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


---

# SECTION 3: PRODUCT SPECIFICATIONS & CHAMPIONSHIP MECHANICS

# PRODUCT SPECIFICATION — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Executive Summary & Vision
**The Trading Floor Championship 2026** is an institutional-grade, real-time stock market simulation platform engineered specifically for collegiate competitions, business school conclaves, and finance festivals. 

Operating on a local area network (LAN) with zero external internet dependencies, it bridges the gap between theoretical classroom finance and fast-paced trading floor execution. The system provides an authentic simulation of the Indian stock market (BSE/NSE mechanics), featuring 20 blue-chip Indian equities across major economic sectors, dynamic order book execution, directional circuit breaker halts, macroeconomic news shocks, and automated audited performance rankings.

---

## 2. Target Audience & Roles
The application natively serves four distinct user roles within a single lightweight architecture:

### 2.1 Host / Competition Director (`ROLE_HOST`)
- **Profile**: Faculty coordinators, student competition organizers, and event administrators.
- **Objectives**: Complete oversight and absolute control of the simulation.
- **Capabilities**:
  - Live start, pause (with 3-2-1 countdown), day conclusion, and day advancement controls.
  - Real-time share universe management (curate active stocks, modify volatility/beta, toggle tradeability).
  - Breaking news wire broadcast (trigger scheduled shocks or draft custom breaking alerts with 60s private impact reveal).
  - Directional circuit breaker overrides and manual halt releases.
  - Dynamic team roster setup ($N \ge 1$), credentials management, starting cash configuration, and transaction fee controls.
  - Team investment analytics view with segmented asset allocation bars.
  - Download audited reports (standings CSV, trades log CSV, audit timeline CSV, raw JSON ledger).
  - Grand Finale winner podium ceremony activation.

### 2.2 Trader Teams (`ROLE_TRADER`)
- **Profile**: Student teams (dynamic capacity: Solo, 2, 4, 8, 16, or Custom $N \ge 1$ teams).
- **Objectives**: Maximize portfolio net worth and percentage return over tournament days.
- **Capabilities**:
  - Paper Trading Cards UX: Clean visual hierarchy with sector pills, day open references, live sparklines, and active position unrealized P&L badges (`+₹Z (+W%)`).
  - Advanced Universe Filters: Live search, dynamic sector chips (`#traderSectorChips`), multi-metric sorter (Gainers, Losers, Price High/Low, Highest Value), and "Holdings Only" filter.
  - Interactive Trade Modal: Tabbed BUY/SELL switcher, stepper controls, quick lot pills (`+1`..`+100`), dynamic budget presets (`25%`, `50%`, `75%`, `Max` cash / `All` held shares), and live affordability recalculation with educational shortfall alerts.
  - Live portfolio valuation, cash balance tracking, and realized P&L calculations.
  - Order history log with authoritative server timestamps and transaction fee receipts.
  - Breaking news toast banner with 15-second progress bar and audio cues.

### 2.3 Stage Projector / Spectator (`ROLE_PROJECTOR`)
- **Profile**: Public auditorium projector screens, audience displays, and live broadcast monitors.
- **Objectives**: Maximize stage excitement, tension, and spectator engagement.
- **Capabilities**:
  - High-visibility full-screen view (clean ivory luxury palette, high contrast, legible from 50 feet away).
  - Zero-scroll stock board pagination (8 cards per page in $4 \times 2$ grid, auto-rotating every 8s, with live rankings `#1..#N`).
  - Spotlight Bar: Permanently visible Top Percentage Gainer and Top Percentage Loser cards.
  - Benchmark and sector indices (`NIFTY_TF20`, `BANK_TF`, `IT_TF`, `AUTO_TF`) with flex-wrap zero horizontal scroll.
  - Dedicated `#projDayCompletedBanner` on day conclusion with audited daily rankings snapshot.
  - Synchronized grand finale podium ceremony with animated confetti, screen rumbling, and trophy fanfare.

### 2.4 Venue Sound Console (`ROLE_SOUND`)
- **Profile**: Dedicated audio laptop plugged into auditorium PA system.
- **Capabilities**: Real-time Web Audio API procedural synthesis of opening bells, closing bells, sirens, tension drumrolls, and victory fanfares.

---

## 3. Tournament Structure & Mechanics

### 3.1 Event Schedule & Days
- **Standard Format**: 3 Trading Days (Day 1, Day 2, Day 3).
- **Day Duration**: Default 30 minutes (1800 seconds) per day, configurable from 5 to 60 minutes.
- **Tick Interval**: Authoritative price update broadcast every 1.5 seconds (1500ms).
- **Inter-Day Reset**: Advancing to the next day archives current prices as previous close (`previousClosePrice`), resets day open/high/low reference points, clears temporary circuit breaker halts, and begins a fresh trading day.

### 3.2 Virtual Capital & Accounting
- **Starting Cash**: Default ₹5,00,000 (configurable from ₹50,000 to ₹1,00,00,000).
- **Transaction Brokerage**: Configurable from 0 to 100 basis points (default: 0 bps). Deducted on both buy and sell orders.
- **Valuation Formula**:
  $$\text{Net Worth} = \text{Available Cash} + \sum (\text{Holdings}_i \times \text{Current Price}_i)$$
  $$\text{Return \%} = \left(\frac{\text{Net Worth} - \text{Starting Capital}}{\text{Starting Capital}}\right) \times 100$$
- **Winner Determination**: Highest verified Net Worth at the conclusion of Day 3. In the event of a tie, the team with lower transaction count (higher capital efficiency) takes precedence.

---

## 4. Key Quality & Architectural Invariants
1. **100% Offline-First (Zero External CDN)**: No reliance on Google Fonts, external CDN scripts, or remote MP3 files. Fonts rely on local system fallbacks; audio is generated using Web Audio API synthesis.
2. **Authoritative Server Architecture**: All trade math, balances, order validation, and circuit breakers reside strictly on the server. The client cannot spoof trades, prices, or balances.
3. **Anti-Tamper Audit Logging**: Every trade, pause, halt, and news shock is timestamped to the millisecond and persisted in `logs/` for faculty verification.


---

# SECTION 4: AUTHORITATIVE BUSINESS RULES & MATHEMATICAL ENGINE

# BUSINESS RULES & TRADING LOGIC — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Capital Accounting & Order Execution Rules

### 1.1 Buy Order Execution
- **Pre-Conditions**:
  1. Market must be ACTIVE (`isPaused === false`, `isConcluded === false`).
  2. Target stock must be ENABLED (`isEnabled !== false`) in the active market universe.
  3. Target stock must NOT be halted (`isHalted === false`).
  4. Requested share quantity $Q > 0$ and $Q \le 1,000,000$.
  5. Required total funds must not exceed team available cash:
     $$\text{Gross Value} = Q \times P_{\text{current}}$$
     $$\text{Fee} = \text{round}\left(\frac{\text{Gross Value} \times \text{FeeBps}}{10000}, 2\right)$$
     $$\text{Required Cash} = \text{Gross Value} + \text{Fee} \le \text{Team Cash}$$
- **Post-Execution State Updates**:
  1. $\text{Team Cash}_{\text{new}} = \text{Team Cash}_{\text{old}} - (\text{Gross Value} + \text{Fee})$
  2. $\text{Holdings}_{\text{new}} = \text{Holdings}_{\text{old}} + Q$
  3. **Weighted Average Cost Basis (Average Buy Price)**:
     $$\bar{P}_{\text{new}} = \frac{(\text{Holdings}_{\text{old}} \times \bar{P}_{\text{old}}) + (Q \times P_{\text{current}})}{\text{Holdings}_{\text{new}}}$$
  4. Trade count incremented by 1.

### 1.2 Sell Order Execution
- **Pre-Conditions**:
  1. Market must be ACTIVE.
  2. Target stock must be ENABLED in the universe.
  3. Target stock must NOT be halted.
  4. Team must possess sufficient share quantity:
     $$Q \le \text{Team Holdings}[T]$$
- **Post-Execution State Updates**:
  1. $\text{Gross Value} = Q \times P_{\text{current}}$
  2. $\text{Fee} = \text{round}\left(\frac{\text{Gross Value} \times \text{FeeBps}}{10000}, 2\right)$
  3. $\text{Net Credit} = \text{Gross Value} - \text{Fee}$
  4. $\text{Team Cash}_{\text{new}} = \text{Team Cash}_{\text{old}} + \text{Net Credit}$
  5. $\text{Holdings}_{\text{new}} = \text{Holdings}_{\text{old}} - Q$
  6. **Realized Profit / Loss**:
     $$\text{Profit on Sold} = Q \times (P_{\text{current}} - \bar{P}_{\text{old}})$$
     $$\text{Realized P&L}_{\text{new}} = \text{Realized P&L}_{\text{old}} + \text{Profit on Sold} - \text{Fee}$$
  7. If $\text{Holdings}_{\text{new}} == 0$, reset $\bar{P} = 0$.

### 1.3 Dynamic Order-Flow Market Impact (Supply / Demand Liquidity Pressure)
To reflect realistic institutional market micro-structure without lagging the server, executed orders dynamically adjust the underlying asset price:
$$\text{Gross Trade Value} = Q \times P_{\text{current}}$$
$$\Delta P_{\text{raw}} = \text{Gross Trade Value} \times 0.000002$$
$$\Delta P_{\text{clamped}} = \min(\Delta P_{\text{raw}}, P_{\text{current}} \times 0.008)$$

- **Buy Orders (Demand Injection)**:
  $$P_{\text{new}} = P_{\text{current}} + \Delta P_{\text{clamped}}$$
- **Sell Orders (Supply Dumping)**:
  $$P_{\text{new}} = \max(1.0, P_{\text{current}} - \Delta P_{\text{clamped}})$$

This ensures large institutional block orders create realistic upward pressure on buys and downward pressure on sells (capped at $\pm 0.8\%$ per single trade), while high-frequency retail orders produce organic micro-fluctuations.

### 1.4 Liquidate All (Full Portfolio Liquidation to 100% Cash)
- **Pre-Conditions**:
  1. Market must be ACTIVE (`isPaused === false`, `isConcluded === false`).
  2. Team must hold at least 1 active share ($Q > 0$) across active companies. If portfolio is already 100% cash, rejected with: `💼 No active holdings to sell: Your portfolio already holds 100% Cash in Hand.`
  3. 200ms anti-spam order rate limit enforced.
- **Execution Rules**:
  1. Iterates over all active holdings.
  2. If a stock is halted by a circuit breaker (`isHalted === true`), it is skipped and reported in `skippedHalted` so illegal trades are never executed on frozen shares.
  3. Every tradeable held position is liquidated at current market price $P_{\text{current}}$.
  4. Realized P&L and brokerage fees are calculated and applied atomically.
  5. Holdings and average buy price are reset to 0.
  6. Emits `PORTFOLIO_LIQUIDATED` event with total cash received, fees paid, and individual trade records.
  7. Triggers `portfolio_liquidated` institutional sound cue on trader terminal.

## 2. Valuation & Performance Scoring

### 2.1 Total Portfolio Net Worth
$$\text{Equity Value} = \sum_{i=1}^{N} \left(\text{Holdings}_i \times P_{i,\text{current}}\right)$$
$$\text{Net Worth} = \text{Available Cash} + \text{Equity Value}$$

### 2.2 Unrealized P&L per Position
$$\text{Unrealized P&L}_i = \text{Holdings}_i \times (P_{i,\text{current}} - \bar{P}_i)$$

### 2.3 Percentage Return on Capital
$$\text{Return \%} = \left(\frac{\text{Net Worth} - \text{Starting Capital}}{\text{Starting Capital}}\right) \times 100$$

### 2.4 Championship Ranking & Deterministic Tie-Breaker
Teams are ranked strictly by:
1. **Primary Sort**: Total Net Worth (Descending).
2. **Secondary Tie-Breaker**: Total Trade Count (Ascending) — favoring higher capital efficiency and disciplined execution.
3. **Tertiary Tie-Breaker**: Team Registration Sequence.

---

## 3. Circuit Breaker Rules & Directional Order Gating

### 3.1 Trigger Conditions & Mathematical Limits
On each 1000ms price loop tick, every stock's price is evaluated against its official **Day Open Reference Price** ($P_{\text{day\_open}}$):
$$\Delta P = \frac{P_{\text{current}} - P_{\text{day\_open}}}{P_{\text{day\_open}}} \times 100$$
$$\text{Upper Limit} = \text{round}\left(P_{\text{day\_open}} \times \left(1 + \frac{\text{CircuitBreakerPercent}}{100}\right), 2\right)$$
$$\text{Lower Limit} = \text{round}\left(P_{\text{day\_open}} \times \left(1 - \frac{\text{CircuitBreakerPercent}}{100}\right), 2\right)$$

If $P_{\text{current}} \ge \text{Upper Limit}$ or $P_{\text{current}} \le \text{Lower Limit}$:
1. Stock trading status is flagged `isHalted = true`.
2. Direction is recorded: `haltDirection = 'UPPER'` or `'LOWER'`.
3. Price is clamped strictly at the boundary ($\text{Upper Limit}$ or $\text{Lower Limit}$).
4. An institutional circuit breaker alarm chimes on all connected clients (`circuit_alarm`).
5. An authoritative audit event (`CIRCUIT_BREAKER`) is recorded in the immutable audit log.
6. Emits `CIRCUIT_BREAKER_ALERT` WebSocket event to update all client badges in real-time.
7. **Strict Stock Isolation**: The circuit halt applies exclusively to the affected stock. All other active universe equities continue trading normally, and the overall market clock continues ticking.

### 3.2 Directional Order Enforcement Rules
- **At UPPER Circuit Ceiling**:
  - **BUY Orders**: Rejected by server with educational message:
    `"Upper circuit ceiling reached (₹{PRICE}). Buying is restricted under market rules. Selling is permitted."`
  - **SELL Orders**: Permitted and executed normally, providing downward liquidity and allowing traders to exit long positions.
- **At LOWER Circuit Floor**:
  - **SELL Orders**: Rejected by server with educational message:
    `"Lower circuit floor reached (₹{PRICE}). Selling is restricted under market rules. Buying is permitted."`
  - **BUY Orders**: Permitted and executed normally, providing upward liquidity and allowing traders to accumulate undervalued shares.

### 3.3 Halt Release & Circuit Recovery Mechanics
A circuit halt can be released via three authoritative pathways:
1. **Order-Flow Market Impact Recovery**:
   - A executed SELL order on an UPPER-halted stock introduces selling pressure ($P_{\text{new}} < \text{Upper Limit}$), immediately triggering `releaseCircuitBreaker(stock)`.
   - A executed BUY order on a LOWER-halted stock introduces buying pressure ($P_{\text{new}} > \text{Lower Limit}$), immediately triggering `releaseCircuitBreaker(stock)`.
2. **Mean-Reversion Background Drift Buffer (0.8%)**:
   - Background random price drift is clamped at the limit and requires a minimum 0.8% movement away from the ceiling ($P_{\text{current}} \le \text{Upper Limit} - 0.008 \times P_{\text{day\_open}}$) or floor ($P_{\text{current}} \ge \text{Lower Limit} + 0.008 \times P_{\text{day\_open}}$) before triggering release. This permanently prevents premature unhalting caused by micro-noise.
3. **Host Manual Release**:
   - Host can click **Release Halt** in the Host Control Panel, setting `isHalted = false` and `haltDirection = null` to immediately restore unconstrained trading.
   - **Critical Invariant**: $P_{\text{day\_open}}$ remains strictly immutable and is NEVER reset during unhalting, guaranteeing that daily circuit breaker limits ($\pm 20\%$) remain mathematically anchored to the true opening price.
- Upon release:
  - `isHalted = false`, `haltDirection = null`.
  - Records `CIRCUIT_BREAKER_RELEASED` audit event with current price and immutable `day_open_ref`.
  - Broadcasts `CIRCUIT_RECOVERY_ALERT` to remove warning badges across all trader and projector screens.

---

## 4. Anti-Tamper & Security Rules
- **Rate Limit Window**: A 200ms throttle is enforced per team session token. Rapid-fire duplicate clicks are rejected.
- **Role Isolation**: Only authenticated Host sessions (`role === 'HOST'`) can trigger pauses, resumes, day advances, news injections, or universe modifications.
- **Private API Authentication**: `GET /api/team-investments` and `GET /api/team-investments/:teamId` are protected by `requireHostAuth` middleware.
- **Formula Injection Mitigation**: All CSV reports sanitize cell values starting with `=`, `+`, `-`, or `@` by prefixing a single quote (`'`).

---

## 5. Educational Error & Guidance Protocols (Anti-Cryptic Error Policy)
To support college students with zero professional trading background:
1. **No Generic Error Codes**: Rejection reasons must explain **what** occurred, **exact financial figures** (shortfalls, shares held vs attempted), and **how to resolve it**.
2. **Contextual In-Modal Feedback**: The interactive Trade Modal recalculates affordability in real-time, displaying amber/red notices when cash or shares are insufficient before order dispatch.
3. **Audio & Visual Accessibility**: Failed or rejected orders trigger a distinct dual-tone warning buzzer (`order_rejected`) and a high-visibility, auto-dismissing toast with a manual close button.
4. **Permanent Test Substring Guarantees**: All enhanced messages preserve essential substrings (`paused`, `Insufficient shares`, `Insufficient cash`, `Trading is not enabled`, `RESET`) to ensure 100% automated test compliance.

---

## 6. Multi-Day Lifecycle Transitions & Snapshot Locking

### 6.1 Day Conclusion (`concludeCurrentDay`)
- **Trigger**: Automatic clock expiration ($t \ge T_{\text{day\_duration}}$) or manual Host action (`HOST_CONCLUDE_DAY`).
- **State Transition**:
  - `gameState.status = 'DAY_COMPLETED'`
  - `gameState.isPaused = true`
  - `gameState.pauseMode = 'VISIBLE_FROZEN'`
- **Official Daily Snapshot**:
  - Captures each team's opening value, closing value, daily P&L, daily return %, cumulative P&L, cumulative return %, cash, equity, and trade count.
  - Computes daily ranks and rank deltas ($\Delta \text{Rank} = \text{Rank}_{\text{prev}} - \text{Rank}_{\text{current}}$).
  - Locks snapshot permanently into `gameState.dailyLeaderboards['day_X']` and `gameState.dailyClosingPrices['day_X']`.
  - Accessible via authenticated REST endpoint: `GET /api/daily-snapshot/:day`.
- **Broadcast**:
  - Emits `DAY_CONCLUDED` and `DAY_FINALIZED` with `status: 'DAY_COMPLETED'`.
  - Plays closing bell sound cue (`bell_close`).
  - Activates `#traderDayCompletedOverlay` on trader terminals and `#projDayCompletedBanner` on auditorium projectors.

### 6.1b Final Day Conclusion vs Championship Finalization (`HOST_CONCLUDE_CHAMPIONSHIP`)
- When the final scheduled day concludes (`currentDay >= totalDays`):
  - State transitions strictly to `DAY_COMPLETED` (NOT automatically `CHAMPIONSHIP_CONCLUDED`).
  - Broadcasts `FINAL_DAY_COMPLETED` with `requiresExplicitFinalization: true` and pre-calculated winner standings for Host review.
  - The Host must explicitly execute `HOST_CONCLUDE_CHAMPIONSHIP` (or `HOST_FINALIZE_CHAMPIONSHIP`) to officially finalize the championship.
  - Server validation rejects any conclusion attempt if `gameState.status !== 'DAY_COMPLETED'` or `currentDay !== totalDays`.
  - Once validated, transitions to `gameState.status = 'CHAMPIONSHIP_CONCLUDED'`, `isConcluded = true`, archives the authoritative `finalResultsSnapshot`, and broadcasts `CHAMPIONSHIP_CONCLUDED` to launch the auditorium winner ceremony.

### 6.2 Advancing to the Next Day (`HOST_START_NEXT_DAY`)
- **Pre-Conditions**:
  - `currentDay < totalDays` (If on final day, host must use `HOST_ADD_DAY` to extend tournament).
  - Current day must be concluded (`status === 'DAY_COMPLETED'`).
- **State Updates**:
  - `currentDay = currentDay + 1`
  - `elapsedSeconds = 0`
  - `status = 'STANDBY'`, `isPaused = true`
  - For each stock: $P_{\text{prev\_close}} = P_{\text{current}}$, $P_{\text{day\_open}} = P_{\text{current}}$, $P_{\text{high}} = P_{\text{current}}$, $P_{\text{low}} = P_{\text{current}}$, active transitions cleared, history reset to `{ time: 0, price: currentPrice }`.
- **Financial Carry-Over Invariant**:
  - Available Cash and equity share holdings carry forward 100% intact into subsequent days.
  - Trader trade count and realized P&L persist cumulatively across the entire championship.
- **Broadcast**:
  - Emits `DAY_TRANSITION` and `DAY_ADVANCED` with `oldDay`, `newDay`, and `totalDays`.
  - Trader terminals clear the day-completed overlay and display: `"Day {N} Standby: Waiting for Host to open the floor"`.

---

## 7. Master Quantitative Engine & Mathematical Simulation Model

### 7.1 Asset Price Formulation (Log-Return & Centered Micro-Drift)
On each 1,000ms tick, asset prices update via an unbiased institutional simulation model:
$$P_{t+1} = \max\left(P_{\text{min}}, \min\left(P_{\text{max}}, P_t + \Delta P_{\text{total}}\right)\right)$$
$$\Delta P_{\text{total}} = \text{Gaussian} + \text{MicroDrift} + \text{CyclicalWave} + \text{TrendDrift} + \text{MeanReversion}$$

Where:
1. **Effective Volatility**:
   $$\sigma_{\text{eff}} = \max\left(0.0035, \sigma_i \times \beta_i \times 1.5\right)$$
2. **Zero-Mean Gaussian Shock**:
   $$\text{Gaussian} = Z_t \times \sigma_{\text{eff}} \times P_t \times 0.45 \quad \text{where } Z_t \sim \mathcal{N}(0, 1)$$
3. **Unbiased Micro-Drift (Mean = 0)**:
   $$\text{MicroDrift} = (U_t - 0.50) \times \sigma_{\text{eff}} \times P_t \times 0.35 \quad \text{where } U_t \sim \mathcal{U}(0, 1)$$
   *Mathematical Invariant*: Mean is exactly 0, preventing artificial upward profit drift or systematic positive returns.
4. **Intraday Cyclical Sine Wave**:
   $$\text{CyclicalWave} = \cos\left(t \times \omega_i + \phi_i\right) \times \sigma_{\text{eff}} \times P_t \times 0.35$$
5. **Mean-Reversion Anchor**:
   $$\text{MeanReversion} = -0.00015 \times \left(P_t - P_{\text{day\_open}}\right)$$

### 7.2 Semantics of Beta vs. Volatility
- **Beta ($\beta_i$)**: Measures sensitivity to broad-market movements and sector news shocks ($S_i = \text{base\_pct} \times \beta_i$). Beta is **NOT** a general profit multiplier and does not inflate base trade sizes or fees.
- **Volatility ($\sigma_i$)**: Calibrates the dispersion (variance) of simulated returns around the mean. A higher volatility setting increases return fluctuations in both directions equally; it does **NOT** create a systematic upward drift.

### 7.3 Bounded News Smoothstep Transition
When news reacts, prices transition smoothly over $T$ seconds (default 45s) using a cubic Hermite smoothstep profile:
$$u = \operatorname{clamp}\left(\frac{t - t_0}{T}, 0, 1\right)$$
$$s(u) = 3u^2 - 2u^3$$
$$P(t) = P_0 + (P_{\text{target}} - P_0) \times s(u)$$

---

## 8. Role-Based Parameter Security & Time Formatting

### 8.1 Sensitive Parameter Isolation Invariant
Internal quantitative parameters must **NEVER** leak to trading teams, auditorium spectators, projectors, or unauthenticated clients:
- **Restricted Server Parameters**:
  - `beta`
  - `volatility_factor`
  - Internal multiplier formulas & scenario seeds
  - Unpublished news events and future price impact vectors (`impacts`)
- **Backend Sanitization**: `getSanitizedPublicState(role, teamId)` strictly deletes or omits `beta` and `volatility_factor` whenever `role !== 'HOST'`. Sockets authenticated as TRADER or PROJECTOR receive only market prices, percentage changes, corporate fundamentals, and published wire text.
- **Host Dashboard Protection**: Ordinary host cards and stock boards do not display technical coefficients. Editing controls are confined to a collapsible, permission-controlled **Advanced Simulation Settings** area.

### 8.2 Consistent 12-Hour AM/PM Time Formatting
- All user-facing clock times display in 12-hour format with AM/PM (e.g. `9:30 AM`, `12:05 PM`, `4:15 PM`).
- Elapsed time and countdown timers remain in duration format (e.g. `12 min remaining`, `00:45:00`).
- Internal protocol timestamps remain standardized ISO 8601 strings.


---

# SECTION 5: EVENT LIFECYCLE & STATE MACHINE SPECIFICATION

# Event Lifecycle & Authoritative Server State Machine

## 1. Authoritative State Machine

```
[SETUP / DRAFT] (Logins Gated)
      │
      ▼  HOST_SET_EVENT_LOCK
[STANDBY] (Logins Open • Ready to Launch)
      │
      ├─── HOST_SCHEDULE_EVENT ──> [SCHEDULED] ──> Auto-Timer ──┐
      │                                                          │
      ▼  HOST_RESUME_COUNTDOWN / HOST_START_DAY1_NOW             ▼
[COUNTDOWN] (3-2-1 Synchronized Audio/Visual Countdown)
      │
      ▼  Countdown Finishes
[LIVE] (Active Trading Floor • Prices Tick • Orders Execute)
      │
      ├─── HOST_PAUSE ───────────────> [PAUSED / BLACKOUT] ───> HOST_RESUME_COUNTDOWN ──> [LIVE]
      │
      ▼  Clock Expiry (Elapsed >= Duration) OR HOST_CONCLUDE_DAY
[DAY_COMPLETED] (Daily Snapshot Locked • #traderDayCompletedOverlay & #projDayCompletedBanner)
      │
      ├─── If currentDay < totalDays: HOST_START_NEXT_DAY ────> [STANDBY] (Day N+1 • Balances Carried)
      │                                                          │
      │                                                          └──> HOST_RESUME_COUNTDOWN ──> [LIVE]
      │
      ▼  If currentDay == totalDays: FINAL_DAY_COMPLETED (requiresExplicitFinalization)
[DAY_COMPLETED / FINAL REVIEW] (Pre-Generated Standings Audit • Host Review)
      │
      ▼  HOST_CONCLUDE_CHAMPIONSHIP (Requires status === 'DAY_COMPLETED' & currentDay === totalDays)
[CHAMPIONSHIP_CONCLUDED] (Audited Results Snapshot Locked • isConcluded = true)
      │
      ▼  HOST_START_WINNER_PRESENTATION
[WINNER_ANNOUNCEMENT] (Ceremonial Reveal: Bronze ➔ Silver ➔ Champion ➔ Podium)
      │
      ▼  HOST_RESET_ENTIRE_CHAMPIONSHIP ("RESET CHAMPIONSHIP")
[SETUP / DRAFT] (Mandatory Full-Screen Client Logout • Fresh Roster)
```

---

## 2. Server-Enforced Configuration Lock (`EVENT_CONFIG_LOCKED`)

1. **Trigger Condition**:
   - Host clicks `Lock Configuration` in Step 8 of Event Setup (`HOST_SET_EVENT_LOCK`).
   - Server validates title, dynamic roster ($N \ge 1$), and stock catalogue ($\ge 4$ stocks).
   - State sets `gameState.configLocked = true`, `gameState.status = 'STANDBY'`.
2. **Pre-Start Unlock Safeguard (`HOST_UNLOCK_EVENT_CONFIG`)**:
   - Permitted only while in `STANDBY` before trading begins (`elapsedSeconds === 0`).
   - Once the market has gone `LIVE` or seconds have elapsed, configuration is permanently frozen.
3. **Forbidden Mid-Competition Operations (Fairness Protection)**:
   - `HOST_ADD_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_REMOVE_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_EDIT_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_UPDATE_EVENT_CONFIG` (attempting to alter starting capital or total days mid-round): Rejected with `EVENT_CONFIG_LOCKED`.
4. **Allowed In-Competition Host Operations**:
   - Market pause (`HOST_PAUSE`) and resume with 3-2-1 synchronized countdown (`HOST_RESUME_COUNTDOWN`).
   - Directional circuit breaker unhalt (`HOST_UNHALT_STOCK`) and manual halt testing (`HOST_HALT_STOCK`).
   - Dynamic breaking news shocks (`HOST_CREATE_CUSTOM_NEWS`, `HOST_PUBLISH_NEWS_NOW`).
   - Day conclusion (`HOST_CONCLUDE_DAY`) and advancing to next day (`HOST_START_NEXT_DAY`).
   - Extending tournament length dynamically by adding a day (`HOST_ADD_DAY`).
   - Projector remote control (`HOST_UPDATE_PROJECTOR_MODE`, `HOST_PROJECTOR_BOARD_NAV`).
   - Winner presentation stage remote (`HOST_START_WINNER_PRESENTATION`, `HOST_SET_PRESENTATION_SCENE`).
   - Emergency halt (`HOST_EMERGENCY_STOP`) and full reset (`HOST_RESET_ENTIRE_CHAMPIONSHIP`).
   - Audio volume and sound console routing (`HOST_UPDATE_AUDIO_SETTINGS`).


---

# SECTION 6: SYSTEM ARCHITECTURE & NETWORK PROTOCOLS

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
- **Circuit Breaker Reference Immutability**: $P_{\text{day\_open}}$ is established strictly at the start of each trading day and is immutable throughout active trading. Manual unhalting and sector unhalting clear halts without altering $P_{\text{day\_open}}$, guaranteeing boundary integrity.
- **News Event Idempotency Registry**: Server maintains `firedNewsEventsPerDay = new Map()` (key: `day_${dayNum}_${event_id}`). Guaranteed execution exactly once per intended trading day, preventing duplicate shocks across tab reconnects or server restarts.

### 2.2 WebSocket Communication Protocol
All real-time interaction occurs over a persistent WebSocket connection:
- **Authentication**: Clients send `{ action: 'LOGIN', username, password }`. The server validates against registered credentials and returns a 32-character cryptographic session token (`session_token`).
- **Session Continuity**: If a browser tab disconnects or reloads, the client automatically transmits `{ action: 'RESUME_SESSION', session_token }`. The server reconnects the existing session and pushes the latest authoritative state without losing portfolio data.
- **Role-Based Sanitized State Broadcast**:
  - `TRADER`: Receives only tradeable enabled stocks, team's own portfolio/cash, team's own executed trades, public leaderboard, and active news flash. Never receives other teams' private holdings.
  - `PROJECTOR`: Receives public enabled stocks, top 5 leaderboard rankings, and active news flashes.
  - `HOST`: Receives full administrative state including `allCompaniesUniverse` (both enabled and disabled shares), all teams' raw balances, all executed trades, and audit counters.
- **Cryptographic Trade Identifiers**:
  - All BUY, SELL, and LIQUIDATE_ALL transactions generate RFC 4122 v4 UUIDs via `crypto.randomUUID()`.
  - An integer `seq` counter is preserved alongside the UUID for monotonic ordering and display.

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
  - **Intelligent State-Preserving Resumption**: Restoring state from checkpoints or crash files preserves legitimate stopped lifecycle states (`SETUP`, `STANDBY`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`). Only active `LIVE` market trading is paused into `pauseMode = 'RECOVERY'` awaiting Host 3-2-1 resume. Stale countdown timers are cleared and `firedNewsEventsPerDay` is rebuilt.
- **Safe Championship Reset & Setup Wizard**:
  - `HOST_RESET_ENTIRE_CHAMPIONSHIP`: Enforces high-friction typing security (`"RESET"` required). Destroys `live_game_state.json`, disconnects all student sessions, broadcasts `CHAMPIONSHIP_RESET`, and launches the Host Setup Wizard.
  - `HOST_INITIALIZE_NEW_CHAMPIONSHIP`: Configures tournament parameters (title, starting cash, days, session duration, transaction fees, circuit breaker band), custom team roster (names, usernames, passwords, student members), and tradeable share universe.
- **Active Share Universe**: Stored in `data/universe_active.json`. Created or modified whenever the host adds, edits, toggles, duplicates, or randomizes shares.
- **Audit Ledger**: Stored in `logs/AUDIT_LOG_<timestamp>.json`. Written periodically and on every trade/pause/halt event using non-blocking asynchronous disk writes.
- **Full State Backup & Restore API**:
  - `GET /api/backup`: Serializes game state, teams, companies, and executed trades into a complete JSON snapshot.
  - `POST /api/restore`: Ingests a previously exported snapshot and re-establishes server state cleanly.
- **Protected Analytics APIs**:
  - `GET /api/team-investments` and `GET /api/team-investments/:teamId` enforce `requireHostAuth` middleware, blocking unauthorized access with HTTP 403 Forbidden.

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

### 2.6 Responsive Architecture & Classroom Projector Optimization
- **Dynamic Role Attribute**: `switchSpaView(role)` assigns `document.body.setAttribute('data-role', role)`, enabling pure CSS targeting (`body[data-role="PROJECTOR"]`, `body[data-role="TRADER"]`) without inline JS style hacks.
- **Classroom 4:3 Aspect-Ratio Media Query**: Target query `@media (min-aspect-ratio: 4/3) and (max-aspect-ratio: 1.4/1)` adapts the auditorium display for standard Indian college projectors (`1024×768` and `800×600`).
  - Automatically re-partitions cards into $4 \times 2$ (8-card) or $3 \times 2$ (6-card) layouts with zero horizontal scroll.
  - Safe margins (5% horizontal, 8% vertical) guard against hardware overscan/bezel cutoffs.
- **Mobile & Tablet Touch Breakpoints**: Breakpoints at 640px and 1024px provide single-column mobile layouts and 2-column tablet grids with touch targets $\ge 44\text{px}$ and smooth momentum scrolling.
- **Loading & Skeleton System**: Visual feedback via `.btn-loading`, `.skeleton`, and animated progress bars provides instantaneous feedback during asynchronous WebSocket requests.

---

## 3. System Designer & Lead Architect

- **Creator & Lead System Architect**: **Ved Mangukiya**
- **Academic Program**: Pursuing Bachelor of Business Administration (BBA)
- **University**: Gujarat Technological University (GTU)
- **Location**: Surat, Gujarat, India
- **Engineering Benchmark**: Conceived, engineered, and optimized end-to-end from first principles with zero external framework bloat, zero CDN reliance, sub-millisecond server-authoritative liquidity execution, programmatic Web Audio synthesis, and crash-resilient deterministic state restoration. A system architecture unprecedented in collegiate financial simulations worldwide.


---

# SECTION 7: LUXURY DESIGN SYSTEM & VISUAL TOKENS

# DESIGN SYSTEM & UI TOKENS — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Visual Direction & Aesthetic Philosophy

**The Trading Floor Championship** adheres to a **Warm Ivory Luxury Financial Terminal** aesthetic. 
Unlike generic dark-neon crypto dashboards or plain gray administrative portals, this interface evokes the timeless prestige of an institutional wealth management firm, combining:
- Warm ivory and alabaster paper-textured backgrounds.
- Deep British forest green typography.
- Refined champagne gold and burnished bronze accents.
- Muted sage green panels.
- Vivid, high-contrast emerald and crimson market price badges.
- Tabular monospace numerals ensuring numbers never jitter or shift during fast live ticks.

---

## 2. Color Palette & CSS Variables

```css
:root {
  /* Surface & Background Canvas */
  --canvas-ivory:       #FBF9F5; /* Main tournament page canvas */
  --surface-cream:      #F4EFE6; /* Muted inner panels, sub-bars, table headers */
  --surface-card:       #FFFFFF; /* Elevated content cards and order modals */
  --subtle-border:      #E6DEC9; /* Clean institutional border lines */
  
  /* Primary & Editorial Typography */
  --text-forest:        #1A3026; /* Primary titles, table headers, hero brand */
  --text-charcoal:      #2A2826; /* Body copy, table cells, form labels */
  --text-muted:         #6E6A62; /* Micro-copy, timestamps, fundamentals */

  /* Luxury Accents */
  --champagne-accent:   #8E6D3B; /* Burnished gold borders, badges, wire deck */
  --champagne-light:    #F7F2E7; /* Light gold background tint */
  --sage-accent:        #3D5A45; /* Dark sage buttons and interactive elements */
  --sage-light:         #EAEFE9; /* Subtle sage badge backgrounds */

  /* Market Trading Indicators (High-Contrast) */
  --price-up:           #218653; /* Positive tick green (+%) */
  --price-up-bg:        #EAF6EE; /* Positive badge fill */
  --price-down:         #C64B4B; /* Negative tick red (-%) */
  --price-down-bg:      #FBEFEF; /* Negative badge fill */
  --warning-amber:      #C87A18; /* Paused state / pending halt warning */
  --warning-bg:         #FEF7EC; /* Paused badge fill */
  --error-red:          #B82828; /* Circuit breaker halt / order rejection */
  --error-bg:           #FDF0F0; /* Circuit breaker badge fill */
  --error-border:       #EAA8A8; /* Circuit breaker badge border */

  /* System Elevation & Geometry */
  --shadow-subtle:      0 2px 8px rgba(26, 48, 38, 0.04);
  --shadow-card:        0 4px 16px rgba(26, 48, 38, 0.08);
  --shadow-modal:       0 16px 48px rgba(26, 48, 38, 0.22);
  --radius-sm:          4px;
  --radius-md:          8px;
  --radius-lg:          12px;
}
```

---

## 3. Typography Hierarchy

To maintain 100% offline autonomy without external CDN font requests:

```css
/* Typography Stacks */
--font-serif:   'Playfair Display', 'Libre Baskerville', 'Georgia', serif;
--font-sans:    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
--font-mono:    'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
```

- **H1 / Event Headings**: `--font-serif`, font-weight 800, color `--text-forest`, letter-spacing `-0.02em`.
- **H2 / Card Section Titles**: `--font-serif`, font-weight 700, color `--text-forest`.
- **Body & Controls**: `--font-sans`, font-weight 400 to 600, color `--text-charcoal`.
- **Prices, Tickers, Quantities & Clocks**: `--font-mono`, tabular lining numerals (`font-variant-numeric: tabular-nums`).

---

## 4. Component Standards

### 4.1 Luxury Content Cards (`.luxury-card`)
- Clean white background (`#FFFFFF`) with subtle warm border (`var(--subtle-border)`).
- Elevation shadow (`var(--shadow-card)`).
- Subtle top hairline accent or burnished border.

### 4.2 Interactive Badges (`.badge`)
- Padding: `3px 8px`, border-radius `var(--radius-sm)`, text-transform `uppercase`, font-size `10px–11px`, font-weight 700.
- State variants:
  - `.badge-active`: Green fill, green border (`● ACTIVE`).
  - `.badge-paused`: Amber fill, amber border (`⏸ PAUSED`).
  - `.badge-halted`: Crimson fill, red border (`⛔ HALTED (UPPER/LOWER)`).
  - `.badge-champagne`: Burnished gold fill and text (`★ GRAND CHAMPION ★`).

### 4.3 Order Ticket Modals
- High contrast, distraction-free execution dialog.
- Large numerical price and cash display.
- One-click Max Buy and Max Sell calculation shortcuts.
- Real-time gross value, transaction fee, and remaining cash live simulation.

### 4.4 Institutional Chart Containers & Micro-Badges (`style.css`)
- **Card Containers (`.tf-stock-card`)**: Muted cream card (`var(--surface-cream)`), subtle border, smooth hover elevation with champagne glow. Holds `<canvas>` sparkline with dynamic price typography.
- **Chart Wrappers (`.tf-chart-wrap`)**: Crisp white elevated container (`var(--surface-card)`) with 12px border radius, 1px institutional grid border, and soft elevation shadow (`0 6px 24px rgba(26, 48, 38, 0.06)`).
- **Status & P&L Chips (`.tf-chip`)**:
  - `.tf-chip--profit`: Subtle emerald glow fill (`rgba(33, 134, 83, 0.12)`), forest green text (`#218653`).
  - `.tf-chip--drawdown`: Subtle crimson glow fill (`rgba(198, 75, 75, 0.12)`), crimson text (`#C64B4B`).
  - `.tf-chip--halted`: Solid crimson background, stark white text, pulsing alert animation.
- **Crosshair Coordinates**: Snapping dashed hairline crosshair with high-contrast floating tooltip badge displaying precise timestamp and price coordinate.

### 4.5 50-Foot Stage Projector Variant (`.tf-projector`)
- Targets high-resolution auditorium projection screens and large event displays.
- Applied automatically to the `#projectorView` container.
- Scales card padding (`18px 20px`), sparkline canvas height (`110px`), and ticker price font size (`2rem`) for instant legibility at 50-foot distances.


---

# SECTION 8: VERIFIED SYSTEM BOUNDARIES & DEFECT REGISTER

# KNOWN ISSUES & SYSTEM BOUNDARIES — THE TRADING FLOOR CHAMPIONSHIP 2026

This document honestly outlines verified system boundaries, operational limitations, and documented workarounds.

---

## 1. Verified System Boundaries

### 1.1 Web Audio Autoplay Gesture Policy
- **Behavior**: On first page load, browsers (Chrome, Edge, Safari) prohibit background audio synthesis until the user performs at least one physical click or interaction on the page.
- **Impact**: Opening bell or siren will be silent if no one has clicked on the screen yet.
- **Workaround**: Click anywhere on the dashboard once after loading the page (e.g. click "Market Desk" or the screen background).

### 1.2 Campus Wi-Fi Access Point (AP) Client Isolation
- **Behavior**: Certain enterprise campus Wi-Fi networks block peer-to-peer communication between connected laptops to prevent unauthorized network scanning.
- **Impact**: Student laptops receive "Connection Timed Out" when attempting to reach `http://<HOST_IP>:3000/`.
- **Workaround**: Use a standalone offline travel router, a dedicated access point, or a smartphone mobile hotspot for the event. No active internet is required.

### 1.3 Recommended Team Concurrency
- **Boundary**: Extensively tested and optimized for 1 to 24 concurrent teams on standard dual/quad-core laptops.
- **Guidance**: For mega-events exceeding 32 teams, run the host server on a machine with at least 8 GB RAM and modern multi-core CPU.

### 1.4 Intraday Tick History Pruning
- **Behavior**: To prevent client and server memory bloat over multi-hour competitions, intraday price coordinate history is maintained in rolling arrays per day and archived on day advance.
- **Impact**: Sparkline curves reflect the active trading day rather than multi-day cumulative curves.

---

## 2. Defect Tracking & Resolution Status

| Issue ID | Description | Severity | Status | Workaround / Resolution |
| :---: | :--- | :---: | :---: | :--- |
| **SEC-01** | Rapid double-click order duplicate spam | Medium | RESOLVED | 200ms per-session debounce enforced in `server.js`. |
| **SEC-02** | CSV Formula Injection vulnerability | High | RESOLVED | `sanitizeCsvCell()` prepends `'` to dangerous `=+-@` characters. |
| **SEC-03** | Private team investments endpoints publicly accessible | Critical | RESOLVED | `requireHostAuth` middleware applied to `/api/team-investments` and `/api/team-investments/:teamId` returning 403 Forbidden. |
| **MKT-01** | Circuit breaker anchor reset on manual or sector unhalt | Critical | RESOLVED | Immutable `dayOpenPrice` enforced in `server.js`; unhalting never modifies reference price. |
| **ENG-01** | News events firing multiple times in same trading day | High | RESOLVED | `firedNewsEventsPerDay` Map registry tracks executed events per day; cleared on day advance. |
| **LFC-01** | Final trading day automatically finalized championship | High | RESOLVED | Explicit two-step process: `concludeCurrentDay` concludes Day $N$; `HOST_CONCLUDE_CHAMPIONSHIP` requires `status === 'DAY_COMPLETED'`. |
| **RES-01** | Checkpoint restoration forced `PAUSED` on stopped states | Medium | RESOLVED | Legitimate stopped states (`SETUP`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`) preserved; `pauseMode = 'RECOVERY'`. |
| **ORD-01** | Sequential trade IDs risk collisions across server restarts | Low | RESOLVED | Migrated to RFC 4122 `crypto.randomUUID()` while retaining sequential `seq` counter for ordering. |
| **ENC-01** | Character encoding corruption (`â‚¹`, `ðŸš€`, etc.) in `server.js` | Medium | RESOLVED | Restored clean UTF-8 encoding across `server.js` with zero character corruption. |
| **NET-01** | Sudden LAN drop or browser refresh | Medium | RESOLVED | `RESUME_SESSION` token protocol automatically restores portfolio. |
| **UI-01** | Disabled stocks visible on trader screens | High | RESOLVED | Server filters `companies` payload by `isEnabled !== false`. |
| **DOM-01** | 21 duplicate element IDs in `public/index.html` | Low | RESOLVED | Duplicate IDs in `#hostTabContentSetup` namespaced with `hostTabSetup_`; standalone `#eventSetupView` remains canonical. `tools/find_duplicate_ids.js` verified 0 duplicates. |
| **TST-01** | Integration test suite unauthenticated HTTP calls | Low | RESOLVED | `test_dynamic_upgrade_suite.js` updated to verify 403 Forbidden without token, and uses Host session token for authorized calls; self-contained auto-boot enabled for all test suites (`npm run test:all` 86/86 passing). |



---

# SECTION 9: CURRENT VERIFIED SYSTEM STATUS & ACTION LOG

# CURRENT SYSTEM STATUS — THE TRADING FLOOR CHAMPIONSHIP

**Date**: 2026-11-02  
**Version**: 2.8.1 (Full Audit Verification • UI Alignment & Host Live News Sync Parity)  
**Status**: PRODUCTION-READY, FULLY IMPLEMENTED & VERIFIED (36/36 Unified Single-Flow Master Assertions Passing + 194/194 Total Chunk Assertions Passing + 5/5 Phase 1 Assertions Passing + 0 Duplicate DOM IDs)  

---

## 0. RECENT FIXES & AUDITED DEFECT RESOLUTION (2026-11-02)

### A. All 12 Backend Server Core (`server.js`) & Subsystem (`server/*.js`) Audit Items Resolved
1. **News Smoothstep Freeze During Market Pause**:
   - Resuming the market (`startResumeCountdown` completion & `HOST_START_EVENT_NOW`) computes `pausedMs = Date.now() - gameState.pauseStartedAt` and advances all active transitions (`c.activeTransition.startTimeMs += pausedMs`), preventing instantaneous price snap on resume.
2. **Deterministic `syncDerivedStateFlags(gameState)` Parity**:
   - Added `syncDerivedStateFlags(gameState)` across all state transitions (`concludeCurrentDay`, `HOST_PAUSE`, `HOST_SCHEDULE_EVENT`, `HOST_CANCEL_SCHEDULE`, `HOST_FINISH_EVENT`, `HOST_CONCLUDE_CHAMPIONSHIP`, `HOST_START_WINNER_PRESENTATION`, `HOST_EXIT_WINNER_PRESENTATION`), ensuring `stateVersion` monotonically increments and downstream clients never drop state frames.
3. **Non-Blocking Atomic Disk I/O**:
   - `saveLiveGameState()` refactored to asynchronous atomic write (`.tmp` write followed by `fs.promises.rename`) protected by an `isSavingLiveState` mutex lock, eliminating 5–25ms synchronous disk stalls during high-velocity trading rounds.
4. **Test & Scenario Universe Disk Protection**:
   - `saveUniverseToDisk()` now aborts immediately if `activeScenarioMode === 'test'` or `process.env.NODE_ENV === 'test'`, preserving active baseline universe metadata (`exchange`, `currency`, `reference_source`, `reference_timestamp`).
5. **Subsystem Logic & Math Unification**:
   - Replaced duplicated inline implementations in `server.js` with authoritative modules from `server/`:
     - `server/accounting.js`: Implements synchronized 5-tier leaderboard tie-breakers (`netWorth` ➔ `pnlPct` ➔ `cash` ➔ `tradeCount` ➔ `a.id.localeCompare(b.id)`), comprehensive `calculateTeamInvestments`, canonical 7 indices (`NIFTY_TF20` + 6 sectors), and descending sector allocations.
     - `server/news_scheduler.js`: Standardized reading windows (12s, 18s, 22s, 25s) and schedule feasibility validator.
     - `server/sanitizer.js`: RFC 4180 CSV cell quote-escaping (`""`) and formula injection shielding (`'`).
     - `server/persistence.js`: Serializes and restores active WebSocket sessions and `lastOrderAtByTicker`.
6. **Canonical `CHAMPIONSHIP_CONCLUDED` Lifecycle Status**:
   - `HOST_FINISH_EVENT` now sets canonical `CHAMPIONSHIP_CONCLUDED` (previously non-canonical `FINAL_ANALYSIS`), perfectly matching `server/state_machine.js`.
7. **Safe Numeric Parsing & Clamping in `HOST_EDIT_SHARE`**:
   - Numeric inputs validated with `Number.isFinite()`, clamped to valid bounds (`beta`: 0.1–3.0, `volatility_factor`: 0.0005–0.05), and price history/extremes re-anchored when edited before round start.
8. **Pre-Competition Price Mutation Guards**:
   - `HOST_RANDOMIZE_PRICES`, `HOST_APPLY_MARKET_TEMPLATE`, and `HOST_RESET_UNIVERSE_BASELINE` strictly guarded with `if (gameState.configLocked || gameState.status === 'LIVE' || gameState.elapsedSeconds > 0)`.
9. **Circuit Breaker Upper/Lower Clamp Invariant**:
   - Background noise loop keeps halted stocks anchored at `upperLimit`/`lowerLimit` without biased random walks, preserving strict directional circuit breaker enforcement until genuine counter-flow liquidity triggers release.
10. **WebSocket Session Re-Binding on Checkpoint Restore**:
    - `restoreFromCheckpointData` reconstructs `sessions` mapping from open `wss.clients`, preventing host lockout upon disaster recovery restore.
11. **Consistent Initial Schema Parity in `HOST_SET_EVENT_LOCK`**:
    - Team objects initialize with `dayOpeningPortfolioValue: gameState.startingCash`, guaranteeing strict schema parity across default, new, and locked teams.
12. **Purge of Dead Helper Functions**:
    - Removed unseeded, unused `gaussianRandom()` from `server.js`, standardizing on seeded `randomGaussian` from `./server/market_engine`.

---

### B. UI & News State-Machine Live Sync Bugs Resolved
1. **Host Live Market News `[⏸️ PAUSED]` Freeze**:
   - *Root Cause*: `renderHostDashboard` only called `renderHostNews` if `activeHostTab === 'news' || activeHostTab === 'floor'`. When clicking the canonical "Live Market Floor" navigation tab (`activeHostTab = 'market'`), `renderHostNews` was skipped on TICK_UPDATE. Furthermore, `ensureHostNewsTicker` only updated timers when `activeHostTab === 'news'`. As a result, news cards frozen during a host pause were never re-rendered upon resumption or floor start.
   - *Fix*:
     - Expanded `renderHostDashboard` condition to include `market`, `stocks`, `floor`, and all aliases.
     - Updated `ensureHostNewsTicker` to evaluate whenever the market hub or `#hostNewsList` is active.
     - Added immediate news re-render and timer synchronization upon `MARKET_RESUMED`, `MARKET_PAUSED`, and `EVENT_CONFIG_LOCKED`.
     - Added visibility change handler to refresh news timers immediately when the browser tab becomes active.
2. **Stale Paused News Remaining After Full Championship Reset**:
   - *Root Cause*: On `CHAMPIONSHIP_RESET` / `CHAMPIONSHIP_RESET_ACK`, `#hostNewsList` and `#hostNewsNextBanner` were not cleared in the DOM. Upon configuring and launching a new event, the old cards from the previous tournament remained visible with old paused badges.
   - *Fix*: Handlers for `CHAMPIONSHIP_RESET` and `CHAMPIONSHIP_RESET_ACK` now purge `#hostNewsList` and `#hostNewsNextBanner` with clean placeholder notices, and `EVENT_CONFIG_LOCKED` immediately renders the newly generated news schedule.
3. **News Preview Layout Optimization (Section 5 Setup & Locked Schedule)**:
   - Extracted dynamic schedule stats into full-width `#setupNewsSummaryBar` above the news grid.
   - Split news preview by tournament day (`DAY 1 TIMELINE`, `DAY 2 TIMELINE`, `DAY 3 TIMELINE`) with independent multi-column sub-grids in both draft preview (`updateNewsPreviewFromSelection`) and locked schedule (`renderSetupSections`).
   - Restructured card headers into two non-overlapping rows: Row 1 for timestamp badge and ticker pill (`flex-shrink: 0`); Row 2 for session timing context.
   - Cards enforce `min-width: 0; overflow: hidden;` preventing text clipping or overflow across all display resolutions.

---

## 1. Architectural Principle: ONE ACTION = ONE CLEAR PLACE = ONE AUTHORITATIVE IMPLEMENTATION
- [x] **4 Primary Host Navigation Hubs**:
  1. `🏠 1. Home`: Status overview, connection monitor (Traders, Projector, Sound), Readiness Checklist, and single dynamic Next Step guidance.
  2. `⚙️ 2. Event`: 8-step guided setup workflow (`Details -> Teams -> Companies -> Trading Rules -> Schedule -> News Plan -> Projector & Sound -> Review & Lock`), real company selection, auto-generated news plan, automatic readiness validation, and single safe `Unlock Configuration` control.
  3. `📈 3. Live Market`: Canonical single Market Operations Bar (`▶ Resume 3-2-1`, `⏸ Pause`, `🕶️ Blackout`, `🔔 Conclude Day`, `➕ Add Next Day`, `🛑 Emergency Stop`), real-time stock boards, News Control Centre with 60-second privacy reveal, and live trade stream.
  4. `🖥️ 4. Stage & Results`: Auditorium Projector Remote (Auto-Cycle / Fixed Screen / Board Page Controls), Team Investment Analytics, Venue Sound Console controls, Disaster Recovery & Checkpoint Matrix, Leaderboard results, audited CSV/JSON reports, and Safe Championship Reset card.
- [x] **Zero Action Duplication**: Consolidated floating/overview pause and resume buttons into one canonical Live Market bar. Removed duplicate news editors, duplicate company pickers, and redundant launchers.
- [x] **Distinct Lifecycle Operations**: Strictly separated `Conclude Day`, `Start Next Day`, `Add Next Day`, `Finish Event`, `Finalize Championship`, and `Emergency Stop` with dedicated confirmation dialogs and authoritative server validation.

---

## 2. Automatic Configuration Locking & Safe Pre-Competition Unlock
- [x] **Automatic Readiness Validation**: Checks all required fields (title, starting cash, fees, company selection, schedule, and balanced news plan).
- [x] **Automatic Lock on Valid Draft**: Transitions state to `Ready — Locked` with simple English notice:
  *"Your event setup is complete. Settings are now locked to protect competition fairness."*
- [x] **Safe Unlock (`HOST_UNLOCK_EVENT_CONFIG`)**:
  - Permitted only before the tournament starts (`gameState.status === 'STANDBY' && gameState.elapsedSeconds === 0`).
  - Once live trading begins or seconds elapse, permanently freezes event configuration. Any unlock attempt returns clear explanation:
    *"Cannot unlock settings: The competition has already started. Event settings are permanently frozen during live trading."*

---

## 3. Automatic News Plan Generation from Selected Companies
- [x] **Host Selects Companies — Engine Selects News**: The host selects participating companies from the verified Indian listed universe (`RELIANCE`, `TATAMOTORS`, `TCS`, `HDFCBANK`, etc.).
- [x] **Auto News Plan (`HOST_GENERATE_AUTO_NEWS_PLAN`)**:
  - Uses `NEWS_TEMPLATE_LIBRARY` (10 rich sector/macro templates with neutral headlines in plain English).
  - Strictly targets selected companies (zero leakage of unselected companies into impacts).
  - Generates balanced, multi-day schedules with deterministic timing fractions.
- [x] **Neutral Public Headlines**: Formatted in objective wire language without buy/sell advice (e.g. *"Ministry of Heavy Industries Outlines Updated Production and Component Sourcing Guidelines"*).

---

## 4. Confidentiality & 60-Second Private Impact Reveal Model
- [x] **Default Private Impact Masking**: Private price impact percentages (`+11.5%`, `-3.5%`) are masked by default in the host interface as `[🔒 Private Price Impact Details Hidden]`.
- [x] **Zero Public Leakage**: Trader workstations and auditorium projector never receive private impact percentages or directional targets over WebSocket.
- [x] **60-Second Reveal Window**:
  - Clicking `👁️ Reveal Private News Details` displays permitted impact percentages and activates a visible 60-second countdown banner (`⚠️ Private event information is visible. It will hide automatically in 60s.`).
  - Features immediate `🔒 Hide Now` button.
  - Automatically re-masks all private details when the timer expires or when the host navigates away from the Market tab.

---

## 5. Smoothstep Stock Price Movement Engine
- [x] **Mathematical Smoothstep Formulation**:
  $$u = \text{clamp}\left(\frac{t - t_0}{T}, 0, 1\right), \quad s(u) = 3u^2 - 2u^3, \quad P(t) = P_0 + (P_T - P_0) \cdot s(u)$$
- [x] **Continuous Server-Time Basis**: Computed using exact elapsed milliseconds (`Date.now() - stock.activeTransition.startTimeMs`), rendering the engine completely immune to tick delay drift.
- [x] **Non-Snapping Trajectory Transition**: When a new shock arrives during an active transition, the new trajectory begins from the current official price $P_0 = P_{\text{current}}$, eliminating jarring price snaps.
- [x] **Realistic Reaction Window**: Durations calibrated (15s to 60s) allowing participants to read news and execute trades while prices evolve.

---

## 6. Projector Redesign: Zero-Scroll Pagination & Spotlight Bar
- [x] **Zero-Scroll Stock Board Pagination**:
  - Automatically partitions the active stock universe into readable 8-card pages ($4 \times 2$ responsive grid) with `overflow: hidden`.
  - Automatically rotates to the next page every 8 seconds with smooth CSS transitions.
  - In-place DOM and sparkline updates ensure price ticks never restart rotation timers or cause canvas flickering.
- [x] **Permanently Visible Spotlight Bar**:
  - **Top Percentage Gainer**: Displays ticker, current price, and percentage change. Deterministic alphabetical tie-break prevents jitter.
  - **Top Percentage Loser**: Displays ticker, current price, and percentage change.
  - **Market Breadth**: Live counter of Advancing, Declining, and Unchanged stocks across the universe.
  - **Pagination Controls**: Displays "Page X of Y", visual dot indicators, and Host remote controls (`◀ Prev`, `⏸ Pause/Resume`, `▶ Next`).

---

## 7. Disaster Recovery & Checkpoint Engine
- [x] **Periodic & Manual Snapshots**:
  - Auto-checkpoints every 120 seconds during live market sessions saved to `data/checkpoints/`.
  - Host can capture instant named checkpoints via `HOST_CREATE_CHECKPOINT`.
- [x] **One-Click & File Upload Restore**:
  - Host can inspect and restore any previous checkpoint directly from the Stage & Results hub.
  - Supports uploading exported JSON backup files from an external USB drive.
- [x] **Safe Restored State Invariant**:
  - Upon restore, market status is forced to `PAUSED` waiting for Host Resume 3-2-1.
  - All connected trader and projector terminals receive `MARKET_RESTORED` notice and refresh their portfolios cleanly.

---

## 8. Safe Championship Reset with Mandatory Client Logout
- [x] **Strict Confirmation Phrase**: Requires explicit `"RESET CHAMPIONSHIP"` (or `'RESET'`) input, rejecting any mismatched confirmation.
- [x] **Mandatory Full-Screen Client Notification**:
  *"The host has reset the competition. You have been logged out. Please wait for the host to set up a new event."*
- [x] **Trader Session Invalidation**: Immediately invalidates active trader sessions server-side to prevent stale orders from executing, displays full-screen overlay `#clientResetModal`, and cleanly redirects to login.

---

## 9. Verification & Streamlined Test Architecture
- [x] **4 Authoritative Test Suites (194/194 Passing Assertions, 0 Failures, 100% Reliability)**:
  1. `tests/test_unified_master_flow.js`: **36/36 PASSED (100%)** (End-to-end 11-phase championship lifecycle flow on port 3099).
  2. `tests/test_chunk2_state_machine.js`: **5/5 PASSED (100%)** (Monotonic stateVersion and countdown guards on port 3102).
  3. `tests/test_chunk3_ui_and_overlays.js`: **89/89 PASSED (100%)** (DOM parity, zero duplicate IDs, role overlays on port 3103).
  4. `tests/test_chunk4_action_contracts.js`: **64/64 PASSED (100%)** (Universal Action Contract locks, network shields, timeout fallback on port 3104).
- [x] **Zero Dossiers & Lean Codebase Invariant**:
  - Permanently purged redundant `MASTER_CODEBASE_DOSSIER/`, `docs/archive/argon_dossier/`, `docs/CLAUDE_CSS_MASTER_DOSSIER.md`, and `tools/build_master_dossier.js`.
  - Permanently purged 7 deprecated/redundant legacy test files.
  - Zero duplicate code files across the repository.

---

## 10. Dynamic Team Capacity, Risk Profiles & Post-Lock Launch Engine (v2.3.0)
- [x] **Dynamic Team Capacity**:
  - Eliminated hardcoded 16-team limits.
  - Quick presets: Solo (1 Desk), 2 Teams, 4 Teams, 8 Teams, 16 Teams, Custom ($N \ge 1$).
  - Dynamic roster table: Add (`+ Add Team Desk`), remove (`🗑️`), PIN generator, copy credentials, CSV export.
  - Automatic portfolio mapping guarantees initialized holdings and cash for every desk.
- [x] **Calibrated Simulation Risk & Opportunity Profiles**:
  - Conservative (0.75x shock scale), Balanced (1.0x), High Opportunity (1.45x), Custom.
  - Calibrated multiplier directly scales news shocks so student traders experience meaningful portfolio movements.
- [x] **Student-Friendly 5-Phase News Flow**:
  - Phase 1: Announced.
  - Phase 2: Reading & Discussion Window (12–30s countdown bar, no instant price jump, trading remains fully active).
  - Phase 3: Decision Deadline.
  - Phase 4: Smooth cubic S-curve reaction ($e(u) = 3u^2 - 2u^3$) with `NEWS_REACTION_START` audio chime.
  - Phase 5: Reaction Completed.
- [x] **Post-Lock Day 1 Launch Modal & Dynamic WebSocket Unlock**:
  - Automatically launches upon locking setup: "Start Day 1 Now", "Schedule Day 1", "Start Later".
  - Instant WebSocket login unlock broadcast (`EVENT_CONFIG_LOCKED`) allows students to log in immediately without refreshing browsers.
- [x] **Dramatic & Intense Winner Reveal Audio & Animations**:
  - Web Audio API: `dramatic_tension_riser`, `winner_drumroll_boom`, `champion_fanfare_epic`.
  - Visuals: Camera vibration (`.dramatic-screen-rumble`), gold aura shockwave (`.golden-aura-glow`), 3D trophy slam (`.trophy-intense-slam`), 180 confetti storm.
  - Remote trigger controls for host: "🥁 Tension Drumroll" and "🏆 4. Reveal Champion (Epic)".

---

## 11. HOD Interactive Showcase Mode, GitHub Actions & Cloud Deployment
- [x] **Automated GitHub Actions Deployment (`.github/workflows/deploy-pages.yml`)**:
  - Automatically runs `npm test` to verify all 48 test stages on Ubuntu CI runner.
  - Automatically packages and deploys `./public` to GitHub Pages (`https://ved-mangukiya.github.io/TheTradingFLoor/`).
- [x] **Client-Side Interactive Showcase & Demo Sandbox Engine**:
  - Built-in `MockEngine` in `public/app.js` loaded with all 20 real Indian listed equities (`RELIANCE`, `TATAMOTORS`, `MARUTI`, `TCS`, `INFY`, `HDFCBANK`, `ICICIBANK`, `LT`, etc.).
  - Automatically activates when visited on GitHub Pages or with `?demo=1`, eliminating server cold starts or dead connection loops.
  - Realistic 2-second micro-ticks simulate price movements, updating live sparkline charts and projector auto-cycle.
  - Fully interactive Host Panel (Pause, Resume 3-2-1, Broadcast News, Toggle Circuit Breaker Halts).
  - Fully interactive Trader Terminal (Team 1 Dalal Street Titans, ₹10,00,000 cash, Buy/Sell modal order execution with audio chimes and P&L updates).
- [x] **1-Click HOD & Faculty Demo Launchers (`#demoQuickAccessCard`)**:
  - Direct 1-click access buttons on the login screen for `👑 Open Event Host Control Panel`, `📊 Open Big Screen Auditorium Projector`, and `💻 Open Trader Desk`.
  - Floating top demo role switcher banner (`#ttfDemoBanner`) with quick-switch pills (`👑 Host`, `📊 Projector`, `💻 Trader`, `🏆 Winner Stage`, `🔊 Sound`).
- [x] **1-Click Cloud Deployment Blueprint (`render.yaml`)**:
  - Zero-config blueprint ready for Render.com free tier hosting (`node server.js live` with full WebSocket support).
- [x] **Instant 10-Second Public Tunnel (`Launch_The_Trading_Floor.bat`)**:
  - Launches local server and exposes it via secure Cloudflare Tunnel (`npx -y untun tunnel --port 3000`), giving Ved an instant public HTTPS link for live demonstration.
- [x] **Production Event Day LAN Invariant Preserved**:
  - When accessed on localhost or local LAN IP (`192.168.x.x`), the system connects 100% directly to the authoritative Node.js server. Demo overlays stay hidden.

---

## 12. Paper Trading Cards UX, Universe Filters & Directional Circuit Breakers (v2.5.0)
- [x] **Upgraded Stock Trading Cards (Inspired by Paper Trading Cards `media_1792231121505.html`)**:
  - Structured card layout: Clean stock identity, sector badge, current price, day open, and percentage delta.
  - Position Unrealized P&L: Displays live profit/loss breakdown (`+₹Z (+W%)`) with color-coded badges for active positions.
  - Integrated Quick Stepper & Lot Presets: Quick-adjust lot buttons (`+5`, `-5`) directly accessible.
  - Primary Trade Action Trigger: Clean `Trade` button launching the unified interactive Trade Modal.
- [x] **Advanced Universe Filtering & Multi-Metric Sorting**:
  - Live Search Box: Instant case-insensitive ticker and company name search.
  - Sector Filtering: Dynamic sector dropdown plus clickable sector chips (`#traderSectorChips`).
  - Multi-Metric Sorter: Gainers, Losers, Price: High to Low, Price: Low to High, Highest Value.
  - "Holdings Only" Toggle: Instant checkbox filter isolating actively owned assets.
  - Empty-State Reset: Educational guidance card with 1-click `Reset All Filters` when no stocks match.
- [x] **Interactive Trade Modal with Real-Time Affordability Engine**:
  - Tabbed BUY / SELL Switcher: Clear visual side toggle updating context, limits, and guidance.
  - Stepper Controls: Responsive `−` / `+` share quantity adjustment buttons.
  - Quick Lot Pills: `+1`, `+5`, `+10`, `+25`, `+50`, `+100`.
  - Dynamic Budget / Holding Preset Pills:
    - BUY Mode: `25%`, `50%`, `75%`, `Max` of available cash.
    - SELL Mode: `25%`, `50%`, `75%`, `All` of held shares.
  - Live Affordability Recalculation:
    - Gross trade value, transaction fee, and total cash impact updated in real-time.
    - Remaining Cash in Hand preview before order dispatch.
    - Educational balance validation: High-contrast shortfall alerts explaining exactly how many shares can be afforded.
- [x] **Directional Upper & Lower Circuit Breakers**:
  - Upper Circuit Limit ($+20\%$): Clamps price at ceiling, blocks BUY orders, and permits SELL orders to inject downward liquidity.
  - Lower Circuit Limit ($-20\%$): Clamps price at floor, blocks SELL orders, and permits BUY orders to inject upward liquidity.
  - Order-Flow Circuit Recovery: Counter-directional trades dynamically adjust price and unhalt the stock.
  - 0.8% Mean-Reversion Buffer: Background 1-second price loop prevents premature unhalting on micro-noise.
  - Strict Stock Isolation: A circuit halt on one stock never freezes the broader market or other stocks.
- [x] **Explicit Day 1 ➔ Day 2 Lifecycle State Machine**:
  - Non-Ambiguous Status: Timer expiration and manual conclusion set `status = 'DAY_COMPLETED'` (never ambiguously "Paused by Host").
  - Trader Station Guidance: Displays high-visibility `#traderDayCompletedOverlay` ("Day X Concluded • Standby for Day X+1").
  - Auditorium Projector Banner: Dedicated `#projDayCompletedBanner` with audited daily leaderboard snapshot.
  - Seamless Balance Carry-Over: Cash, share holdings, and trade history carry over cleanly into subsequent competition days.
- [x] **Comprehensive Automated Verification**:
  - `test_master_suite.js`: **52/52 PASSED (100%)** (Core end-to-end regression across all stages).
  - Clean regression test pass rate: **100%**.

---

## 13. P0 Critical Invariants, Responsive 4:3 Projector & UX/DX Enhancements (v2.5.1)
- [x] **P0 Circuit Breaker Day Open Price Immutability**:
  - Eliminated rogue reassignment of `dayOpenPrice = currentPrice` during manual unhalt (`HOST_UNHALT_STOCK`) and sector unhalt (`HOST_SECTOR_HALT`).
  - `dayOpenPrice` remains anchored as the true immutable reference for the trading day, preventing stocks from escaping $\pm 20\%$ daily circuit boundaries.
  - Guarded `HOST_RANDOMIZE_PRICES` to reset `dayOpenPrice` only in `SETUP` mode.
- [x] **P0 Protected Analytics & Financial Inspection Authentication**:
  - Applied `requireHostAuth` middleware to `GET /api/team-investments` and `GET /api/team-investments/:teamId`.
  - Unauthenticated requests receive HTTP 403 Forbidden; confidential team cost basis, holdings, and realized P&L are protected against network snooping.
  - Fixed trade history filtering to match authoritative `team_id` / `teamId` attributes.
- [x] **P0 News Event Idempotency & Per-Day Registry**:
  - Implemented `firedNewsEventsPerDay = new Map()` tracking key format `day_${dayNum}_${event_id}`.
  - Guaranteed each scheduled or breaking news event fires strictly once per intended day, eliminating duplicate price shocks and repeated audio chimes on client reconnection.
  - Automatically resets registry upon day advance (`HOST_NEXT_DAY`) and championship reset.
- [x] **P0 Explicit Championship Finalization & Day Completion Gating**:
  - Concluding the final day transitions to `DAY_COMPLETED` and broadcasts `FINAL_DAY_COMPLETED` with `requiresExplicitFinalization: true`.
  - `HOST_CONCLUDE_CHAMPIONSHIP` explicitly validates that `currentDay === totalDays` and `status === 'DAY_COMPLETED'`, preventing accidental premature tournament conclusions.
- [x] **P0 Checkpoint Restoration Lifecycle Preservation**:
  - Preserves legitimate stopped states (`SETUP`, `STANDBY`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`, `FINAL_ANALYSIS`) upon checkpoint restore, distinguishing recovery pauses (`pauseMode = 'RECOVERY'`) from manual Host pauses.
  - Cancels stale countdown timers and rebuilds `firedNewsEventsPerDay` directly from restored event states.
- [x] **P0 Next Day Rollover Validation**:
  - Enforced that advancing to the next day requires `status === 'DAY_COMPLETED'`, preventing skipped daily snapshots.
  - Resets triggered status and impacts for upcoming day news events.
- [x] **Classroom 4:3 Projector Native Layouts (1024×768 & 800×600)**:
  - Added specialized aspect-ratio detection: `@media (min-aspect-ratio: 4/3) and (max-aspect-ratio: 1.4/1)`.
  - Dedicated $4 \times 2$ (8-card) grid for 1024×768 and $3 \times 2$ (6-card) grid for 800×600 resolutions with safe margins (5% horizontal, 8% vertical).
  - Scaled typography for long-distance viewing and vertical podium layout for winner ceremony.
- [x] **Mobile-First & Tablet Responsive Suite**:
  - Mobile layouts (320px–640px) with single-column stacked cards, full-screen order entry modals, and 16px form inputs to prevent iOS/Android zoom.
  - Tablet layouts (641px–1024px) with 2-column stock grids and touch-optimized controls.
  - Touch targets meeting WCAG 2.2 standards ($\ge 44 \times 44\text{px}$) with `-webkit-overflow-scrolling: touch`.
  - Body role tagging via `document.body.setAttribute('data-role', role)`.
- [x] **RFC 4122 Cryptographic Trade UUIDs**:
  - Migrated `tradeId` generation in `server.js` from sequential strings to cryptographically unique 128-bit `crypto.randomUUID()`.
  - Retained sequential `seq` counter for chronological sorting, backward compatibility, and CSV exports.
- [x] **Loading States, Skeleton Screens & Keyboard Shortcuts**:
  - CSS loading utilities: `.btn-loading`, `.skeleton`, `.skeleton-card`, `.spinner-inline`, indeterminate progress bars.
  - Global Keyboard Shortcuts Help Modal accessible via `?` key.
  - Host shortcuts: `Ctrl+Space` (Pause/Resume), `Ctrl+S` (Save Checkpoint), `Ctrl+D` (Advance Day).
  - Projector shortcuts: `F` (Fullscreen), `L` (Lock/Unlock Screen).
  - Enhanced toast notifications with action button callbacks (`showEnhancedToast()`).
- [x] **Clean UTF-8 Character Encoding**:
  - Fully restored clean UTF-8 encoding across `server.js` with zero character corruption.
- [x] **DOM ID Deduplication (DOM-01 Resolved)**:
  - Namespaced all 21 duplicate element IDs in `#hostTabContentSetup` (`public/index.html`) using the `hostTabSetup_` prefix.
  - Verified via `tools/find_duplicate_ids.js` that exactly 0 duplicate element IDs remain across the entire DOM tree.
- [x] **Automated Test Suite Expansion & Token Wiring (TST-01 Resolved)**:
  - Updated `test_dynamic_upgrade_suite.js` with Host session token auth, verifying 403 Forbidden on unauthenticated access and 200 OK on authenticated analytics.
  - Added self-contained auto-boot and teardown across all test runners.
  - Full end-to-end suite passing: `npm run test:all` executes 86/86 automated tests across 3 suites with 0 failures.

---

## 14. Master Bug-Fix & UX Polish (v2.5.2)
- [x] **Day Conclusion Non-Pause Invariant**:
  - `concludeCurrentDay()` sets `isPaused = false` and `status = 'DAY_COMPLETED'`. Day completion is an authoritative terminal state, not a pause.
  - Stopped clock and price loops when status is not `LIVE`.
  - Trader terminal `#traderDayCompletedOverlay` elevated to `z-index: 10000;` with backdrop blur, preventing `#softPauseOverlay` from covering the screen.
  - Real dynamic leaderboard rendered on `#traderDayCompletedOverlay` displaying all teams, gold/silver/bronze medals, `(YOU)` desk highlight, net worth, return %, and green/red P&L (`#16804a` / `#b42318`).
  - Added persistent `#3f6292` Waiting for Host banner with clock icon: *"Trading session completed successfully • Waiting for the host to start the next trading day"*.
- [x] **Strict Login Screen Isolation**:
  - WebSocket event dispatcher immediately drops news toasts, circuit strobe/banners, 3s countdown overlays, pause popups, audio cues, and private ticks for unauthenticated clients (`!isLoggedIn || currentRole === null`).
  - Terminal logout resets authenticated state and cleans up all overlays, strobes, and timers.
- [x] **Real-Time Live Setup Status Without Refresh**:
  - New and reconnecting sockets immediately receive `PUBLIC_EVENT_STATUS`.
  - Host config lock (`EVENT_CONFIG_LOCKED`) propagates instantaneously to all public clients, dynamically flipping setup banner from amber ("Setup in Progress") to emerald ("Competition Ready • Logins Open") without manual browser refresh.
- [x] **Host Control Lifecycle Safety**:
  - Contextual host controls: distinct actions per phase (Trading: Pause / Conclude; Paused: Resume 3-2-1 / Conclude; Day Completed: Advance to Day N+1 / Finalize).
  - Server validation rejects invalid transitions (cannot pause a concluded day, duplicate concludes rejected, cannot resume concluded day).
  - All orders rejected during `DAY_COMPLETED` with clear notice: *"🔔 Day N trading has concluded. All portfolios are locked until the Host opens Day N+1."*
  - Seamless balance, holding, and P&L carry-over into Day 2 without reset.
- [x] **Comprehensive Master Test Suite**:
  - Added `test_master_lifecycle_and_isolation.js` with 13 comprehensive end-to-end verifications.
  - Total automated verification: `npm run test:all` executes **99/99 automated tests across 4 test suites with 0 failures (100% pass rate)**.

---

## 15. Master Interaction Logic, State Machine & UX Hardening (v2.5.3)
- [x] **Authoritative State-Aware Resume & Pause Protection**:
  - Exact prompt compliance on concluded day resume attempts: Returns authoritative rejection `"Day N has ended. Trading cannot be resumed. Review the results and prepare the next day."` with exact day number.
  - Countdown callback race condition eliminated: In countdown timer callback, checks `if (gameState.status === 'DAY_COMPLETED' || gameState.isConcluded) return;` preventing unpausing if conclusion occurs during 3-2-1.
  - Duplicate pause prevention: In `HOST_PAUSE`, if `gameState.isPaused && gameState.status !== 'COUNTDOWN' && !activeCountdownTimer`, rejects with `"Trading is already paused. Resume trading when you are ready."`. If paused during countdown, cancels countdown gracefully.
- [x] **Atomic Day Conclusion Idempotency & Audit Trail**:
  - Atomic idempotency guard in `concludeCurrentDay()` prevents duplicate leaderboards, dual ledger snapshots, or multi-broadcasts on concurrent conclude calls.
  - Audit trail differentiation: Records `gameState.isAutomaticEnd` (`true` for timer expiry, `false` for manual host action) and `gameState.concludedReason` (`'TIMER_EXPIRY'` vs `'MANUAL_HOST_ACTION'`).
  - Automatic expiry client announcement: Broadcasts `"The trading timer has ended. Results have been finalized, and trading cannot be resumed for this day."`.
- [x] **Complete Setup & Stock Universe Immutability**:
  - Backend enforcement: Guards `HOST_ADD_SHARE`, `HOST_REMOVE_SHARE`, `HOST_DUPLICATE_SHARE`, `HOST_APPLY_MARKET_TEMPLATE`, `HOST_RESET_UNIVERSE_BASELINE`, and `HOST_CONFIGURE_TEAMS` to reject modifications whenever `gameState.configLocked === true`.
  - Mid-competition lock tampering protection: `HOST_SET_EVENT_LOCK` rejects unlock requests if competition has already started (`status === 'LIVE' || elapsedSeconds > 0 || currentDay > 1`).
  - Setup form fields visually disabled: Section 1 inputs (`setupEventTitle`, `setupInstitution`, `setupStartingCash`, `setupTotalDays`, `setupDayDuration`, `setupTransactionFee`, `setupCircuitBreaker`) styled with `#F8FAFC` background and `cursor: not-allowed` when locked.
- [x] **Canonical Market Operations Bar Dynamic Synchronization**:
  - Fully dynamic state synchronization in `updateHostTournamentFlow()` for `#btnMarketResume`, `#btnMarketPauseSoft`, `#btnMarketPauseBlackout`, `#btnMarketCloseSession`, and `#marketOpsLiveBadge`.
  - In `LIVE` trading: Pause buttons active; Resume disabled and styled neutral.
  - In `PAUSED`: Resume button active (`#16a34a`); Pause buttons disabled and neutral.
  - In `DAY_COMPLETED`: Resume and Pause buttons both disabled (`cursor: not-allowed`, opacity 0.45); Conclude button disabled; Next Day / Finish actions highlighted.
- [x] **Double-Click Debounce & Action Feedback**:
  - Added debounce guards to `executeConcludeDay()` and `executeStartNextDay()` preventing rapid double-click submissions.
  - Informative toasts added to `hostPauseMarket()` and `hostResumeMarket()` when attempted in invalid states.
- [x] **Master Interaction & State Machine QA Suite (`test_interaction_logic_and_state_machine.js`)**:
  - 16 comprehensive automated tests validating all 12 QA Trials on isolated port 3091.

---

## 16. Master Quantitative Engine, Dynamic Time Ratios, News Scheduling & Sensitive Parameter Security (v2.6.0)
- [x] **Sensitive Parameter Security & Public State Sanitization**:
  - `beta` and `volatility_factor` are attached to `companies` inside `getSanitizedPublicState()` strictly when `isHost === true`. For `TRADER`, `PROJECTOR`, and unauthenticated sockets, internal parameters are completely stripped (`undefined`).
  - Removed `BETA:` display on trader stock cards, replaced with `LOT: N SH`.
  - Replaced `Stock Beta` panel in public stock details modal (`modalStockDetails`) with `Face Value: ₹10.00` (`modalFaceValue`).
  - Quarantined quantitative editing in the Host Share Modal (`shareEditorModal`) under a collapsible `<details id="advancedSimSettings">` accordion titled *"⚙️ Advanced Simulation Settings (Beta & Volatility Factor)"*, accompanied by clear non-technical guidance.
- [x] **Dynamic Time Management & Proportional News Scheduling**:
  - Stored canonical relative timeline fractions (`relative_position: t_i / D`) on all auto-generated and user-configured news events.
  - Implemented `recalculateNewsScheduleForDuration(newDuration)` on server and `generateClientNewsPreview` on client:
    $$t_i = \operatorname{round}(D \times p_i)$$
  - Enforced dynamic reading windows ($W$) with non-zero cognitive floors:
    - $D \le 300\text{s}$ (5m): $W = 12\text{s}$
    - $D \le 600\text{s}$ (10m): $W = 18\text{s}$
    - $D \le 1200\text{s}$ (20m): $W = 22\text{s}$
    - $D > 1200\text{s}$ (30m+): $W = 25\text{s}$
  - Added schedule feasibility validation (`validateScheduleFeasibility`): guarantees $t_i > 0$, $t_i + W \le D - 15\text{s}$, and inter-event separation $\Delta t \ge 60\text{s}$.
  - Added `HOST_RECALCULATE_SCHEDULE` WebSocket action and automatic schedule synchronization in `HOST_UPDATE_EVENT_CONFIG` and `HOST_SET_EVENT_LOCK`.
- [x] **One-Time Locked News Schedule & Publication Idempotency**:
  - `HOST_PUBLISH_NEWS_NOW` enforces strict exactly-once publication per day, returning `ORDER_REJECTED: Already published for today` if triggered more than once.
  - Once event configuration is locked (`gameState.configLocked === true`), server rejects all attempts to add, duplicate, edit, or cancel scheduled news events.
- [x] **12-Hour AM/PM Clock Formatting**:
  - Implemented canonical `formatClock12H(dateOrIso, includeSeconds = false)` returning formatted 12-hour strings (`9:30 AM`, `12:05 PM`, `4:15 PM`).
  - Standardized all absolute timestamps across waiting room cards, activity feeds, trade logs, snapshot finalized timestamps, and scheduled opening toasts.
- [x] **Master Quantitative & Security Verification Suite (`test_master_quantitative_and_security_suite.js`)**:
  - 7 comprehensive automated tests validating host vs trader parameter isolation, dynamic 30m-to-45m schedule scaling, schedule locking, news idempotency, circuit breakers, and daily P&L.

---

## 17. Unified Single-Flow Master Verification Architecture (v2.6.1)
- [x] **Elimination of Port Collisions & Process Leaks**:
  - Replaced fragmented, overlapping test runners with a single authoritative chronological state-machine test runner: `test_unified_master_flow.js`.
  - Bound exclusively to isolated port 3099 with child-process lifecycle tracking and guaranteed `serverProcess.kill('SIGKILL')` cleanup in a robust `finally` block.
- [x] **Zero Disk State Mutation Guarantee**:
  - Automatic in-memory backup of `data/universe_active.json` before any test runs and automatic disk restoration on process completion/exit.
  - Guarded `saveUniverseToDisk()` and `HOST_RESET_UNIVERSE_BASELINE` in `server.js` against unlinking or overwriting `data/universe_active.json` when `activeScenarioMode === 'test'` or `process.argv.includes('test')`.
  - Verified disk universe remains 100% pristine with 20 real Indian enterprise baseline companies.
- [x] **Protocol Standardization & Action Alignment**:
  - `HOST_START_NEXT_DAY` & `HOST_NEXT_DAY`: Standardized day transitions, broadcasting both `DAY_TRANSITION` and `DAY_ADVANCED` with both `newDay` and `currentDay`.
  - `HOST_CONCLUDE_CHAMPIONSHIP` & `HOST_FINISH_EVENT`: Uniformly finalize the championship, setting `status = 'CHAMPIONSHIP_CONCLUDED'`, generating `winnerData` and `finalResultsSnapshot`, and broadcasting `CHAMPIONSHIP_CONCLUDED`.
  - `HOST_RESET_ENTIRE_CHAMPIONSHIP`: Authoritatively accepts `'RESET'`, `'RESET CHAMPIONSHIP'`, and `'RESET THE ENTIRE CHAMPIONSHIP'`, generates an isolated `eventId`, preserves Host session credentials, broadcasts `CHAMPIONSHIP_RESET` to all connected clients, and responds with `CHAMPIONSHIP_RESET_ACK`.
  - `HOST_TRIGGER_NEWS`: Rejects duplicate triggers with `ACTION_REJECTED` and zero second shock or news flash; added `id: eventObj.event_id` to `newsRecord` payload.
- [x] **11 Chronological Tournament Lifecycle Phases (100% Pass Rate)**:
  - Phase 1: Pre-Auth Security, Real Universe Baseline & Login Isolation (SETUP state, 403 REST guards).
  - Phase 2: Host Auth, Pre-Lock Gating, Dynamic Schedule & Custom Share Setup (`HOST_RECALCULATE_SCHEDULE`, `CAMPUSCO` addition, invalid lock rejection).
  - Phase 3: Setup Lock, Config Immutability & Role Parameter Isolation (live lock propagation, 5 post-lock mutation rejections, zero parameter leakage to non-hosts).
  - Phase 4: Countdown, Cancel, Duplicate Pause & Emergency Stop State Machine (order rejection in standby, 3-2-1 countdown, pause cancel, duplicate pause rejection, emergency stop).
  - Phase 5: Order Accounting (10 bps), Debounce, Share Toggle & Liquidation (exact fee deduction, oversell/overbuy rejection, 200ms anti-spam debounce, share disable/enable toggle, `LIQUIDATE_ALL`).
  - Phase 6: Real News Idempotency (Zero Double Shock) & Directional Circuit Breakers (scheduled news idempotency, custom news shock, upper circuit buy halt, stock isolation, lower circuit sell halt, counter-flow buy recovery).
  - Phase 7: Team Investment Analytics & Privacy-Safe Macro APIs (`/api/team-investments` net worth math invariant, `/api/market-indices`, `/api/sector-allocations` privacy).
  - Phase 8: Concurrency-Safe Day 1 Conclusion & Non-Pause Invariant (atomic single conclusion on concurrent triggers, `DAY_COMPLETED`, zero `MARKET_PAUSED`, Day 1 snapshot lock).
  - Phase 9: Day 2 Carry-Over & Strictly Isolated Daily vs. Cumulative P&L Math (holdings carry-over, Day 2 buy & price shock, isolated daily vs cumulative P&L math, final day advance gating, `HOST_ADD_DAY` to Day 3).
  - Phase 10: Grand Finale, Audited CSV/JSON Exports & 6-Stage Winner Reveal (`CHAMPIONSHIP_CONCLUDED`, 5 export endpoints, projector auto-cycle, 6-stage presentation scenes).
  - Phase 11: Full Championship Reset & Second Event Identity Isolation (phrase verification, fresh `eventId`, Day 1 STANDBY, clean projector reconnection).
- [x] **Canonical Test Execution**:
  - Verified via `npm test` and `node test_unified_master_flow.js`: **All 36 assertions passed across all 11 phases with 0 errors (100% pass rate)**.

---

## 18. Chunk 3 — Complete User Journeys and Screen Redesign (v2.6.3)
- [x] **FLOW-001: Deterministic Role & Overlay Router (`syncRoleOverlays`)**:
  - Overlay visibility across terminals is a deterministic mathematical function of `(status, pauseMode, currentRole)`.
  - `#traderWaitingRoomOverlay` is visible strictly during `STANDBY` and `SCHEDULED`.
  - `#softPauseOverlay` is visible strictly during `PAUSED (VISIBLE_FROZEN)` or `PAUSED (RECOVERY)`.
  - `#blackoutOverlay` is visible strictly during `PAUSED (BLACKOUT)` or `PAUSED (EMERGENCY_HALT)`.
  - In `STANDBY`, `SCHEDULED`, and `DAY_COMPLETED`, `#softPauseOverlay` and `#blackoutOverlay` are strictly suppressed.
  - `#countdownOverlay` (3-2-1) takes absolute precedence during countdown, temporarily hiding all background blocking cards.
- [x] **FLOW-002: Single Canonical Setup Workspace in Hub 2 (`#hostTabContentEvent`)**:
  - Eliminated split-setup personality: standalone `#eventSetupView` replaced with compatibility container; Hub 2 (`#hostTabContentEvent`) is the sole authoritative 6-step Setup Workspace (`Details -> Teams -> Universe -> Schedule -> News -> Review & Lock`).
  - Total unique IDs verified: 712, **0 duplicate IDs**.
  - Dynamic team roster supports Solo, 2, 4, 8, 16 presets + dynamic Add/Remove team rows.
  - Stock catalogue supports live search, sector filtering, and auto-generated balanced news timeline.
  - Added backward-compatible DOM ID proxy (`LEGACY_SETUP_ID_MAP`) so legacy tests querying `hostTabSetup_*` transparently resolve.
- [x] **FLOW-003: Sub-Navigation Bars for Host Hub 3 & Hub 4**:
  - Hub 3 (Live Market) Sub-Navigation: `#hostMarketSubNav_all`, `stocks`, `news`, `leaderboard`, `analysis`, `trades`.
  - Hub 4 (Stage & Results) Sub-Navigation: `#hostStageSubNav_projector`, `day`, `sound`, `commentary`, `launcher`, `exports`.
  - Functions `switchHostMarketSubTab(tab)` and `switchHostStageSubTab(tab)` manage individual panel visibility and pill button active styling.
- [x] **FLOW-004: Read-Only Post-Close Trader Mode**:
  - When a day concludes, `#traderDayCompletedOverlay` presents audited daily net worth and P&L.
  - Dismissing the overlay reveals `#traderReadOnlyConcludedBanner` with persistent `#btnReopenDaySummary`.
  - In Read-Only mode (`status === 'DAY_COMPLETED' || status === 'CHAMPIONSHIP_CONCLUDED'`), Buy, Sell, and Liquidate All controls are disabled with clear tooltip guidance.
- [x] **FLOW-005: Sound Console Autoplay Policy Unlock & Audio Cue Isolation (DEF-016 / DEF-032)**:
  - If `AudioContext.state !== 'running'`, `#soundAutoplayUnlockOverlay` is displayed on `#soundConsoleView`.
  - Supports click or pressing `Spacebar` to resume context and arm hall PA audio.
  - `server.js` `broadcastAudioCue` isolates cues strictly to `soundClients` (`SOUND_CONSOLE`), forwarding only explicit test cues to `HOST`. Traders and unauthenticated public sockets receive 0 audio cues.
- [x] **FLOW-006: Flicker-Free Projector 8-Card Slot Reuse (DEF-031)**:
  - Replaced destructive `grid.innerHTML = ...` cycle with 8 pre-allocated persistent card slots (`#projCardSlot_0` .. `#projCardSlot_7`) and canvases (`#projCanvasSlot_0` .. `#projCanvasSlot_7`).
  - Cards, ranks, prices, circuit banners, and HiDPI Bezier sparklines update in place every 8 seconds without DOM or canvas context destruction.
- [x] **FLOW-007: Ceremony Audio Idempotency on Refresh (DEF-030)**:
  - Stored `${eventId}_${normScene}` in `sessionStorage`. Browser refreshes during the awards ceremony render visual elements without replaying the grand brass victory fanfare.
- [x] **DEF-009 / DEF-010: Winner Presentation UI Gating**:
  - Gated `#btnLaunchPresentationAnalysis` and `#btnLaunchPresentationProjector`: disabled with explanatory tooltip unless `status === 'CHAMPIONSHIP_CONCLUDED' || (status === 'DAY_COMPLETED' && currentDay >= totalDays)`.
- [x] **Verification Status**:
  - `npm run test:chunk3`: **89/89 assertions passing (100%)**.
  - `npm run test:chunk2`: **5/5 assertions passing (100%)**.
  - `npm test`: **36/36 assertions passing (100%)**.

---

## 19. Chunk 4 — Universal Action Contracts, In-Flight Locking & Double-Click Shield (v2.6.4)
- [x] **BTN-000: Universal Action Contract Pattern (`applyActionContractLock`, `releaseActionContractLock`)**:
  - Centralized in-flight contract engine tracking all pending network operations via `inFlightActionButtons` Map.
  - Calling `applyActionContractLock(button, processingText)`:
    - Atomically disables the button (`button.disabled = true`).
    - Stashes original text into `button.dataset.originalText` (safeguarded against duplicate writes).
    - Swaps button label to active processing text (e.g., `'Confirming Order...'`, `'Liquidating All Shares...'`, `'Resuming (3-2-1)...'`, `'Halting Floor...'`).
    - Arms a guaranteed 5000ms safety timeout fallback that automatically releases locks and displays an order toast if the server or network stalls.
  - Calling `releaseActionContractLock(button)` or `releaseActionLockById(btnId)`:
    - Cancels active safety timers.
    - Re-enables the button (`button.disabled = false`).
    - Restores the original label from `dataset.originalText`.
  - Calling `releaseAllActionLocks()`:
    - Sweeps all in-flight buttons and returns the entire UI to responsive standby.
- [x] **BTN-001: Trader Order Execution Double-Click Shield (`#btnExecuteTradeOrder`)**:
  - Locked on click 1 with `'Confirming Order...'`.
  - Subsequent rapid clicks while in-flight return immediately, emitting 0 duplicate WebSocket frames.
  - Released on server `ORDER_FILLED` or `ORDER_REJECTED` or modal close (`closeTradeModal()`).
- [x] **BTN-002: Trader Liquidation Double-Click Shield (`#btnConfirmLiquidate`)**:
  - Locked on click 1 with `'Liquidating All Shares...'`.
  - Rapid double-clicks are rejected immediately with 0 extra network frames.
  - Released on server `PORTFOLIO_LIQUIDATED` or `ORDER_REJECTED` or modal close (`closeLiquidateModal()`).
- [x] **BTN-003: Login Terminal Access In-Flight Lock (`#btnLoginSubmit`)**:
  - Locked on submit with `'Connecting...'` or `'Accessing Terminal...'`.
  - Released on server `LOGIN_SUCCESS` or `LOGIN_ERROR`.
- [x] **BTN-004: Host Live Market Operations In-Flight Locks**:
  - `#btnMarketResume`: Locked with `'Resuming (3-2-1)...'`, released on `COUNTDOWN_START` or `MARKET_RESUMED`.
  - `#btnMarketPauseSoft`: Locked with `'Pausing...'`, released on `MARKET_PAUSED`.
  - `#btnMarketPauseBlackout`: Locked with `'Blackout...'`, released on `MARKET_PAUSED`.
  - `#btnMarketCloseSession`: Locked with `'Closing Day...'`, released on `DAY_CONCLUDED`.
- [x] **BTN-005: Host Lifecycle & Emergency Controls**:
  - `#btnConfirmEmergencyStop`: Locked with `'Halting...'`, released on `EMERGENCY_STOP`.
  - `#btnExecuteStartNextDay`: Locked with `'Advancing Day...'`, released on `DAY_TRANSITION` or `DAY_STARTED`.
  - `#btnConfirmAddDay`: Locked with `'Adding Day...'`, released on `DAY_ADDED` or `EVENT_DAYS_UPDATED`.
  - `#btnConfirmResetChampionship`: Locked with `'Resetting Tournament...'`, released on `CHAMPIONSHIP_RESET`.
  - `#btnSubmitLockSetup`: Locked with `'Submitting & Locking...'`, released on `EVENT_CONFIG_LOCKED`, `EVENT_CONFIG_CHANGED`, or `SETUP_VALIDATION_ERROR`.
  - `#btnUnlockEventConfig`: Locked with `'Unlocking...'`, released on `EVENT_CONFIG_UNLOCKED`.
- [x] **BTN-006: Presentation Ceremony Launch & Dismiss Controls**:
  - `#btnLaunchPresentationAnalysis` & `#btnLaunchPresentationProjector`: Locked with `'Launching Ceremony...'`, released on `PROJECTOR_STATE_UPDATE`.
  - `#hostDismissPodium`: Locked with `'Closing Ceremony...'`, released on `PROJECTOR_STATE_UPDATE`.
- [x] **BTN-007: Disaster Recovery Checkpoint Save Lock (`#btnHostCreateCheckpoint`)**:
  - Locked with `'Saving Checkpoint...'`, released on server `CHECKPOINT_CREATED_ACK`.
- [x] **BTN-008: Server Rejection Catch-All (`ACTION_REJECTED`)**:
  - When the server dispatches `{ type: 'ACTION_REJECTED', reason: '...' }`, `public/app.js` automatically invokes `releaseAllActionLocks()`, instantly re-enabling all buttons and providing clear user toast guidance.
- [x] **DOM ID Uniqueness Verification**:
  - All 718 unique DOM IDs verified with `tools/find_duplicate_ids.js`: **0 duplicate IDs**.
- [x] **Complete Verification Metric Summary**:
  - `npm run test:chunk4`: **64/64 assertions PASS (100%)**.
  - `npm run test:chunk3`: **89/89 assertions PASS (100%)**.
  - `npm run test:chunk2`: **5/5 assertions PASS (100%)**.
  - `npm test`: **36/36 single-flow master assertions PASS (100%)**.
  - Total Verified Assertions Across Suites: **194 / 194 passing with 0 errors**.

---

## 21. Streamlined Event Setup, Reset & Scheduling Flow (Zero Duplication & Single SSOT)
- [x] **Elimination of Duplicate Scheduling Details**:
  - `#scheduleEventModal` now operates as a focused **Opening Countdown Scheduler**: asks ONLY for opening start mode (Immediate 3-2-1 vs Scheduled Date/Time with +1m, +2m, +5m presets).
  - Redundant input fields for Tournament Title, Institution, Round Duration, and Pause Policy were removed from the user interface and replaced with an authoritative read-only setup summary badge (`Active Setup Parameters: Duration: 30m • Pause Policy: Trading Time (Locked & Synchronized)`).
  - Backward-compatible hidden inputs preserved in DOM for full test compatibility.
- [x] **Removal of Premature Setup Step 4 Popup Trigger**:
  - Setup Step 4 (`#setupSectionSchedule`) transformed into a clean inline "Market Duration & Launch Sequence" and "Market Pause Policy Contract" configuration step.
  - Removed confusing "Configure Opening Countdown Timer" popup button that prematurely prompted host to start/schedule before reviewing News (Step 5) or Locking (Step 6).
- [x] **Fluid Step 6 Review & Lock Flow (No Double-Modal Stack)**:
  - Clicking "🔒 Confirm & Lock Event Setup (Open Team Logins)" in Step 6 directly validates tournament parameters and issues `HOST_SET_EVENT_LOCK`.
  - Removed the redundant intermediate `#lockSetupConfirmModal`, transitioning the host directly to `#postLockDay1Modal` ("Championship Setup Locked & Active!").
  - `#postLockDay1Modal` provides 3 crystal clear launch options:
    1. `▶ Start Day 1 Now` (Synchronized 3-2-1 opening countdown).
    2. `📅 Schedule Day 1 Start Time` (Integrated with quick presets: +1M, +2M, +5M Recommended, +10M).
    3. `🚪 Start Later` (Transitions to Host Operations Bar in Standby mode).
- [x] **Browser Visual Verification Verified via `browser_subagent`**:
  - Live walkthrough recorded (`host_streamlined_setup_flow_1792328477578.webp`).
  - Successfully verified championship reset, 6-step guided setup walkthrough, clean Step 4 layout, direct Step 6 lock, post-lock modal quick presets, and Day 1 LIVE market launch.

---

## 22. Host Live Market Data Population, Dedicated Projector Indices & Child-Friendly Strategy UI (v2.6.5)
- [x] **Host Live Market Tables Always Populated**:
  - Resolved empty tables in Host "Live Market" tab (`#hostLeaderboardTbody` and `#hostRecentTradesTbody`).
  - Added fallback `effectiveLeaderboard` derived from `state.allTeamsList` (with initial net worth = starting cash, 0 trades, 0% P&L) when tournament has not executed trades yet.
  - Wrapped both leaderboard and recent trades rendering in robust error guards (`try...catch`) so no upstream error suppresses table output.
  - Hooked `renderHostView(latestState)` into `switchHostMarketSubTab` ensuring tables render immediately when switching between subtabs.
  - Verified in live browser: all registered teams, net worths, cash balances, P&L percentages, and execution stream trades render crisply.
- [x] **Projector Layout Enhancement & Dedicated Full-Screen Indices Scene**:
  - Permanently hidden the persistent top indices bar (`#projIndicesTickerBar` with `display: none !important;`) that previously squeezed stock cards across all scenes.
  - Elevated indices to a dedicated rotation time slot (`SCENE_INDICES` / `#projSceneIndices`) cycling in projector rotation.
  - Engineered zero-CDN Vanilla Canvas charting engine `drawProjectorIndexChart`:
    - Clean reference baseline line (base value: 25,000 / 50,000 / 33,600, etc.).
    - Dynamic gradient area fill with green (+ve) and crimson (-ve) price trajectory.
    - End-point current value beacon dot.
    - Displays TTF NIFTY 20 benchmark hero card + 6 sector cards (Banking, IT, Auto, Energy, Infra, FMCG) with constituent breakdowns.
- [x] **Child-Friendly Team Strategy & Uninvested Capital Scene**:
  - Revamped `SCENE_STRATEGY` (`#projSceneStrategy`) into an intuitive visual format accessible to any spectator or beginner:
    - **Floor Macro Capital Bar**: Displays total tournament-wide liquidity split (`💵 CASH: X%` vs `📈 STOCKS: Y%`).
    - **Strategy Archetype Badges**: Intuitive categorization (`💤 100% IN BANK • SITTING ON SIDELINES`, `🛡️ DEFENSIVE • CASH PRESERVATION`, `⚖️ SMART BALANCED • PRUDENT SPREAD`, `🚀 AGGRESSIVE TRADER • HEAVILY INVESTED`, `⚡ ALL-IN DAREDEVIL • FULL MARKET EXPOSURE`).
    - **"Piggy Bank vs Market" Dual Bars**: Color-coded progress scales showing exact Rupee amounts and percentages for cash-in-hand vs invested equity.
    - **Plain-English Explanations**: E.g., *"Has not purchased any stocks yet. Cash is 100% safe, but missing out on all stock rallies!"* and *"Putting 69% of their money to work in companies. High upside potential!"*.
    - **Industry Exposure Pills**: Displays top sector holdings per team (e.g., `Banking 40%`, `IT & Tech 29%`).
- [x] **Dynamic Local Windows PC Wall-Clock Time for News Wires (Indian Standard Time)**:
  - Eliminated confusing relative session elapsed time (e.g. `at 5 mins` or `05:24`) for published news wires.
  - Stamped `publishedWallClock` on `server.js` using real Windows host clock in Indian format: `nowTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST'`.
  - Added `estimatedWallClock` for scheduled upcoming news wires.
  - Implemented client helper `getNewsWireTime(item)` across all terminal surfaces:
    - Host News Control Centre (`🟢 WIRED AT 03:40:12 PM IST`).
    - Trader Terminal News Stream (`DAY 1 • 🕒 Wired at: 03:40:12 PM IST`).
    - Projector Breaking News Wire (`🕒 Wired at: 03:40:12 PM IST`).
    - Breaking News Toast Banner & Full Screen Breaking News Flash Modals (`DAY 1 • MARKET SHOCK • 🕒 03:40:12 PM IST`).
- [x] **Full Test Suite & Browser Verification**:
  - `npm test` (`node tests/test_unified_master_flow.js`): **36/36 single-flow master assertions passing (100%)**.
  - `node tools/find_duplicate_ids.js`: **0 duplicate IDs** across 738 unique DOM elements.
  - Visual verification executed via `browser_subagent` across Host and Projector views.





