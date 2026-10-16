# DAILY LEADERBOARD & MULTI-DAY SNAPSHOT MECHANICS

## 1. Overview
The Trading Floor Championship 2026 operates as a multi-day championship (default 3 days). At the end of each competition day, the market is closed, official closing prices are frozen, and an immutable daily snapshot is finalized.

---

## 2. Daily Closing & Finalization Protocol

### Step 1: Session Close (`HOST_CLOSE_SESSION`)
- When the trading duration elapses or the host presses **Close Trading Day**, the server blocks all incoming orders (`isPaused = true`, `status = CLOSED`).
- Any pending orders in the queue are drained or rejected.

### Step 2: Finalize Day Snapshot (`HOST_FINALIZE_DAY`)
1. **Closing Price Freeze**: The server captures the final closing price for all active universe stocks.
2. **Portfolio Valuation**:
   $$\text{Portfolio Value} = \text{Cash in Hand} + \sum (\text{Holdings}_i \times \text{Closing Price}_i)$$
   $$\text{Net P&L} = \text{Portfolio Value} - \text{Starting Capital}$$
   $$\text{Return \%} = \frac{\text{Net P\&L}}{\text{Starting Capital}} \times 100$$
3. **Rank & Delta Computations**:
   - Teams are ranked by Portfolio Value descending.
   - Deterministic tie-breaker: Team with the highest percentage of cash balance breaks ties, followed by lower cumulative transaction fees.
   - Rank delta ($\Delta = \text{Previous Rank} - \text{Current Rank}$) is computed to indicate leaderboard movement ($\uparrow, \downarrow, =$).
4. **Immutable Snapshot Persistence**:
   - The finalized snapshot is recorded under `gameState.dailySnapshots[dayNumber]`.
   - Snapshot contains: `dayNumber`, `timestamp`, `closingPrices`, `standings` (team name, rank, cash, holdings value, portfolio value, net profit, return %, trades count).
   - Saved persistently to disk in `data/state_backup.json` and accessible via `GET /api/daily-snapshot/:day`.

---

## 3. Cumulative Leaderboard vs. Daily Leaderboard

| Feature | Daily Leaderboard | Cumulative Leaderboard |
| :--- | :--- | :--- |
| **Scope** | Performance within a single trading day | Total performance across all days from Day 1 start |
| **Benchmark** | Day Opening Valuation | Original Starting Capital (₹5,00,000) |
| **Access** | `GET /api/daily-snapshot/:day` | `GET /api/standings` & Live Standings Board |
| **Display** | Stage projector daily review scene, Reports tab | Trader desk, Live Floor, Projector main cycle |

---

## 4. Preserving Cumulative Integrity Across Days
Advancing to the next day (`HOST_NEXT_DAY`):
- Does **NOT** reset cash balances, stock holdings, or historical trade logs.
- Holdings carry forward at previous day closing prices.
- New day opens in `PAUSED` or `SCHEDULED` state with day counter incremented (`day = day + 1`).
- Host resumes the floor using the synchronized 3-second countdown.
