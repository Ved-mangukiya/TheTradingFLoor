# Real Market Indices & Benchmarking Engine

## 1. Overview
The Trading Floor Championship 2026 computes 6 real-time simulated market indices derived from the authoritative prices of constituent stocks.

## 2. Calculated Indices Catalogue

| Index ID | Index Name | Sector | Base Value | Constituent Symbols |
| :--- | :--- | :--- | :--- | :--- |
| `NIFTY_TF20` | Championship Broad 20 | Broad Market Benchmark | 25,000.00 | All 20 Real Universe Companies |
| `BANK_TF` | Banking & Financial Services | Banking & NBFC | 50,000.00 | HDFCBANK, ICICIBANK, SBIN, BAJFINANCE |
| `IT_TF` | Information Technology Index | Software & Tech | 35,000.00 | TCS, INFY |
| `AUTO_TF` | Automotive Mobility Index | Auto & Ancillaries | 20,000.00 | TATAMOTORS, MARUTI, M&M |
| `ENERGY_TF` | Energy & Power Index | Power & Oil-to-Chemicals | 15,000.00 | RELIANCE, NTPC, POWERGRID |
| `METALS_TF` | Metals & Mining Index | Steel & Minerals | 10,000.00 | TATASTEEL, JSWSTEEL |

## 3. Mathematical Formula
Each index is calculated using a price-relative equal-weighted methodology:

$$I_t = I_0 \times \left( \frac{1}{N} \sum_{i=1}^{N} \frac{P_{i,t}}{P_{i,0}} \right)$$

Where:
- $I_t$: Current index value at time $t$.
- $I_0$: Configured base index value (e.g. 25,000 for Broad 20, 50,000 for Banking).
- $N$: Number of valid enabled constituent shares in that index.
- $P_{i,t}$: Current simulated market price of constituent $i$.
- $P_{i,0}$: Reference opening base price of constituent $i$.

## 4. Endpoints & Presentation
- **REST API**: `GET /api/market-indices` returns both a key-value dictionary and structured array.
- **WebSocket Broadcast**: `marketIndices` is transmitted in every tick to Host and Projector terminals.
- **Projector Scene**: Displayed during `SCENE_INDICES` with change points and change percentages.
