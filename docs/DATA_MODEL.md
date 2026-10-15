# DATA MODEL SPECIFICATION — THE TRADING FLOOR CHAMPIONSHIP 2026

This document defines the complete TypeScript-style schemas and JSON data structures utilized across the server engine, WebSocket contracts, and persistent disk files.

---

## 1. User & Session Model

```typescript
type UserRole = 'HOST' | 'TRADER' | 'PROJECTOR';

interface UserRecord {
  username: string;       // e.g. "host", "projector", "team1"
  password: string;       // Plaintext tournament password (e.g. "trade100")
  role: UserRole;         // Authorization level
  id: string;             // Unique ID: "host", "PROJECTOR", "team_1"
  name: string;           // Display Name: "Dalal Street Titans"
  members?: string;       // Optional member roster: "Alice, Bob"
}

interface ActiveSession {
  token: string;          // 32-character hex cryptographic token
  role: UserRole;
  id: string;
  name: string;
  username: string;
  members: string;
  lastOrderAt: number;    // Epoch ms of last trade (for 200ms debounce)
}
```

---

## 2. Team & Portfolio Model

```typescript
interface TeamRecord {
  id: string;                         // "team_1"
  username: string;                   // "team1"
  name: string;                       // "Dalal Street Titans"
  members: string;                    // "Trader 1A, Trader 1B"
  cash: number;                       // Current available cash in INR
  startingCash: number;               // Baseline starting cash (e.g. 500000)
  holdings: Record<string, number>;   // ticker -> integer share count
  avgBuyPrice: Record<string, number>;// ticker -> weighted acquisition price
  realizedPnl: number;                // Cumulative realized profit/loss
  tradeCount: number;                 // Total executed order counter
}

// Client-calculated & Server-audited Standings
interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  members: string;
  cash: number;
  holdingsValue: number;
  netWorth: number;
  returnPct: number;
  tradeCount: number;
}
```

---

## 3. Company & Share Universe Model

```typescript
interface CompanyShare {
  ticker: string;                     // "RELIANCE"
  name: string;                       // "Reliance Industries Limited"
  sector: string;                     // "Oil & Gas / Conglomerate"
  base_price: number;                 // Initial baseline price
  currentPrice: number;               // Live simulated market tick price
  dayOpenPrice: number;               // Reference price at start of day
  dayHigh: number;                    // Session maximum
  dayLow: number;                     // Session minimum
  previousClosePrice: number;         // Prior trading day close
  lot_presets: number[];              // [1, 5, 10, 50, 100]
  beta: number;                       // News sensitivity multiplier (e.g. 1.15)
  volatility_factor: number;          // Gaussian walk volatility (e.g. 0.004)
  min_price: number;                  // Minimum allowed price floor
  max_price: number;                  // Maximum price ceiling
  isEnabled: boolean;                 // Active in tradeable market universe
  isHalted: boolean;                  // Circuit breaker halt state
  haltDirection: 'UPPER' | 'LOWER' | null;
  activeTransition: {                 // Active exponential news shock
    targetPrice: number;
    stepDelta: number;
    stepsRemaining: number;
  } | null;
  history: Array<{ time: number; price: number }>; // Bezier sparkline coordinates
  fundamentals?: {
    summary?: string;
    face_value?: number;
    high_52w?: number;
    low_52w?: number;
    pe_ratio?: number;
    debt_to_equity?: number;
    market_cap?: string;
  };
}
```

---

## 4. Trade Execution & Order Record

```typescript
type OrderType = 'BUY' | 'SELL';

interface TradeRecord {
  tradeId: string;        // "TRD_104"
  seq: number;            // 104
  timestamp: string;      // "10:14:22 AM"
  exactIso: string;       // "2026-10-15T04:44:22.104Z"
  day: number;            // Current competition day (1, 2, or 3)
  second: number;         // Elapsed second in day (e.g. 842)
  teamId: string;         // "team_3"
  teamName: string;       // "Alpha Hedge"
  type: OrderType;        // "BUY" or "SELL"
  ticker: string;         // "INFY"
  quantity: number;       // 100
  price: number;          // Executed share price (e.g. 1920.50)
  grossValue: number;     // quantity * price
  fee: number;            // Brokerage fee charged
  totalImpact: number;    // Net cash deducted or credited
  cashBefore: number;     // Team cash prior to trade
  cashAfter: number;      // Team cash post trade
}
```

---

## 5. News & Shock Event Model

```typescript
interface NewsImpact {
  delta_pct?: number;     // Company-specific % shift (e.g. +8.5%)
  base_pct?: number;      // Global market-wide % shift (e.g. -3.0%)
  duration_sec: number;   // Gradual ramp duration (30-60s)
}

interface NewsEvent {
  event_id: string;       // "NEWS_DAY1_1"
  day: number;            // 1
  trigger_second: number; // Scheduled trigger second (e.g. 300)
  type: string;           // "SECTOR SHOCK", "MACRO", "EARNINGS"
  headline: string;       // Breaking news headline
  simple_explanation: string; // Plain-English trading guide
  impacts: Record<string, NewsImpact>; // ticker -> impact parameters
  triggered?: boolean;
}
```

---

## 6. Global Competition State (`GameState`)

```typescript
interface GameState {
  title: string;                      // "The Trading Floor Championship 2026"
  currentDay: number;                 // 1, 2, or 3
  totalDays: number;                  // Default 3
  dayDurationSeconds: number;         // Default 1800 (30 mins)
  startingCash: number;               // Default 500000
  elapsedSeconds: number;             // Elapsed seconds in active day
  isPaused: boolean;                  // Market paused status
  pauseMode: string;                  // "VISIBLE_FROZEN"
  pauseStartedAt: number | null;      // Epoch ms when paused
  totalShiftOffsetSeconds: number;    // Cumulative pause offset
  tickIntervalMs: number;             // Default 1500ms
  circuitBreakerPercent: number;      // Default 20%
  transactionFeeBps: number;          // Default 0 bps (0 to 100 bps)
  activeNewsFlash: NewsEvent | null;  // Currently active breaking news
  newsHistory: NewsEvent[];           // Published news history
  isConcluded: boolean;               // Tournament concluded
  winnerData: WinnerPodiumData | null;// 1st, 2nd, 3rd place standings
}
```
