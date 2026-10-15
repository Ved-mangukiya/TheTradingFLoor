# Live Event Anchor & Host Commentary Prompts Engine

## 1. Overview
The Event Anchor Commentary Engine generates dynamic, entertaining, data-driven talking points for the master of ceremonies (emcee), faculty host, or student commentators during the competition.

## 2. Core Principles
1. **100% Real Data**: Prompts are derived solely from audited server math (rank deltas, cash reserves, index momentum, sector concentration).
2. **Strict Trading Neutrality**: Prompts never provide investment advice, buy/sell recommendations, or future price predictions.
3. **No Information Leakage**: Commentaries discuss macro sector shifts and public standings, never revealing private unreleased news or individual stock ticker bets.

## 3. Categories of Generated Prompts

| Category | Trigger Condition | Example Anchor Talking Point |
| :--- | :--- | :--- |
| `LEADER` | 1st Place Desk | *"Dalal Street Titans commands 1st Place at ₹5,38,200 with heavy Banking weighting (48%)."* |
| `CONCENTRATION` | Sector Allocation $\ge 45\%$ | *"Team 3 has placed an aggressive conviction bet, allocating 52% of their fund directly into Automotive."* |
| `CASH_POSITION` | Uninvested Cash $\ge 40\%$ | *"Beta Bulls is holding 44% in pure cash (₹2,20,000), poised for market dips."* |
| `INDEX_MOMENTUM` | Benchmark Shift $\ge \pm 1.5\%$ | *"Championship Broad 20 has surged +2.1% from session open, shifting portfolio valuations."* |
| `RANK_MOVEMENT` | Rank Surge $\ge +2$ spots | *"Alpha Kings has surged +3 spots on the leaderboard today into Rank #2!"* |

## 4. Host Integration
- Available in Host Panel under **🎙️ Anchor Commentary**.
- Features 1-click **📋 Copy** buttons to copy prompts directly to clipboard for live speech delivery.
- REST endpoint: `GET /api/anchor-commentary`.
