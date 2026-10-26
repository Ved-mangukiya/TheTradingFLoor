# NEXT SESSION TASKS — THE TRADING FLOOR CHAMPIONSHIP 2026

**Current Baseline**: Version 2.6.4 (Target Architecture, Authoritative State Model, Complete User Journeys & Screen Redesign, Universal Action Contracts & In-Flight Double-Click Shield Verified)  
**Authoritative Multi-Suite Verification**:
- `npm run test:chunk4` / `node tests/test_chunk4_action_contracts.js`: **64/64 passing (100%)** across Universal Action Contract locks, double-click network shields, 5000ms safety timeout fallbacks, server acknowledgments, and `ACTION_REJECTED` catch-all.
- `npm run test:chunk3` / `node tests/test_chunk3_ui_and_overlays.js`: **89/89 passing (100%)** across all 5 user flow and screen redesign verification specs on isolated port 3103.
- `npm run test:chunk2` / `node tests/test_chunk2_state_machine.js`: **5/5 passing (100%)** (TEST-STATE-001 through TEST-STATE-005 verified on isolated port 3102).
- `npm test` / `node tests/test_unified_master_flow.js`: **36/36 passing (100%)** across all 11 tournament lifecycle phases in a single chronological run on isolated port 3099.
- DOM ID Integrity: **0 duplicate IDs** across all 718 unique DOM IDs in `public/index.html` (`node tools/find_duplicate_ids.js`).
- Backend Domain Modularization: `server/state_machine.js`, `server/sanitizer.js`, `server/accounting.js`, `server/persistence.js`, `server/news_scheduler.js`, `server/market_engine.js`.
- Frontend State Guard: `public/js/state_guard.js` wired into `public/index.html` and `public/app.js` (`shouldAcceptIncomingState` monotonic versioning guard).
- Audio Cue Isolation: `broadcastAudioCue()` delivers exclusively to `soundClients` (`SOUND_CONSOLE`), protecting traders and unauthenticated sockets from audio cue leakage (`DEF-016`).
- Overlay Determinism: `syncRoleOverlays()` with mutual exclusion across `STANDBY`, `COUNTDOWN`, `LIVE`, `PAUSED` (soft vs blackout), `DAY_COMPLETED` (modal vs read-only banner), and `CHAMPIONSHIP_CONCLUDED` (`FLOW-001`).
- Projector In-Place 8-Card Slot Reuse: `#projCardSlot_0`..`#projCardSlot_7` and canvases updated in-place without DOM reconstruction or canvas 2D context thrashing (`FLOW-006` / `DEF-031`).
- Universal Action Contract Engine: `applyActionContractLock` and `releaseActionContractLock` prevent double-click frame spam on orders, liquidations, logins, market operations, and ceremony launches with 5000ms timeout fallback (`BTN-000` .. `BTN-009`).
- Next Milestone: **Chunk 5 — Advanced Analytics, Reports, Multi-Section Tournament Clustering, or Production Deployment / Packaging**.

---

## 1. Verified Operational Invariants (Do Not Break)
- **Universal Action Contract Invariant (BTN-000)**: All UI state mutations must route through `applyActionContractLock(button, text)` and be resolved via server WebSocket acknowledgment or safety timeout (5000ms). Rapid secondary clicks while in-flight MUST emit 0 duplicate network frames.
- **4 Canonical Hubs**: Home, Event, Live Market, Stage & Results.
- **One Action Principle**: Single entry point for all market operations (Pause, Resume 3-2-1, Blackout, Conclude).
- **Sensitive Parameter Isolation Invariant**: `beta`, `volatility_factor`, and unrevealed news impacts are strictly withheld from TRADER, PROJECTOR, and unauthenticated payloads. Public stock details display Face Value (`₹10.00`).
- **Dynamic Proportional Scheduling Invariant**: Changing session duration $D$ automatically recalculates all event offsets via $t_i = \operatorname{round}(D \times p_i)$ while strictly respecting cognitive reading window floors ($\ge 12\text{--}25\text{s}$) and minimum inter-event separation ($\Delta t \ge 60\text{s}$).
- **One-Time News Publication Idempotency**: Scheduled news can only trigger once per day; subsequent triggers return `ORDER_REJECTED: Already published for today`.
- **Configuration Lock Immutability**: Locking event settings freezes stock rosters and news schedules, rejecting subsequent edits, cancellations, and duplicate creations.
- **Circuit Breaker Reference Immutability**: `dayOpenPrice` is immutable once trading begins; manual unhalt and sector unhalt NEVER reset `dayOpenPrice = currentPrice`.
- **Private Analytics Protection**: `GET /api/team-investments` and `GET /api/team-investments/:teamId` strictly require `requireHostAuth` middleware.
- **Two-Step Championship Finalization**: Concluding the final day sets `DAY_COMPLETED` with `requiresExplicitFinalization: true`; `HOST_CONCLUDE_CHAMPIONSHIP` requires `status === 'DAY_COMPLETED'` and `currentDay === totalDays`.
- **Checkpoint Recovery State Preservation**: Restoring from checkpoint preserves legitimate stopped states (`SETUP`, `STANDBY`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`), setting `pauseMode = 'RECOVERY'`.
- **Next Day Validation**: Advancing day requires prior `DAY_COMPLETED` status.
- **RFC 4122 Trade UUIDs**: All BUY, SELL, and LIQUIDATE_ALL orders generate 128-bit `crypto.randomUUID()` trade IDs while preserving sequential `seq` counter.
- **Classroom 4:3 Projector Support**: `@media (min-aspect-ratio: 4/3)` specialized $4 \times 2$ and $3 \times 2$ responsive grids for 1024×768 and 800×600 projectors with zero horizontal scrollbars.
- **Strict DOM ID Uniqueness**: 0 duplicate DOM IDs across all 718 elements in `public/index.html`; canonical `#setup*` elements embedded in Hub 2 `#hostTabContentEvent`, with DOM proxy for backward compatibility.
- **Self-Contained Test Isolation**: All test suites (`test_unified_master_flow.js`, `test_chunk2_state_machine.js`, `test_chunk3_ui_and_overlays.js`, `test_chunk4_action_contracts.js`) auto-boot isolated test servers with cleanup, eliminating manual port prerequisites.
- **Offline-First Zero-CDN Invariant**: Local college LAN events operate with zero internet connection; no external CDN scripts, fonts, or links.

---

## 2. Priority Backlog & Future Enhancements (Chunk 5 Candidates)
- [ ] **Offline Multi-Hall Tournament Clustering**: Support multiple simultaneous simulation rooms on a single campus server port if hosting multi-section competitions.
- [ ] **Advanced Print/Export Templates**: Additional PDF export presets for university coordinator scorecards and team participation certificates.
- [ ] **Auditorium Speaker Pairing Assistant**: Interactive audio test tones per category in the Sound Console UI with dB meters.
- [ ] **Desktop Native Launcher & Bundling**: Self-contained executable / packaged offline bundle with bundled Node.js runtime for zero-install distribution.
