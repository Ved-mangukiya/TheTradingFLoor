# CHANGELOG — THE TRADING FLOOR CHAMPIONSHIP

All notable changes to **The Trading Floor Championship** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Author & System Architect**: Ved Mangukiya  
**Repository**: `TheTradingFLoor`  
**Architecture**: Offline-First Zero-CDN Node.js WebSocket Trading Arena Engine

---

## [3.0.0] — 2026-11-04 (Current Production Release)

### Added
- **Multi-Type Trader Graphing Engine (`TFCharts`)**:
  - Implemented interactive Candlestick chart rendering: Japanese Candlesticks with Open, High, Low, Close real bodies and high/low shadow wicks.
  - Implemented classic financial OHLC Bar chart rendering with left-open and right-close ticks.
  - Added 1-click Chart View Style Switcher (`[📈 Line / Area]`, `[🕯️ Candlestick]`, `[📊 OHLC Bar]`) in the full-screen trader analysis modal.
  - Preserved ultra-smooth interactive crosshair with real-time price delta badges and high-DPI canvas scaling.
- **Guided Host & Trader Smart Flow System**:
  - Added `#hostGuidedFlowDirective` live smart directive banner at the top of the Host Operations Bar that provides real-time, plain-English guidance on what to do next at every stage of the tournament.
  - Fully guided state machine: Step 1 (Setup) -> Step 2 (Standby) -> Step 3 (Live Trading) -> Step 4 (Day Conclusion) -> Step 5 (Winner Podium).
  - Clear, educational session guidance for all participant desks.
- **Predefined Coherent Financial News Timelines**:
  - Replaced external web scraping / live RSS volatility shocks with curated, logically sequenced news events written in clear, accessible financial English.
  - Sequenced across Days 1–3 without contradictory headlines, anchored in genuine corporate fundamentals (RBI monetary policy, EV incentives, cloud enterprise contracts, FDA clearances).

### Changed & Hardened
- **Zero-Overflow Editorial Login Screen**:
  - Fixed horizontal scrollbar defect by eliminating the overflowing fixed-width utility bar and replacing it with a responsive, centralized institutional broadsheet login card.
  - Updated user-facing authentication terminology to standard financial terms (`Trader ID / Username` and `Password`).
- **Complete Elimination of AI-Generated Clutter**:
  - Eradicated artificial weather widgets (`SURAT 32°C • BAROMETER 1012 hPa`), fake rating stars, Latin mottoes (*“Veritas in Numeris”*), fake issue numbers, and false security guarantee badges.
  - Removed top reading scroll progress bar entirely.
- **Elimination of URL Credential Leakage**:
  - Stripped query parameter auto-login; opening any new window or tab requires fresh authentication.
  - Replaced URL parameter token downloads with secure HTTP header-based Blob fetching.
- **Developer Identity Formalization**:
  - Author: **Ved Mangukiya** (SSASIT).
  - Streamlined software branding to **The Trading Floor — Arena Engine v3.0**.

---

## [2.7.0] — 2026-11-02

### Added
- **4-Suite Authoritative Regression Test Framework (195 Verified Assertions)**:
  - `tests/test_unified_master_flow.js`: 36 end-to-end assertions verifying all 11 chronological championship phases on isolated port 3099.
  - `tests/test_chunk2_state_machine.js`: 5 assertions for monotonic stateVersion and countdown guards on port 3102.
  - `tests/test_chunk3_ui_and_overlays.js`: 90 assertions verifying role overlay determinism and zero duplicate DOM IDs on port 3103.
  - `tests/test_chunk4_action_contracts.js`: 64 assertions testing universal action contract locks, network shields, and timeout fallbacks on port 3104.
  - Verified 0 duplicate DOM IDs across all 737 unique elements in `public/index.html` via `tools/find_duplicate_ids.js`.
- **Locked Configuration Gates & State Immutability**:
  - Single canonical setup review and lock contract via `#btnSubmitLockSetup` (`submitLockEventSetupValidated`), immediately locking tournament settings and broadcasting `EVENT_CONFIG_LOCKED`.
  - Strict server-side rejection of all 5 post-lock mutation vectors: adding shares, duplicating shares, editing team rosters, recalculating schedules, and modifying news events.
  - Pre-lock login gating: Public sockets and trader desks are strictly blocked from authenticating until the host locks configuration.
