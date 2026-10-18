# Predefined Neutral News Engine & Deterministic Shocks

## 1. Overview
The news engine executes multi-day market shocks with fixed, auditable percentage movements. To guarantee academic rigor and force analytical thinking among student participants:
1. **Zero Trade Recommendations**: News headlines and body copy NEVER instruct participants to buy or sell. Phrases like *"Good news for X"* or *"X is set to skyrocket"* are strictly banned.
2. **Journalistic Wire Style**: Headlines adopt realistic Bloomberg/Reuters wire syntax (e.g. *"Ministry of Heavy Industries Revises Production-Linked Incentive Norms"*).
3. **Public Secrecy Invariant**: The private mathematical impact matrix (`impacts: [{ ticker: 'TATAMOTORS', delta_pct: 7 }]`) is stripped from public and trader broadcasts. Only the Host Master Control dashboard can preview formula percentages and publication countdowns.

## 2. Multi-Day Connected Storylines Catalogue

### Day 1 Storylines
- **Event N1 (Second 120)**: *Ministry of Heavy Industries Revises Production-Linked Incentive Norms*
  - Sector: Automotive & Components
  - Impacts: `TATAMOTORS` (+7%), `MARUTI` (+4%), `M&M` (+5%)
- **Event N2 (Second 360)**: *Global Semiconductor Fab Cluster Reports Output Bottlenecks*
  - Sector: Technology & Automotive
  - Impacts: `TATAMOTORS` (-6%), `MARUTI` (-5%), `TCS` (-3%), `INFY` (-4%)
- **Event N3 (Second 600)**: *Reserve Bank of India Monetary Policy Committee Announces Rate Decision*
  - Sector: Banking & Finance
  - Impacts: `HDFCBANK` (+5%), `ICICIBANK` (+6%), `SBIN` (+4%), `BAJFINANCE` (+7%)
- **Event N4 (Second 900)**: *Ministry of Power Directs Accelerated Renewable Grid Integration*
  - Sector: Power & Infrastructure
  - Impacts: `RELIANCE` (+5%), `NTPC` (+6%), `POWERGRID` (+5%), `LT` (+4%)

### Day 2 Storylines
- **Event N5 (Second 180)**: *European Union Releases Preliminary Critical Raw Materials Carbon Tariff Framework*
  - Sector: Metals & Steel
  - Impacts: `TATASTEEL` (-8%), `JSWSTEEL` (-7%)
- **Event N6 (Second 480)**: *Ministry of Steel Considers Anti-Dumping Safeguards on Overseas Imports* (Twist/Fact-check to N5)
  - Sector: Domestic Steel
  - Impacts: `TATASTEEL` (+9%), `JSWSTEEL` (+8%)
- **Event N7 (Second 780)**: *Department of Telecom Finalizes Spectrum Allocation Roadmap*
  - Sector: Telecommunications
  - Impacts: `AIRTEL` (+7%), `RELIANCE` (+4%)
- **Event N8 (Second 1080)**: *Monsoon Session Reports Rural Consumer Sentiment Index*
  - Sector: FMCG & Rural Mobility
  - Impacts: `ITC` (+5%), `HINDUNILVR` (+6%), `M&M` (+4%)

### Day 3 Storylines
- **Event N9 (Second 180)**: *US FDA Issues Form 483 Observations for Active Pharmaceutical Ingredient Facility*
  - Sector: Healthcare
  - Impacts: `SUNPHARMA` (-8%)
- **Event N10 (Second 480)**: *Sun Pharma Completes Corrective Protocol; US FDA Confirms Voluntary Action Indicated* (Twist to N9)
  - Sector: Healthcare
  - Impacts: `SUNPHARMA` (+11%)
- **Event N11 (Second 780)**: *Ministry of Finance Unveils National Infrastructure Pipeline Tranche*
  - Sector: Infrastructure
  - Impacts: `LT` (+8%), `NTPC` (+5%), `TATASTEEL` (+4%)
- **Event N12 (Second 1100)**: *Global Sovereign Wealth Fund Allocates Additional Equity Tranche to Indian Benchmarks*
  - Sector: Broad Market Benchmark
  - Impacts: `RELIANCE` (+5%), `TCS` (+4%), `HDFCBANK` (+4%), `TITAN` (+6%)

## 3. Dynamic Time Management & Proportional Scaling Engine

### Canonical Relative Position Formula
Let $D$ = configured session duration in seconds, $p_i$ = relative fractional position of news event $i$ ($0.05 \le p_i \le 0.95$). The scheduled offset $t_i$ from session start is:
$$t_i = \operatorname{round}(D \times p_i)$$

For example, when an event is positioned at $p_i = 0.40$ (40% of the session):
- In a 30-minute day ($D = 1,800\text{s}$), $t_i = 720\text{s}$ (12 minutes).
- In a 45-minute day ($D = 2,700\text{s}$), $t_i = 1,080\text{s}$ (18 minutes).
- In a 10-minute day ($D = 600\text{s}$), $t_i = 240\text{s}$ (4 minutes).

### Relative vs. Absolute Constrained Timing
1. **Proportional Relative Timing**: Publication offsets $t_i$ dynamically scale when session duration changes.
2. **Absolute Constrained Timing**:
   - **Minimum Reading Window**: Participants require sufficient time to read and analyze news before price impacts take effect:
     - $D \le 300\text{s}$: 12 seconds reading window.
     - $D \le 600\text{s}$: 18 seconds reading window.
     - $D \le 1,200\text{s}$: 22 seconds reading window.
     - $D > 1,200\text{s}$: 25 seconds reading window.
   - **Minimum Reading Separation**: A minimum separation of $\Delta t \ge 60\text{s}$ is strictly enforced between consecutive news items on the same day to prevent overlapping decision fatigue.
   - **Session End Buffer**: $t_i \le D - W_{\text{read}} - 25\text{s}$ ensures the price reaction concludes before the closing bell.

### Feasibility Validation
Before event configuration is locked, `validateScheduleFeasibility` checks:
1. Every event offset is positive ($t_i > 0$).
2. Every event finishes its reading and reaction window before the day concludes.
3. Every pair of consecutive events has $\ge 60\text{s}$ spacing.

## 4. Locked News Schedule & Exactly-Once Publication Idempotency
- **Locked Immutability**: Once the Host locks event configuration (`configLocked = true`), scheduled news events cannot be edited, rewritten, cancelled, or duplicated via ordinary controls.
- **Idempotent Triggering**: Each news event has a stable UUID (`event_id`) and is tracked in a per-day registry `firedNewsEventsPerDay`.
- **Zero Double-Shocks**: In-flight network retries, duplicate clicks, or socket reconnects never re-apply price transitions (`eventObj.impactsApplied = true`).
- **Sanitized Non-Host Payloads**: Sockets authenticated as TRADER, PROJECTOR, or unauthenticated visitors receive news only after publication (`triggered = true`), with private impact percentages (`impacts`) stripped from payloads.
