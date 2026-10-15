# DESIGN SYSTEM & UI TOKENS — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Visual Direction & Aesthetic Philosophy

**The Trading Floor Championship** adheres to a **Warm Ivory Luxury Financial Terminal** aesthetic. 
Unlike generic dark-neon crypto dashboards or plain gray administrative portals, this interface evokes the timeless prestige of an institutional wealth management firm, combining:
- Warm ivory and alabaster paper-textured backgrounds.
- Deep British forest green typography.
- Refined champagne gold and burnished bronze accents.
- Muted sage green panels.
- Vivid, high-contrast emerald and crimson market price badges.
- Tabular monospace numerals ensuring numbers never jitter or shift during fast live ticks.

---

## 2. Color Palette & CSS Variables

```css
:root {
  /* Surface & Background Canvas */
  --canvas-ivory:       #FBF9F5; /* Main tournament page canvas */
  --surface-cream:      #F4EFE6; /* Muted inner panels, sub-bars, table headers */
  --surface-card:       #FFFFFF; /* Elevated content cards and order modals */
  --subtle-border:      #E6DEC9; /* Clean institutional border lines */
  
  /* Primary & Editorial Typography */
  --text-forest:        #1A3026; /* Primary titles, table headers, hero brand */
  --text-charcoal:      #2A2826; /* Body copy, table cells, form labels */
  --text-muted:         #6E6A62; /* Micro-copy, timestamps, fundamentals */

  /* Luxury Accents */
  --champagne-accent:   #8E6D3B; /* Burnished gold borders, badges, wire deck */
  --champagne-light:    #F7F2E7; /* Light gold background tint */
  --sage-accent:        #3D5A45; /* Dark sage buttons and interactive elements */
  --sage-light:         #EAEFE9; /* Subtle sage badge backgrounds */

  /* Market Trading Indicators (High-Contrast) */
  --price-up:           #218653; /* Positive tick green (+%) */
  --price-up-bg:        #EAF6EE; /* Positive badge fill */
  --price-down:         #C64B4B; /* Negative tick red (-%) */
  --price-down-bg:      #FBEFEF; /* Negative badge fill */
  --warning-amber:      #C87A18; /* Paused state / pending halt warning */
  --warning-bg:         #FEF7EC; /* Paused badge fill */
  --error-red:          #B82828; /* Circuit breaker halt / order rejection */
  --error-bg:           #FDF0F0; /* Circuit breaker badge fill */
  --error-border:       #EAA8A8; /* Circuit breaker badge border */

  /* System Elevation & Geometry */
  --shadow-subtle:      0 2px 8px rgba(26, 48, 38, 0.04);
  --shadow-card:        0 4px 16px rgba(26, 48, 38, 0.08);
  --shadow-modal:       0 16px 48px rgba(26, 48, 38, 0.22);
  --radius-sm:          4px;
  --radius-md:          8px;
  --radius-lg:          12px;
}
```

---

## 3. Typography Hierarchy

To maintain 100% offline autonomy without external CDN font requests:

```css
/* Typography Stacks */
--font-serif:   'Playfair Display', 'Libre Baskerville', 'Georgia', serif;
--font-sans:    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
--font-mono:    'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
```

- **H1 / Event Headings**: `--font-serif`, font-weight 800, color `--text-forest`, letter-spacing `-0.02em`.
- **H2 / Card Section Titles**: `--font-serif`, font-weight 700, color `--text-forest`.
- **Body & Controls**: `--font-sans`, font-weight 400 to 600, color `--text-charcoal`.
- **Prices, Tickers, Quantities & Clocks**: `--font-mono`, tabular lining numerals (`font-variant-numeric: tabular-nums`).

---

## 4. Component Standards

### 4.1 Luxury Content Cards (`.luxury-card`)
- Clean white background (`#FFFFFF`) with subtle warm border (`var(--subtle-border)`).
- Elevation shadow (`var(--shadow-card)`).
- Subtle top hairline accent or burnished border.

### 4.2 Interactive Badges (`.badge`)
- Padding: `3px 8px`, border-radius `var(--radius-sm)`, text-transform `uppercase`, font-size `10px–11px`, font-weight 700.
- State variants:
  - `.badge-active`: Green fill, green border (`● ACTIVE`).
  - `.badge-paused`: Amber fill, amber border (`⏸ PAUSED`).
  - `.badge-halted`: Crimson fill, red border (`⛔ HALTED (UPPER/LOWER)`).
  - `.badge-champagne`: Burnished gold fill and text (`★ GRAND CHAMPION ★`).

### 4.3 Order Ticket Modals
- High contrast, distraction-free execution dialog.
- Large numerical price and cash display.
- One-click Max Buy and Max Sell calculation shortcuts.
- Real-time gross value, transaction fee, and remaining cash live simulation.
