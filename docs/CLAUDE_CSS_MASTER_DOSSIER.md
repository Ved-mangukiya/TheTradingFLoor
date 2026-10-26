# THE TRADING FLOOR CHAMPIONSHIP 2026 — MASTER CSS & UI/UX DOSSIER FOR CLAUDE
## Ultra-Smooth, Institutional Luxury Design System, Motion Choreography & Responsive Blueprint

> **PURPOSE FOR CLAUDE (3.5 / 3.7 SONNET)**:  
> You are the Principal UI/UX Architect and Motion Designer for **The Trading Floor Championship 2026** — an elite, offline-first institutional stock exchange simulator used in university business school championships.  
> Your task is to craft the complete, world-class CSS styling for this application.  
> **Aesthetic Standard**: Think Bloomberg Terminal meets Apple-grade luxury. Deep slate navy surfaces (`#0F172A`, `#1E293B`), champagne podium gold (`#D4AF37`), warm ivory cards, emerald profits, crimson circuits, buttery-smooth cubic-bezier transitions, tactile button feedback, and responsive adaptations for mobile phones up to classroom 4:3 auditorium projectors.

---

## 1. Zero-CDN Offline System Design Tokens (`:root`)

```css
:root {
  /* Core Luxury Palette */
  --bg-app: #0F172A;                  /* Midnight Obsidian Slate */
  --bg-surface: #1E293B;              /* Elevated Card Slate */
  --bg-surface-elevated: #273549;     /* Modal / Hover Surface */
  --bg-ivory: #F8F5EF;                /* Daytime Ivory Paper */
  --card-white: #FFFFFF;              /* Crisp Pure White */
  --surface-cream: #FFFDF9;           /* Warm Sand Tone */

  /* Text & Contrast Hierarchy */
  --text-primary: #FAF9F6;            /* High Contrast Off-White */
  --text-secondary: #CBD5E1;          /* Cool Slate Silver */
  --text-muted: #94A3B8;              /* Subtle Gray */
  --text-charcoal: #1E293B;           /* Dark Card Text */
  --text-forest: #14532D;             /* Deep Emerald Header */

  /* Institutional Accents & Borders */
  --champagne-accent: #D4AF37;        /* Pure Metallic Gold */
  --champagne-glow: rgba(212, 175, 55, 0.35);
  --champagne-light: #FDF8ED;
  --podium-gold: #D4AF37;
  --podium-silver: #94A3B8;
  --podium-bronze: #CD7F32;
  --subtle-border: rgba(255, 255, 255, 0.08);
  --card-border: rgba(226, 232, 240, 0.15);
  --card-border-light: #E2DBD0;

  /* Real-Time Financial Indicators */
  --price-up: #10B981;                /* Vivid Emerald Profit */
  --price-up-glow: rgba(16, 185, 129, 0.4);
  --price-up-bg: rgba(16, 185, 129, 0.12);
  --price-up-border: rgba(16, 185, 129, 0.3);

  --price-down: #EF4444;              /* High-Visibility Crimson */
  --price-down-glow: rgba(239, 68, 68, 0.4);
  --price-down-bg: rgba(239, 68, 68, 0.12);
  --price-down-border: rgba(239, 68, 68, 0.3);

  --circuit-halt: #F59E0B;             /* Electric Amber Halt */
  --circuit-halt-glow: rgba(245, 158, 11, 0.45);

  /* Typography Stacks (100% Offline-First) */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-mono: 'IBM Plex Mono', 'SF Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace;

  /* Radii & Elevations */
  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 9999px;

  --shadow-subtle: 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-card: 0 10px 30px -5px rgba(0, 0, 0, 0.3), 0 0 1px 1px rgba(255, 255, 255, 0.05);
  --shadow-elevated: 0 20px 50px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 175, 55, 0.2);
  --shadow-glow-gold: 0 0 25px rgba(212, 175, 55, 0.35);

  /* Motion & Easing Curves */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-deliberate: 400ms;
}
```

---

## 2. Universal Animation Library & Micro-Interactions

Every interaction must feel alive, weighted, and tactile:

1. **Button Press Feedback (`:active`)**:
   - `transform: translateY(1.5px) scale(0.985);`
   - Active state reduces shadow elevation and brightens border glow.
2. **Action Contract Lock Spinner (`.btn-action-locked` / `[data-action-locked="true"]`)**:
   - Disabled cursor, opacity `0.75`, and an embedded pseudo-element hardware-accelerated continuous spinner (`@keyframes spin { to { transform: rotate(360deg); } }`).
3. **Price Tick Flash Pulses**:
   - **Tick Up**: `@keyframes tickPulseUp` (Flashes background to `--price-up-bg` and text to `--price-up` for 600ms, gently decaying to normal).
   - **Tick Down**: `@keyframes tickPulseDown` (Flashes background to `--price-down-bg` and text to `--price-down` for 600ms).
