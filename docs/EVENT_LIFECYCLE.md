# Event Lifecycle & Authoritative Server State Machine

## 1. Lifecycle States

```
[DRAFT / SETUP] ──> [SCHEDULED] ──> [COUNTDOWN] ──> [LIVE TRADING]
      ▲                                                  │
      │                                             [PAUSED / BLACKOUT]
      │                                                  │
[COMPLETED] <── [WINNER_ANNOUNCEMENT] <── [FINAL_ANALYSIS] <── [MARKET_CLOSED]
```

## 2. Server-Enforced Configuration Lock (`EVENT_CONFIG_LOCKED`)
1. **Trigger Condition**:
   - As soon as the tournament enters `SCHEDULED` or `LIVE` (`gameState.configLocked = true`).
2. **Forbidden Mid-Competition Operations**:
   - `HOST_ADD_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_REMOVE_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_EDIT_SHARE`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_CREATE_CUSTOM_NEWS`: Rejected with `EVENT_CONFIG_LOCKED`.
   - `HOST_UPDATE_EVENT_CONFIG` (modifying starting capital or total days): Rejected with `EVENT_CONFIG_LOCKED`.
3. **Allowed Operational Controls**:
   - Market pause (`HOST_PAUSE`), resume with 3-2-1 synchronized countdown (`HOST_RESUME_COUNTDOWN`).
   - Projector cycle mode and scene switching (`HOST_UPDATE_PROJECTOR_MODE`).
   - Daily standings finalization (`HOST_FINALIZE_DAY`).
   - Stage awards presentation (`HOST_START_WINNER_PRESENTATION`, `HOST_SET_PRESENTATION_SCENE`, `HOST_EXIT_WINNER_PRESENTATION`).
   - Audio volume and hardware sound routing (`HOST_UPDATE_AUDIO_SETTINGS`).
