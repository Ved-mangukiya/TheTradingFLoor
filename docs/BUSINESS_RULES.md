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
   - Host can click **Release Halt** in the Host Control Panel, resetting $P_{\text{day\_open}} = P_{\text{current}}$ and immediately restoring unconstrained trading.
- Upon release:
  - `isHalted = false`, `haltDirection = null`.
  - Records `CIRCUIT_RECOVERY` audit event.
  - Broadcasts `CIRCUIT_RECOVERY_ALERT` to remove warning badges across all trader and projector screens.

---

## 4. Anti-Tamper & Security Rules
- **Rate Limit Window**: A 200ms throttle is enforced per team session token. Rapid-fire duplicate clicks are rejected.
- **Role Isolation**: Only authenticated Host sessions (`role === 'HOST'`) can trigger pauses, resumes, day advances, news injections, or universe modifications.
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
