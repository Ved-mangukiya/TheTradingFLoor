# EVENT LIFECYCLE & STATE MACHINE
## Complete Tournament Lifecycle, State Transitions & Recovery Workflows

> **DOCUMENT ID**: `ARGON_DOSSIER/03_EVENT_LIFECYCLE.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **PRIMARY FILES**: [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js) (lines 1229–1370, 3130–3610), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js) (lines 6280–6670, 9380–9520)

---

## 1. Finite State Machine (FSM) Overview

The tournament progresses through 8 formal lifecycle states enforced strictly on the server (`gameState.status`):

```
       ┌───────────┐
       │   SETUP   │  (Configuration unlocked, team logins gated)
       └─────┬─────┘
             │  HOST_SET_EVENT_LOCK
             ▼
       ┌───────────┐
       │  STANDBY  │◄────────────────────────────────────────┐
       └─────┬─────┘                                         │
             │  HOST_RESUME_COUNTDOWN                        │
             ▼                                               │
       ┌───────────┐                                         │
       │ COUNTDOWN │  (Authoritative 3-2-1 sequence)         │
             ▼                                               │
       ┌───────────┐  HOST_PAUSE                             │
  ┌───►│   LIVE    ├─────────────┐                           │
  │    └───┬───────┘             ▼                           │
  │        │               ┌───────────┐                     │
  │        │ HOST_RESUME   │  PAUSED   │                     │
  │        └───────────────┤ (Visible/ │                     │
  │                        │  Blackout)│                     │
  │                        └─────┬─────┘                     │
  │                              │                           │
  │  Timer Expiry / Conclude     │                           │
  └──────────────────────────────┼───────────────────────────┤
                                 ▼                           │
                       ┌───────────────────┐                 │
                       │   DAY_COMPLETED   │                 │
                       └─────────┬─────────┘                 │
                                 │                           │
                   ┌─────────────┴─────────────┐             │
      Current < Total Days              Current === Total Days
                   │                           │             │
                   ▼                           ▼             │
             HOST_START_NEXT_DAY   HOST_CONCLUDE_CHAMPIONSHIP│
                   │                           │             │
                   └───────────────────────────┼─────────────┘
                                               ▼
                                   ┌───────────────────────┐
                                   │ CHAMPIONSHIP_CONCLUDED│
                                   └───────────┬───────────┘
                                               │ HOST_START_WINNER_PRESENTATION
                                               ▼
                                   ┌───────────────────────┐
                                   │  WINNER_ANNOUNCEMENT  │ (6-Stage Projector Reveal)
                                   └───────────────────────┘
