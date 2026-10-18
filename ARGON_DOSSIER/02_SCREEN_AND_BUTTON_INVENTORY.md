# SCREEN & INTERACTION INVENTORY
## Complete Screen Catalogue, Modal Registry & Button-by-Button Interaction Map

> **DOCUMENT ID**: `ARGON_DOSSIER/02_SCREEN_AND_BUTTON_INVENTORY.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **PRIMARY FILES**: [public/index.html](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/index.html), [public/app.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js), [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js)

---

## 1. Complete Screen & View Catalogue

The frontend is a Single-Page Application (SPA) where only one primary view is visible at any time (`display: block` vs `display: none`), managed via `switchView(viewId)` in `public/app.js`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                               VIEW ROUTER                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌──────────────┬────────────────┼──────────────┬────────────────┐
    ▼              ▼                ▼              ▼                ▼
#loginView    #hostView       #traderView    #projectorView   #soundConsoleView
(Auth/Roles)  (Host Matrix)   (Student Desk) (Auditorium 4:3) (Hall PA System)
```

### 1. `#loginView` — Universal Terminal Gateway
- **Intended User**: All participants, Host, Projector operator, Sound engineer.
- **Entry Conditions**: Default landing view on fresh browser load or after terminal logout/reset.
- **Visible Information**: Competition title, GTU affiliation badge, real-time connection status pill, role selector pills (Host, Projector, Trader Desk, Winner Stage, Sound), username & password inputs, login error banner.
- **Gating**: Trader logins are strictly disabled until the Host completes and locks the setup wizard (`gameState.configLocked === true`).

### 2. `#hostView` — Host Master Control Matrix
- **Intended User**: Event Coordinator, Professor, Student Head.
- **Structure**: Divided into **4 Primary Navigation Hubs**:
  1. **`🏠 1. Home` (`#hostTabContentHome`)**: Real-time tournament heartbeat, terminal connection monitor (connected traders, projector, sound), 5-point Readiness Checklist, dynamic "Next Step" action card.
  2. **`⚙️ 2. Event Setup` (`#hostTabContentSetup` / `#eventSetupView`)**: 8-step guided configuration wizard (`1. Event Details -> 2. Teams Roster -> 3. Stock Universe -> 4. Rules & Limits -> 5. Schedule & Timing -> 6. News Timeline -> 7. Projector & Sound -> 8. Review & Lock`).
  3. **`📈 3. Live Market` (`#hostTabContentMarket`)**: The operational hub during live competition. Features the canonical **Live Market Operations Bar** (`▶ Resume 3-2-1`, `⏸ Pause`, `🕶️ Blackout`, `🏁 Conclude Session`, `🛑 Emergency Stop`), News Control Center with 60-second privacy reveal, live trade feed, and stock board.
  4. **`🖥️ 4. Stage & Results` (`#hostTabContentProjector`)**: Auditorium Projector Remote (Auto-Cycle / Fixed Screen / Board Page Selector), Team Investment Analytics, Sound Console controls, Disaster Recovery & Checkpoint Matrix, Leaderboard, CSV/JSON exports, and Tournament Reset card.

### 3. `#traderView` — Student Trader Terminal
- **Intended User**: Student trading teams (16 to 30 teams, 2 traders per desk).
- **Structure**:
  - **Header Bar**: Team name, desk ID (`team_1`), available cash, portfolio market value, total net worth, realized P&L, daily return %.
  - **Pre-Market Waiting Room Overlay (`#traderWaitingRoomOverlay`)**: Full-screen luxury card shown during `STANDBY`, displaying scheduled 12-hour AM/PM opening time and trading rules.
  - **Market Tab (`#traderTabContentMarket`)**: Active stock card grid, search bar, sector filter pills, Top Gainer / Loser sort options.
  - **Positions Tab (`#traderTabContentPositions`)**: Granular open position table with quantity, average buy price, current market price, and unrealized P&L. Includes quick "Sell" and "Liquidate All" actions.
  - **Trades Tab (`#traderTabContentTrades`)**: Chronological audit log of executed orders.
  - **Day Completed Overlay (`#traderDayCompletedOverlay`)**: Full-screen modal elevated to `z-index: 10000` with daily ranking, net worth, and waiting-for-host indicator.

