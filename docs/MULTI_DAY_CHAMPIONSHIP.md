# Multi-Day Championship Lifecycle & Portfolio Scoring Model

## 1. Overview
The Trading Floor Championship 2026 natively supports multi-day tournaments (typically 3 competition days) with continuous overnight portfolio tracking and end-of-day standings finalization.

## 2. Championship Scoring Model: Continuous Portfolio
1. **Capital Carry-Over**: Teams retain their cash and stock positions across tournament days.
2. **Daily P&L vs Cumulative P&L**:
   - **Opening Portfolio Value ($V_{\text{open}}$)**: The team's closing portfolio value from the previous day's finalized snapshot (or initial starting capital of ₹5,00,000 on Day 1).
   - **Current Portfolio Value ($V_{\text{close}}$)**: $\text{Cash} + \sum (\text{Holdings}_i \times P_i)$.
   - **Daily P&L**: $V_{\text{close}} - V_{\text{open}}$.
   - **Daily Return %**: $\left( \frac{V_{\text{close}} - V_{\text{open}}}{V_{\text{open}}} \right) \times 100$.
   - **Cumulative Net Profit/Loss**: $V_{\text{close}} - \text{StartingCapital}$.
   - **Cumulative Return %**: $\left( \frac{V_{\text{close}} - \text{StartingCapital}}{\text{StartingCapital}} \right) \times 100$.
3. **Rank Movement ($\Delta \text{Rank}$)**:
   $$\Delta \text{Rank} = \text{Rank}_{\text{previous}} - \text{Rank}_{\text{current}}$$
   - $\Delta \text{Rank} > 0$: Team moved up (e.g. `▲ +2`).
   - $\Delta \text{Rank} < 0$: Team dropped down (e.g. `▼ -1`).
   - $\Delta \text{Rank} = 0$: Unchanged (e.g. `• 0`).

## 3. End-of-Day Finalization Procedure
When the day ends or when the host clicks **📅 Finalize Current Day Standings**:
1. Server freezes day closing stock prices.
2. Server calculates every team's closing net worth, daily P&L, cumulative P&L, and rank deltas.
3. Server commits the immutable snapshot to `gameState.dailyLeaderboards['day_' + day]`.
4. Host and projector displays update with verified daily standings.
5. The snapshot is accessible via `GET /api/daily-snapshot/:day`.