- **Real-World Live Financial News Engine (`server/real_news_feed.js`)**:
  - Live Indian Equities RSS integration pulling genuine market news from Google News RSS and NSE feeds.
  - Authentic publisher source preservation (*The Economic Times*, *Reuters*, *Mint*, *Moneycontrol*, *Bloomberg*, *Financial Express*).
  - Dynamic company ticker mapping (correlating headlines to `RELIANCE`, `TCS`, `TATAMOTORS`, `HDFCBANK`, `INFY`, etc.).
  - Automated financial sentiment analysis (Bullish / Bearish / Neutral) with estimated volatility impacts.
  - Offline-first disk persistence in `data/real_news_cache.json` with genuine cache age tracking, guaranteeing 100% functionality during offline campus LAN events without fabricated timestamps.
  - Background auto-sync worker running every 15 minutes when online, plus manual host trigger via `HOST_SYNC_REAL_NEWS` and REST `/api/real-news/sync`.
  - Host "Broadcast to Floor" capability allowing the event host to shock market prices with real-world breaking news.
- **News Control Centre Sub-Tabs (Host Hub 3)**:
  - Clean segmented view toggling between "📅 Scheduled Scenario Wires" and "🌐 Real-World Live Market Feed".
  - Dedicated real-world news cards with publisher badges, publication times, and 1-click broadcast controls.
- **Ceremony Director Bar (`#hostCeremonyDirectorBar`)**:
  - Embedded 6-scene ceremony switcher in Host Operations for seamless grand finale orchestration (`SCENE_INTRO`, `SCENE_BRONZE`, `SCENE_SILVER`, `playDrumrollCue`, `SCENE_CHAMPION`, `SCENE_PODIUM`, `SCENE_LEADERBOARD`).
- **Dynamic Startup Telemetry Dashboard**:
  - Elevated terminal boot banner with LAN IP detection, active scenario mode, baseline company counts, memory telemetry, and direct role instructions.

### Changed
- **Streamlined Hub 2 Setup Workspace**:
  - Completely purged redundant setup dialogs (`#teamSetupModal`, `#eventSettingsModal`, `#championshipWizardModal`, `#lockSetupConfirmModal`).
  - Routed all championship configuration exclusively through the 6-step guided workspace in Hub 2 (`Details -> Teams -> Companies -> Trading Rules -> Schedule -> News Plan -> Review & Lock`).
- **Production-Grade Documentation Overhaul**:
  - Rewrote every `.md` file across the repository from scratch based on actual working code.
  - Purged obsolete monolithic dossiers (`MASTER_CODEBASE_DOSSIER/`, `docs/archive/argon_dossier/`), build scripts, and scratch files.
  - Enforced platform-wide timelessness across documentation, UI headers, and terminal outputs.

### Fixed
- **News Timer Paused Badge Bug**:
  - Resolved bug where news cards displayed `⏸️ PAUSED` while the market was running live or after resetting and starting a new championship.
  - Implemented authoritative `getNewsCardBadgeHtml()` enforcing mutually exclusive state checks (`isLive`, `isCountdown`, `isActuallyPaused`, `isStandbyOrSetup`).
  - Synchronized Next Scheduled Wire banner (`hostNewsNextBanner`) with identical authoritative state resolution.
- **State Machine Monotonicity & Derived Flags**:
  - Added `syncDerivedStateFlags(gameState)` across all state transitions, guaranteeing monotonically increasing `stateVersion` numbers so downstream clients never drop state frames.
- **Winner Podium Infinite Loop**:
  - Prevented winner podium modal from endlessly re-opening on every tick after host dismissal.
- **Emergency Stop Auto-Close Race Condition**:
  - Fixed lifecycle bug where emergency stop modal would auto-close on incoming live tick updates.
- **Circuit Breaker Stabilization & Smoothstep Pause Buffer**:
  - Resuming the market computes `pausedMs = Date.now() - gameState.pauseStartedAt` and advances active transition start times, preventing instantaneous price snaps on resume.

---