### 4. `#projectorView` — Auditorium Stage Projector
- **Intended User**: Large auditorium audience, spectators, faculty jury.
- **Structure**:
  - **Persistent Spotlight Bar**: Top Percentage Gainer, Top Percentage Loser, Market Breadth (Advancing / Declining / Unchanged).
  - **Zero-Scroll Stock Board**: 8-card responsive grid ($4 \times 2$) rotating every 8 seconds across multiple pages. Supports vintage 4:3 campus projectors (1024×768 / 800×600) without horizontal scrollbars.
  - **Auditorium Hero Countdown (`#countdownOverlay`)**: Giant pulsating 3-2-1 countdown overlay.
  - **Breaking News Crawl Overlay (`#newsFlashModal`)**: Full-screen breaking wire banner with neutral headline.
  - **Ceremonial Winner Stage (`#winnerPresentationView`)**: 6-stage presentation reveal (`INTRO` -> `BRONZE` -> `SILVER` -> `CHAMPION` -> `PODIUM` -> `LEADERBOARD`).

### 5. `#soundConsoleView` — Hall PA Sound System Console
- **Intended User**: Auditorium audio technician.
- **Structure**: Master volume slider, mute toggle, category volume sliders (Lifecycle Bells, News Fanfare, Circuit Alarms, Ceremony Trumpets), test tone soundboard, and live WebSocket audio listener.

---

## 2. Modal, Overlay & Dialog Registry

All 22 dialogs and overlays defined in `public/index.html`:

| Modal ID | Purpose & Trigger | Roles Visible To | Key Interactive Controls |
|---|---|---|---|
| `#tradeModal` | Buy/Sell Order Entry (clicking stock card). | `TRADER` | Quantity stepper (`-`, `+`, `Max`), Gross value, 10 bps fee preview, Confirm button. |
| `#detailsModal` | Fundamentals & 52-Week Range modal. | `TRADER`, `HOST` | Face value, market cap, P/E, 52W bar, summary. |
| `#fullChartModal` | Interactive Bezier Canvas Chart. | `TRADER`, `HOST` | High-FPS Canvas 2D chart with historical price ticks. |
| `#liquidateModal` | Emergency exit confirmation dialog. | `TRADER` | Cancel, `btnConfirmLiquidate` (`LIQUIDATE_ALL`). |
| `#modalConcludeDay` | Day conclusion confirmation dialog. | `HOST` | Daily snapshot notice, Confirm Day Conclusion. |
| `#modalStartNextDay`| Advance to Day $N+1$ confirmation dialog. | `HOST` | Advance to Day $N+1$ Standby, Schedule Timer. |
| `#modalAddDay` | Extend tournament by adding Day $N+1$. | `HOST` | Add Day button. |
| `#modalFinishEvent` | Championship finalization confirmation. | `HOST` | Confirm Final Championship Conclusion. |
| `#modalEmergencyStop`| Floor-wide Emergency Stop confirmation. | `HOST` | Red Emergency Stop trigger button. |
| `#resetChampionshipModal`| Permanent tournament wipe modal. | `HOST` | Strict confirmation input (`"RESET"`), wipe button. |
| `#championshipWizardModal`| Fast tournament re-initialization wizard. | `HOST` | Title, cash, days, duration, fee, circuit band. |
| `#shareEditorModal` | Add/Edit company fundamentals modal. | `HOST` | Ticker, name, sector, price, collapsible Advanced Settings ($\beta$, $\sigma$). |
| `#teamSetupModal` | Team names and passwords editor. | `HOST` | 16-team table with custom names and passwords. |
| `#eventSettingsModal`| Global parameters editor modal. | `HOST` | Title, starting cash, fees, circuit limit inputs. |
| `#scheduleEventModal`| Timed auto-start scheduler modal. | `HOST` | Scheduled start clock, duration, confirm button. |
| `#teamInvestmentDetailModal`| Detailed single-team analytics modal. | `HOST` | Holdings table, avg buy price, trade order history. |
| `#rulesHelpModal` | Rules & scoring formula documentation. | `TRADER`, `HOST` | Tabs explaining order rules, fees, circuit breaks. |
| `#clientResetModal`| Full-screen lockout shown when host resets. | `TRADER`, `PROJECTOR`| Acknowledgment button redirecting to login. |
| `#newsFlashModal` | Breaking news broadcast banner overlay. | All | Auto-dismisses after reading window expires. |
| `#countdownOverlay`| 3-2-1 Synchronized resume countdown. | All | 3-2-1 animated sequence. |
| `#softPauseOverlay`| Semi-transparent market pause banner. | `TRADER` | Notice that trading is paused by host. |
| `#blackoutOverlay` | Full blackout screen during private pause. | All | Black screen hiding all market boards. |

---

## 3. Exhaustive Button-by-Button Interaction Table

Every interactive button in the application, traced from DOM ID to server handler:

