# CHANGELOG — THE TRADING FLOOR CHAMPIONSHIP

All notable changes to **The Trading Floor Championship** platform are documented in this file.

---

## [2.7.0]
### Added
- **Real-World Live Financial News Engine (`server/real_news_feed.js`)**:
  - Live Indian Equities RSS integration pulling genuine market news from Google News RSS / NSE feeds.
  - Authentic publisher source preservation (*The Economic Times*, *Reuters*, *Mint*, *Moneycontrol*, *Bloomberg*, *Financial Express*).
  - Genuine publication timestamps and direct source article links.
  - Dynamic company ticker mapping (correlating headlines to `RELIANCE`, `TCS`, `TATAMOTORS`, `HDFCBANK`, `INFY`, etc.).
  - Automated financial sentiment analysis (Bullish / Bearish / Neutral) with estimated volatility impacts.
  - Offline-first disk persistence in `data/real_news_cache.json` with genuine cache age tracking, ensuring 100% functionality during offline campus events without fabricated data.
  - Background auto-sync worker running every 15 minutes when online, plus manual host trigger via `HOST_SYNC_REAL_NEWS` and REST `/api/real-news/sync`.
  - Host "Broadcast to Floor" capability allowing the event host to shock market prices with real-world breaking news.
- **News Control Centre Sub-Tabs (Host Hub 3)**:
  - Clean segmented view toggling between "📅 Scheduled Scenario Wires" and "🌐 Real-World Live Market Feed".
  - Dedicated real-world news cards with publisher badges, publication times, and 1-click broadcast controls.
- **Production-Grade Documentation & Repository Overhaul**:
  - Rewrote every `.md` file across the repository from scratch based on actual current code.
  - Completely purged obsolete monolithic dossiers, archive logs, and scratch scripts.
  - Enforced platform-wide timelessness across all documentation, UI footers, and terminal banners.

### Fixed
- **News Timer Paused Badge Bug**:
  - Fixed bug where news cards displayed `⏸️ PAUSED` while the market was running live or after resetting and starting a new championship.
  - Implemented authoritative `getNewsCardBadgeHtml()` enforcing mutually exclusive state checks (`isLive`, `isCountdown`, `isActuallyPaused`, `isStandbyOrSetup`).
  - Synchronized Next Scheduled Wire banner (`hostNewsNextBanner`) with identical authoritative state resolution.
- **Post-Lock Day 1 Launch Synchronization**:
  - Verified `HOST_START_DAY1_NOW` and `HOST_RESUME_COUNTDOWN` smoothly transition through authoritative 3-2-1 countdown into `LIVE` market trading.

---

## [2.6.0]
### Added
- **Singular Host Operations Bar**:
  - Unified market operations into a non-duplicated, state-driven Operations Bar on the Host matrix.
  - Clean choice pause actions: Soft Freeze (prices visible) vs. Blackout Pause (prices hidden).
  - One-click resume with authoritative 3-2-1 server countdown and opening bell dispatch.
- **Universal Action Contract Locks**:
  - Implemented client-side button locking to prevent double-click order duplicates or accidental repeated pause commands.
  - 5000ms automatic safety unlock fallback guaranteeing controls never stay permanently frozen if network packets drop.
- **Ceremony Director Bar (Projector Presentation Control)**:
  - Embedded direct 6-scene ceremony switcher in Host Operations for seamless grand finale orchestration.

### Fixed
- **Event Setup Modal Stack Duplication**:
  - Purged redundant setup modals (`#teamSetupModal`, `#eventSettingsModal`, `#championshipWizardModal`).
  - Routed all championship configuration exclusively through the 6-step guided workspace in Hub 2.

---

## [2.5.1]
### Added
- **Classroom 4:3 Projector Native Optimization**:
  - Added dedicated media query aspect-ratio detection (`@media (min-aspect-ratio: 4/3) and (max-aspect-ratio: 1.4/1)`) specifically targeting standard Indian college classroom projectors (`1024×768` and `800×600`).
  - Native 8-card ($4 \times 2$) grid for 1024×768 and 6-card ($3 \times 2$) grid for 800×600, guaranteeing zero horizontal scrollbar and 100% viewport containment.
  - Scaled typography for long-distance auditorium legibility and vertical medal podium orientation for 4:3 projector winner presentation.
  - Safe margins (5% horizontal, 8% vertical) protecting against optical projector bezel clipping.
- **Mobile-First & Tablet Responsive Suite**:
  - Mobile layouts (320px–640px) with single-column stacked cards, full-screen order entry modals, and 16px form inputs to prevent mobile browser auto-zoom.
  - Tablet layouts (641px–1024px) with 2-column stock grids and touch-optimized controls.
  - Touch targets meeting WCAG standards ($\ge 44 \times 44\text{px}$) with `-webkit-overflow-scrolling: touch` momentum scrolling.
- **P1/P2 UX & DX Improvements**:
  - **RFC 4122 Trade UUIDs**: Migrated `tradeId` generation in `server.js` from sequential strings to cryptographically unique 128-bit `crypto.randomUUID()`.
  - **Loading States & Skeleton UI**: Added `.btn-loading` with animated spinner, `.skeleton`, `.skeleton-card`, `.spinner-inline`, and indeterminate progress bars.
  - **Comprehensive Keyboard Shortcuts & Help Modal**: Added global `?` shortcut opening the Keyboard Shortcuts Help Modal, along with `Ctrl+Space` (Pause/Resume), `Ctrl+S` (Save Checkpoint), `Ctrl+D` (Advance Day), `F` (Fullscreen), and `L` (Lock Projector).

### Fixed
- **Circuit Breaker Anchor Immutability (CRITICAL SECURITY)**:
  - Eliminated rogue resets of `dayOpenPrice = currentPrice` during manual unhalt and sector unhalt, strictly anchoring daily circuit limits ($\pm 20\%$) to true day opening prices.
- **Private Investment Analytics Authentication (CRITICAL SECURITY)**:
  - Applied `requireHostAuth` middleware to `GET /api/team-investments` and `GET /api/team-investments/:teamId`, blocking unauthenticated public access to confidential team portfolios with HTTP 403 Forbidden.
- **News Event Idempotency & Per-Day Registry**:
  - Implemented `firedNewsEventsPerDay` Map registry in `server.js` to ensure news events fire strictly once per intended trading day.
- **Day Completion vs Championship Finalization**:
  - Concluding the final day now transitions to `DAY_COMPLETED` and broadcasts `FINAL_DAY_COMPLETED` with `requiresExplicitFinalization: true`.
- **Checkpoint Restoration Lifecycle Preservation**:
  - Restoring saved checkpoints now preserves legitimate stopped states (`SETUP`, `STANDBY`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`), pausing only if active live trading was underway.

---

## [2.5.0]
### Added
- **Paper Trading Cards UX & Structured Information Hierarchy**:
  - Upgraded stock trading cards with luxury tactile card-stock styling, guilloche headers, and letterpress ledgers.
  - Structured card layout cleanly segregating stock identity (symbol, name, sector pill) from financial metrics (current price, day open, high/low range, and percentage delta).
  - Position Unrealized P&L: Displays live profit/loss breakdown with color-coded badges for active positions.
