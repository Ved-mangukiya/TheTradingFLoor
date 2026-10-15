# Real Indian Publicly Listed Companies Universe Specification

## 1. Overview
The Trading Floor Championship 2026 operates using 20 verified Indian publicly listed companies on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE). Fictional company names have been permanently decommissioned.

## 2. Company Registry (20 Official Real Companies)

| Ticker | Company Name | Sector | Base Price (₹) | Beta | Volatility Factor | Lot Presets |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RELIANCE** | Reliance Industries | Energy & Conglomerate | 2,950.00 | 1.05 | 0.0022 | [1, 5, 10] |
| **TATAMOTORS** | Tata Motors Limited | Automotive | 985.00 | 1.45 | 0.0042 | [5, 15, 30] |
| **MARUTI** | Maruti Suzuki India | Automotive | 12,450.00 | 0.88 | 0.0020 | [1, 2, 5] |
| **M&M** | Mahindra & Mahindra | Automotive | 2,820.00 | 1.25 | 0.0035 | [1, 5, 10] |
| **TCS** | Tata Consultancy Services | Information Technology | 3,920.00 | 0.82 | 0.0018 | [1, 5, 10] |
| **INFY** | Infosys Limited | Information Technology | 1,840.00 | 1.15 | 0.0026 | [5, 10, 25] |
| **HDFCBANK** | HDFC Bank Limited | Banking & Financial Services | 1,680.00 | 1.02 | 0.0021 | [5, 15, 30] |
| **ICICIBANK** | ICICI Bank Limited | Banking & Financial Services | 1,240.00 | 1.18 | 0.0028 | [5, 15, 30] |
| **SBIN** | State Bank of India | Public Sector Banking | 810.00 | 1.35 | 0.0038 | [10, 25, 50] |
| **BAJFINANCE** | Bajaj Finance Limited | Non-Banking Financial (NBFC) | 7,150.00 | 1.40 | 0.0040 | [1, 3, 5] |
| **LT** | Larsen & Toubro | Infrastructure & Engineering | 3,650.00 | 1.10 | 0.0025 | [1, 5, 10] |
| **AIRTEL** | Bharti Airtel | Telecommunications | 1,620.00 | 0.90 | 0.0020 | [5, 10, 25] |
| **ITC** | ITC Limited | Fast Moving Consumer Goods | 485.00 | 0.65 | 0.0014 | [10, 25, 50] |
| **HINDUNILVR** | Hindustan Unilever | Fast Moving Consumer Goods | 2,520.00 | 0.70 | 0.0015 | [1, 5, 10] |
| **SUNPHARMA** | Sun Pharmaceutical Industries | Pharmaceuticals & Healthcare | 1,780.00 | 0.75 | 0.0018 | [5, 10, 20] |
| **NTPC** | NTPC Limited | Power Generation | 390.00 | 1.12 | 0.0028 | [10, 25, 50] |
| **POWERGRID** | Power Grid Corporation of India | Power Transmission | 325.00 | 0.80 | 0.0018 | [10, 25, 50] |
| **TATASTEEL** | Tata Steel Limited | Metals & Mining | 155.00 | 1.50 | 0.0048 | [20, 50, 100] |
| **JSWSTEEL** | JSW Steel Limited | Metals & Mining | 945.00 | 1.38 | 0.0042 | [5, 15, 30] |
| **TITAN** | Titan Company | Consumer Discretionary & Luxury | 3,480.00 | 1.05 | 0.0026 | [1, 5, 10] |

## 3. Real Prices vs. Simulation Prices
1. **Reference Baseline**: The simulation's starting prices (`base_price`) are derived from verified official NSE closing price benchmarks (NSE EOD reference timestamp: `2026-10-15T15:30:00Z`).
2. **Simulation Price**: Once trading starts, prices are dynamically driven by order flows, deterministic news shocks, and beta-weighted macro movements.
3. **Disclosure Rule**: All user interfaces clearly label prices as *Simulated Trading Prices* derived from NSE reference benchmarks, strictly ensuring no misrepresentation of live real-world external feeds.
