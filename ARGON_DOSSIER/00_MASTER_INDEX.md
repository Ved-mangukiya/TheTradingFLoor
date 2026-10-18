# THE TRADING FLOOR CHAMPIONSHIP 2026 — MASTER DOSSIER FOR ARGON 4
## System Architecture, Codebase Audit & Portable Redesign Blueprint

> **DOCUMENT ID**: `ARGON_DOSSIER/00_MASTER_INDEX.md`  
> **APPLICATION VERSION**: `2.6.1`  
> **AUDIT TARGET**: The Trading Floor Championship (Intra-College Real-Time Stock Market Simulation)  
> **AUTHOR / LEAD DEVELOPER**: Ved Maheshbhai Mangukiya (Surat, Gujarat, India)  
> **TARGET AUDIENCE FOR THIS DOSSIER**: Argon 4 (External AI Reviewer & System Architect)  
> **STATUS**: COMPLETED & VERIFIED (36/36 Unified Single-Flow Master Assertions Passing, 100% Core Verification)

---

## 1. Executive Summary & Project Purpose

**The Trading Floor Championship 2026** is an institutional-grade, real-time stock market competition application designed for collegiate business school tournaments, finance clubs, and university festivals.

### Core Simulation Premise
- **Target Participants**: Undergraduate and graduate business students (BBA, B.Com, MBA, Finance).
- **Environment**: High-energy computer lab or campus auditorium running entirely over a **local campus LAN network**.
- **Hardware Profile**: 
  - Host master laptop (Professor, Event Coordinator, or Student Head).
  - 10 to 30 Trader team workstations / student laptops.
  - Main auditorium stage projector (1080p, 720p, or vintage 4:3 1024×768 / 800×600 campus projectors).
  - Dedicated sound system console laptop connected to hall PA speakers.
- **Zero-Internet / Offline-First Invariant**: Campus LANs frequently suffer from firewall blocks, captive portals, or complete WAN outages. The system is engineered to run with **zero external CDN dependencies** (no external Google Fonts, no CDN stylesheets, no external audio files, no remote npm CDNs). All audio is synthesized locally via the HTML5 Web Audio API; all icons are inline SVGs; all charts are rendered via an in-house Canvas 2D Bezier engine.

---

## 2. High-Level Architecture Overview

