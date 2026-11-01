# BRAND_GUIDELINES.md — THE TRADING FLOOR BRAND IDENTITY & DESIGN SYSTEM

> **AUTHORITATIVE DESIGN SPECIFICATION**: This document establishes the official brand identity, visual design tokens, physical card-stock architecture, interaction patterns, and timeless product standards for **The Trading Floor**. All screens, modals, and future extensions MUST adhere strictly to these principles.

---

## 1. BRAND ESSENCE & PERSONALITY

- **Product Name**: The Trading Floor
- **Tagline**: Institutional Market Simulation & Championship Arena
- **Brand Personality**: Timeless, aristocratic, mathematically rigorous, ultra-clean, and prestigious.
- **Visual Reference Origin**: Inherited directly from the physical card-stock architecture in `card.html` (v4 Projector-Grade Suite).
- **Core Aesthetic**: Warm ivory paper textures, British racing green & slate navy editorial inks, polished bronze and gold metallic foil accents, letterpress financial ledgers, and WCAG AAA auditorium-grade contrast.

---

## 2. COLOR PALETTE & SEMANTIC DESIGN TOKENS

The color palette is calibrated for high luminance in both brightly lit college trading halls and auditorium projectors. It uses a **Dual Gold System**: Dark Bronze (`#78530D`) for crystal-clear readability on light ivory paper, and Metallic Gold Foil (`#B88728`) for metallic crests, stamps, and ribbons.

### 2.1 Surfaces & Backgrounds
| Token | Hex / Value | Description & Purpose |
|---|---|---|
| `--bg-ivory` | `#F8F5EF` | Core application background surface |
| `--body-gradient` | `radial-gradient(...)` | Elegant atmospheric radial glow for desktop views |
| `--surface-cream` | `#FFFDF9` | Top-layer card stock paper surface (pure luxury ivory) |
| `--card-white` | `#FFFFFF` | Form input backgrounds and pure white panels |
| `--paper-2` | `#EFE5CE` | Secondary textured ledger paper |
| `--subtle-border` | `#E5DDD1` | Subtle divider lines and card borders |
| `--card-border` | `#DFD7CA` | Stronger card definition borders |

### 2.2 Typography Inks (WCAG AAA Compliant)
| Token | Hex / Value | Contrast Ratio | Role & Application |
|---|---|---|---|
| `--text-forest` | `#14352B` | 13.8:1 on ivory | Editorial serif titles, grand headlines, primary branding |
| `--text-charcoal` / `--ink` | `#0A121E` | 18.2:1 on ivory | Primary UI body text, numbers, metrics, labels |
| `--text-muted` / `--ink-2` | `#253244` | 11.4:1 on ivory | Secondary subtitles, table headers, captions, metadata |
| `--text-light` / `--ink-3` | `#435166` | 7.6:1 on ivory | Muted timestamps, hint text, fine security prints |
| `--gold-ink` | `#78530D` | 6.4:1 on ivory | Dark bronze typography for highlighted status text |

### 2.3 Gold & Champagne Accent System
| Token | Hex / Value | Role & Application |
|---|---|---|
| `--gold` | `#B88728` | Primary metallic foil gold for borders and crests |
| `--gold-hi` | `#F5E3A6` | High-luminance gold specular highlight |
| `--gold-lo` | `#684A10` | Deep shadow tone for metallic seals |
| `--champagne-accent` | `#B49A70` | Warm champagne accent for badges and borders |
| `--champagne-light` | `#F7F3EB` | Soft champagne pill background fill |

### 2.4 Financial Semantic Colors
| State | Text & Indicator | Background Fill | Border |
|---|---|---|---|
| **Profit / Up / Active** | `--price-up`: `#0F683C` | `--price-up-bg`: `#DCFCE7` | `rgba(15, 104, 60, 0.38)` |
| **Loss / Down / Alert** | `--price-down`: `#B42318` | `--price-down-bg`: `#FEE2E2` | `rgba(180, 35, 24, 0.35)` |
| **Warning / Imminent** | `--amber`: `#9A4A06` | `--amber-bg`: `#FEF3C7` | `rgba(154, 74, 6, 0.40)` |

---

## 3. TYPOGRAPHY SYSTEM

Typography relies on offline-safe font stacks to guarantee zero remote CDN dependencies.

```css
--font-serif: 'Newsreader', 'Playfair Display', 'Libre Baskerville', Georgia, serif;
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'IBM Plex Mono', Consolas, monospace;
```

### 3.1 Type Hierarchy
1. **Product Wordmark**: Serif, 22–32px, Bold 800, letter-spacing `-0.02em`, color `--text-forest`.
2. **Page & Section Titles**: Serif, 20–28px, Bold 700–800, line-height `1.25`, color `--text-forest`.
3. **Card Headings**: Serif or Semi-bold Sans, 16–22px, Bold 700, color `--ink`.
4. **Body Text**: Sans-serif, 13–15px, Regular 400 or Medium 500, line-height `1.55`, color `--ink-2`.
5. **Ledger & Financial Values**: Monospace, 13–28px, Bold 700–900, tabular figures, color `--ink`.
6. **Badges & Meta**: Sans-serif / Monospace, 9–11px, Bold 800, uppercase, letter-spacing `0.06em`.

---

## 4. THE PHYSICAL CARD-STOCK SYSTEM

All primary interface containers follow the physical card architecture established in `card.html`:

1. **Card Base (`.luxury-card-stock`)**:
   - Background: Pure ivory paper (`#FFFDF9`) with subtle warm edge borders.
   - Border radius: `20px` (or `16px` for compact widgets).
   - Border: `1.5px solid rgba(48, 34, 10, 0.22)`.
   - Shadow: Layered ambient depth `0 20px 48px -10px rgba(10, 18, 30, 0.18)`.
