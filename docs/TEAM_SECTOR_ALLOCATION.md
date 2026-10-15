# Team Sector Allocation & Audience Strategy Privacy Model

## 1. Vision & Purpose
During a live collegiate competition, the auditorium audience and commentators want to understand each team's overarching market strategy (e.g. *“Team 1 is betting 48% of their capital on the Automotive rally while Team 4 holds 35% in liquid cash waiting for a dip”*).

However, revealing specific stock tickers (e.g. *“Team 1 bought 100 shares of TATAMOTORS”*) would ruin competitive secrecy and encourage front-running.

## 2. Strict Privacy Invariant
- **Allowed on Public Projector**: Macro sector breakdown percentages (e.g., Banking: 45%, IT: 25%, Auto: 15%, Cash: 15%), total portfolio valuation, and strategy classification badges.
- **Strictly Prohibited on Public Projector**: Specific stock tickers (`ticker`), individual quantities (`quantity`), entry prices (`avgBuyPrice`), and pending orders.
- **Server Enforcement**: `calculateTeamSectorAllocations()` aggregates market values strictly by sector (`c.sector || 'General'`). Only sector percentages and cash percentages are serialized.

## 3. Calculation Mechanics
1. **Holding Valuation by Sector**:
   $$\text{SectorValue}(s) = \sum_{c \in \text{Sector}(s)} (\text{holdings}[c.ticker] \times c.currentPrice)$$
2. **Total Fund Capital**:
   $$\text{TotalPortfolio} = \text{cash} + \sum_{s} \text{SectorValue}(s)$$
3. **Sector Allocation Percentage**:
   $$\text{AllocationPct}(s) = \left( \frac{\text{SectorValue}(s)}{\text{TotalPortfolio}} \right) \times 100$$
4. **Cash Reserve Percentage**:
   $$\text{CashPct} = \left( \frac{\text{cash}}{\text{TotalPortfolio}} \right) \times 100$$

## 4. Strategy Badges & Thresholds
- **High Conviction Concentration**: Assigned if any single sector exceeds 40% of the total portfolio.
- **Diversified Portfolio**: Assigned if holdings are spread across 3 or more sectors with no single sector exceeding 35%.
- **Cash Cushion / Dry Powder**: Assigned if uninvested cash exceeds 35% of total portfolio.
