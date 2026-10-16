# NEXT SESSION TASKS — THE TRADING FLOOR CHAMPIONSHIP 2026

**Current Baseline**: Version 2.0.0 (Master Upgrade Complete)  
**All Tests Verified**: `test_master_suite.js` (47/47 passing) + `test_upgrade_master.js` (100% passing)  

---

## 1. Verified Operational Invariants
- **4 Canonical Hubs**: Home, Event, Live Market, Stage & Results.
- **One Action Principle**: No duplicate launch/pause buttons across tabs.
- **Automatic Setup Lock**: Locks when valid; unlocks before start; permanently locked once live.
- **Auto News Plan**: Host selects companies; system generates balanced neutral plan targeting only selected stocks.
- **News Secrecy & 60s Reveal**: Masked by default; 60s countdown on explicit host reveal; zero leakage to traders.
- **Smoothstep Price Math**: $s(u) = 3u^2 - 2u^3$ continuous over elapsed milliseconds.
- **Safe Championship Reset**: Broadcasts mandatory logout notice to all trader terminals.

---

## 2. Potential Future Enhancements
- [ ] **Offline Multi-Hall Tournament Clustering**: Support multiple simultaneous simulation rooms on a single campus server port if hosting multi-section competitions.
- [ ] **Advanced Print/Export Templates**: Additional PDF export presets for university coordinator scorecards.
