# CHANGELOG — THE TRADING FLOOR CHAMPIONSHIP

All notable changes to **The Trading Floor Championship 2026** platform are documented in this file.

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
