/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP — BACKEND MODULES & CONFIGURATION
 * Contains: package.json + modular server subsystems from /server directory
 * ============================================================================
 */

// ============================================================================
// 1. PACKAGE.JSON CONFIGURATION & DEPENDENCIES
// ============================================================================
/*
{
  "name": "the-trading-floor",
  "version": "2.6.0",
  "description": "Real-time LAN stock market simulation engine for The Trading Floor Championship",
  "author": "Ved Mangukiya (Surat, Gujarat, India)",
  "main": "server.js",
  "scripts": {
    "start": "node server.js live",
    "dev": "node server.js live",
    "start:live": "node server.js live",
    "start:test": "node server.js test",
    "test": "node tests/test_unified_master_flow.js",
    "test:all": "node tests/test_unified_master_flow.js && node tests/test_chunk2_state_machine.js && node tests/test_chunk3_ui_and_overlays.js && node tests/test_chunk4_action_contracts.js",
    "test:unified": "node tests/test_unified_master_flow.js",
    "test:chunk2": "node tests/test_chunk2_state_machine.js",
    "test:chunk3": "node tests/test_chunk3_ui_and_overlays.js",
    "test:chunk4": "node tests/test_chunk4_action_contracts.js",
    "test:phase1": "node tests/test_phase1_simulation_and_sync.js",
    "build:dossier": "node tools/build_master_dossier.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "ws": "^8.18.0"
  }
}

*/

// ============================================================================
// 2. SERVER / STATE_MACHINE.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * AUTHORITATIVE STATE MACHINE MODULE (server/state_machine.js)
 *
 * Implements the 4-dimensional orthogonal state model, monotonic stateVersion
 * synchronization, and centralized action-eligibility validation.
 */

'use strict';

const LOCKED_STATUSES = new Set([
  'STANDBY',
  'SCHEDULED',
  'COUNTDOWN',
  'LIVE',
  'PAUSED',
  'DAY_COMPLETED',
  'CHAMPIONSHIP_CONCLUDED',
  'WINNER_ANNOUNCEMENT'
]);

const CANONICAL_STATUSES = [
  'SETUP',
  'RESET',
  'STANDBY',
  'SCHEDULED',
  'COUNTDOWN',
  'LIVE',
  'PAUSED',
  'DAY_COMPLETED',
  'CHAMPIONSHIP_CONCLUDED',
  'WINNER_ANNOUNCEMENT'
];

/**
 * Deterministic Derived Flag Synchronizer (syncDerivedStateFlags)
 * Guarantees that orthogonal state dimensions (status, pauseMode, dayIndex, presentationState)
 * map deterministically to boolean flags and monotonically increment stateVersion.
 */
function syncDerivedStateFlags(gs) {
  if (!gs) return gs;

  // 1. Normalize legacy status aliases into canonical status + pauseMode
  if (gs.status === 'BLACKOUT') {
    gs.status = 'PAUSED';
    gs.pauseMode = 'BLACKOUT';
  } else if (gs.status === 'EMERGENCY_STOP') {
    gs.status = 'PAUSED';
    gs.pauseMode = 'EMERGENCY_HALT';
  } else if (gs.status === 'FINAL_ANALYSIS') {
    gs.status = 'CHAMPIONSHIP_CONCLUDED';
  }

  // 2. Authoritative configLocked invariant
  gs.configLocked = LOCKED_STATUSES.has(gs.status);

  // 3. Authoritative isConcluded invariant
  gs.isConcluded = (gs.status === 'CHAMPIONSHIP_CONCLUDED' || gs.status === 'WINNER_ANNOUNCEMENT');

  // 4. Authoritative isPaused invariant
  // DAY_COMPLETED has isPaused = false so terminals render Day Concluded rather than Paused by Host
  gs.isPaused = (gs.status !== 'LIVE' && gs.status !== 'DAY_COMPLETED');

  // 5. Clean up pauseMode when not in PAUSED
  if (gs.status !== 'PAUSED') {
    gs.pauseMode = 'NONE';
    gs.pauseStartedAt = null;
  } else if (!gs.pauseMode || gs.pauseMode === 'NONE') {
    gs.pauseMode = 'VISIBLE_FROZEN';
  }

  // 6. Authoritative tradeable check helper & monotonic version bump
  gs.isTradingOpen = (gs.status === 'LIVE' && !gs.isPaused && !gs.isConcluded);
  gs.isFinalDayCompleted = (gs.status === 'DAY_COMPLETED' && gs.currentDay >= gs.totalDays);
  gs.stateVersion = (gs.stateVersion || 1) + 1;

  return gs;
}

