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
