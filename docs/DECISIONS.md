# ARCHITECTURAL DECISION RECORDS (ADR) — THE TRADING FLOOR CHAMPIONSHIP 2026

This document chronicles the fundamental architectural and product design choices made during the development of The Trading Floor Championship.

---

## ADR-01: Pure Node.js & Native WebSockets vs. Heavy Frameworks (Next.js / React)
- **Context**: The software must run reliably on an offline LAN server, frequently hosted on modest laptops with limited resources.
- **Decision**: Build using pure Node.js, Express, and native WebSockets (`ws`), paired with a vanilla HTML5/CSS/JS frontend.
- **Rationale**: Eliminates long build times, heavy node_modules (100MB+ vs 5MB), transpilation bugs, and memory overhead. Provides cold startup in under 1 second and sub-5ms tick propagation.

---

## ADR-02: Zero External CDN Policy
- **Context**: College auditoriums, exam halls, and festival venues frequently experience cellular network congestion or have zero internet access.
- **Decision**: Ban all remote script tags, Google Fonts, and external CDN stylesheets.
- **Rationale**: Guarantees that the software runs flawlessly when disconnected from the WAN. Styling relies on bundled system fonts and custom CSS tokens.

---

## ADR-03: Web Audio API Synthesizer vs. MP3 Audio Files
- **Context**: Playing audio cues (bells, alarms, sirens) often fails when external media files are missing, blocked by browser CORS, or corrupted during file transfers.
- **Decision**: Synthesize all institutional sound cues programmatically using the browser's native `AudioContext` and oscillator nodes.
- **Rationale**: 100% self-contained code. Zero external MP3 downloads required. Instant playback with zero latency.

---

## ADR-04: File-Based JSON Persistence vs. SQLite / PostgreSQL
- **Context**: Non-technical faculty coordinators must be able to download, copy, and run the simulator without configuring database engines, ODBC drivers, or migration scripts.
- **Decision**: Store active configurations and scenarios in cleanly structured JSON files (`data/universe_active.json`, `logs/AUDIT_LOG_*.json`).
- **Rationale**: Instant portability across USB drives and operating systems. Human-readable and editable in any text editor. Zero database engine installation overhead.

---

## ADR-05: Warm Ivory Luxury Design Direction vs. Dark Neon
- **Context**: Most financial trading apps adopt generic dark neon crypto palettes that cause eye strain in bright collegiate auditoriums and look unprofessional on projectors.
- **Decision**: Establish an authoritative Warm Ivory (`#FBF9F5`), British forest green (`#1A3026`), and champagne gold (`#8E6D3B`) aesthetic.
- **Rationale**: Superior legibility under stage lighting, high contrast for price deltas, and an institutional wealth-management ambiance.
