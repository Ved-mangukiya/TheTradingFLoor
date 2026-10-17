# Bugfix Requirements Document

## Introduction

The Trading Floor Championship v2.5.0 application has critical responsive design, runtime reliability, and user experience issues that prevent optimal operation in real-world Indian college environments. These bugs affect the primary deployment scenarios: mobile/tablet traders, 4:3 aspect ratio classroom projectors (1024×768, 800×600), and multi-screen synchronization reliability.

**Impact Scope:**
- **Critical**: Projector display breaks on standard 4:3 Indian classroom projectors, rendering the application unusable during live events
- **High**: Mobile traders (phones/tablets) experience broken layouts, preventing effective participation
- **Medium**: Runtime bugs cause potential order collisions and state synchronization failures
- **Medium**: UX friction reduces operational efficiency during time-critical trading sessions

**Affected Components:**
- Frontend: `public/style.css` (responsive design), `public/index.html` (viewport), `public/app.js` (client logic)
- Backend: `server.js` (order ID generation, WebSocket handling, error messaging)
- All user roles: Host, Trader, Projector, Sound Console, Winner Display

---

## Bug Analysis

### Current Behavior (Defect)

#### 1. Responsive Design Issues

**1.1 WHEN the projector screen is accessed on a 4:3 aspect ratio display (1024×768 or 800×600) THEN the system displays content outside the viewport with horizontal scrolling required, cutting off critical market data and leaderboards**

**1.2 WHEN a trader accesses the application on a mobile phone (viewport width 320px-480px) THEN the system displays overlapping UI elements, broken card layouts, and inaccessible buttons due to insufficient touch target sizes (<44px)**

**1.3 WHEN a trader uses a tablet in portrait mode (768px width) THEN the system displays a compressed layout with truncated stock tickers, unreadable price values, and non-functional order entry modals**

**1.4 WHEN multiple UI components (header, metrics bar, stock cards) are rendered on small screens THEN the system fails to apply adaptive typography, causing text overflow and illegible labels**

**1.5 WHEN the order entry modal is opened on mobile devices THEN the system displays a modal that exceeds viewport height without proper scrolling, preventing submission button access**

**1.6 WHEN touch interactions are used on mobile/tablet devices THEN the system provides insufficient touch target sizes for buttons, dropdowns, and input fields (many < 44×44px minimum iOS/Android guideline)**

#### 2. Projector 4:3 Aspect Ratio Optimization

**2.1 WHEN the projector displays the market board on 1024×768 resolution THEN the system uses widescreen-optimized grid layouts that create horizontal overflow and hide rightmost stock cards**

**2.2 WHEN the projector cycles through scenes (market board, leaderboard, indices) on 800×600 resolution THEN the system fails to scale content appropriately, causing clipped headlines and truncated team names**

**2.3 WHEN the breaking news banner appears on projector screens THEN the system displays banner content that extends beyond safe viewing area on 4:3 displays**

**2.4 WHEN the winner presentation stage is shown on projector THEN the system uses podium layouts optimized for 16:9, causing awkward spacing and misaligned elements on 4:3 screens**

#### 3. Runtime Bugs & Reliability

**2.5 WHEN two or more traders from the same team submit orders within milliseconds of each other THEN the system generates trade IDs using `TRD_${tradeSeqCounter}` format which increments sequentially, but lacks collision prevention if WebSocket messages arrive simultaneously**

**2.6 WHEN rapid consecutive orders are submitted within the 200ms debounce window THEN the system correctly blocks the orders but provides a generic error message that doesn't explain the rate limit**

**2.7 WHEN WebSocket connection is lost and reconnected during active trading THEN the system may not properly synchronize client state, causing stale price data or missing holdings updates**

**2.8 WHEN invalid order parameters are submitted (e.g., negative quantity, non-existent ticker) THEN the system returns cryptic WebSocket error messages instead of user-friendly explanations**

**2.9 WHEN circuit breaker triggers on a halted stock THEN the system displays technical halt messages ("UPPER_HALT", "LOWER_HALT") instead of plain-language explanations for non-technical student traders**

#### 4. UX/Flow Issues

**2.10 WHEN a host navigates the setup wizard to initialize a competition THEN the system provides unclear progression indicators and ambiguous "Next" button labels**

**2.11 WHEN a trader attempts to place an order THEN the system requires multiple clicks through order entry modal (select stock → enter quantity → review → confirm) with no quick-entry shortcut for experienced traders**