2. **Metallic Crest (`.crest-gold`)**:
   - `42px` × `42px` rounded gold medallion with dark navy core and high-contrast `TF` monogram.
3. **Gold Foil Badge (`.badge-gold-foil`)**:
   - Scalloped 64-point metallic seal with crisp uppercase serif typography.
4. **Official Security Ribbon (`.official-security-ribbon`)**:
   - Anchored at card bottom: displays cryptographic fair-play indicators (`✦ Official Event Cryptographic Ledger ✦`) preventing intelligence leaks.
5. **Hero Action Box (`.hero-action-box`)**:
   - Dotted letterpress frame containing major state announcements (`STANDBY`, `PAUSED`, `CONCLUDED`).

---

## 5. BUTTON & ACTION CONTRACT SYSTEM

Every button that triggers an authoritative state transition or API action MUST follow the **Universal Action Contract**:

```javascript
applyActionContractLock(buttonElement, 'Processing...');
// ... dispatch WebSocket frame ...
// Upon ACK or ACTION_REJECTED: releaseActionLockById(...) or releaseAllActionLocks()
```

- **5,000ms Safety Timeout**: If the network drops, the button automatically unlocks and restores its original label.
- **Zero Double-Click**: Rapid duplicate clicks in-flight are instantly discarded.
- **Button Variants**:
  - `.btn-sage`: British racing green primary action button.
  - `.btn-champagne`: Warm gold highlight action button.
  - `.btn-outline`: Subtle bordered ivory button for non-destructive actions.
  - `.btn-danger`: Crimson alert button for emergency stop and reset.

---

## 6. MODAL & OVERLAY LIFECYCLE RULES

To permanently prevent stuck overlays and invisible blocking layers:
1. **Body Scroll Lock Coordination**:
   - Adding `body.modal-open` locks page scroll while a modal is active.
   - Closing ANY modal MUST invoke `document.body.classList.remove('modal-open')` immediately.
2. **Backdrop & ESC Key Dismissal**:
   - All modals MUST dismiss when clicking the backdrop: `onclick="if (event.target === this) dismissModal();"`.
   - Pressing the `Escape` key MUST close active modals cleanly.
3. **State Guard**:
   - User dismissals must set explicit flags (e.g. `podiumDismissedByUser = true`) so subsequent background ticks do NOT forcibly re-open the dialog.

---

## 7. MOTION, HOVER & PROJECTOR AUTO-HOVER

- **Trader & Host Desks**:
  - Hover tilt is bounded strictly to the card’s bounding box plus a **45px outer buffer**.
  - Small, organic, smooth tilt (`max ±2.2°`, gentle depth) using `perspective(1200px)` ("just feel").
  - When the cursor exits the 45px buffer, the card smoothly glides back to rest (`targetRx = 0, targetRy = 0`).
- **Auditorium Projector View**:
  - Operates autonomously with continuous ambient orbital floating (`Math.sin` / `Math.cos`).
  - **Zero Cursor**: Projector screens enforce `cursor: none !important;` so mouse cursors are never visible during live presentations.

---

## 8. NEWS MANAGEMENT & INTERACTIVE DISPATCHES

1. **Confidentiality Guard**:
   - Quantitative percentage impacts (`impacts: { RELIANCE: 12% }`) are broadcast **ONLY to the Host**.
   - Traders and Projectors receive neutral journalistic narratives and simple explanations without private numbers.
2. **Interactive Dispatch Reader (`#fullNewsModal`)**:
   - Clicking any sidebar item opens the full story in a luxury financial wire reader modal.
   - Displays headline, time, simple explanation, and affected sector tags in plain English.
3. **Duplicate Shock Prevention**:
   - Server enforces idempotent firing per event ID and per day (`firedNewsEventsPerDay`). Duplicate trigger requests are safely rejected.

---

## 9. TIMELESSNESS RULES (THE ZERO-HARDCODING POLICY)

1. **Permanent Product Brand**:
   - Always refer to the platform canonically as **The Trading Floor**.
   - NEVER hardcode a specific year (e.g. "Championship 2026") into static logos, headings, or core templates.
2. **Dynamic Event Titles**:
   - The active event title is dynamic: `gameState.title || 'The Trading Floor Championship'`.
   - Host event configuration in Step 1 allows hosts to name their tournament for 2026, 2027, 2030, etc.
3. **Dynamic Dates & Timers**:
   - Daily clocks and schedules calculate dynamically from `gameState.scheduledStartTime` and `gameState.elapsedSeconds`.
4. **Dynamic Copyright**:
   - All footers use `<span class="current-year"></span>` initialized via `new Date().getFullYear()`.

---

## 10. PRODUCT VOICE & COPYWRITING STANDARDS

- **Plain English**: Use easy, conversational language that beginner business students and professors understand instantly.
- **Consistent Terminology**:
  - Use `Start Trading` (not "Begin Session" or "Go Live").
  - Use `Pause Market` (not "Halt Trading Floor").
  - Use `Conclude Day` (not "Finish Round").
  - Use `Conclude Championship` (not "End Tournament").
- **Clear State Messaging**:
  - Waiting Room: *"Tournament Waiting Room • Desk Connected & Armed"*
  - Soft Pause: *"Trading Session Paused by Host • Order Book Frozen"*
  - Day Concluded: *"Day Completed • Audited Daily Settlement Snapshot"*
  - Championship Concluded: *"Championship Concluded • Audited Standings Finalized"*