4. **Circuit Breaker Emergency Strobe**:
   - `@keyframes circuitStrobe` (Pulsing neon-amber or crimson alert badge with expanding box-shadow ring).
5. **Modal Spring-Zoom Entry**:
   - `opacity: 0; transform: scale(0.94) translateY(12px);` to `opacity: 1; transform: scale(1) translateY(0);` over `280ms var(--ease-spring)`.
   - Backdrop filter blur: `backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`.
6. **Breaking News Toast & Progress Bar**:
   - Slide-in from top right with an animated horizontal countdown line (`@keyframes progressShrink { from { width: 100%; } to { width: 0%; } }`).
7. **Winner Ceremony Gold Fanfare & Rumble**:
   - `@keyframes winnerRumble` (Subtle 2px stadium screen vibration during reveal).
   - Confetti particles, golden sheen reflections across pedestals, and podium badge pop-ins.

---

## 3. Screen Inventory & Structural Selectors

### A. Global Shell & Navigation
- `.ttf-app`: Root container (`min-height: 100vh; background: var(--bg-app); font-family: var(--font-sans);`).
- `#ttfAppHeader`: Glassmorphic top navigation bar with institutional branding, clock, and connection status pill.
- `.nav-role-badge`: Pill indicating current role (`HOST`, `TRADER`, `PROJECTOR`, `SOUND`).
- `#ttfDemoBanner`: Top interactive demo bar (`✦ HOD PREVIEW • INTERACTIVE DEMO`) with role pills (`#demoPillHost`, `#demoPillTrader`, etc.).

### B. View 1: Login & Role Selection (`#viewLogin`)
- `.login-wrapper`: Centered flexbox or grid with geometric radial background accents.
- `.login-card`: Luxury card with gold border accents (`#setupEventTitlePreview`, role tabs, password input `#loginPassword`, and submit button `#btnLoginSubmit`).
- `#demoQuickAccessCard`: 1-click preview cards for faculty and students.