| Button ID | UI Label | Screen / Container | Preconditions | JS Handler (`app.js`) | WebSocket Action / REST | Server Handler (`server.js`) | Downstream Mutation & Broadcast |
|---|---|---|---|---|---|---|---|
| `#demoPillHost` | `👑 Host Panel` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `host`, password to `host2026`. |
| `#demoPillProjector` | `📊 Projector` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `projector`, password to `screen2026`. |
| `#demoPillTrader` | `💻 Trader Desk` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `team1`, password to `trade100`. |
| `#demoPillWinner` | `🏆 Winner Stage` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `winner`, password to `winner2026`. |
| `#demoPillSound` | `🔊 Sound` | `#loginView` | None | `setupDemoPillClicks()` | None (Local DOM) | None | Sets username to `sound`, password to `sound2026`. |
| `btnLoginSubmit` | `Access Terminal ➔` | `#loginView` | Fields not empty | `handleLoginSubmit()` | `LOGIN` | Lines 2362–2411 | Validates credentials, creates session token, returns `LOGIN_SUCCESS` or `LOGIN_ERROR`. |
| `#hostTabBtnHome` | `🏠 1. Home` | `#hostView` | Host logged in | `switchHostTab('home')` | None (Local DOM) | None | Displays `#hostTabContentHome`, updates navigation bar styling. |
| `#hostTabBtnEvent` | `⚙️ 2. Event` | `#hostView` | Host logged in | `switchHostTab('event')` | None (Local DOM) | None | Displays `#eventSetupView`, updates wizard progress. |
| `#hostTabBtnMarket` | `📈 3. Live Market` | `#hostView` | Host logged in | `switchHostTab('market')`| None (Local DOM) | None | Displays `#hostTabContentMarket`, starts trade stream updates. |
| `#hostTabBtnStage` | `🖥️ 4. Stage & Results`| `#hostView`| Host logged in | `switchHostTab('stage')` | None (Local DOM) | None | Displays `#hostTabContentProjector`, loads analytics. |
| `#btnUnlockEventConfig`| `🔓 Unlock Configuration`| `#hostTabContentHome`| `STANDBY` & elapsed=0 | `hostUnlockConfiguration()` | `HOST_UNLOCK_EVENT_CONFIG` | Lines 3090–3113 | Unlocks setup wizard; sets `configLocked = false`. |
| `#btnNextStepAction` | `⚙️ Go to Event Setup` | `#hostTabContentHome`| Host logged in | `switchHostTab('event')` | None (Local DOM) | None | Jumps host directly to setup wizard tab. |
| `#btnMarketResume` | `▶ Resume 3-2-1` | Live Operations Bar | `PAUSED` or `STANDBY` | `hostResumeMarket()` | `HOST_RESUME_COUNTDOWN` | Lines 3173–3180 | Starts 3-2-1 countdown; broadcasts `COUNTDOWN_START`. |
| `#btnMarketPauseSoft` | `⏸ Pause` | Live Operations Bar | `LIVE` trading | `hostPauseMarket('VISIBLE_FROZEN')` | `HOST_PAUSE` | Lines 3138–3171 | Freezes trading; broadcasts `MARKET_PAUSED`. |
| `#btnMarketPauseBlackout`| `🕶️ Blackout` | Live Operations Bar | `LIVE` trading | `hostPauseMarket('BLACKOUT')` | `HOST_PAUSE` | Lines 3138–3171 | Freezes trading & blacks screen; broadcasts `MARKET_PAUSED`. |
| `#btnMarketCloseSession`| `🏁 Conclude Session` | Live Operations Bar | `LIVE` or `PAUSED` | `openConcludeDayModal()` | `HOST_CONCLUDE_DAY` | Lines 3473–3483 | Concludes day; sets `DAY_COMPLETED`; broadcasts `DAY_CONCLUDED`. |
| `#btnEmergencyStopTrigger`| `🛑 Emergency Stop`| Live Operations Bar | Any active state | `openEmergencyStopModal()`| `HOST_EMERGENCY_STOP` | Lines 3603–3626 | Halts floor; triggers siren; broadcasts `EMERGENCY_STOP`. |
| `#btnRevealPrivateNews` | `👁️ Reveal Details` | News Control Center | Host logged in | `revealPrivateNewsDetails()`| None (Local DOM) | None | Unmasks impact % for 60 seconds with countdown banner. |
| `#btnLockEventSetup` | `🔒 Confirm & Lock` | Setup Step 8 | Valid configuration | `submitLockSetup()` | `HOST_SET_EVENT_LOCK` | Lines 2879–3070 | Locks setup; sets `configLocked = true`; broadcasts `EVENT_CONFIG_LOCKED`. |
| `#btnExecuteTradeOrder`| `Confirm BUY/SELL` | `#tradeModal` | Affordable & unhalted | `submitOrder()` | `ORDER` | Lines 2470–2718 | Validates order; executes fill; broadcasts `TICK_UPDATE`. |
| `#btnLiquidateAll` | `⚡ Liquidate to Cash`| `#traderView` | Has open holdings | `openLiquidateModal()` | None (Local DOM) | None | Opens `#liquidateModal` confirmation dialog. |
| `#btnConfirmLiquidate` | `🚨 Sell Everything` | `#liquidateModal` | Has open holdings | `executeLiquidateAll()` | `LIQUIDATE_ALL` | Lines 2719–2750 | Sells all active positions; broadcasts `PORTFOLIO_LIQUIDATED`. |
| `#btnExecuteStartNextDay`| `▶️ Advance to Standby`| `#modalStartNextDay` | `DAY_COMPLETED` | `executeStartNextDay()` | `HOST_START_NEXT_DAY` | Lines 3486–3563 | Advances to Day $N+1$; broadcasts `DAY_TRANSITION`. |
| `#btnConfirmResetChampionship`| `Permanently Wipe`| `#resetChampionshipModal`| Typed `"RESET"` | `executeResetChampionship()`| `HOST_RESET_ENTIRE_CHAMPIONSHIP`| Lines 4058–4204 | Wipes tournament; generates new `eventId`; broadcasts `CHAMPIONSHIP_RESET`. |
| `#btnProjModeAuto` | `🔄 Auto-Cycle Mode` | Projector Remote | Host logged in | `setProjectorMode('AUTO_CYCLE')`| `HOST_UPDATE_PROJECTOR_MODE`| Lines 3435–3450 | Enables automatic 8-second page rotation on projector. |
| `#btnProjModeFixed` | `📌 Fixed Screen` | Projector Remote | Host logged in | `setProjectorMode('FIXED_BOARD')`| `HOST_UPDATE_PROJECTOR_MODE`| Lines 3435–3450 | Freezes projector display on selected board page. |
| `#btnProjFullscreen` | `⛶ Enter Fullscreen` | Projector Header | Modern browser | `toggleProjectorFullscreen()` | None (Browser API) | None | Requests browser `requestFullscreen()` on `#projectorView`. |
| `#btnProjToggleBoardPause`| `⏸ / ▶` | Projector Header | Host / Projector | `toggleProjectorBoardPause()` | `HOST_TOGGLE_PROJECTOR_BOARD_PAUSE`| Lines 3462–3471 | Pauses/resumes automatic page cycling timer. |
| `#btnUnlockAudio` | `🔊 Unlock Speakers` | `#soundConsoleView` | Browser gesture | `unlockAudioContext()` | None (Web Audio) | None | Resumes suspended `AudioContext` and plays test chime. |