```

---

## 2. Comprehensive State Transition Matrix

| # | Current State | Triggering Event / Action | Preconditions | Frontend Handler (`app.js`) | Backend Handler (`server.js`) | Persistence | Resulting State | Realtime Broadcast | Screens Affected |
|---|---|---|---|---|---|---|---|---|---|
| **T01** | `None` | Server Boot (`node server.js live`) | Clean startup or recovery file exists | N/A | Lines 4725–4750 | Loads `live_game_state.json` or scenario | `SETUP` or Restored | None | All |
| **T02** | `SETUP` | `HOST_SET_EVENT_LOCK` | $\ge 4$ stocks, valid title, teams configured | `submitLockSetup()` | Lines 2879–3070 | `saveLiveGameState()`, `saveUniverseToDisk()` | `STANDBY` (`configLocked = true`) | `EVENT_CONFIG_LOCKED`, `PUBLIC_EVENT_STATUS` | Login screen opens logins; Host shows locked badge. |
| **T03** | `STANDBY` | `HOST_UNLOCK_EVENT_CONFIG` | Pre-trading only (`elapsedSeconds === 0`) | `hostUnlockConfiguration()` | Lines 3090–3113 | `saveLiveGameState()` | `SETUP` (`configLocked = false`) | `PUBLIC_EVENT_STATUS` | Setup wizard inputs re-enable. |
| **T04** | `STANDBY` / `PAUSED` | `HOST_RESUME_COUNTDOWN` | Not concluding, no active countdown | `hostResumeMarket()` | Lines 2123–2160, 3173–3180 | In-memory countdown | `COUNTDOWN` | `COUNTDOWN_START` (3s) | All screens display hero 3-2-1 overlay. |
| **T05** | `COUNTDOWN` | `HOST_PAUSE` | Active countdown in progress | `hostPauseMarket()` | Lines 3138–3150 | In-memory | `PAUSED` | `COUNTDOWN_CANCELLED`, `MARKET_PAUSED` | Countdown overlay dismisses instantly; pause overlay shows. |
| **T06** | `COUNTDOWN` | Timer Expiry (3000ms elapsed) | Host did not pause during 3-2-1 | Handled via countdown tick callback | Lines 2145–2160 | `saveLiveGameState()` | `LIVE` (`isPaused = false`) | `MARKET_RESUMED` | Overlays clear; trade modals and buttons activate. |
| **T07** | `LIVE` | `HOST_PAUSE` | Market currently trading | `hostPauseMarket(mode)` | Lines 3138–3170 | `saveLiveGameState()` | `PAUSED` (`isPaused = true`) | `MARKET_PAUSED` | Trader orders blocked; soft pause or blackout overlay shows. |
| **T08** | `LIVE` | `HOST_EMERGENCY_STOP` | Any live trading | `openEmergencyStopModal()` | Lines 3603–3626 | `saveLiveGameState()` | `PAUSED` (`pauseMode = 'BLACKOUT'`) | `EMERGENCY_STOP` | Audible klaxon sounds; red emergency stop screen displayed. |
| **T09** | `LIVE` / `PAUSED` | Timer Expiration (`elapsedSeconds >= dayDurationSeconds`) | Automatic end-of-session | Clock tick loop evaluates duration | Lines 1229–1370 (`concludeCurrentDay(true)`) | Locks daily snapshot to `dailyLeaderboards` | `DAY_COMPLETED` (`isPaused = false`) | `BELL_EVENT` (Close), `DAY_CONCLUDED` | `#traderDayCompletedOverlay` displays daily rankings. |
| **T10** | `LIVE` / `PAUSED` | `HOST_CONCLUDE_DAY` | Manual host conclusion | `openConcludeDayModal()` | Lines 3473–3483 (`concludeCurrentDay(false)`) | Locks daily snapshot to `dailyLeaderboards` | `DAY_COMPLETED` (`isPaused = false`) | `BELL_EVENT` (Close), `DAY_CONCLUDED` | Host operations bar locks; `#traderDayCompletedOverlay` displays. |
| **T11** | `DAY_COMPLETED` | `HOST_START_NEXT_DAY` | `currentDay < totalDays` | `executeStartNextDay()` | Lines 3486–3563 | Locks Day $N$ close as Day $N+1$ baseline | `STANDBY` (Day $N+1$, `elapsed = 0`) | `DAY_TRANSITION`, `DAY_ADVANCED` | Day flips to $N+1$; waiting room reappears; holdings preserved. |
| **T12** | `DAY_COMPLETED` | `HOST_ADD_DAY` | Day completed | `executeAddDay()` | Lines 3565–3581 | Increments `totalDays` | `DAY_COMPLETED` (New total) | `DAY_ADDED` | Tournament extended by 1 day; news balanced. |
| **T13** | `DAY_COMPLETED` | `HOST_CONCLUDE_CHAMPIONSHIP` | `currentDay === totalDays` | `openFinishEventModal()` | Lines 4006–4046 | Generates `finalResultsSnapshot` | `CHAMPIONSHIP_CONCLUDED` | `CHAMPIONSHIP_CONCLUDED` | Trading locked permanently; official podium created. |
| **T14** | `CHAMPIONSHIP_CONCLUDED` | `HOST_START_WINNER_PRESENTATION`| Host logged in | `startWinnerPresentation()` | Lines 3352–3381 | In-memory presentation state | `WINNER_ANNOUNCEMENT` | `PROJECTOR_STATE_UPDATE`, `PRESENTATION_SCENE_UPDATE` | Projector transitions to 6-stage ceremonial stage. |
| **T15** | `WINNER_ANNOUNCEMENT` | `HOST_SET_PRESENTATION_SCENE` | Presentation active | `setPresentationScene(scene)` | Lines 3395–3433 | In-memory scene state | `WINNER_ANNOUNCEMENT` | `PRESENTATION_SCENE_UPDATE` | Projector displays Bronze, Silver, Champion, Podium, Leaderboard. |
| **T16** | `Any` | `HOST_RESET_ENTIRE_CHAMPIONSHIP`| Confirmation `"RESET"` provided | `executeResetChampionship()` | Lines 4058–4204 | Unlinks `live_game_state.json`; creates fresh `eventId` | `RESET` $\to$ `STANDBY` (Day 1) | `CHAMPIONSHIP_RESET`, `CHAMPIONSHIP_RESET_ACK` | Traders logged out to `#clientResetModal`; Host returned to Step 1. |

