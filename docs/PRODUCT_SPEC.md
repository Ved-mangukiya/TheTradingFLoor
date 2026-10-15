# PRODUCT SPECIFICATION — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Executive Summary & Vision
**The Trading Floor Championship 2026** is an institutional-grade, real-time stock market simulation platform engineered specifically for collegiate competitions, business school conclaves, and finance festivals. 

Operating on a local area network (LAN) with zero external internet dependencies, it bridges the gap between theoretical classroom finance and fast-paced trading floor execution. The system provides an authentic simulation of the Indian stock market (BSE/NSE mechanics), featuring 12 blue-chip Indian equities across 6 major economic sectors, dynamic order book execution, realistic circuit breaker halts, macroeconomic news shocks, and automated audited performance rankings.

---

## 2. Target Audience & Roles
The application natively serves three distinct user roles within a single lightweight architecture:

### 2.1 Host / Competition Director (`ROLE_HOST`)
- **Profile**: Faculty coordinators, student competition organizers, and event administrators.
- **Objectives**: Complete oversight and absolute control of the simulation.
- **Capabilities**:
  - Live start, pause (with 3-2-1 countdown), and day advancement controls.
  - Real-time share universe management (curate active stocks, modify volatility/beta, toggle tradeability).
  - Breaking news wire broadcast (trigger scheduled shocks or draft custom breaking alerts).
  - Circuit breaker overrides and manual halt releases.
  - Team roster setup, credentials management, starting cash configuration, and transaction fee controls.
  - Download audited reports (standings CSV, trades log CSV, audit timeline CSV, raw JSON ledger).
  - Grand Finale winner podium ceremony activation.

### 2.2 Trader Teams (`ROLE_TRADER`)
- **Profile**: Student teams (1–16 teams, up to 4 members per team).
- **Objectives**: Maximize portfolio net worth and percentage return over the tournament days.
- **Capabilities**:
  - Real-time stock desk with live pricing, sparkline curves, day open/high/low, and 52-week fundamentals.
  - Lightning-fast one-click order ticket with quantity shortcuts (Max Buy, Max Sell, 1, 5, 10, 50, 100).
  - Live portfolio valuation, cash balance tracking, and unrealized/realized P&L calculations.
  - Order history log with authoritative server timestamps and transaction fee receipts.
  - Live breaking news feed with audio visual alerts and trading impact explanations.

### 2.3 Stage Projector / Spectator (`ROLE_PROJECTOR`)
- **Profile**: Public auditorium projector screens, audience displays, and live broadcast monitors.
- **Objectives**: Maximize stage excitement, tension, and spectator engagement.
- **Capabilities**:
  - High-visibility full-screen view (clean ivory luxury palette, high contrast, legible from 50 feet away).
  - Top 5 live championship standings podium with real-time net worth and return percentages.
  - 12-company stock ticker grid with organic Bezier curves and circuit breaker status indicators.
  - Prominent simulation clock, tournament day indicator, and breaking news banners.
  - Synchronized grand finale podium ceremony with animated confetti and trophy fanfare.

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