---

## 4. In-Card & Dynamic Table Actions

In addition to static buttons, `public/app.js` generates interactive buttons dynamically:

### Stock Cards (`renderStockCard(stock)`)
- **`Buy` Button**: Triggers `openTradeModal(ticker, 'BUY')`. Populates current price, max affordable shares, fee preview, and opens `#tradeModal`.
- **`Sell` Button**: Triggers `openTradeModal(ticker, 'SELL')`. Populates current shares held, net cash proceeds, fee preview, and opens `#tradeModal`.
- **`Chart` Icon**: Triggers `openFullChartModal(ticker)`. Opens `#fullChartModal` and attaches real-time Canvas 2D tick engine.
- **`Info` (Details) Icon**: Triggers `openDetailsModal(ticker)`. Displays fundamentals and 52-week price bar in `#detailsModal`.

### News Control Center Cards (`renderNewsControlCentre()`)
- **`⚡ Publish Now`**: Triggers `hostPublishNewsNow(eventId)` $\to$ `HOST_PUBLISH_NEWS_NOW`. Server verifies `firedNewsEventsPerDay` to prevent duplicate publishing.
- **`✏️ Edit`**: Triggers `openEditNewsModal(eventId)`. Blocked by server if `gameState.configLocked === true`.
- **`❌ Cancel`**: Triggers `hostCancelNews(eventId)` $\to$ `HOST_CANCEL_NEWS`. Blocked if event is already locked or published.

### Share Universe Catalogue Table (`renderUniverseTable()`)
- **`Toggle Trading` (Eye Icon)**: Triggers `hostToggleShare(ticker)` $\to$ `HOST_TOGGLE_SHARE`. Toggles `c.isEnabled`, preventing new order routing.
- **`Edit Share` (Pencil Icon)**: Opens `#shareEditorModal` with company fundamentals and collapsible Advanced Simulation Settings.
- **`Duplicate Share` (Copy Icon)**: Clones company into universe before setup lock.
- **`Delete Share` (Trash Icon)**: Removes custom stock before setup lock.

Proceed to **`ARGON_DOSSIER/03_EVENT_LIFECYCLE.md`**.