---

## 3. Detailed Step-by-Step User Journey

### Phase 1: Server Startup & Crash Recovery
1. The coordinator double-clicks `Launch_The_Trading_Floor.bat`.
2. The batch script detects local `%~dp0tools\node.exe` or system `node`, launching `server.js live`.
3. The server inspects `data/live_game_state.json`:
   - If present and valid (from a server power outage or accidental terminal close), the engine **restores all balances, holdings, elapsed clocks, and daily snapshots cleanly**, setting `isPaused = true` and `pauseMode = 'RECOVERY'`. The market waits safely for the Host to resume.
   - If absent, it loads baseline `data/universe_active.json` with 20 real Indian enterprises in state `SETUP`.
4. The server prints the local LAN IP (e.g. `http://192.168.1.45:3000`) for auditorium screens and student desks.

### Phase 2: Host Event Setup Wizard
1. The Host navigates to `http://localhost:3000` and logs in as `host` / `host2026`.
2. The Host enters `⚙️ Event Setup` (`#eventSetupView`) and configures:
   - **Step 1 (Details)**: Event Title, Institution (`SSASIT / GTU`), Starting Cash (`₹5,00,000`).
   - **Step 2 (Teams)**: 16 trading desks, team names, custom desk passwords.
   - **Step 3 (Universe)**: Selects participating stocks from the 20-company catalogue.
   - **Step 4 (Rules)**: Transaction fees (default 10 bps), Circuit breaker band ($\pm 20\%$).
   - **Step 5 (Schedule)**: Selects session duration (e.g., 30 minutes or 45 minutes). The dynamic schedule engine automatically recalculates all news trigger offsets proportionally.
   - **Step 6 (News Plan)**: Reviews auto-generated news timeline with exact 12-hour AM/PM trigger clocks.
   - **Step 7 (Stage & Audio)**: Sets default projector page cycle duration (8s) and sound levels.
   - **Step 8 (Review & Lock)**: Automatic validation verifies completeness. Clicking `🔒 Lock Configuration` transitions the event to `STANDBY`.

### Phase 3: Team Login & Pre-Market Waiting Room
1. As soon as setup is locked, `EVENT_CONFIG_LOCKED` broadcasts live across the LAN.
2. Unauthenticated student workstations dynamically update their login screens from amber ("Setup in Progress") to emerald ("Logins Open").
3. Teams log in using their assigned credentials (`team1` / `trade100`).
4. Upon successful login, trader terminals display the full-screen **Pre-Market Waiting Room Card (`#traderWaitingRoomOverlay`)**, showing:
   - Scheduled opening clock: `"Scheduled Open: 09:30 AM"`.
   - Team allocation: `"Allocated Capital: ₹5,00,000.00"`.
   - Key trading rules and circuit breaker guidelines.
   - Orders submitted during `STANDBY` are strictly rejected by the server.

