# NEXT SESSION TASKS — THE TRADING FLOOR CHAMPIONSHIP 2026

**Current Baseline**: Version 2.1.0 (Master Upgrade Complete: 4-Hub Host Workflow, Zero-Scroll Projector Pagination, Spotlight Bar, Disaster Recovery Checkpoints)  
**All Tests Verified**:
- `test_master_suite.js`: 48/48 passing (100%)
- `test_projector_pagination.js`: 100% passing
- `test_checkpoint_disaster_recovery.js`: 100% passing
- `test_upgrade_master.js`: 100% passing
- `test_load_stress.js`: 160/160 orders passing (19.09ms avg latency)
- `test_2hour_heavy_load.js`: 7,200s endurance test (480 trades, 8.7 MB heap)

---

## 1. Verified Operational Invariants (Do Not Break)
- **4 Canonical Hubs**: Home, Event, Live Market, Stage & Results.
- **One Action Principle**: Single entry point for all market operations (Pause, Resume 3-2-1, Blackout, Conclude).
- **Automatic Setup Lock**: Locks when valid; unlocks before start; permanently locked once live trading begins.
- **Auto News Plan**: Host selects companies; system generates balanced neutral wire stories targeting only selected stocks.
- **News Secrecy & 60s Reveal**: Masked by default; 60s countdown on explicit host reveal; zero leakage to traders or projector.
- **Smoothstep Price Math**: $s(u) = 3u^2 - 2u^3$ continuous over elapsed milliseconds ($P(t) = P_0 + (P_T - P_0) \cdot s(u)$).
- **Projector Zero-Scroll Pagination**: 8 stock cards per page ($4 \times 2$ grid); auto-rotates every 8s; in-place DOM updates with zero timer resets on price ticks.
- **Spotlight Bar**: Top Percentage Gainer and Top Percentage Loser computed across active universe with deterministic alphabetical tie-breaks.
- **Disaster Recovery Checkpoints**: Auto-snapshots every 120s; manual instant checkpoints; one-click restore; always enters safe PAUSED state awaiting Host Resume 3-2-1.
- **Safe Championship Reset**: Broadcasts mandatory full-screen logout notice to all trader terminals and invalidates sessions.

---

## 2. Potential Future Enhancements
- [ ] **Offline Multi-Hall Tournament Clustering**: Support multiple simultaneous simulation rooms on a single campus server port if hosting multi-section competitions.
- [ ] **Advanced Print/Export Templates**: Additional PDF export presets for university coordinator scorecards.
- [ ] **Auditorium Speaker Pairing Assistant**: Interactive audio test tones per category in the Sound Console UI.
