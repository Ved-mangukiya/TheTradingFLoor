# Intelligent Projector Presentation Cycle & Embedded Winner Reveal

## 1. Overview
The stage projector terminal (`/?role=projector&pass=screen2026`) is designed for high-visibility display in college auditoriums. It operates with server synchronization and dual-stage architecture.

## 2. Multi-Scene Intelligent Cycle
The projector rotates smoothly between 5 distinct market scenes:
1. `SCENE_MARKET_BOARD`: 20 real company cards with live stock prices, percentage change, and high-FPS Bezier sparklines.
2. `SCENE_INDICES`: 6 real market benchmark cards (`NIFTY_TF20`, `BANK_TF`, `IT_TF`, `AUTO_TF`, `ENERGY_TF`, `METALS_TF`) showing points change, percentage, and weighting.
3. `SCENE_STRATEGY`: Audience-friendly team macro sector allocations (Banking %, IT %, Auto %, Energy %, Metals %, Cash %) with concentration tags and zero stock ticker leakage.
4. `SCENE_LEADERBOARD`: Complete live standings table with rank, net worth, daily profit/loss, and return %.
5. `SCENE_NEWS`: Journalistic breaking wires feed with official regulatory notices.

## 3. Host Control Modes
- **🔄 Auto-Cycle Mode (`AUTO_CYCLE`)**: Rotates scenes automatically based on configurable duration (default 12 seconds per scene). The scene badge in the header shows the live countdown (e.g. `🔄 CYCLE: MARKET INDICES (8s)`).
- **📌 Fixed Screen Mode (`FIXED_SCREEN`)**: Locks the projector to a specific scene selected by the host for lectures or specific announcements.

## 4. Embedded Projector Winner Reveal Stage
The auditorium projector embeds the complete cinematic awards ceremony directly behind the live market stage:
- **Zero Separate URLs**: No need to navigate to a separate `/winner` URL. The projector display (`/?role=projector`) natively houses both the live market stage (`#projectorMainStage`) and the awards ceremony stage (`#projectorWinnerStage`).
- **Instant Transformation**: When the host clicks **👑 Announce Winners on Projector Screen**, the live market grid smoothly hides and the verified settlement audit stage appears in full screen.
- **Auditorium Ceremony Scenes**:
  - `SCENE_INTRO`: Verified settlement audit notice confirming all portfolios, fees, and prices are frozen.
  - `SCENE_BRONZE`: 3rd Place Bronze Medalist reveal with valuation and returns.
  - `SCENE_SILVER`: 2nd Place Silver Runner-up reveal.
  - `SCENE_CHAMPION`: 1st Place Grand Champion reveal with animated gold trophy bounce and dual-container confetti celebration.
  - `SCENE_PODIUM`: The grand 3-tier championship podium.
  - `SCENE_STANDINGS`: Complete official final classification of all teams.
- **Graceful Exit**: Clicking **⏹️ Exit Winner Mode & Return to Market Cycle** instantly returns the projector to the live market cycle.