The application is structured as a tightly coupled, lightweight client-server system:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS SERVER (server.js)                      │
│                                                                        │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ State Machine Engine  │  │ Price Simulation │  │ Order Accounting │  │
│  │ (SETUP -> LIVE -> ...)│  │ (GBM + Shocks)   │  │ (Gross, Fee, Net)│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Circuit Breaker (±20%)│  │ News Scheduler  │  │ Audit & Snapshot │  │
│  │ (Upper/Lower Clamps)  │  │ (Ratios & Window│  │ (JSON/CSV Export)│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│                                    ▲                                   │
│                        Express REST│ & WebSocket (ws)                  │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   HOST WORKSTATION   │  │   TRADER TERMINALS   │  │   STAGE PROJECTOR    │
│   (Role: HOST)       │  │   (Role: TRADER)     │  │   (Role: PROJECTOR)  │
│                      │  │                      │  │                      │
│ • Setup Wizard (1-8) │  │ • Waiting Room       │  │ • 8-Card Auto-Cycle  │
│ • Live Operations Bar│  │ • Stock Grid & Chart │  │ • Spotlight Gain/Loss│
│ • News Control Center│  │ • Buy / Sell Order   │  │ • Breaking News Crawl│
│ • Results & Reset    │  │ • Holdings Drawer    │  │ • Winner Presentation│
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

1. **Backend (`server.js`)**: Single-file Node.js server (~4,770 lines) utilizing `express` for static file serving & REST endpoints, and `ws` for duplex WebSocket message routing. Holds **100% authoritative state**; clients never dictate prices, fills, fees, or valuations.
2. **Frontend (`public/index.html`, `public/app.js`, `public/style.css`)**: Single-page application (~11,430 lines of JS, ~5,000 lines of HTML, ~3,500 lines of CSS). Manages role-based views (`#loginView`, `#hostView`, `#traderView`, `#projectorView`, `#soundConsoleView`, `#winnerPresentationView`).
3. **Data Layer (`data/`)**: Flat-file JSON persistence:
   - `data/universe_active.json`: Current 20-company stock universe baseline.
   - `data/scenario_live.json` / `scenario_test.json`: Full tournament scenarios (macro metadata, baseline shares, multi-day news plan).
   - `data/live_game_state.json`: Crash-recovery state auto-saved every 4 seconds.
   - `data/checkpoints/*.json`: Named and automatic 120-second snapshot checkpoints.
   - `logs/*.json`: Full chronological audit logs.

---

## 3. Dossier Reading Order & Document Map

Argon 4 must review these dossier documents in the following sequence:

```
00_MASTER_INDEX.md  ─────────► Start here for map, scope, and coverage limitations
       │
       ▼
01_ARCHITECTURE.md ─────────► Core technology, directory layout, protocols, entities
       │
       ▼
02_SCREEN_AND_BUTTON_INVENTORY.md ──► Complete UI screens, modals, and button-by-button table
       │
       ▼
03_EVENT_LIFECYCLE.md ──────► Chronological tournament state machine and transitions
       │
       ▼
04_MATHEMATICAL_ENGINE.md ──► Price models, returns, beta, fees, P&L, and tie-breakers
       │
       ▼
05_TIMING_AND_NEWS.md ──────► Dynamic time ratios, reading windows, news publication
       │
       ▼
06_SECURITY_AND_DATA_FLOW.md ► Authentication, token registry, parameter sanitization
       │
       ▼
07_DEFECT_REGISTER.md ──────► Discovered defects, design weaknesses, and subtle risks
       │
       ▼
08_TESTS_AND_DEPENDENCIES.md ► Unified single-flow test suite, commands, dependencies
       │
       ▼
09_REDESIGN_CONSTRAINTS.md ──► Non-negotiable invariants and boundaries for redesign
```

### Document Summary Guide
| File | Focus Area | Key Contents for Argon 4 |
|---|---|---|
| **`01_ARCHITECTURE.md`** | System Architecture | Dependency versions, entry points, REST endpoints, WebSocket schema, authoritative state locations. |
| **`02_SCREEN_AND_BUTTON_INVENTORY.md`** | UI & Interactions | Every screen, modal, and button with exact DOM IDs, click handlers, WebSocket actions, and downstream effects. |
| **`03_EVENT_LIFECYCLE.md`** | State Machine | 10 tournament lifecycle states, transition matrix, countdowns, conclusion gating, and reset mechanics. |
| **`04_MATHEMATICAL_ENGINE.md`** | Financial Math | Geometric Brownian motion, smoothstep trajectories, 10 bps fee accounting, daily vs cumulative P&L. |
| **`05_TIMING_AND_NEWS.md`** | Clocks & News | Dynamic schedule scaling ($t_i = D \times p_i$), reading windows ($W(D)$), one-time publication idempotency, 12-hour AM/PM format. |
| **`06_SECURITY_AND_DATA_FLOW.md`** | Security & Privacy | Token authorization, role gating, sanitization of $\beta$ and $\sigma$, 60s news impact reveal model. |
| **`07_DEFECT_REGISTER.md`** | Audit Findings | Confirmed bugs, design weaknesses, subtle race conditions, and architectural debt. |
| **`08_TESTS_AND_DEPENDENCIES.md`** | QA Infrastructure | `test_unified_master_flow.js` (11 phases, 36 assertions), legacy suites, portable Node launcher. |
| **`09_REDESIGN_CONSTRAINTS.md`** | Guardrails | Non-negotiable competition invariants and guidelines for modernizing into a modular architecture. |

---

## 4. Codebase Inspection & Coverage Map

Every file in the repository was examined directly from disk:

| Directory / File | Size (Bytes) | Lines | Inspection Level | Notes & Role |
|---|---|---|---|---|
| `server.js` | 183,016 | 4,773 | **100% Exhaustive** | Authoritative backend, WebSocket router, price engine, accounting. |
| `public/app.js` | 516,562 | 11,435 | **100% Exhaustive** | Frontend controller, DOM event listeners, canvas charts, sound synth. |
| `public/index.html` | 349,267 | 4,942 | **100% Exhaustive** | Complete DOM tree: 656 IDs, 6 primary views, 22 modals/overlays. |
| `public/style.css` | 87,796 | 3,510 | **High (Structural)** | Design tokens, responsive grids (16:9, 4:3, mobile), animations. |
| `data/universe_active.json` | 13,185 | 522 | **100% Exhaustive** | Active 20-company baseline universe (NSE/BSE Indian companies). |
| `data/scenario_live.json` | 28,798 | 850 | **100% Exhaustive** | Default 3-day scenario with news plan, sector weights, macro rules. |
| `data/scenario_test.json` | 5,564 | 180 | **100% Exhaustive** | Fast 2-day test scenario for automated verification suites. |
| `test_unified_master_flow.js` | 43,638 | 884 | **100% Exhaustive** | Canonical 11-phase state-machine test runner on isolated port 3099. |
| `package.json` | 1,260 | 27 | **100% Exhaustive** | Version `2.6.1`, npm scripts (`test`, `test:unified`, `test:legacy`). |
| `README.md` | 27,108 | 740 | **High (Contextual)** | Host operations guide, physical room setup, rules summary. |
| `AGENTS.md` | 6,827 | 185 | **High (Contextual)** | Development invariants, offline zero-CDN rules, common pitfalls. |
| `docs/*.md` (28 files) | ~110,000 | ~3,200 | **High (Reference)** | Feature-specific architecture notes, business rules, design system. |
| `tasks/*.md` (2 files) | ~37,000 | ~350 | **100% Exhaustive** | Verified status log and active operational invariants. |

### Known Limitations of the Inspection
- **Hardware Variation**: Testing was performed on Windows 11 with Node.js v20.11.0. Behavior on ultra-low-end campus hardware (e.g., dual-core Celeron with 4GB RAM) was modeled via CPU throttling rather than physical legacy hardware.
- **WebSocket Socket Concurrency**: Automated tests run up to 10 concurrent WebSocket connections. A 30-team competition with 30 trader laptops, 2 projectors, and 1 host laptop (~33 concurrent connections) was validated through connection loops, but not in a 1,000-socket stress test.

---

## 5. Essential Source Files for Argon 4

If Argon 4 cannot receive the full repository at once, the user should provide these **four essential files** in priority order:

1. **`server.js`** (Core backend, REST handlers, WebSocket actions, financial math, state machine).
2. **`public/app.js`** (Client SPA controller, WebSocket listeners, UI view rotators, trade handlers).
3. **`public/index.html`** (DOM structure, view containers, modals, form inputs, button IDs).
4. **`test_unified_master_flow.js`** (Authoritative behavioral contract and verification test suite).

---

## 6. How Argon 4 Should Use This Dossier

1. **Do not guess variable names or message formats**: Consult `01_ARCHITECTURE.md` and `06_SECURITY_AND_DATA_FLOW.md` for exact WebSocket actions and state fields.
2. **Do not infer UI behavior without checking handlers**: Cross-reference any button in `02_SCREEN_AND_BUTTON_INVENTORY.md` to see its exact listener in `public/app.js` and downstream operation in `server.js`.
3. **Do not alter mathematical equations**: The formulas in `04_MATHEMATICAL_ENGINE.md` are locked educational competition standards.
4. **Review `07_DEFECT_REGISTER.md` before planning the redesign**: It documents all known race conditions, DOM coupling issues, and structural debt that should be cleaned up during modernization.

Proceed to **`ARGON_DOSSIER/01_ARCHITECTURE.md`**.
