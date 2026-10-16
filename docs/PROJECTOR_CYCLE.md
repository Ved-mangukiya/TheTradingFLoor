# Intelligent Projector Presentation Cycle, Automatic Pagination & Winner Reveal

## 1. Overview
The stage projector terminal (`/?role=projector&pass=screen2026`) is engineered specifically for large-screen auditorium displays (1920×1080 and 4K displays). It operates in pure offline-first mode over WebSockets, synchronized in real-time with the authoritative Node.js server.

---

## 2. Zero-Scroll Automatic Stock Board Pagination (Scene 1)
When large stock universes (such as the 20 verified real NSE companies) are displayed, dumping all cards onto one screen forces a vertical scrollbar that audience members cannot see or scroll. 

To guarantee **100% visibility without any vertical scrolling (`overflow: hidden;`)**, the market board utilizes an **Automatic Paginated Presentation Engine**:

1. **Configurable Cards Per Page**:
   - Default: **8 cards per page** arranged in a balanced $4 \times 2$ grid.
   - Fits standard 1080p projectors with large typography, comfortable spacing, and zero page scrolling.
2. **Slicing & Pages**:
   - For 20 stocks: **3 pages** (Page 1: Stocks 1–8; Page 2: Stocks 9–16; Page 3: Stocks 17–20).
   - For 8 test stocks: **1 page** (Stocks 1–8).
3. **Smooth Auto-Rotation**:
   - Automatically flips to the next page every **8 seconds** (configurable).
   - Loops seamlessly back to Page 1 upon reaching the last page.
4. **Stable In-Place Updates (Zero Timer Resets)**:
   - On incoming WebSocket price ticks, the currently visible cards update their prices, percentage changes, and Bezier sparkline curves **in place**.
   - Price ticks do **not** restart the page flip timer, and do **not** jump back to Page 1.
5. **Page Navigation & Indicator**:
   - Displays clear badge: `📄 Page 1 of 3 (Stocks 1–8 of 20)`.
   - Includes manual navigation controls: `[◀ Prev]` `[⏸ Pause]` `[▶ Next]`.

---

## 3. Persistent Spotlight: Top Percentage Gainer & Loser
Located permanently above the stock grid, the **Market Spotlight Bar** remains visible at all times across all page flips:

### 3.1 Top Percentage Gainer Card
- **Calculation Formula**:
  $$\text{Change \%} = \frac{P_{\text{current}} - P_{\text{ref}}}{P_{\text{ref}}} \times 100$$
  *(Where $P_{\text{ref}}$ is the day's opening baseline price)*.
- **Displayed Fields**:
  - `🏆 TOP GAINER` gold badge.
  - Large verified ticker symbol (e.g. `RELIANCE`).
  - Company full name and sector (e.g. `Reliance Industries Ltd • Energy`).
  - Current simulated price (e.g. `₹2,950.00`).
  - Forest green percentage badge: `+14.50% ▲`.
- **Tie-Break Rule**: In case of identical percentage gain, ties are broken deterministically by alphabetical order of the ticker symbol (`a.ticker.localeCompare(b.ticker)`).

### 3.2 Top Percentage Loser Card
- **Calculation Formula**: Evaluates the minimum (most negative) percentage change across all enabled companies.
- **Displayed Fields**:
  - `📉 TOP LOSER` crimson badge.
  - Large verified ticker symbol (e.g. `TATAMOTORS`).
  - Company full name and sector (e.g. `Tata Motors Ltd • Automobile`).
  - Current simulated price (e.g. `₹920.00`).
  - Crimson red percentage badge: `-8.20% ▼`.
- **Tie-Break Rule**: In case of identical percentage loss, ties are broken deterministically by alphabetical order of the ticker symbol.

### 3.3 Market Breadth Indicator
- Evaluates active market sentiment in real-time across the entire universe:
  $$\text{Advancing Count } (▲) \quad \bullet \quad \text{Declining Count } (▼)$$
- Updates live with green and red color coding.

---

## 4. Multi-Scene Intelligent Cycle
Beyond the Market Board, the projector rotates between 5 distinct financial scenes:
1. `SCENE_MARKET_BOARD`: Paginated real company cards with persistent Top Gainer/Loser spotlight and high-FPS Bezier sparklines.
2. `SCENE_INDICES`: 6 real market benchmark cards (`NIFTY_TF20`, `BANK_TF`, `IT_TF`, `AUTO_TF`, `ENERGY_TF`, `METALS_TF`) showing points change, percentage, and weighting.
3. `SCENE_STRATEGY`: Audience-friendly team macro sector allocations (Banking %, IT %, Auto %, Energy %, Metals %, Cash %) with concentration tags and zero stock ticker leakage.
4. `SCENE_LEADERBOARD`: Complete live standings table with rank, net worth, daily profit/loss, and return %.
5. `SCENE_NEWS`: Journalistic breaking wires feed with official regulatory notices.

---

## 5. Host Remote Controls (Stage & Results)
The Host has full authoritative remote control over the projector via WebSockets:
- **`HOST_UPDATE_PROJECTOR_MODE`**: Switches between `AUTO_CYCLE` (rotates scenes every 12s) and `FIXED_SCREEN` (locks to a specific scene for speeches).
- **`HOST_SET_PROJECTOR_BOARD_PAGE`**: Remotely commands the projector to jump to a specific stock board page.
- **`HOST_TOGGLE_PROJECTOR_BOARD_PAUSE`**: Remotely pauses or resumes the 8-second stock board auto-flip timer.

---

## 6. Embedded Projector Winner Reveal Stage
The auditorium projector embeds the complete cinematic awards ceremony directly behind the live market stage:
- **Zero Separate URLs**: The projector display (`/?role=projector`) natively houses both the live market stage (`#projectorMainStage`) and the awards ceremony stage (`#projectorWinnerStage`).
- **Instant Transformation**: When the host clicks **👑 Announce Winners on Projector Screen**, the live market grid smoothly hides and the verified settlement audit stage appears in full screen.
- **Auditorium Ceremony Scenes**:
  - `SCENE_INTRO`: Verified settlement audit notice confirming all portfolios, fees, and prices are frozen.
  - `SCENE_BRONZE`: 3rd Place Bronze Medalist reveal with valuation and returns.
  - `SCENE_SILVER`: 2nd Place Silver Runner-up reveal.
  - `SCENE_CHAMPION`: 1st Place Grand Champion reveal with animated gold trophy bounce and dual-container confetti celebration.
  - `SCENE_PODIUM`: The grand 3-tier championship podium.
  - `SCENE_STANDINGS`: Complete official final classification of all teams.
- **Graceful Exit**: Clicking **⏹️ Exit Winner Mode & Return to Market Cycle** instantly returns the projector to the live market cycle.