## [2.5.0] — 2026-10-17

### Added
- **Formal Multi-Day Championship Lifecycle State Machine**:
  - Standardized state progression: `SETUP` ➔ `STANDBY` ➔ `COUNTDOWN` ➔ `LIVE` ➔ `DAY_COMPLETED` ➔ `CHAMPIONSHIP_CONCLUDED`.
  - Non-ambiguous day conclusion: Setting `status = 'DAY_COMPLETED'` preserves portfolios and displays audited day summaries (never displaying ambiguous "Paused by Host" banners).
  - Dynamic `#traderDayCompletedOverlay` displaying audited daily net worth, daily P&L, cumulative return, and full desk standings.
  - Seamless Day 1 ➔ Day 2 carry-over of cash balances, share positions, and trade histories into subsequent competition days.
  - Concurrency-safe day conclusion with audit trail differentiation (timer expiry vs. manual host action).
- **Directional Upper & Lower Circuit Breakers (±20%)**:
  - Clamps stock price movements strictly within $\pm 20\%$ of immutable `dayOpenPrice`.
  - **Upper Circuit Limit (+20%)**: Clamps price at ceiling, blocks BUY orders, and permits SELL orders to inject downward liquidity.
  - **Lower Circuit Limit (-20%)**: Clamps price at floor, blocks SELL orders, and permits BUY orders to inject upward liquidity.
  - **Order-Flow Circuit Recovery**: Counter-directional trades dynamically adjust price away from circuit limits and automatically unhalt trading.
  - **0.8% Mean-Reversion Buffer**: Background price loop requires a 0.8% price buffer before mean-reversion unhalts, preventing premature releases on micro-noise.
  - **Strict Stock Isolation**: Circuit breaker halts on individual stocks never freeze other shares or the broader market.
- **Universal Action Contract Pattern & Rate-Limit Shield**:
  - Universal Action Contract locks (`applyActionContractLock` / `releaseActionContractLock`) on all state mutation buttons with 5000ms safety timeout fallback (`BTN-000` .. `BTN-009`).
  - Strict 200ms anti-spam order debounce per team session preventing double-click duplication.
- **Paper Trading Cards UX & Structured Information Hierarchy**:
  - Upgraded stock trading cards with luxury tactile card-stock styling, guilloche headers, and letterpress ledgers.
  - Structured card layout cleanly segregating stock identity (symbol, name, sector pill) from financial metrics (current price, day open, high/low range, and percentage delta).
  - Position Unrealized P&L: Displays live profit/loss breakdown with color-coded badges for active positions.
- **Interactive Trade Modal with Real-Time Affordability Engine**:
  - Tabbed BUY / SELL switcher updating context, limits, and guidance.
  - Quick quantity stepper controls (`−` / `+`) and lot size pills (`+1`, `+5`, `+10`, `+25`, `+50`, `+100`).
  - Dynamic budget / holding preset pills: BUY Mode (`25%`, `50%`, `75%`, `Max` of cash); SELL Mode (`25%`, `50%`, `75%`, `All` of held shares).
  - Real-time affordability recalculation showing gross value, 10 bps transaction fee, and net cash impact before order dispatch.
- **Advanced Universe Filtering & Multi-Metric Sorting**:
  - Real-time search by ticker or company name.
  - Dynamic sector dropdown filter and clickable sector chips (`#traderSectorChips`).
  - Multi-metric sorter (Top Gainers, Top Losers, Price High to Low, Price Low to High).
  - "Holdings Only" checkbox filter isolating active team positions.
- **Classroom 4:3 Projector Native Layouts (1024×768 & 800×600)**:
  - Added specialized media query detection (`@media (min-aspect-ratio: 4/3) and (max-aspect-ratio: 1.4/1)`).
  - Dedicated $4 \times 2$ (8-card) grid for 1024×768 and $3 \times 2$ (6-card) grid for 800×600 resolutions with safe margins (5% horizontal, 8% vertical).
  - Scaled typography for long-distance auditorium legibility and vertical medal podium orientation for 4:3 projector winner presentation.
  - Flicker-free 8-card slot reuse: Replaced destructive `innerHTML` clearing with persistent card slots (`#projCardSlot_0` .. `#projCardSlot_7`) and canvases.
