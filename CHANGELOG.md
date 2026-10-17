# CHANGELOG — THE TRADING FLOOR CHAMPIONSHIP

All notable changes to **The Trading Floor Championship 2026** platform are documented in this file.

---

## [2.2.0] — 2026-10-17
### Added
- **Architectural Separation & Database Transparency**:
  - Documented explicit architectural boundaries between **Preview Website** (zero-server client showcase deployed to GitHub Pages) and **Main Event Hosting** (server-authoritative Node.js exchange running on local LAN).
  - Created [`data/README.md`](data/README.md) clearly mapping `scenario_live.json`, `universe_active.json`, `scenario_test.json`, and disaster recovery checkpoints.
- **Developer Persona & System Architect Elevation**:
  - Branded all terminal views, modals, documentation, and footers with **Ved Mangukiya**, Pursuing BBA, Gujarat Technological University, Surat, Gujarat, India.
  - Complete scrub of legacy coordinator titles, academic years, college acronyms, and institutional codes.

### Removed
- Removed confusing duplicate root `index.html` to establish `public/index.html` as the single canonical SPA entry point.
- Purged legacy standalone test scripts (`test_2hour_heavy_load.js`, `test_checkpoint_disaster_recovery.js`, `test_load_stress.js`, `test_projector_pagination.js`, `test_upgrade_master.js`) in favor of unified `test_master_suite.js`.
- Removed redundant batch files (`Start_Live_Scenario.bat`, `Start_Test_Scenario.bat`, `Open_Host_Panel.bat`, `Open_Projector.bat`) and `.env.example`.
- Purged historical test audit logs and temporary test checkpoints.

---

## [2.1.0] — 2026-10-16
### Added
- **Disaster Recovery Checkpoints & Instant Game Restore**:
  - Full-state snapshots saved in `data/checkpoints/` (`checkpoint_Day{D}_{Sec}s_{label}_{timestamp}.json`).
  - Auto-checkpoints captured every 120 seconds during live trading.
  - Dedicated **Disaster Recovery & Checkpoints Card** in Host `Stage & Results`.
  - Instant manual backup button (`💾 Save Instant Checkpoint Now`) and file upload restore (`📂 Upload Backup File`).
  - Zero-disconnection client restore: Connected terminals remain active, receive `MARKET_RESTORED`, and update instantly without re-logging in.
  - Invariant enforcement: Game always restores in a safe `PAUSED` state waiting for Host `▶ Resume 3-2-1`.
- **Projector Zero-Scroll Automatic Stock Board Pagination**:
  - Automatically slices large stock universes into readable pages (default 8 stocks per page, $4 \times 2$ grid).
  - Rotates every 8 seconds with zero vertical scrolling (`overflow: hidden;`).
  - In-place price updates: WebSocket ticks update visible cards and Bezier sparklines without tearing down DOM or resetting timers.
  - Remote Host control via WebSockets (`HOST_SET_PROJECTOR_BOARD_PAGE`, `HOST_TOGGLE_PROJECTOR_BOARD_PAUSE`).
- **Projector Persistent Spotlight (Top Gainer & Top Loser)**:
  - Permanent spotlight bar positioned above the stock grid, visible across all page flips.
  - Evaluates maximum and minimum percentage changes across all enabled companies in real-time.
  - Deterministic tie-breaking: Alphabetical sorting by ticker symbol prevents flickering.
  - Live Market Breadth indicator displaying advancing vs declining counts.
- **Self-Contained Portable USB Package**:
  - Embedded portable Node.js runtime (`tools/node.exe`, Node v24.14.0).
  - `Pack_Portable_USB_Zip.bat` creates a ready-to-run 35 MB ZIP for zero-dependency college PC execution.
- **Automated Test Matrix Expansion**:
  - Added `test_projector_pagination.js` (Top gainer/loser math, tie-breaks, 20-stock pagination, remote controls).
  - Added `test_checkpoint_disaster_recovery.js` (full save, list, mutate, restore cycle).
  - Added `test_2hour_heavy_load.js` (7,200s endurance test with 480 trades, 78 KB audit log).
  - Expanded `test_master_suite.js` to 48 passing tests (100% pass rate).

---

## [2.0.0] — 2026-10-16
### Added
- **4 Canonical Host Navigation Hubs**: Home, Event Setup, Live Market, and Stage & Results.
- **Automatic Configuration Locking**: Locks tournament settings on valid review; prevents mid-competition tampering.
- **Automatic News Plan Generation**: Host selects companies, system generates 12 balanced, multi-day news items with neutral headlines.
- **60-Second Confidentiality Reveal Window**: Private price impacts masked by default; 60s countdown banner on explicit host reveal.
- **Continuous Smoothstep Price Engine**: $s(u) = 3u^2 - 2u^3$ continuous over elapsed milliseconds.
- **Safe Championship Reset**: Strict confirmation phrase (`RESET CHAMPIONSHIP`) with full-screen trader logout overlay.

---

## [1.2.0] — 2026-10-15
### Added
- **Market Builder & Share Universe Manager**: Dedicated host tab to curate active tradeable stocks without code editing.
- **Stock Universe Persistence**: Saved automatically to `data/universe_active.json` on any add, edit, duplicate, delete, or toggle action.
- **Curated Market Presets**: 1-click templates for Balanced (6 blue-chips), High Volatility (tech/growth), Tech & Auto Focus, Defensive & Value (banking/pharma), and Enable All (12 stocks).
- **Price Randomization**: Host control to randomize base prices (±5% to ±25%) within safe bounds for fresh tournament rounds.
- **Export & Backup Endpoints**: REST endpoints for exporting active universe as JSON (`/api/export/universe`) and CSV (`/api/export/universe-csv`).
- **1-Click Windows Launchers**:
  - `Launch_The_Trading_Floor.bat` with auto Node.js detection, automatic dependency installation, dynamic LAN IP detection, and instant browser opening.
  - `Open_Host_Panel.bat` and `Open_Projector.bat` for quick multi-monitor management.
- **Comprehensive Permanent Documentation Suite**: 17 complete documentation guides in `docs/` and task tracking in `tasks/`.
- **Developer & AI Governance**: Added `AGENTS.md`, `CONTRIBUTING.md`, `.env.example`, and updated `.gitignore`.

### Changed
- Refactored `server.js` public state filtering: Trader and Projector views only receive enabled tradeable stocks; Host receives complete registered universe (`allCompaniesUniverse`).
- Added strict order rejection for disabled shares: `"Trading is not enabled for {TICKER} in this market universe."`.
- Expanded `test_master_suite.js` to assert share universe management, trade rejection on disabled shares, and export endpoints.

---

## [1.1.0] — 2026-10-14
### Added
- **Ivory Luxury Design System**: Warm ivory (`#FBF9F5`), forest accents (`#1A3026`), champagne gold, and high-contrast market badges.
- **Offline Audio Synthesizer**: Web Audio API sound generator producing opening bells, circuit breaker sirens, news alerts, and championship fanfare without external audio files.
- **Grand Finale Winner Podium**: 3-tier gold/silver/bronze podium ceremony with confetti animation and net worth breakdown.
- **Synchronized 3-2-1 Resume Countdown**: Fullscreen modal countdown ensuring fair terminal preparation when pausing and resuming.
- **Audit Logging**: Millisecond-accurate timeline exported to `logs/` in JSON and CSV.

---

## [1.0.0] — 2026-10-10
### Added
- Initial core engine with Express, WebSocket server, mock blue-chip stock simulation, and team order processing.