/**
 * Single Trading Gate Helper (STATE-006)
 * Authoritative check enforced identically across ORDER and LIQUIDATE_ALL.
 */
function canExecuteTrades(gs) {
  if (!gs) return false;
  return gs.status === 'LIVE' && !gs.isPaused && !gs.isConcluded;
}

/**
 * Centralized Action-Eligibility Validator.
 * Returns { allowed: boolean, reason?: string }.
 */
function validateActionEligibility(gs, action) {
  if (!gs) return { allowed: false, reason: 'Game state not initialized.' };
  const status = gs.status || 'SETUP';
  const currentDay = gs.currentDay || 1;
  const totalDays = gs.totalDays || 3;
  const elapsedSeconds = gs.elapsedSeconds || 0;

  switch (action) {
    case 'HOST_SET_EVENT_LOCK':
    case 'HOST_LOCK_EVENT':
      if (status === 'LIVE' || elapsedSeconds > 0 || currentDay > 1) {
        return { allowed: false, reason: 'Cannot modify event configuration: The tournament is already underway. Event settings are permanently locked.' };
      }
      return { allowed: true };

    case 'HOST_UNLOCK_EVENT_CONFIG':
    case 'HOST_UNLOCK_EVENT':
      if (status === 'LIVE' || elapsedSeconds > 0 || currentDay > 1) {
        return { allowed: false, reason: 'Cannot unlock settings: The competition has already started. Event settings are permanently frozen during live trading.' };
      }
      return { allowed: true };

    case 'HOST_TRIGGER_NEWS':
    case 'HOST_PUBLISH_NEWS_NOW':
    case 'HOST_CREATE_CUSTOM_NEWS':
      if (status !== 'LIVE' && status !== 'PAUSED') {
        return {
          allowed: false,
          reason: `Cannot broadcast breaking news while event is in ${status} state. Start the trading session first.`
        };
      }
      return { allowed: true };

    case 'HOST_TRIGGER_CIRCUIT_BREAKER':
    case 'HOST_HALT_STOCK':
    case 'HOST_UNHALT_STOCK':
    case 'HOST_RELEASE_CIRCUIT_BREAKER':
    case 'HOST_SECTOR_HALT':
      if (status !== 'LIVE' && status !== 'PAUSED') {
        return {
          allowed: false,
          reason: `Circuit breaker controls are only active during LIVE or PAUSED trading sessions (current: ${status}).`
        };
      }
      return { allowed: true };

    case 'HOST_CONCLUDE_DAY':
    case 'HOST_FINALIZE_DAY':
      if (!gs.configLocked || status === 'SETUP' || status === 'RESET') {
        return { allowed: false, reason: 'Cannot conclude day: No event is currently active or configured. Complete event setup first.' };
      }
      if (status === 'DAY_COMPLETED') {
        return { allowed: false, reason: `Day ${currentDay} is already concluded. Stand by to advance to Day ${currentDay + 1} or finalize the championship.` };
      }
      if (gs.isConcluded) {
        return { allowed: false, reason: 'Championship is already concluded.' };
      }
      return { allowed: true };

    case 'HOST_START_NEXT_DAY':
    case 'HOST_NEXT_DAY':
      if (status !== 'DAY_COMPLETED') {
        return { allowed: false, reason: 'Cannot advance to next day. Current day must be concluded first.' };
      }
      if (currentDay >= totalDays) {
        return { allowed: false, reason: `Cannot advance: Day ${currentDay} is the final planned day. Use 'Finish Championship' or 'Add Next Day'.` };
      }
      return { allowed: true };

    case 'HOST_CONCLUDE_CHAMPIONSHIP':
    case 'HOST_FINALIZE_CHAMPIONSHIP':
    case 'HOST_FINISH_EVENT':
      if (!gs.isConcluded && (status !== 'DAY_COMPLETED' || currentDay < totalDays)) {
        return {
          allowed: false,
          reason: `Championship finalization requires the final day (Day ${totalDays}) to be completed. Current: Day ${currentDay}/${totalDays}, Status: ${status}`
        };
      }
      return { allowed: true };

    case 'HOST_START_WINNER_PRESENTATION':
      if (!gs.isConcluded && (status !== 'DAY_COMPLETED' || currentDay < totalDays)) {
        return {
          allowed: false,
          reason: `Stage Presentation requires all tournament days (Day ${totalDays}/${totalDays}) to be concluded first.`
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

/**
 * Validates whether a requested Host transition action is permitted from current state.
 */
function canTransitionTo(currentStatus, action, meta = {}) {
  const mockGs = {
    status: currentStatus,
    configLocked: LOCKED_STATUSES.has(currentStatus),
    isConcluded: currentStatus === 'CHAMPIONSHIP_CONCLUDED' || currentStatus === 'WINNER_ANNOUNCEMENT',
    currentDay: meta.currentDay || 1,
    totalDays: meta.totalDays || 3,
    elapsedSeconds: meta.elapsedSeconds || 0
  };
  const eligibility = validateActionEligibility(mockGs, action);
  if (!eligibility.allowed) return false;

  switch (action) {
    case 'HOST_SET_EVENT_LOCK':
      return currentStatus === 'SETUP' || currentStatus === 'RESET';

    case 'HOST_UNLOCK_EVENT_CONFIG':
      return (currentStatus === 'STANDBY' || currentStatus === 'SCHEDULED') && (meta.currentDay === 1 && meta.elapsedSeconds === 0);

    case 'HOST_SCHEDULE_EVENT':
      return currentStatus === 'SETUP' || currentStatus === 'STANDBY';

    case 'HOST_CANCEL_SCHEDULE':
      return currentStatus === 'SCHEDULED';

    case 'HOST_RESUME_COUNTDOWN':
      return currentStatus === 'STANDBY' || currentStatus === 'SCHEDULED' || currentStatus === 'PAUSED';

    case 'HOST_PAUSE':
    case 'HOST_EMERGENCY_STOP':
      return currentStatus === 'LIVE' || currentStatus === 'COUNTDOWN';

    case 'HOST_START_EVENT_NOW':
    case 'HOST_START_MARKET':
      return currentStatus === 'STANDBY' || currentStatus === 'SCHEDULED' || currentStatus === 'PAUSED';

    case 'HOST_CONCLUDE_DAY':
    case 'HOST_FINALIZE_DAY':
      return currentStatus === 'LIVE' || currentStatus === 'PAUSED' || currentStatus === 'COUNTDOWN';

    case 'HOST_START_NEXT_DAY':
    case 'HOST_NEXT_DAY':
      return currentStatus === 'DAY_COMPLETED' && (meta.currentDay < meta.totalDays);

    case 'HOST_ADD_DAY':
      return !meta.isConcluded && (meta.totalDays < 10);

    case 'HOST_CONCLUDE_CHAMPIONSHIP':
    case 'HOST_FINALIZE_CHAMPIONSHIP':
      return currentStatus === 'DAY_COMPLETED' && (meta.currentDay >= meta.totalDays);

    case 'HOST_START_WINNER_PRESENTATION':
      return currentStatus === 'CHAMPIONSHIP_CONCLUDED' || (currentStatus === 'DAY_COMPLETED' && meta.currentDay >= meta.totalDays);

    case 'HOST_SET_PRESENTATION_SCENE':
      return currentStatus === 'WINNER_ANNOUNCEMENT' || meta.isConcluded;

    case 'HOST_EXIT_WINNER_PRESENTATION':
    case 'HOST_DISMISS_PODIUM':
      return currentStatus === 'WINNER_ANNOUNCEMENT' || currentStatus === 'CHAMPIONSHIP_CONCLUDED';

    case 'HOST_RESET_ENTIRE_CHAMPIONSHIP':
      return true;

    case 'HOST_INITIALIZE_NEW_CHAMPIONSHIP':
      return currentStatus === 'RESET' || currentStatus === 'SETUP' || currentStatus === 'STANDBY';

    default:
      return true;
  }
}

module.exports = {
  LOCKED_STATUSES,
  CANONICAL_STATUSES,
  syncDerivedStateFlags,
  canExecuteTrades,
  validateActionEligibility,
  canTransitionTo
};


// ============================================================================
// 3. SERVER / ACCOUNTING.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * AUTHORITATIVE ACCOUNTING & VALUATION ENGINE (server/accounting.js)
 *
 * Implements server-side portfolio valuation, synchronized leaderboard tie-breakers,
 * macro sector allocations, and official results snapshots.
 */

'use strict';

/**
 * Calculates current leaderboard across all teams with synchronized tie-breaker hierarchy:
 * 1. Net Worth (descending)
 * 2. Return % / PnL % (descending)
 * 3. Cash in Hand (descending)
 * 4. Trade Count (ascending — fewer trades wins)
 * 5. Team ID (alphabetical deterministic fallback)
 *
 * Resolves DEF-004 (Tie-breaker consistency) and DEF-005 (Preserves disabled stock holdings value).
 */
function calculateLeaderboard(teams, companies) {
  return Object.values(teams || {}).map((t) => {
    let holdingsValue = 0;
    let unrealizedPnl = 0;
    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      const cost = (t.avgBuyPrice && t.avgBuyPrice[c.ticker]) || 0;
      holdingsValue += qty * c.currentPrice;
      if (qty > 0) {
        unrealizedPnl += qty * (c.currentPrice - cost);
      }
    });
    const startingCash = t.startingCash || 500000;
    const netWorth = +(t.cash + holdingsValue).toFixed(2);
    const pnlPct = +(((netWorth - startingCash) / startingCash) * 100).toFixed(2);
    const totalPnl = +(netWorth - startingCash).toFixed(2);

    return {
      id: t.id,
      username: t.username || t.id.replace('_', ''),
      name: t.name,
      members: t.members || '',
      cash: +t.cash.toFixed(2),
      holdingsValue: +holdingsValue.toFixed(2),
      netWorth,
      totalPnl,
      pnlPct,
      realizedPnl: +(t.realizedPnl || 0).toFixed(2),
      unrealizedPnl: +unrealizedPnl.toFixed(2),
      tradeCount: t.tradeCount || 0,
      holdings: t.holdings || {}
    };
  }).sort((a, b) => {
    if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
    if (b.pnlPct !== a.pnlPct) return b.pnlPct - a.pnlPct;
    if (b.cash !== a.cash) return b.cash - a.cash;
    if (a.tradeCount !== b.tradeCount) return a.tradeCount - b.tradeCount;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calculates detailed investment analytics per team.
 */
function calculateTeamInvestments(teams, companies) {
  return Object.values(teams || {}).map((t) => {
    let investedCost = 0;
    let holdingsMarketValue = 0;
    let distinctHoldingsCount = 0;
    const holdingsDetail = [];

    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      if (qty > 0) {
        distinctHoldingsCount++;
        const avgPrice = (t.avgBuyPrice && t.avgBuyPrice[c.ticker]) || 0;
        const cost = +(qty * avgPrice).toFixed(2);
        const mktVal = +(qty * c.currentPrice).toFixed(2);
        const unPnl = +(mktVal - cost).toFixed(2);
        const retPct = cost > 0 ? +((unPnl / cost) * 100).toFixed(2) : 0;

        investedCost += cost;
        holdingsMarketValue += mktVal;

        holdingsDetail.push({
          ticker: c.ticker,
          name: c.name,
          sector: c.sector,
          quantity: qty,
          avgBuyPrice: avgPrice,
          currentPrice: c.currentPrice,
          totalCost: cost,
          marketValue: mktVal,
          unrealizedPnl: unPnl,
          returnPct: retPct
        });
      }
    });

    const netWorth = +(t.cash + holdingsMarketValue).toFixed(2);
    const startingCash = t.startingCash || 500000;
    const netPnl = +(netWorth - startingCash).toFixed(2);
    const returnPct = +(((netWorth - startingCash) / startingCash) * 100).toFixed(2);

    return {
      id: t.id,
      teamId: t.id,
      name: t.name,
      username: t.username || t.id.replace('_', ''),
      members: t.members || '',
      cash: +t.cash.toFixed(2),
      investedCost: +investedCost.toFixed(2),
      holdingsMarketValue: +holdingsMarketValue.toFixed(2),
      netWorth,
      netPnl,
      returnPct,
      tradeCount: t.tradeCount || 0,
      distinctHoldingsCount,
      realizedPnl: +(t.realizedPnl || 0).toFixed(2),
      holdings: holdingsDetail
    };
  });
}

/**
 * Calculates market indices (NIFTY_CAMPUS, AUTO_INDEX, IT_INDEX, etc.)
 */
function calculateMarketIndices(companies) {
  const enabled = (companies || []).filter((c) => c.isEnabled !== false);
  if (enabled.length === 0) return [];

  let totalCur = 0;
  let totalOpen = 0;
  const sectors = {};

  enabled.forEach((c) => {
    const cur = c.currentPrice || c.base_price;
    const opn = c.dayOpenPrice || c.base_price;
    totalCur += cur;
    totalOpen += opn;

    const sec = c.sector || 'General';
    if (!sectors[sec]) sectors[sec] = { cur: 0, opn: 0, count: 0 };
    sectors[sec].cur += cur;
    sectors[sec].opn += opn;
    sectors[sec].count++;
  });

  const campusBase = 10000;
  const broadChangePct = totalOpen > 0 ? +(((totalCur - totalOpen) / totalOpen) * 100).toFixed(2) : 0;
  const campusValue = +(campusBase * (1 + broadChangePct / 100)).toFixed(2);

  const indices = [
    {
      id: 'NIFTY_CAMPUS',
      name: 'NIFTY Campus 20',
      value: campusValue,
      baseValue: campusBase,
      changePct: broadChangePct,
      changeValue: +(campusValue - campusBase).toFixed(2),
      direction: broadChangePct >= 0 ? 'UP' : 'DOWN'
    }
  ];

  Object.entries(sectors).forEach(([secName, data]) => {
    const sChangePct = data.opn > 0 ? +(((data.cur - data.opn) / data.opn) * 100).toFixed(2) : 0;
    const sValue = +(5000 * (1 + sChangePct / 100)).toFixed(2);
    indices.push({
      id: `SECTOR_${secName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
      name: `${secName} Index`,
      value: sValue,
      baseValue: 5000,
      changePct: sChangePct,
      changeValue: +(sValue - 5000).toFixed(2),
      direction: sChangePct >= 0 ? 'UP' : 'DOWN'
    });
  });

  return indices;
}

/**
 * Calculates privacy-safe macro sector allocations per team.
 */
function calculateTeamSectorAllocations(teams, companies) {
  return Object.values(teams || {}).map((t) => {
    let holdingsValue = 0;
    const sectorValues = {};

    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      if (qty > 0) {
        const val = qty * c.currentPrice;
        holdingsValue += val;
        const sec = c.sector || 'Other';
        sectorValues[sec] = (sectorValues[sec] || 0) + val;
      }
    });

    const netWorth = t.cash + holdingsValue;
    const cashPct = netWorth > 0 ? +((t.cash / netWorth) * 100).toFixed(1) : 100;
    const sectorPcts = {};

    Object.entries(sectorValues).forEach(([sec, val]) => {
      sectorPcts[sec] = netWorth > 0 ? +((val / netWorth) * 100).toFixed(1) : 0;
    });

    return {
      teamId: t.id,
      teamName: t.name,
      cashPct,
      holdingsPct: +(100 - cashPct).toFixed(1),
      sectorPcts
    };
  });
}

module.exports = {
  calculateLeaderboard,
  calculateTeamInvestments,
  calculateMarketIndices,
  calculateTeamSectorAllocations
};


// ============================================================================
// 4. SERVER / MARKET_ENGINE.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * MATHEMATICAL MARKET & PRICE ENGINE (server/market_engine.js)
 *
 * Implements:
 * - Seedable Mulberry32 PRNG (cryptographic random seed per run by default,
 *   or deterministic seed when configured for reproducible testing/audits).
 * - Multi-factor log-return price evolution:
 *     Company Return = Market Factor + Sector Factor + Idiosyncratic Volatility Shock
 *                      + Randomized-Phase Intraday Wave + Mean Reversion + Event Smoothstep.
 * - Smoothstep shock interpolation & directional circuit breaker clamping.
 */

'use strict';

const crypto = require('crypto');

/**
 * Generates a fresh 32-bit unsigned integer seed from cryptographic entropy.
 */
function generateCryptoSeed() {
  return crypto.randomBytes(4).readUInt32LE(0);
}

/**
 * Creates a fast, high-quality Mulberry32 PRNG instance from a 32-bit integer seed.
 */
function createSeededRng(seed) {
  let state = (seed >>> 0) || generateCryptoSeed();
  return function nextFloat() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard smoothstep polynomial: S(u) = 3*u^2 - 2*u^3 for u in [0, 1].
 */
function smoothstep(u) {
  const clamped = Math.max(0, Math.min(1, u));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Box-Muller transform for zero-mean standard Gaussian variate using provided rng.
 */
function randomGaussian(mean = 0, stdev = 1, rng = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

/**
 * Clamp numeric value between min and max bounds, guarding against NaN/Infinity.
 */
function clamp(val, min, max) {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Assigns independent per-run wave phases and frequencies to each stock
 * so repeated runs never exhibit hardcoded directional openings.
 */
function initializeStockStochastics(companies, rng = Math.random) {
  (companies || []).forEach((stock) => {
    stock.trendPhase = rng() * Math.PI * 2;
    stock.trendFreq = 0.010 + rng() * 0.025;
    stock.sentimentBias = 0;
  });
}

/**
 * Computes a single multi-factor market step across all enabled stocks.
 * Factors:
 *  1. Market-wide systemic influence (18% weight, beta-scaled)
 *  2. Sector-level correlated influence (22% weight)
 *  3. Company-specific idiosyncratic Gaussian shock (45% weight) + unbiased micro-drift
 *  4. Randomized-phase cyclical intraday wave (20% weight)
 *  5. Gentle mean reversion toward dayOpenPrice
 */
function computeMultiFactorStep(stock, context) {
  const {
    rng = Math.random,
    elapsedSeconds = 0,
    marketShockZ = 0,
    sectorShockZ = 0
  } = context || {};

  const baseVol = clamp(parseFloat(stock.volatility_factor) || 0.004, 0.0005, 0.05);
  const beta = clamp(parseFloat(stock.beta) || 1.0, 0.1, 3.5);
  const effectiveVol = Math.max(0.0035, baseVol * beta * 1.5);

  // 1. Market-wide systemic influence (18% weight, beta-scaled)
  const marketReturn = marketShockZ * baseVol * beta * 0.18;

  // 2. Sector-level correlated influence (22% weight)
  const sectorReturn = sectorShockZ * effectiveVol * 0.22;

  // 3. Company-specific idiosyncratic Gaussian shock (45% weight) + unbiased micro-drift
  const idioZ = randomGaussian(0, 1, rng);
  const idioReturn = idioZ * effectiveVol * 0.45;
  const microReturn = (rng() - 0.50) * effectiveVol * 0.25;

  // 4. Intraday cyclical wave with per-run randomized phase (20% weight)
  const phase = typeof stock.trendPhase === 'number' ? stock.trendPhase : 0;
  const freq = typeof stock.trendFreq === 'number' ? stock.trendFreq : 0.018;
  const waveReturn = Math.cos(elapsedSeconds * freq + phase) * effectiveVol * 0.20;

  // 5. Gentle mean-reversion toward dayOpenPrice
  const refOpen = stock.dayOpenPrice || stock.base_price || stock.currentPrice || 100;
  const reversionPull = -0.00015 * ((stock.currentPrice - refOpen) / Math.max(1, refOpen));

  const totalLogReturn = marketReturn + sectorReturn + idioReturn + microReturn + waveReturn + reversionPull;
  const rawNextPrice = stock.currentPrice * Math.exp(clamp(totalLogReturn, -0.08, 0.08));

  const minBound = Math.max(0.05, parseFloat(stock.min_price) || 1);
  const maxBound = parseFloat(stock.max_price) || 500000;
  return +clamp(rawNextPrice, minBound, maxBound).toFixed(2);
}

/**
 * Unified Order-Flow Price Impact Calculator (used identically by BUY, SELL, and LIQUIDATE_ALL).
 * Prevents arbitrary minimum jumps while scaling smoothly with order value and share quantity.
 */
function calculateOrderFlowImpact(stock, quantity, side) {
  const price = Number(stock.currentPrice) || 100;
  const qty = Math.max(1, Number(quantity) || 1);
  const grossValue = qty * price;
  // Proportional liquidity impact: 0.0002% per rupee of gross value + lot pressure, capped at 0.6% per order
  const rawPct = Math.min(0.006, Math.max(0.0002, (grossValue * 0.0000002) + (qty / 500) * 0.0005));
  const delta = +(price * rawPct).toFixed(2);
  return side === 'BUY' ? delta : -delta;
}

module.exports = {
  generateCryptoSeed,
  createSeededRng,
  smoothstep,
  randomGaussian,
  clamp,
  initializeStockStochastics,
  computeMultiFactorStep,
  calculateOrderFlowImpact
};


// ============================================================================
// 5. SERVER / NEWS_SCHEDULER.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * NEWS SCHEDULER & TIMING ENGINE (server/news_scheduler.js)
 *
 * Implements proportional timing t_i = round(D * p_i), dynamic cognitive reading
 * windows W(D), schedule feasibility validation, and minimum separation enforcement.
 */

'use strict';

/**
 * Calculates adaptive cognitive reading window W(D) based on day duration D.
 * Scale:
 *   D <= 600s (10m)  -> 15s
 *   D <= 1200s (20m) -> 20s
 *   D <= 1800s (30m) -> 30s
 *   D > 1800s        -> 45s
 */
function getReadingWindowForDuration(durationSeconds) {
  if (durationSeconds <= 600) return 15;
  if (durationSeconds <= 1200) return 20;
  if (durationSeconds <= 1800) return 30;
  return 45;
}

/**
 * Validates schedule feasibility: ensures all events trigger within trading hours,
 * complete reading windows before close, and maintain >= 60s separation.
 */
function validateScheduleFeasibility(newsEvents, dayDurationSeconds, minSeparationSec = 60) {
  const issues = [];
  const eventsByDay = {};

  (newsEvents || []).forEach((ev) => {
    const d = ev.day || 1;
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  });

  Object.entries(eventsByDay).forEach(([day, dayEvents]) => {
    dayEvents.sort((a, b) => (a.trigger_second || 0) - (b.trigger_second || 0));
    for (let i = 0; i < dayEvents.length; i++) {
      const cur = dayEvents[i];
      const trig = cur.trigger_second || 0;
      const readSec = cur.reading_duration_sec || 20;

      if (trig <= 0) {
        issues.push(`Day ${day} event "${cur.event_id || cur.id}" scheduled before trading starts (${trig}s).`);
      }
      if (trig + readSec + 25 > dayDurationSeconds) {
        issues.push(`Day ${day} event "${cur.event_id || cur.id}" expires after trading day closes (${trig + readSec + 25}s > ${dayDurationSeconds}s).`);
      }
      if (i > 0) {
        const prev = dayEvents[i - 1];
        const gap = trig - (prev.trigger_second || 0);
        if (gap < minSeparationSec) {
          issues.push(`Day ${day} events "${prev.event_id || prev.id}" and "${cur.event_id || cur.id}" overlap or have insufficient reading separation (${gap}s < ${minSeparationSec}s).`);
        }
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    summary: issues.length === 0 ? '✓ Schedule feasible: all events fit with valid reading windows and separation' : issues.join('; ')
  };
}

module.exports = {
  getReadingWindowForDuration,
  validateScheduleFeasibility
};


// ============================================================================
// 6. SERVER / PERSISTENCE.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * PERSISTENCE & DISASTER RECOVERY MODULE (server/persistence.js)
 *
 * Implements atomic checkpointing, crash recovery, and sessions map serialization.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CHECKPOINTS_DIR = path.join(DATA_DIR, 'checkpoints');
const LIVE_STATE_FILE = path.join(DATA_DIR, 'live_game_state.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(CHECKPOINTS_DIR)) {
  try { fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true }); } catch (e) {}
}

/**
 * Serializes active in-memory session tokens into JSON-safe array for persistence.
 */
function serializeSessions(sessionsMap) {
  if (!sessionsMap) return [];
  const list = [];
  for (const [token, s] of sessionsMap.entries()) {
    list.push({
      token,
      role: s.role,
      id: s.id,
      name: s.name,
      username: s.username,
      members: s.members || '',
      lastOrderAt: s.lastOrderAt || 0,
      lastOrderAtByTicker: s.lastOrderAtByTicker || {}
    });
  }
  return list;
}

/**
 * Restores sessions Map from array of serialized session objects.
 */
function restoreSessions(sessionsArray, sessionsMap) {
  if (!Array.isArray(sessionsArray) || !sessionsMap) return;
  sessionsArray.forEach((s) => {
    if (s && s.token) {
      sessionsMap.set(s.token, {
        token: s.token,
        role: s.role,
        id: s.id,
        name: s.name,
        username: s.username,
        members: s.members || '',
        lastOrderAt: s.lastOrderAt || 0,
        lastOrderAtByTicker: s.lastOrderAtByTicker || {}
      });
    }
  });
}

module.exports = {
  DATA_DIR,
  CHECKPOINTS_DIR,
  LIVE_STATE_FILE,
  serializeSessions,
  restoreSessions
};


// ============================================================================
// 7. SERVER / SANITIZER.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * ROLE SANITIZER & SECURITY BOUNDARY MODULE (server/sanitizer.js)
 *
 * Implements role-based data filtering and formula-injection guards.
 */

'use strict';

/**
 * Formula Injection Protection for CSV exports.
 * Prepends single quote if value begins with dangerous spreadsheet execution symbols.
 */
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Filter sensitive news impact parameters based on role.
 * Only Host terminals may receive raw price impacts and volatility factors.
 */
function sanitizeNewsEventForRole(ev, role, hostRevealedIds = new Set()) {
  if (!ev) return null;
  const isHost = role === 'HOST';
  const isRevealedToHost = isHost && hostRevealedIds.has(ev.id);

  const sanitized = {
    id: ev.id,
    day: ev.day,
    trigger_second: ev.trigger_second,
    headline: ev.headline,
    body: ev.body,
    category: ev.category,
    urgency: ev.urgency,
    phase: ev.phase || 'SCHEDULED',
    triggered: !!ev.triggered,
    cancelled: !!ev.cancelled
  };

  if (isHost) {
    sanitized.source = ev.source;
    sanitized.impact_type = ev.impact_type;
    sanitized.target_sector = ev.target_sector;
    sanitized.impactsRevealed = isRevealedToHost;
    if (isRevealedToHost || ev.phase === 'COMPLETED') {
      sanitized.impacts = ev.impacts;
    } else {
      sanitized.impacts = '[🔒 Private Price Impact Details Hidden]';
    }
  }

  return sanitized;
}

module.exports = {
  sanitizeCsvCell,
  sanitizeNewsEventForRole
};