### Phase 4: Market Opening & 3-2-1 Countdown
1. In the Host Live Market tab, the Live Market Operations Bar displays `▶ Resume 3-2-1`.
2. The Host clicks `▶ Resume 3-2-1`.
3. The server broadcasts `COUNTDOWN_START` (`seconds: 3`).
4. An authoritative 3-second animated sequence triggers simultaneously across all student desks and the auditorium projector, while the sound system plays synchronized countdown pings.
5. Upon zero, the server transitions state to `LIVE`, triggers the Market Open Bell chime, and trading begins.

### Phase 5: Live Trading & News Shocks
1. Traders enter Buy and Sell orders. Server executes orders with exact 10 bps fee accounting, updating cash, holdings, and portfolio valuations in real time.
2. When a scheduled news event reaches its trigger offset:
   - Server broadcasts `NEWS_FLASH` and plays breaking news fanfare.
   - Non-host screens receive neutral wire headlines and enter the **Cognitive Reading Window** (12s to 25s) with zero immediate price movement.
   - When the reading window expires, the price engine executes a smoothstep price trajectory ($3u^2 - 2u^3$) toward target prices.
   - If a stock reaches $\pm 20\%$, directional circuit breakers clamp the price, rejecting further trend-following orders while allowing counter-flow liquidity orders.

### Phase 6: Session Conclusion & Daily Results
1. When session time expires (or Host clicks `🏁 Conclude Session`):
   - Server transitions state to `DAY_COMPLETED`.
   - Market Close Bell chimes across the hall.
   - All open order routing is immediately blocked.
   - Server locks the daily snapshot: Day Opening Valuation, Closing Valuation, Daily P&L, Cumulative P&L, Daily Rank, and Rank Delta ($\Delta$).
   - Student desks display `#traderDayCompletedOverlay` with verified daily standings.
   - The auditorium projector displays the full-floor daily leaderboard.

### Phase 7: Next-Day Transition & Holdings Carry-Over
1. The Host clicks `▶️ Advance to Standby`.
2. The server advances `gameState.currentDay` to Day $N+1$ and resets `elapsedSeconds = 0`.
3. **Carry-Over Invariant**: All team cash balances and stock holdings are preserved without reset. The closing portfolio value of Day 1 becomes the authoritative `dayOpeningPortfolioValue` for Day 2.
4. Traders return to the Pre-Market Waiting Room, ready for Day 2 opening.

### Phase 8: Grand Finale & 6-Stage Winner Ceremony
1. Following the conclusion of the final scheduled day (e.g. Day 2 of 2), the Host clicks `🏁 Finalize Championship`.
2. Server transitions to `CHAMPIONSHIP_CONCLUDED` and generates `finalResultsSnapshot`.
3. The Host clicks `🏆 Launch Winner Presentation`.
4. The auditorium projector enters the cinematic 6-stage presentation:
   - `SCENE_INTRO`: Dramatic title card with orchestral fanfare.
   - `SCENE_BRONZE`: 3rd Place Team reveal with net worth and member names.
   - `SCENE_SILVER`: 2nd Place Team reveal.
   - `SCENE_CHAMPION`: Grand Champion reveal with trumpet fanfare and celebratory animations.
   - `SCENE_PODIUM`: Complete 1st, 2nd, and 3rd place podium graphics.
   - `SCENE_LEADERBOARD`: Complete 16-team final tournament standings.
5. The Host downloads audited CSV reports (`/api/export/standings`, `/api/export/trades`).

Proceed to **`ARGON_DOSSIER/04_MATHEMATICAL_ENGINE.md`**.
