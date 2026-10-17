# NEXT SESSION TASKS — THE TRADING FLOOR CHAMPIONSHIP 2026

**Current Baseline**: Version 2.4.0 (Flexible Multi-Day Lifecycle, Idempotent News Engine, Zero Horizontal Scroll Indices, Live Stock Rankings, TV Post-News Reaction Spotlight, Team Investment Analytics & Segmented Allocation Visualizer)  
**All Tests Verified**:
- `test_dynamic_upgrade_suite.js`: 9/9 passing (100%)
- `test_master_suite.js`: 52/52 passing (100%)
- Total Automated Verification: **61/61 passing tests (0 failures)**

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