**2.12 WHEN market is paused or circuit breaker activates THEN the system displays pause/halt badges but does not provide prominent, centralized status indicators**

**2.13 WHEN no stocks are loaded or no teams are registered THEN the system shows empty grids without helpful empty-state messaging or actionable guidance**

**2.14 WHEN data is loading from server (initial connection, day transition) THEN the system displays inconsistent loading states (some screens show spinners, others show stale data, some show nothing)**

#### 5. Touch-Friendliness & Mobile Interactions

**2.15 WHEN mobile traders interact with dropdown selects (stock picker, quantity selector) THEN the system uses native HTML select elements that are difficult to tap accurately on small screens**

**2.16 WHEN traders scroll through stock lists on touch devices THEN the system lacks momentum scrolling and smooth touch interactions**

**2.17 WHEN mobile users access the host control panel THEN the system displays dense control buttons (Start Day, Pause, Resume, Publish News) that are too small and closely spaced for reliable touch interaction**

---

### Expected Behavior (Correct)

#### 1. Responsive Design - Mobile & Tablet

**3.1 WHEN the application is accessed on mobile phones (320px-480px width) THEN the system SHALL apply mobile-first responsive styles with single-column layouts, stacked cards, full-width buttons (min 44×44px touch targets), and adaptive 12-13px base font size**

**3.2 WHEN the application is accessed on tablets (768px-900px width) THEN the system SHALL display 2-column grid layouts for stock cards, condensed headers with collapsible metrics, and touch-optimized form controls**

**3.3 WHEN order entry modal is opened on screens <640px THEN the system SHALL display full-screen modal with scrollable content, bottom-anchored action buttons, and minimum 16px font size for inputs to prevent iOS auto-zoom**

**3.4 WHEN UI components are rendered on small viewports THEN the system SHALL apply fluid typography (clamp() or viewport-relative units) to ensure readability without horizontal scrolling**

**3.5 WHEN touch interactions are detected THEN the system SHALL ensure all interactive elements meet WCAG 2.2 minimum touch target size of 44×44px with adequate spacing (8px minimum between targets)**

#### 2. Projector 4:3 Aspect Ratio Optimization

**3.6 WHEN projector screen is accessed on 1024×768 resolution THEN the system SHALL detect 4:3 aspect ratio and apply specialized layout with 4×2 stock card grid (8 cards per page), centered content with safe margins (5% horizontal, 8% vertical), and appropriate font scaling**

**3.7 WHEN projector displays content on 800×600 resolution THEN the system SHALL apply further scaling adjustments with 3×2 grid (6 cards per page), increased font sizes for readability at distance (minimum 18px body, 32px headlines), and reduced padding to maximize usable space**

**3.8 WHEN breaking news banner appears on projector THEN the system SHALL constrain banner width to 90% of viewport with text truncation and ensure all content remains within 4:3 safe area**

**3.9 WHEN winner presentation stage is shown on 4:3 projector THEN the system SHALL use vertical-optimized podium layout with stacked medal positions and centered alignment**

#### 3. Runtime Reliability & Error Handling

**3.10 WHEN multiple rapid orders are submitted THEN the system SHALL maintain the existing sequential trade ID counter with server-side transaction atomicity, ensuring no duplicate IDs even under high concurrency**

**3.11 WHEN an order is rejected due to 200ms rate limit THEN the system SHALL return user-friendly error message: "Please wait before submitting another order. Orders are limited to one every 200ms to prevent accidental duplicates."**

**3.12 WHEN WebSocket reconnection occurs THEN the system SHALL trigger full state resync by sending SYNC_REQUEST and updating client state with latest gameState, holdings, and prices**

**3.13 WHEN invalid order parameters are received THEN the system SHALL return structured error responses with human-readable messages (e.g., "Invalid stock ticker: UNKNOWN. Please select a valid stock from the list.")**

**3.14 WHEN circuit breaker triggers THEN the system SHALL display plain-language status messages (e.g., "TRADING HALTED: Price moved too quickly. Buying temporarily restricted." for UPPER_HALT)**

#### 4. UX Flow Improvements

**3.15 WHEN host uses setup wizard THEN the system SHALL display clear step indicators (Step 1 of 4: Load Companies, Step 2 of 4: Configure Teams...), descriptive button labels ("Next: Configure Teams"), and progress breadcrumbs**

**3.16 WHEN trader places orders frequently THEN the system SHALL provide quick-entry mode with keyboard shortcuts (Q = buy, W = sell, number keys for quantity presets) and persistent last-used quantity**

