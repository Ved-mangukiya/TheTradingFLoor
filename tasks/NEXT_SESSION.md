# NEXT SESSION HANDOVER & ACTION PLAN — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Handover Summary for Future Developers & AI Agents
The system is in a stable, verified, and complete state (v1.4.0). All requirements from both the Master Implementation Prompt and Master Upgrade Prompt have been engineered:
1. **20 Real Indian Listed Companies (NSE/BSE)**: Replaced fictional tickers with official companies (`RELIANCE`, `TATAMOTORS`, `TCS`, `INFY`, `HDFCBANK`, `SBIN`, `LT`, etc.) with lot presets, beta multipliers, and NSE EOD reference baselines.
2. **Neutral Journalistic Storylines & Impact Secrecy**: 12 multi-day storylines across Days 1, 2, and 3 with zero buy/sell recommendations in headlines. Private price impact matrices are strictly stripped from public broadcasts.
3. **Server Configuration Lock (`EVENT_CONFIG_LOCKED`)**: Tournament parameters, starting capital, and share universe are permanently frozen once the event is scheduled or live. Any mid-competition mutations are rejected with `EVENT_CONFIG_LOCKED`.
4. **Market Indices & Benchmarking**: 6 server-calculated indices (`NIFTY_TF20`, `BANK_TF`, `IT_TF`, `AUTO_TF`, `ENERGY_TF`, `METALS_TF`) using an equal-weighted price-relative formula.
5. **Team Sector Strategy & Macro Privacy**: Public projector displays macro sector percentages (Banking %, IT %, Auto %, Energy %, Cash %) with zero individual stock ticker/quantity exposure.
6. **Live Anchor Commentary Prompts**: Real-time talking points for the event host/anchor derived from concentration alerts, cash cushions, and rank surges.
7. **Intelligent Projector Cycle & Embedded Winner Reveal**:
   - Rotates between 5 distinct market scenes (`SCENE_MARKET_BOARD`, `SCENE_INDICES`, `SCENE_STRATEGY`, `SCENE_LEADERBOARD`, `SCENE_NEWS`).
   - Auditorium projector natively houses both the live market stage and the awards ceremony stage. When the Host clicks **Announce Winner**, the projector seamlessly transforms into the full-screen cinematic winner reveal sequence without needing a separate URL.
8. **Multi-Day Championship Lifecycle & Day Finalization**: Continuous overnight portfolio tracking across competition days, daily P&L calculation, cumulative return %, rank movement deltas (`▲ +2`, `▼ -1`, `• 0`), and daily snapshot persistence.
9. **Authoritative 3-Second Resume Countdown & Hall Sound Console**: Fixed countdown drift/skip with server-owned deadlines and dedicated hall audio laptop support (`/?role=sound`).
10. **Automated Verification**: All 47 automated tests pass with 100% success (`node test_master_suite.js`).

---

## 2. Priority Next Actions (Next Tasks)

1. **Task 1: Automated Verification**:
   Run `npm test` (`node test_master_suite.js`). Ensure all 47 test stages pass with 0 errors.
2. **Task 2: Production Rehearsal on Campus LAN**:
   Conduct an end-to-end dry run across 4 physical devices over the college Wi-Fi/LAN router:
   - Host Master Control Laptop (`http://<LAN_IP>:3000/?role=host&pass=host2026`)
   - Stage Auditorium Projector (`http://<LAN_IP>:3000/?role=projector&pass=screen2026`)
   - Venue PA Speaker Laptop (`http://<LAN_IP>:3000/?role=sound&pass=sound2026`)
   - Student Trading Desks (`http://<LAN_IP>:3000/?team=team1&pass=trade100` ... `team16`)
3. **Task 3: Git Synchronization**:
   Keep all changes committed and pushed to `https://github.com/Ved-mangukiya/TheTradingFLoor.git`.

---

## 3. Strict Development Invariants
- **NO ZIP FILES**: Never create, package, or generate `.zip` archives. The Git repository is the sole distribution mechanism.
- **Offline-First Zero-CDN**: All charting (`TFCharts`), fonts, styles, audio cues (`AudioContext`), and icons must operate locally with zero internet access.
- **Authoritative Server Math**: The client never calculates prices, balances, circuit halts, or fees independently. All accounting is server-authoritative.
- **Embedded Projector Winner Screen**: The winner reveal stage is natively embedded inside the projector screen; never force the projector to navigate to a separate URL during the live show.
