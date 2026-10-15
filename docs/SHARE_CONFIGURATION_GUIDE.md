# ORGANIZER'S GUIDE TO MARKET CONFIGURATION — THE TRADING FLOOR CHAMPIONSHIP 2026

This practical guide assists competition directors and faculty coordinators in designing engaging stock market scenarios tailored to participant skill levels.

---

## 1. Selecting the Right Market Archetype

| Round Type | Recommended Preset | Companies Enabled | Volatility ($\sigma$) | News Beta ($\beta$) | Tournament Style |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Beginner / Trial** | `defensive` (Value & Banking) | 4–6 Stocks | Low (`0.003`) | Moderate (`0.85`) | Slower, predictable price action. Ideal for 1st-year students learning order books. |
| **Standard Round 1** | `balanced` (Balanced Mix) | 8–10 Stocks | Normal (`0.004`) | Normal (`1.00`) | Multi-sector diversification. Tests analytical skills across IT, Banking, and Energy. |
| **Advanced Finals** | `high_vol` (High Volatility) | All 12 Stocks | High (`0.008`) | Sharp (`1.60`) | Fast-paced price action with dramatic news shocks and frequent circuit breaker tests. |
| **Sector Challenge** | `tech_auto` (Tech & Auto) | 4–5 Stocks | Dynamic (`0.006`) | High (`1.30`) | Industry conclaves and specialized domain competitions. |

---

## 2. Step-by-Step Market Customization

### Step 1: Access Market Builder
1. Log into the Host Control Panel at `http://localhost:3000/?role=host`.
2. Click the **🏛️ Market Builder (Share Universe)** subtab.

### Step 2: Choose a Baseline or Template
- Click one of the preset buttons: **Balanced Market**, **High Volatility**, **Tech & Auto Focus**, or **Defensive & Value**.
- The table updates immediately, highlighting active stocks in green and disabled stocks in faded gray.

### Step 3: Fine-Tune Starting Prices
- To prevent teams from reusing historical strategy notes, click **🎲 Randomize Prices (±10%)**.
- All tradeable stocks receive a slight price variance within authentic market bounds.

### Step 4: Add a Custom Company or College Sponsor
Want to introduce a fictional campus unicorn or the title sponsor company?
1. Click **+ Add New Company**.
2. Enter:
   - **Ticker Symbol**: e.g., `CAMPUSPAY` or `SPONSORCORP`
   - **Company Full Name**: e.g., `CampusPay Technologies Ltd`
   - **Sector**: e.g., `Fintech & Payments`
   - **Starting Base Price**: e.g., `240.00`
   - **Volatility Factor**: `0.006` (standard)
   - **News Beta**: `1.25`
   - **Brief Description**: One-sentence summary for the student terminal.
3. Click **Save Share Configuration**.
4. The new company is immediately tradeable by all teams.

### Step 5: Exporting Your Universe
- Click **Export Universe (JSON)** or **Export Universe (CSV)** to archive the configuration for future conclaves.