**3.17 WHEN market status changes (paused, halted, day completed) THEN the system SHALL display prominent full-width status banner at top of screen with color-coded backgrounds and clear action items**

**3.18 WHEN empty states occur (no stocks, no teams, no trades) THEN the system SHALL show centered empty-state cards with illustrative icons, explanatory text, and actionable CTAs ("Load companies to begin trading")**

**3.19 WHEN data is loading THEN the system SHALL display consistent skeleton loaders for stock cards, pulsing placeholders for prices, and unified spinner overlay for full-page loads**

#### 5. Touch Optimization

**3.20 WHEN native dropdowns are used on mobile THEN the system SHALL replace with custom touch-friendly selectors with large tap targets (min 48px height) and clear visual feedback**

**3.21 WHEN touch scrolling is used THEN the system SHALL enable `-webkit-overflow-scrolling: touch` for momentum scrolling and `touch-action` CSS properties for gesture optimization**

**3.22 WHEN host accesses controls on mobile THEN the system SHALL display responsive control panel with vertically stacked buttons (min 48px height), grouped actions in collapsible sections, and confirmation dialogs for destructive actions**

---

### Unchanged Behavior (Regression Prevention)

#### Core Architecture Preservation

**4.1 WHEN responsive fixes are applied THEN the system SHALL CONTINUE TO operate with zero external CDN dependencies, using only local fonts, inline SVG icons, and bundled CSS**

**4.2 WHEN CSS media queries are added THEN the system SHALL CONTINUE TO maintain the offline-first architecture with all styles served from `public/style.css`**

**4.3 WHEN order handling logic is modified THEN the system SHALL CONTINUE TO enforce server-authoritative pricing, cash validation, and 200ms debounce rate limiting**

**4.4 WHEN error messaging is improved THEN the system SHALL CONTINUE TO use WebSocket JSON protocol for all client-server communication without introducing HTTP polling**

#### Desktop & Widescreen Experience

**4.5 WHEN the application is accessed on desktop (>1280px width) THEN the system SHALL CONTINUE TO display the current multi-column layouts, full metrics dashboard, and side-by-side stock grids**

**4.6 WHEN projector is used on 16:9 widescreen displays THEN the system SHALL CONTINUE TO use the existing grid layouts optimized for horizontal aspect ratios**

**4.7 WHEN host panel is accessed on large screens THEN the system SHALL CONTINUE TO show the full control matrix with all administrative functions in current layout**

#### Business Logic & Game Mechanics

**4.8 WHEN orders are executed THEN the system SHALL CONTINUE TO calculate fees, deduct cash, update holdings, and enforce circuit breaker rules with existing formulas**

**4.9 WHEN news events are published THEN the system SHALL CONTINUE TO apply price impacts, trigger smooth transitions, and maintain 60-second auto-hide behavior**

**4.10 WHEN day transitions occur THEN the system SHALL CONTINUE TO calculate leaderboards, generate daily snapshots, carry over balances, and reset elapsed time**

#### Multi-Screen Synchronization

**4.11 WHEN state updates are broadcast THEN the system SHALL CONTINUE TO synchronize all connected clients (host, traders, projector, sound console) via WebSocket tick updates**

**4.12 WHEN audio cues are triggered THEN the system SHALL CONTINUE TO use Web Audio API synthesis for opening bells, countdown pulses, and circuit breaker sirens**

**4.13 WHEN checkpoints are created THEN the system SHALL CONTINUE TO save full game state to JSON files every 2 minutes and restore with paused status**

#### Design System & Theming

**4.14 WHEN responsive styles are applied THEN the system SHALL CONTINUE TO use the ivory luxury design system with cream surfaces, forest text, champagne accents, and podium colors**

**4.15 WHEN typography is adjusted for mobile THEN the system SHALL CONTINUE TO use the serif font stack (Playfair Display fallback) for headings and sans-serif (Inter fallback) for body text**

**4.16 WHEN touch targets are enlarged THEN the system SHALL CONTINUE TO use existing button styles (btn-primary, btn-champagne, btn-outline) with adjusted padding only**

#### Accessibility & Print Styles

**4.17 WHEN media queries are tested THEN the system SHALL CONTINUE TO respect `prefers-reduced-motion` query to disable animations for users with motion sensitivity**

**4.18 WHEN print styles are applied THEN the system SHALL CONTINUE TO hide navigation, optimize tables for printing, and maintain report formatting**

**4.19 WHEN focus-visible states are styled THEN the system SHALL CONTINUE TO show 2px champagne outline for keyboard navigation accessibility**
