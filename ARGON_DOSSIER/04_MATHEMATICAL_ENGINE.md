# MATHEMATICAL ENGINE & FINANCIAL SIMULATION MODEL
## Exact Quantitative Formulas, Accounting Equations & Statistical Processes

> **DOCUMENT ID**: `ARGON_DOSSIER/04_MATHEMATICAL_ENGINE.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **PRIMARY FILES**: [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js) (lines 1450–1560, 2470–2720, 1229–1370), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js) (lines 2190–2410)

---

## 1. Background Stochastic Price Engine

During periods without active news shocks, stock prices follow a discrete-time approximation of an unbiased geometric Brownian motion (GBM) with zero mean drift:

```
Source: server.js lines 1450–1510
Function: updateMarketPrices()
Call Frequency: Every 1,000 ms (tickIntervalMs = 1000)
```

### Formula
$$P_{t+1} = P_t \times \exp\left( -\frac{1}{2}\sigma_{\text{eff}}^2 + \sigma_{\text{eff}} \cdot Z_t \right)$$

Where:
- $P_t$: Current market price of the stock.
- $\sigma_{\text{eff}}$: Effective per-tick volatility factor, defined as:
  $$\sigma_{\text{eff}} = \text{stock.volatility\_factor} \times \sqrt{\text{stock.beta}}$$
  *(Typical range: $0.0020$ to $0.0045$, equivalent to $0.20\%\text{--}0.45\%$ standard deviation per second).*
- $Z_t \sim \mathcal{N}(0, 1)$: Standard normal random variable generated via the Box-Muller transform:
  $$Z_t = \sqrt{-2 \ln(U_1)} \cdot \cos(2\pi U_2), \quad U_1, U_2 \sim \mathcal{U}(0, 1)$$
- $-\frac{1}{2}\sigma_{\text{eff}}^2$: Itô calculus convexity correction drift, ensuring the expected price is strictly unbiased:
  $$\mathbb{E}[P_{t+1} \mid P_t] = P_t$$
  *(Guarantees no artificial upward or downward price drift during quiet trading).*

### Precision & Clamping Bounds
$$P_{t+1} = \operatorname{clamp}\left( P_{t+1}, \text{stock.min\_price}, \text{stock.max\_price} \right)$$
$$P_{t+1} = \frac{\operatorname{round}(P_{t+1} \times 100)}{100} \quad \text{(Rounded strictly to 2 decimal places / paise)}$$

---

## 2. Smoothstep News Shock Trajectory Engine

When a scheduled or breaking news shock targets a stock, price movement does not snap instantaneously. Instead, it follows a continuous cubic Hermite polynomial ("smoothstep") curve:

```
Source: server.js lines 1480–1525
Function: updateMarketPrices() -> stock.activeTransition
Transition Duration: 15s to 60s (calibrated per news event)
```

### Mathematical Formulation
Let $t$ be the current server epoch time in milliseconds, $t_0$ be transition start time, and $T$ be total shock duration:

1. **Normalized Progress ($u$)**:
   $$u = \operatorname{clamp}\left( \frac{t - t_0}{T}, 0, 1 \right)$$

2. **Cubic Hermite Spline ($s(u)$)**:
   $$s(u) = 3u^2 - 2u^3$$
   - Boundary Values: $s(0) = 0, \quad s(1) = 1$.
   - First Derivatives: $s'(0) = 0, \quad s'(1) = 0$.
   - **Economic Justification**: Zero initial slope ($s'(0) = 0$) ensures prices begin moving smoothly without an instantaneous step-function spike. Zero terminal slope ($s'(1) = 0$) ensures prices glide gently into their new post-shock equilibrium without overshoot oscillations.

3. **Trajectory Price ($P(t)$)**:
   $$P(t) = P_0 + (P_{\text{target}} - P_0) \cdot s(u)$$
   Where:
   - $P_0$: Initial price at the exact moment the reaction phase began.
   - $P_{\text{target}} = P_0 \times (1 + I_{\text{stock}})$: Terminal shock target price.
   - $I_{\text{stock}}$: Sector- and beta-adjusted price impact percentage.

4. **Non-Snapping Invariant on Overlapping Shocks**:
   If a new shock arrives while a transition is already active, the new trajectory re-anchors to $P_0 = P_{\text{current}}$, completely eliminating discontinuous price jumps.

---

## 3. CAPM Beta & Volatility Multiplication

Individual stock sensitivity to broader macroeconomic and sector events is scaled by the CAPM Beta ($\beta$):

```
Source: server.js lines 990–1040
Function: calculateSectorShockImpact()
```

### Stock-Specific News Impact Formula
$$I_{\text{stock}} = I_{\text{base}} \times \left( 1 + (\beta - 1) \times 0.5 \right)$$

Where:
- $I_{\text{base}}$: Base impact percentage defined in the news template (e.g., $+10.0\%$).
- $\beta$: Company CAPM Beta sensitivity:
  - If $\beta = 1.0$: $I_{\text{stock}} = I_{\text{base}} \times 1.0 = +10.0\%$.
  - If $\beta = 1.40$ (High beta, e.g. Tech/Auto): $I_{\text{stock}} = +10.0\% \times (1 + 0.20) = +12.0\%$.
  - If $\beta = 0.70$ (Defensive, e.g. FMCG/Pharma): $I_{\text{stock}} = +10.0\% \times (1 - 0.15) = +8.5\%$.

---

## 4. Directional Circuit Breakers & Counter-Flow Liquidity

To emulate modern exchange mechanisms (NSE/BSE) and prevent runaway market failure, individual stocks have strict $\pm 20\%$ price circuit bands:

```
Source: server.js lines 1175–1225, 2520–2575
Threshold: gameState.circuitBreakerPercent (Default: 20%)
```

### Circuit Band Thresholds
$$P_{\text{upper}} = \operatorname{round}\left( P_{\text{day\_open}} \times \left(1 + \frac{\text{cbPct}}{100}\right), 2 \right)$$
$$P_{\text{lower}} = \operatorname{round}\left( P_{\text{day\_open}} \times \left(1 - \frac{\text{cbPct}}{100}\right), 2 \right)$$

> **CRITICAL INVARIANT**: $P_{\text{day\_open}}$ is **STRICTLY IMMUTABLE** throughout the trading day. Manual unhalts or sector releases NEVER reset $P_{\text{day\_open}} = P_{\text{current}}$.

### Directional Order Restrictions
- **Upper Circuit Halt ($P \ge P_{\text{upper}}$)**:
  - `haltDirection = "UPPER"`
  - **BUY orders are STRICTLY REJECTED**:
    *"Upper circuit ceiling reached (₹X.XX). Buying is restricted under market rules."*
  - **SELL orders are PERMITTED**: Traders holding stock can sell, injecting downward recovery liquidity into the order book.
- **Lower Circuit Halt ($P \le P_{\text{lower}}$)**:
  - `haltDirection = "LOWER"`
  - **SELL orders are STRICTLY REJECTED**:
    *"Lower circuit floor reached (₹X.XX). Selling is restricted under market rules."*
  - **BUY orders are PERMITTED**: Bargain-seeking traders can buy, injecting upward recovery liquidity into the order book.
- **Stock Isolation Invariant**: A circuit halt on one stock NEVER halts the wider market or freezes other active stocks.

---

## 5. Order Execution & Financial Accounting

All transaction accounting is executed server-side with exact floating-point rounding guards:

```
Source: server.js lines 2470–2715
Transaction Fee: gameState.transactionFeeBps (Default: 10 bps = 0.10%)
```

### 1. Buy Order Execution
For an order to buy $Q$ shares at current market price $P$:
1. **Gross Transaction Value**:
   $$\text{Gross} = Q \times P$$
2. **Transaction Fee (10 bps)**:
   $$\text{Fee} = \operatorname{round}\left( \text{Gross} \times \frac{\text{feeBps}}{10,000}, 2 \right)$$
3. **Total Cash Deduction**:
   $$\text{Total Deducted} = \text{Gross} + \text{Fee}$$
4. **Cash Validation Guard**:
   $$\text{If } \text{cash} < \text{Total Deducted} \implies \text{REJECT ORDER (Insufficient Cash)}$$
5. **Weighted Average Buy Price ($\bar{P}$)**:
   $$\bar{P}_{\text{new}} = \operatorname{round}\left( \frac{H_{\text{old}} \times \bar{P}_{\text{old}} + Q \times P}{H_{\text{old}} + Q}, 2 \right)$$
6. **Balance Updates**:
   $$\text{cash} \leftarrow \text{cash} - \text{Total Deducted}$$
   $$H_{\text{ticker}} \leftarrow H_{\text{ticker}} + Q$$

### 2. Sell Order Execution
For an order to sell $Q$ shares at current market price $P$:
1. **Share Validation Guard**:
   $$\text{If } H_{\text{ticker}} < Q \implies \text{REJECT ORDER (Insufficient Shares)}$$
2. **Gross Transaction Value**:
   $$\text{Gross} = Q \times P$$
3. **Transaction Fee (10 bps)**:
   $$\text{Fee} = \operatorname{round}\left( \text{Gross} \times \frac{\text{feeBps}}{10,000}, 2 \right)$$
4. **Net Cash Proceeds**:
   $$\text{Net Proceeds} = \text{Gross} - \text{Fee}$$
5. **Realized Profit/Loss ($\text{P\&L}_{\text{realized}}$)**:
   $$\text{Trade Realized P\&L} = Q \times (P - \bar{P}_{\text{old}}) - \text{Fee}$$
   $$\text{realizedPnl} \leftarrow \text{realizedPnl} + \text{Trade Realized P\&L}$$
6. **Balance Updates**:
   $$\text{cash} \leftarrow \text{cash} + \text{Net Proceeds}$$
   $$H_{\text{ticker}} \leftarrow H_{\text{ticker}} - Q$$
   *(If $H_{\text{ticker}} = 0$, then $\bar{P}_{\text{ticker}} \leftarrow 0$).*

---

## 6. Portfolio Valuation, Daily P&L & Cumulative P&L

The system maintains strict isolation between **Daily P&L** (performance within the active session) and **Cumulative P&L** (overall tournament standing):

```
Source: server.js lines 1240–1285, 1575–1630
```

### Core Equations
1. **Portfolio Market Value**:
   $$\text{Portfolio Value} = \sum_{k \in \text{Enabled Stocks}} \left( H_k \times P_k \right)$$

2. **Total Net Worth**:
   $$\text{Net Worth} = \text{Cash} + \text{Portfolio Value}$$

3. **Cumulative Tournament P&L**:
   $$\text{Cumulative P\&L} = \text{Net Worth} - \text{Starting Cash}$$
   $$\text{Cumulative Return \%} = \frac{\text{Cumulative P\&L}}{\text{Starting Cash}} \times 100$$
   *(Starting cash is typically ₹5,00,000).*

4. **Daily Session P&L**:
   $$\text{Daily P\&L} = \text{Net Worth} - \text{Day Opening Portfolio Value}$$
   $$\text{Daily Return \%} = \frac{\text{Daily P\&L}}{\text{Day Opening Portfolio Value}} \times 100$$

### Multi-Day Baseline Carry-Over Invariant
When advancing from Day $N$ to Day $N+1$ via `HOST_START_NEXT_DAY`:
$$\text{DayOpeningPortfolioValue}_{N+1} = \text{ClosingPortfolioValue}_N$$
This ensures:
- Day 2 starts with $\text{Daily P\&L} = ₹0.00$.
- Cumulative P&L accurately retains all historical gains/losses.
- Cash and stock holdings are completely preserved without liquidation.

---

## 7. Leaderboard Ranking & Deterministic Tie-Breakers

To prevent jitter on projectors and student terminals, standings are sorted using a 4-tier deterministic tie-breaking hierarchy:

```
Source: server.js lines 1285–1295
```

### Sorting Algorithm
1. **Primary Key**: `Daily P&L` (or `Net Worth` for cumulative standings) descending.
2. **Secondary Tie-Breaker**: `Return %` descending.
3. **Tertiary Tie-Breaker**: `Available Cash` descending (more liquid portfolio wins).
4. **Quaternary Tie-Breaker**: `Trade Count` ascending (fewer trades implies higher efficiency).
5. **Final Fallback**: Alphabetical by `teamId`.

### Rank Delta ($\Delta$)
$$\text{Rank Delta} = \text{Previous Day Rank} - \text{Current Day Rank}$$
- Positive ($\Delta > 0$): Gained ranks (rendered with green upward triangle `▲`).
- Negative ($\Delta < 0$): Lost ranks (rendered with red downward triangle `▼`).
- Zero ($\Delta = 0$): Position maintained (rendered with gray dash `—`).

---

## 8. Market Breadth & NIFTY_TF20 Index Calculation

```
Source: server.js lines 1585–1640
```

### 1. Market Breadth Counter
- **Advancing Stocks**: $\sum [\text{stock.currentPrice} > \text{stock.dayOpenPrice}]$
- **Declining Stocks**: $\sum [\text{stock.currentPrice} < \text{stock.dayOpenPrice}]$
- **Unchanged Stocks**: $\sum [\text{stock.currentPrice} = \text{stock.dayOpenPrice}]$

### 2. NIFTY_TF20 Benchmark Index
Base Value: $10,000.00$ points at tournament open.
$$\text{Index Value}_t = 10,000 \times \frac{\sum_{k} \left( P_{k, t} \times W_k \right)}{\sum_{k} \left( P_{k, \text{open}} \times W_k \right)}$$
Where $W_k$ is the market-cap weight derived from company fundamentals.

Proceed to **`ARGON_DOSSIER/05_TIMING_AND_NEWS.md`**.