- **Mobile-First & Tablet Responsive Suite**:
  - Mobile layouts (320px–640px) with single-column stacked cards, full-screen order entry modals, and 16px form inputs to prevent browser auto-zoom.
  - Tablet layouts (641px–1024px) with 2-column stock grids and touch-optimized controls.
  - Touch targets meeting WCAG standards ($\ge 44 \times 44\text{px}$) with `-webkit-overflow-scrolling: touch` momentum scrolling.
- **Cryptographic RFC 4122 Trade UUIDs**:
  - Migrated `tradeId` generation in `server.js` from sequential strings to cryptographically unique 128-bit `crypto.randomUUID()`, retaining sequential `seq` counter for CSV exports.
- **Dynamic Team Capacity & Risk Profiles**:
  - Dynamic team capacity presets: Solo (1 Desk), 2 Teams, 4 Teams, 8 Teams, 16 Teams, and Custom ($N \ge 1$).
  - Simulation risk multipliers: Conservative (0.75x), Balanced (1.0x), High Opportunity (1.45x).
- **Student-Friendly 5-Phase News Flow**:
  - Phase 1: Announced.
  - Phase 2: Reading & Discussion Window (12–25s cognitive countdown, zero instant price jump).
  - Phase 3: Decision Deadline.
  - Phase 4: Smooth cubic S-curve reaction ($s(u) = 3u^2 - 2u^3$) with `NEWS_REACTION_START` audio chime.
  - Phase 5: Reaction Completed.
- **Dramatic Winner Reveal Presentation**:
  - Web Audio API dramatic risers, drumroll booms, and epic fanfare.
  - Screen rumble animations, gold aura glow, and 180 confetti storm.

### Fixed
- **Circuit Breaker Anchor Immutability (CRITICAL SECURITY)**:
  - Eliminated rogue resets of `dayOpenPrice = currentPrice` during manual unhalt and sector unhalt, strictly anchoring daily circuit limits ($\pm 20\%$) to true day opening prices.
- **Private Investment Analytics Authentication (CRITICAL SECURITY)**:
  - Applied `requireHostAuth` middleware to `GET /api/team-investments` and `GET /api/team-investments/:teamId`, blocking unauthenticated public access with HTTP 403 Forbidden.
- **News Event Idempotency & Per-Day Registry**:
  - Implemented `firedNewsEventsPerDay` Map registry in `server.js` ensuring news events fire strictly once per intended trading day.
- **Day Completion vs Championship Finalization**:
  - Concluding the final day now transitions to `DAY_COMPLETED` and broadcasts `FINAL_DAY_COMPLETED` with `requiresExplicitFinalization: true`.
