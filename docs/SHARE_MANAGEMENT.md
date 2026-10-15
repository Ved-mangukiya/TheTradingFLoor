# SHARE UNIVERSE MANAGEMENT & MARKET BUILDER — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Overview & Objective
In competitive trading tournaments, competition hosts require complete control over which equities participate in each round. The **Share Universe Manager / Market Builder** empowers organizers to configure tradeable shares, introduce new companies, adjust starting valuations, modify volatility, apply market sector presets, and randomize prices without touching code or restarting the server.

---

## 2. Share Data Schema & Fields

Each equity in the universe is modeled with the following authoritative fields:

| Field | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `ticker` | String | Yes | Unique 2-10 character uppercase trading symbol | `RELIANCE`, `TCS`, `INFY` |
| `name` | String | Yes | Full corporate enterprise name | `Tata Consultancy Services Ltd` |
| `sector` | String | Yes | Industry sector classification | `Information Technology` |
| `base_price` | Number | Yes | Baseline reference price (₹) | `3850.00` |
| `currentPrice` | Number | Auto | Live simulated market price (₹) | `3892.40` |
| `dayOpenPrice` | Number | Auto | Reference price at start of current day | `3850.00` |
| `dayHigh` | Number | Auto | Highest price recorded during current day | `3910.00` |
| `dayLow` | Number | Auto | Lowest price recorded during current day | `3840.00` |
| `volatility_factor` | Number | Yes | Geometric walk standard deviation ($\sigma$) | `0.004` (low) to `0.015` (high) |
| `beta` | Number | Yes | Sensitivity multiplier to breaking news ($\beta$) | `0.85` (defensive) to `1.80` (volatile) |
| `isEnabled` | Boolean | Yes | Tradeability status (`true` = active, `false` = excluded) | `true` |
| `isHalted` | Boolean | Auto | Circuit breaker halt status | `false` |
| `haltDirection` | String | Auto | Direction of halt (`UPPER`, `LOWER`, or `null`) | `null` |
| `lot_presets` | Array | Yes | Standard order quantity buttons | `[1, 5, 10, 50, 100]` |
| `fundamentals` | Object | Optional | Summary, P/E, 52W High/Low, Market Cap | `{ summary: "..." }` |

---

## 3. Host Market Builder Controls

### 3.1 Curated Market Presets
The host can instantly configure the market by clicking one of the preset buttons:
1. **Balanced Market (`balanced` / `all_active`)**: Activates a diversified portfolio of 6–12 blue-chip companies across IT, Banking, Energy, FMCG, and Auto.
2. **High Volatility (`high_vol`)**: Enables all companies, boosts volatility ($\sigma = 0.008$), and increases news sensitivity ($\beta = 1.6$) for an intense, fast-moving final round.
3. **Tech & Auto Focus (`tech_auto`)**: Automatically enables IT and Automotive companies (`TCS`, `INFY`, `TATAMOTORS`, `MARUTI`) while disabling unrelated sectors.
4. **Defensive & Value (`defensive`)**: Focuses on stable banking and FMCG equities (`HDFCBANK`, `ICICIBANK`, `ITC`, `HINDUNILVR`) with reduced volatility ($\sigma = 0.003$).
5. **Enable All (`all`)**: Restores all 12 registered companies to active trading status.

### 3.2 Price Randomization Engine (`HOST_RANDOMIZE_PRICES`)
- **Use Case**: Prevents participants from memorizing base prices or exploiting historical scenario sheets in repeat rounds.
- **Mechanism**: The host specifies a variance percentage (default: $\pm 10\%$, bounds: $1\%$ to $25\%$). Each active stock's base price is scaled by a random factor:
  $$P_{\text{base, new}} = P_{\text{base}} \times \left(1 + \text{rand}(-1, 1) \times \frac{\text{variance}}{100}\right)$$
- Immediately resets `currentPrice`, `dayOpenPrice`, `dayHigh`, and `dayLow` to the new base price.

### 3.3 Adding & Editing Shares
- **Add Share (`HOST_ADD_SHARE`)**: Host opens the Share Editor modal, inputs Ticker, Company Name, Sector, Starting Base Price, Volatility, and Beta. The new company is appended to the active universe, and all team portfolios are automatically provisioned with 0 holdings.
- **Edit Share (`HOST_EDIT_SHARE`)**: Host modifies company name, sector, volatility factor, beta, description, or baseline price.
- **Toggle Active / Excluded (`HOST_TOGGLE_SHARE`)**: Instantly hides or reveals a stock from student trader desks. When disabled, existing orders in that stock are blocked, and traders cannot buy or sell it.
- **Duplicate as Template (`HOST_DUPLICATE_SHARE`)**: Clones an existing company configuration into a new series (`_2`, `_3`), facilitating quick creation of related stocks.
- **Delete Share (`HOST_DELETE_SHARE`)**: Permanently removes a company from the universe. Automatically clears holdings across all team accounts.

---

## 4. Universe Persistence & Data Flow

Whenever any modification occurs in the share universe:
1. The server serializes the modified list into `data/universe_active.json`.
2. A permanent audit entry is recorded in `logs/AUDIT_LOG_*.json`.
3. An updated state payload is broadcast over WebSocket:
   - Traders and Projectors receive the sanitized active subset (`companies`).
   - The Host receives the full administrative universe (`allCompaniesUniverse`).

---

## 5. Exporting & Importing the Universe
- **JSON Export**: `GET /api/export/universe` returns a clean JSON representation of all companies.
- **CSV Export**: `GET /api/export/universe-csv` returns a spreadsheet-friendly CSV table containing Symbol, Company Name, Sector, Base Price, Current Price, Volatility, Beta, Status, and Business Description.