### C. View 2: Student Trading Desk (`#viewTrader`)
- `#traderHeroMetrics`: 4-card metric strip (Total Portfolio Net Worth, Available Cash, Daily P&L, Cumulative ROI %).
- `#traderSectorFilterBar`: Dynamic universe filter bar with search input `#traderStockSearch`, sector dropdown, sector filter chips (`#traderSectorChips`), sorter `#traderSortSelect`, and checkbox `#traderHoldingsOnly`.
- `#traderStockGrid`: Fluid grid (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px;`).
- `.stock-card`: Luxury paper trading card:
  - Header: Sector badge, Ticker, Company Name.
  - Price Hero: Large bold price (`.font-mono-price`), Day Open baseline, and real-time delta badge (`+2.45%`).
  - Active Holding Pill: Position badge (`+15 shares • +₹1,240 P&L`).
  - Interactive Canvas: Responsive sparkline chart with gradient fill.
  - Action Footer: Quick lot steppers (`-5`, `+5`) and primary trade button `.btn-trade` (`#btnOpenTrade_TICKER`).
- `#modalTradeOrder`: Order execution modal:
  - BUY / SELL segmented control tabs (`#tradeTabBuy`, `#tradeTabSell`).
  - Quantity stepper (`#tradeOrderQty`) and quick lot pills (`+1`, `+5`, `+10`, `+25`, `+100`).
  - Budget/Holding presets: Percentage pills (`25%`, `50%`, `75%`, `Max` / `All`).
  - Live affordability card: Estimated gross, 10 bps fee, and remaining cash after trade.
  - Primary button: `#btnExecuteTradeOrder`.
- `#traderPositionsDrawer`: Slide-up or expandable drawer with table of currently owned stocks, average buy price, current price, unrealized P&L, and 1-click "Liquidate All" button (`#btnConfirmLiquidate`).
- `#traderNewsWireSidebar`: Live breaking news wire with timestamps, headlines, and urgency badges.

### D. View 3: Host Control Centre (`#viewHost`)
- Master 4-Hub Tab Bar:
  - `Hub 1: 🏠 Home` (`#hostTabContentHome`): Live terminal monitor, readiness checklist, and audit stream.
  - `Hub 2: ⚙️ Event` (`#hostTabContentEvent`): 8-step guided wizard (`#setupNavBtnDetails` .. `#setupNavBtnReview`), setup inputs, and `#btnSubmitLockSetup`.
  - `Hub 3: 📈 Live Market` (`#hostTabContentMarket`):
    - Market Operations Bar (`#hostMarketOperationsBar`): `#btnMarketResume` (Resume 3-2-1), `#btnMarketPauseSoft`, `#btnMarketPauseBlackout`, `#btnMarketCloseSession` (Conclude Day), `#btnEmergencyStopTrigger`.
    - News Control Center: Schedule timeline, breaking news alert composer, and 60-second private impact reveal toggle.
    - Live trading log and market ticker stream.
  - `Hub 4: 🖥️ Stage & Results` (`#hostTabContentStage`): Auditorium Projector remote, Sound Console triggers, safe championship reset card (`#btnConfirmResetChampionship`), and export marksheets.

### E. View 4: Auditorium Stage Projector (`#viewProjector`)
- Giant high-contrast layout readable from 50 feet away in college auditoriums.
- Aspect ratio detection:
  - **16:9 / 16:10 Widescreen**: Auto-cycle rotating stock board.
  - **4:3 Aspect Ratio (`@media (min-aspect-ratio: 4/3)`)**: Tailored 8-card ($4 \times 2$) and 6-card ($3 \times 2$) grids with high-contrast text and zero horizontal overflow.
- `#projPersistentBoard`: Fixed 8-card slots (`#projCardSlot_0` through `#projCardSlot_7`) updated in-place without canvas destruction.
- Top Mover Spotlight Cards: Top Gainer & Top Loser persistently visible.
- Bottom Ticker Tape: Continuous smooth-crawling breaking news crawl.
- `#projDayCompletedBanner`: Prominent gold & emerald daily leaderboard snapshot card.

### F. View 5: Winner Podium Ceremony Stage (`#viewWinner`)
- Grand Finale ceremonial podium:
  - **1st Place Champion**: Towering Gold Pedestal (`#podiumPedestalGold`) with shimmering crown and gold rays.
  - **2nd Place Runner-Up**: Silver Pedestal (`#podiumPedestalSilver`).
  - **3rd Place Second Runner-Up**: Bronze Pedestal (`#podiumPedestalBronze`).
- Full-screen animated confetti canvas (`#podiumConfettiCanvas`).
- Stage sequence: Bronze Reveal $\to$ Silver Reveal $\to$ Champion Reveal $\to$ Full Podium $\to$ Complete Standings Table.

### G. View 6: Dedicated Sound Console (`#viewSound`)
- Minimalist dark audio deck for sound laptop connected to hall PA speakers.
- Autoplay unlock overlay (`#soundAutoplayUnlockCard`).
- Big tactile test pads for Opening Bell, Circuit Alarm, News Siren, and Victory Fanfare.

### H. Universal Overlays & Modals
- `#traderWaitingRoomOverlay`: Standby waiting room with pulsing glowing hourglass and event instructions.
- `#softPauseOverlay`: Frozen semi-transparent pause overlay ("⏸️ Market Paused by Host").
- `#blackoutOverlay`: Solid blackout overlay for covert tactical rounds.
- `#traderDayCompletedOverlay`: Concluded day modal with audited daily marksheets and carryover stats.
- `#developerInfoModal`: Luxury profile modal celebrating Ved Mangukiya as Lead Architect.
- `#keyboardShortcutsModal`: Interactive cheat-sheet modal triggered by <kbd>?</kbd>.

---

## 4. Comprehensive Responsive Breakpoints

1. **Classroom 4:3 Vintage Projectors (`@media (min-aspect-ratio: 4/3) and (max-aspect-ratio: 16/10)`)**:
   - Cards scale to compact 2-row grids.
   - Typography scales dynamically via `clamp()` to prevent cutoffs.
2. **Standard Desktop & 1080p / 4K (`@media (min-width: 1025px)`)**:
   - Fluid 3-column / 4-column card layouts, fixed sidebar, luxury glassmorphic spacing.
3. **Tablet & iPad (`@media (max-width: 1024px)`)**:
   - Sidebar collapses below main grid or into accessible slide drawer.
   - Header metrics wrap into a clean 2x2 grid.
4. **Mobile Phones (`@media (max-width: 640px)`)**:
   - Single-column trading cards with full-width touch targets ($\ge 44\text{px}$).
   - Sticky bottom action bar for Trade Modal and Holdings.
   - Modals expand to 100% viewport width with bottom-sheet drawer animations.
   - Font size `16px` on form inputs to permanently prevent iOS Safari auto-zoom.

---

## 5. Chunked Generation Protocol (How Claude Delivers the CSS)

To prevent token cutoffs and guarantee zero context overflow, Claude must output the CSS in **4 dedicated, fully formed modular stylesheets**:

- **Chunk 1**: `01_core_animations.css` — Variables, Resets, Design Tokens, Global Typography, Buttons, Badges, and Micro-Animation Keyframes.
- **Chunk 2**: `02_trader_mobile.css` — Student Trading Desk, Paper Trading Cards, Trade Modal, Holdings Drawer, News Wire, and Mobile Responsive Suite.
- **Chunk 3**: `03_host_control.css` — Host Control Centre (All 4 Hubs: Home, Event Wizard, Market Operations Bar, Stage & Analytics).
- **Chunk 4**: `04_projector_winner_overlays.css` — 4:3 & 16:9 Projector Board, Winner Podium Ceremony, Sound Console, and Universal Overlays.