- **Checkpoint Restoration Lifecycle Preservation**:
  - Restoring saved checkpoints now preserves legitimate stopped states (`SETUP`, `STANDBY`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`), setting `pauseMode = 'RECOVERY'` only if active live trading was underway.

---

## [2.0.0] — 2026-10-16

### Added
- **Disaster Recovery & Checkpoint Engine**:
  - Automated background snapshots every 120 seconds during live market sessions saved to `data/checkpoints/`.
  - On-demand manual checkpoint snapshots with descriptive labels.
  - One-click restore from UI and manual backup JSON file upload.
  - Safe restoration invariant: State restorations automatically pause the market (`isPaused = true`) until Host initiates Resume 3-2-1.
  - Reconstructed WebSocket session bindings preventing host lockouts.
- **Dynamic Multi-Team Desk Support**:
  - Configurable team capacity supporting flexible desk numbers (Desks 1..N).
  - Dynamic portfolio initialization (`holdings`, `cash`, `avgBuyPrice`) preventing runtime undefined errors.
  - Session token authentication with individual team credential isolation.
- **GitHub Pages Live Preview & Interactive HOD Sandbox Engine**:
  - Automated deployment workflow via GitHub Actions (`.github/workflows/deploy-pages.yml`).
  - Standalone client-side `MockEngine` in `public/app.js` enabling 100% interactive demonstrations on GitHub Pages without requiring a backend server.
  - Pre-loaded with 20 real Indian enterprise listed equities (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, etc.).
  - 1-click demo role launcher cards for visiting faculty and department heads (`👑 Open Host`, `📊 Open Projector`, `💻 Open Trader Desk`).
- **Dedicated Sound Console Terminal (`/?role=sound`)**:
  - Dedicated sound console view with Web Audio API synthesizer for the venue sound technician.
  - Isolated audio cue routing: Tension risers and victory fanfares route strictly to Sound Console and Host, shielding traders from disruptive noise.
  - AudioContext autoplay unlock overlay (`#soundAutoplayUnlockOverlay`) supporting 1-click or Spacebar sound arming.
- **Portable Offline USB Distribution**:
  - Windows batch packaging script `Pack_Portable_USB_Zip.bat` creating zero-install portable deployment zips.
  - Portable Node.js runtime detection in `Launch_The_Trading_Floor.bat`.
- **Non-Blocking Audit Log Disk Flushing**:
  - Asynchronous atomic disk I/O (`.tmp` write followed by rename) protected by mutex locks, eliminating 5–25ms disk stalls during heavy trading.
  - High-concurrency stress test scripts simulating 50+ simultaneous traders.

---

## [1.5.0] — 2026-10-15

### Added
- **Synchronized Authoritative 3-2-1 Countdown Engine**:
  - Server-authoritative 3-2-1 countdown broadcasting timestamps to all connected terminals.
  - Overlapping countdown guards and clean pause cancellation.
  - Coordinated market opening bell dispatch.
- **Dedicated Auditorium Projector Stage Display**:
  - Stage display (`/?role=projector`) for large auditorium screens.
  - Live stock ticker rotation and sector categorization.
  - Real-time market index calculation (`NIFTY_TF20` and sector benchmarks).
- **Real NSE Equities Universe**:
  - Initialized simulation baseline with real Indian listed enterprise equities (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `TATAMOTORS`, `MARUTI`, `ICICIBANK`, `LT`, etc.).
  - 52-week high/low calculation and real starting prices.
- **Event-Hall Web Audio Synthesizer**:
  - Zero-CDN Web Audio API sound synthesis: opening bells, transaction chimes, trade alert clicks, and dramatic tension risers.
- **Dramatic 6-Stage Winner Reveal Presentation**:
  - Full-screen podium reveal scene with intro, bronze reveal, silver reveal, drumroll tension cue, gold champion fanfare, and full leaderboard.
- **Institutional Design System**:
  - Aristocratic letterpress styling, ivory cards, and high-contrast typography.

---

## [1.0.0] — 2026-10-15

### Added
- **Core Market Simulation Engine**:
  - Real-time stock market simulation server powered by Node.js, Express, and WebSocket (`ws`).
  - Real-time price loop with stochastic geometric Brownian motion and calibrated volatility parameters.
  - Immediate order-flow price impact: Buy orders exert upward price pressure; Sell orders exert downward price pressure.
- **1-Click Windows Launchers & Portable Architecture**:
  - Zero-dependency local setup via `Launch_The_Trading_Floor.bat`.
  - Self-contained LAN server with dynamic local IP discovery.
  - Offline-first zero-CDN architectural invariant ensuring 100% operation without an internet connection.
- **Interactive Canvas Charting Engine (`TFCharts`)**:
  - Smooth Bezier sparklines with Fritsch-Carlson monotone cubic tangents.
  - Real-time animated pulse head on live price ticks.
  - Interactive modal chart with snapping hover crosshairs and Day Open dashed guide.
  - Team portfolio equity curve tracking net worth against ₹5,00,000 starting cash.
- **Beginner-Friendly Trading Terminal**:
  - 4-card beginner hero summary (Cash, Portfolio Value, Net Worth, Total P&L).
  - Quick quantity stepper buttons and lot size presets.
  - 1-click portfolio liquidation (`LIQUIDATE_ALL`).
  - Educational trade error validation with plain-language feedback.
- **Host Operations & Safe Controls**:
  - Dual pause modes: Soft Freeze (prices visible, orders paused) and Blackout Pause (prices masked).
  - Guided event setup wizard and safe game reset with explicit confirmation phrase.
  - Crash recovery engine with automated live state persistence.
