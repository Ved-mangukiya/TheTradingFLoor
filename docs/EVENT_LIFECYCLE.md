# Event Lifecycle & Authoritative Server State Machine

## 1. Authoritative State Machine

```
[SETUP / DRAFT] (Logins Gated)
      │
      ▼  HOST_SET_EVENT_LOCK
[STANDBY] (Logins Open • Ready to Launch)
      │
      ├─── HOST_SCHEDULE_EVENT ──> [SCHEDULED] ──> Auto-Timer ──┐
      │                                                          │
      ▼  HOST_RESUME_COUNTDOWN / HOST_START_DAY1_NOW             ▼
[COUNTDOWN] (3-2-1 Synchronized Audio/Visual Countdown)
      │
      ▼  Countdown Finishes
[LIVE] (Active Trading Floor • Prices Tick • Orders Execute)
      │
      ├─── HOST_PAUSE ───────────────> [PAUSED / BLACKOUT] ───> HOST_RESUME_COUNTDOWN ──> [LIVE]
      │
      ▼  Clock Expiry (Elapsed >= Duration) OR HOST_CONCLUDE_DAY
[DAY_COMPLETED] (Daily Snapshot Locked • #traderDayCompletedOverlay & #projDayCompletedBanner)
      │
      ├─── If currentDay < totalDays: HOST_START_NEXT_DAY ────> [STANDBY] (Day N+1 • Balances Carried)
      │                                                          │
      │                                                          └──> HOST_RESUME_COUNTDOWN ──> [LIVE]
      │
      ▼  If currentDay >= totalDays: HOST_FINISH_EVENT
[FINAL_ANALYSIS] (Audited Portfolio Standings Review)
      │
      ▼  HOST_START_WINNER_PRESENTATION
[WINNER_ANNOUNCEMENT] (Ceremonial Reveal: Bronze ➔ Silver ➔ Champion ➔ Podium)
      │
      ▼  HOST_RESET_ENTIRE_CHAMPIONSHIP ("RESET CHAMPIONSHIP")
[SETUP / DRAFT] (Mandatory Full-Screen Client Logout • Fresh Roster)
```

---

## 2. Server-Enforced Configuration Lock (`EVENT_CONFIG_LOCKED`)

1. **Trigger Condition**:
   - Host clicks `Lock Configuration` in Step 8 of Event Setup (`HOST_SET_EVENT_LOCK`).
   - Server validates title, dynamic roster ($N \ge 1$), and stock catalogue ($\ge 4$ stocks).
   - State sets `gameState.configLocked = true`, `gameState.status = 'STANDBY'`.
2. **Pre-Start Unlock Safeguard (`HOST_UNLOCK_EVENT_CONFIG`)**:
   - Permitted only while in `STANDBY` before trading begins (`elapsedSeconds === 0`).
   - Once the market has gone `LIVE` or seconds have elapsed, configuration is permanently frozen.
3. **Forbidden Mid-Competition Operations (Fairness Protection)**:
   - `HOST_ADD_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_REMOVE_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_EDIT_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_UPDATE_EVENT_CONFIG` (attempting to alter starting capital or total days mid-round): Rejected with `EVENT_CONFIG_LOCKED`.
4. **Allowed In-Competition Host Operations**:
   - Market pause (`HOST_PAUSE`) and resume with 3-2-1 synchronized countdown (`HOST_RESUME_COUNTDOWN`).
   - Directional circuit breaker unhalt (`HOST_UNHALT_STOCK`) and manual halt testing (`HOST_HALT_STOCK`).
   - Dynamic breaking news shocks (`HOST_CREATE_CUSTOM_NEWS`, `HOST_PUBLISH_NEWS_NOW`).
   - Day conclusion (`HOST_CONCLUDE_DAY`) and advancing to next day (`HOST_START_NEXT_DAY`).
   - Extending tournament length dynamically by adding a day (`HOST_ADD_DAY`).
   - Projector remote control (`HOST_UPDATE_PROJECTOR_MODE`, `HOST_PROJECTOR_BOARD_NAV`).
   - Winner presentation stage remote (`HOST_START_WINNER_PRESENTATION`, `HOST_SET_PRESENTATION_SCENE`).
   - Emergency halt (`HOST_EMERGENCY_STOP`) and full reset (`HOST_RESET_ENTIRE_CHAMPIONSHIP`).
   - Audio volume and sound console routing (`HOST_UPDATE_AUDIO_SETTINGS`).
