# NEXT SESSION TASKS — THE TRADING FLOOR CHAMPIONSHIP 2026

**Current Baseline**: Version 2.5.3 (Master Interaction Logic, State Machine, UX & End-to-End QA Hardening)  
**All Tests Verified**:
- `npm run test:all`: **115/115 passing (100%)** across all 5 test suites:
  - `test_master_suite.js`: **52/52 passing** — Complete end-to-end regression across all stages.
  - `test_dynamic_upgrade_suite.js`: **10/10 passing** — Team investment security (403 unauthenticated / 200 authenticated) & lifecycle.
  - `test_trading_cards_and_lifecycle_suite.js`: **24/24 passing** — Filters, order affordability, circuit breakers & day rollover carry-over.
  - `test_master_lifecycle_and_isolation.js`: **13/13 passing** — Day conclusion non-pause invariant, login isolation, real-time setup broadcast & host control safety.
  - `test_interaction_logic_and_state_machine.js`: **16/16 passing** — All 12 master QA trials (duplicate pause prevention, resume rejection on concluded days, automatic timer expiry, setup & universe locking, countdown safety, multi-day rollover).
- Server syntax & UTF-8 integrity: Clean, valid, zero character corruption (`node -c server.js`, `node -c public/app.js`).
- DOM ID uniqueness: Verified 0 duplicate element IDs across `public/index.html` (`tools/find_duplicate_ids.js`).

---

## 1. Verified Operational Invariants (Do Not Break)
- **4 Canonical Hubs**: Home, Event, Live Market, Stage & Results.
- **One Action Principle**: Single entry point for all market operations (Pause, Resume 3-2-1, Blackout, Conclude).
- **Circuit Breaker Reference Immutability**: `dayOpenPrice` is immutable once trading begins; manual unhalt and sector unhalt NEVER reset `dayOpenPrice = currentPrice`.
- **Private Analytics Protection**: `GET /api/team-investments` and `GET /api/team-investments/:teamId` strictly require `requireHostAuth` middleware.
- **News Idempotency**: `firedNewsEventsPerDay` Map guarantees news events fire strictly once per intended trading day.
- **Two-Step Championship Finalization**: Concluding the final day sets `DAY_COMPLETED` with `requiresExplicitFinalization: true`; `HOST_CONCLUDE_CHAMPIONSHIP` requires `status === 'DAY_COMPLETED'` and `currentDay === totalDays`.
- **Checkpoint Recovery State Preservation**: Restoring from checkpoint preserves legitimate stopped states (`SETUP`, `STANDBY`, `DAY_COMPLETED`, `CHAMPIONSHIP_CONCLUDED`), setting `pauseMode = 'RECOVERY'`.
- **Next Day Validation**: Advancing day requires prior `DAY_COMPLETED` status.
- **RFC 4122 Trade UUIDs**: All BUY, SELL, and LIQUIDATE_ALL orders generate 128-bit `crypto.randomUUID()` trade IDs while preserving sequential `seq` counter.
- **Classroom 4:3 Projector Support**: `@media (min-aspect-ratio: 4/3)` specialized $4 \times 2$ and $3 \times 2$ responsive grids for 1024×768 and 800×600 projectors with zero horizontal scrollbars.
- **Strict DOM ID Uniqueness**: All 21 previously colliding element IDs in `#hostTabContentSetup` namespaced with `hostTabSetup_`; standalone `#eventSetupView` remains canonical.
- **Self-Contained Test Isolation**: All 3 test suites auto-boot isolated test servers with cleanup, eliminating manual port prerequisites.
- **Offline-First Zero-CDN Invariant**: Local college LAN events operate with zero internet connection; no external CDN scripts, fonts, or links.

---

## 2. Priority Backlog & Future Enhancements
- [ ] **Offline Multi-Hall Tournament Clustering**: Support multiple simultaneous simulation rooms on a single campus server port if hosting multi-section competitions.
- [ ] **Advanced Print/Export Templates**: Additional PDF export presets for university coordinator scorecards.
- [ ] **Auditorium Speaker Pairing Assistant**: Interactive audio test tones per category in the Sound Console UI.


