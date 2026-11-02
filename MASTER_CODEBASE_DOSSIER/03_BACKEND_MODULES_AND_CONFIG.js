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
    "test:ids": "node tools/find_duplicate_ids.js",
    "lint:ids": "node tools/find_duplicate_ids.js",
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
 * synchronization, configuration validation, and centralized action-eligibility enforcement.
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
  gs.isTradingOpen = (gs.status === 'LIVE' && !gs.isPaused && !gs.isConcluded && !gs.activeCountdown);
  gs.isFinalDayCompleted = (gs.status === 'DAY_COMPLETED' && gs.currentDay >= gs.totalDays);
  gs.stateVersion = (gs.stateVersion || 1) + 1;

  return gs;
}

/**
 * Single Authoritative Trading Gate Helper (STATE-006)
 * Enforced identically across ORDER and LIQUIDATE_ALL on the backend.
 */
function canExecuteTrades(gs) {
  if (!gs) return false;
  return (
    gs.configLocked === true &&
    gs.status === 'LIVE' &&
    gs.isPaused === false &&
    gs.isConcluded === false &&
    !gs.activeCountdown
  );
}

/**
 * Validates required event configuration before allowing lock or initialization.
 */
function validateEventConfigPayload(payload, currentCompanies = [], currentTeams = {}) {
  const errors = [];
  const title = payload.eventTitle !== undefined ? payload.eventTitle : payload.title;
  if (title !== undefined && (!String(title).trim() || String(title).trim().length < 2)) {
    errors.push('Event title must be at least 2 characters long.');
  }

  const cash = payload.startingCash !== undefined ? Number(payload.startingCash) : 500000;
  if (!Number.isFinite(cash) || cash < 1000 || cash > 100000000) {
    errors.push('Starting capital must be between ₹1,000 and ₹10,00,00,000.');
  }

  const days = payload.totalDays !== undefined ? parseInt(payload.totalDays, 10) : 3;
  if (!Number.isFinite(days) || days < 1 || days > 10) {
    errors.push('Total competition days must be between 1 and 10.');
  }

  const dur = payload.dayDurationSeconds !== undefined ? parseInt(payload.dayDurationSeconds, 10) : 1800;
  if (!Number.isFinite(dur) || dur < 60 || dur > 14400) {
    errors.push('Session duration per day must be between 60 seconds (1 min) and 14,400 seconds (4 hours).');
  }

  let selectedTickers = payload.selectedTickers;
  if (Array.isArray(selectedTickers)) {
    const validTickers = selectedTickers
      .map((t) => String(t || '').toUpperCase().trim())
      .filter((t) => currentCompanies.some((c) => c.ticker === t));
    if (validTickers.length < 4) {
      errors.push('Please select at least 4 verified tradeable stocks for the market universe.');
    }
  } else {
    const enabledCount = currentCompanies.filter((c) => c.isEnabled !== false).length;
    if (enabledCount < 4) {
      errors.push('Please select at least 4 verified tradeable stocks for the market universe.');
    }
  }

  if (Array.isArray(payload.teams)) {
    if (payload.teams.length < 1) {
      errors.push('At least 1 participating team is required.');
    }
    const seenUsernames = new Set();
    payload.teams.forEach((t, idx) => {
      const n = String(t.name || '').trim();
      const p = String(t.password || '').trim();
      const u = String(t.username || `team${idx + 1}`).trim().toLowerCase();
      if (!n) errors.push(`Team ${idx + 1} display name is required.`);
      if (!p) errors.push(`Team ${idx + 1} password is required.`);
      if (seenUsernames.has(u)) errors.push(`Duplicate username "${u}" on Team ${idx + 1}.`);
      seenUsernames.add(u);
    });
  } else if (Object.keys(currentTeams || {}).length < 1) {
    errors.push('At least 1 participating team must be configured.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
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
  const isConfigReady = !!gs.configLocked && status !== 'SETUP' && status !== 'RESET';

  switch (action) {
    case 'HOST_SET_EVENT_LOCK':
    case 'HOST_LOCK_EVENT':
    case 'HOST_INITIALIZE_NEW_CHAMPIONSHIP':
      if (status === 'LIVE' || status === 'COUNTDOWN' || elapsedSeconds > 0 || currentDay > 1) {
        return {
          allowed: false,
          reason: 'Cannot re-initialize or modify event configuration: The tournament is already underway. Reset the championship first if you need a fresh event.'
        };
      }
      return { allowed: true };

    case 'HOST_UNLOCK_EVENT_CONFIG':
    case 'HOST_UNLOCK_EVENT':
      if (status === 'LIVE' || status === 'COUNTDOWN' || elapsedSeconds > 0 || currentDay > 1) {
        return {
          allowed: false,
          reason: 'Cannot unlock settings: The competition has already started. Event settings are permanently frozen during live trading.'
        };
      }
      return { allowed: true };

    case 'HOST_RESUME_COUNTDOWN':
    case 'HOST_START_DAY1_NOW':
    case 'RESUME_MARKET':
    case 'HOST_START_EVENT_NOW':
    case 'HOST_START_MARKET':
    case 'HOST_SCHEDULE_EVENT':
      if (!isConfigReady) {
        return {
          allowed: false,
          reason: 'Cannot launch or schedule market: Event configuration is incomplete. Complete and lock event setup first.'
        };
      }
      if (status === 'DAY_COMPLETED') {
        return {
          allowed: false,
          reason: `Day ${currentDay} has ended. Trading cannot be resumed. Review the results and prepare the next day.`
        };
      }
      if (gs.isConcluded) {
        return {
          allowed: false,
          reason: 'Cannot resume: The championship is already concluded.'
        };
      }
      if (status === 'LIVE' && !gs.isPaused) {
        return {
          allowed: false,
          reason: 'Trading is already active and running live.'
        };
      }
      return { allowed: true };

    case 'HOST_PAUSE':
    case 'HOST_SET_PAUSE_MODE':
      if (!isConfigReady) {
        return {
          allowed: false,
          reason: 'Cannot pause market: Event configuration is incomplete. Complete and lock event setup first.'
        };
      }
      if (status === 'DAY_COMPLETED' || gs.isConcluded) {
        return {
          allowed: false,
          reason: `Cannot pause market: Day ${currentDay} is already concluded.`
        };
      }
      if (status === 'STANDBY' || status === 'SCHEDULED') {
        return {
          allowed: false,
          reason: 'Cannot pause market: Trading session has not started yet (currently on Standby).'
        };
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
      if (!isConfigReady) {
        return {
          allowed: false,
          reason: 'Cannot conclude day: No event is currently active or configured. Complete event setup first.'
        };
      }
      if (status === 'DAY_COMPLETED') {
        return {
          allowed: false,
          reason: `Day ${currentDay} is already concluded. Stand by to advance to Day ${currentDay + 1} or finalize the championship.`
        };
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
        return {
          allowed: false,
          reason: `Cannot advance: Day ${currentDay} is the final planned day. Use 'Finish Championship' or 'Add Next Day'.`
        };
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
    isPaused: currentStatus !== 'LIVE' && currentStatus !== 'DAY_COMPLETED',
    isConcluded: currentStatus === 'CHAMPIONSHIP_CONCLUDED' || currentStatus === 'WINNER_ANNOUNCEMENT',
    currentDay: meta.currentDay || 1,
    totalDays: meta.totalDays || 3,
    elapsedSeconds: meta.elapsedSeconds || 0
  };
  const eligibility = validateActionEligibility(mockGs, action);
  return eligibility.allowed;
}

module.exports = {
  LOCKED_STATUSES,
  CANONICAL_STATUSES,
  syncDerivedStateFlags,
  canExecuteTrades,
  validateEventConfigPayload,
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
      username: t.username || (t.id ? t.id.replace('_', '') : ''),
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
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Calculates detailed investment analytics per team.
 */
function calculateTeamInvestments(teams, companies, defaultStartingCash = 500000) {
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
          sector: c.sector || 'General',
          quantity: qty,
          avgBuyPrice: +avgPrice.toFixed(2),
          investedCost: cost,
          currentPrice: +c.currentPrice.toFixed(2),
          marketValue: mktVal,
          unrealizedPnl: unPnl,
          returnPct: retPct
        });
      }
    });

    const startingCapital = t.startingCash || defaultStartingCash || 500000;
    const availableCash = +t.cash.toFixed(2);
    investedCost = +investedCost.toFixed(2);
    holdingsMarketValue = +holdingsMarketValue.toFixed(2);
    const portfolioValue = +(availableCash + holdingsMarketValue).toFixed(2);
    const netPnl = +(portfolioValue - startingCapital).toFixed(2);
    const returnPct = startingCapital > 0 ? +((netPnl / startingCapital) * 100).toFixed(2) : 0;

    return {
      id: t.id,
      teamId: t.id,
      name: t.name,
      teamName: t.name,
      username: t.username || (t.id ? t.id.replace('_', '') : ''),
      members: t.members || '',
      startingCapital,
      startingCash: startingCapital,
      availableCash,
      investedCost,
      holdingsMarketValue,
      portfolioValue,
      netPnl,
      returnPct,
      distinctHoldingsCount,
      distinctHoldings: distinctHoldingsCount,
      tradeCount: t.tradeCount || 0,
      holdingsDetail,
      lastTradeTime: t.lastTradeTime || '—',
      connected: !!t.connected
    };
  });
}

/**
 * Calculates market indices (NIFTY_TF20 benchmark + 6 sector indices).
 */
function calculateMarketIndices(companies) {
  const enabled = (companies || []).filter((c) => c.isEnabled !== false);
  if (enabled.length === 0) return [];

  const broadBase = 25000;
  const avgRatio = enabled.reduce((acc, c) => acc + (c.currentPrice / (c.base_price || 100)), 0) / enabled.length;
  const broadVal = +(broadBase * avgRatio).toFixed(2);
  const broadChg = +(broadVal - broadBase).toFixed(2);
  const broadPct = +(((broadVal - broadBase) / broadBase) * 100).toFixed(2);

  function calcSubIndex(id, name, sectorName, base, tickers) {
    const subs = enabled.filter((c) => tickers.includes(c.ticker));
    if (subs.length === 0) return null;
    const ratio = subs.reduce((acc, c) => acc + (c.currentPrice / (c.base_price || 100)), 0) / subs.length;
    const val = +(base * ratio).toFixed(2);
    const chg = +(val - base).toFixed(2);
    const chgPct = +(((val - base) / base) * 100).toFixed(2);
    return {
      id,
      name,
      sector: sectorName,
      baseValue: base,
      currentValue: val,
      value: val,
      change: chg,
      changePoints: chg,
      changePct: chgPct,
      constituents: subs.map((s) => s.ticker),
      tickers: subs.map((s) => s.ticker),
      constituentsCount: subs.length,
      weighting: 'Equal-Weighted'
    };
  }

  return [
    {
      id: 'NIFTY_TF20',
      name: 'TTF NIFTY 20 (Benchmark)',
      sector: 'MARKET BENCHMARK',
      baseValue: broadBase,
      currentValue: broadVal,
      value: broadVal,
      change: broadChg,
      changePoints: broadChg,
      changePct: broadPct,
      constituents: enabled.map((s) => s.ticker),
      tickers: enabled.map((s) => s.ticker),
      constituentsCount: enabled.length,
      weighting: 'Equal-Weighted'
    },
    calcSubIndex('BANK_TF', 'TTF BANK NIFTY', 'BANKING & FINANCE', 50000, ['HDFCBANK', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'CROWNBNK']),
    calcSubIndex('IT_TF', 'TTF IT (Tech)', 'INFORMATION TECH', 35000, ['TCS', 'INFY', 'NEXUSTECH', 'CYBERINF']),
    calcSubIndex('AUTO_TF', 'TTF AUTO (Mobility)', 'AUTOMOBILE', 22000, ['TATAMOTORS', 'MARUTI', 'M&M', 'APEXAUTO', 'VELOCAR']),
    calcSubIndex('ENERGY_TF', 'TTF ENERGY & POWER', 'ENERGY & POWER', 18000, ['RELIANCE', 'NTPC', 'POWERGRID', 'ADANIGREEN']),
    calcSubIndex('METALS_TF', 'TTF METALS & INFRA', 'METALS & INFRA', 12000, ['LT', 'TATASTEEL', 'JSWSTEEL']),
    calcSubIndex('CONSUMER_TF', 'TTF CONSUMER & PHARMA', 'CONSUMER & PHARMA', 16000, ['ITC', 'HINDUNILVR', 'SUNPHARMA', 'TITAN'])
  ].filter(Boolean);
}

/**
 * Calculates privacy-safe macro sector allocations per team.
 */
function calculateTeamSectorAllocations(teams, companies) {
  const standings = calculateLeaderboard(teams, companies);
  return standings.map((item) => {
    const t = teams ? teams[item.id] : null;
    if (!t) return null;
    const cash = t.cash || 0;
    let totalHoldingsVal = 0;
    const sectorValues = {};

    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      const val = qty * c.currentPrice;
      if (val > 0) {
        totalHoldingsVal += val;
        const sec = c.sector || 'General';
        sectorValues[sec] = (sectorValues[sec] || 0) + val;
      }
    });

    const totalPortfolio = Math.max(1, cash + totalHoldingsVal);
    const cashPct = +((cash / totalPortfolio) * 100).toFixed(1);
    const sectorPcts = {};
    Object.keys(sectorValues).forEach((sec) => {
      sectorPcts[sec] = +((sectorValues[sec] / totalPortfolio) * 100).toFixed(1);
    });

    // Sort sectors by percentage descending
    const sortedSectors = Object.entries(sectorPcts)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});

    return {
      teamId: t.id,
      teamName: t.name,
      rank: standings.findIndex((s) => s.id === t.id) + 1,
      netWorth: item.netWorth,
      cashPct,
      cashAmount: +cash.toFixed(2),
      sectorPcts: sortedSectors
    };
  }).filter(Boolean);
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
 * Canonical Scale:
 *   D <= 300s (5m)   -> 12s
 *   D <= 600s (10m)  -> 18s
 *   D <= 1200s (20m) -> 22s
 *   D > 1200s        -> 25s
 */
function getReadingWindowForDuration(durationSeconds) {
  if (durationSeconds <= 300) return 12;
  if (durationSeconds <= 600) return 18;
  if (durationSeconds <= 1200) return 22;
  return 25;
}

/**
 * Validates schedule feasibility: ensures all events trigger within trading hours,
 * complete reading windows before close, and maintain >= 60s separation.
 */
function validateScheduleFeasibility(newsEvents, dayDurationSeconds, minSeparationSec = 60) {
  if (!Array.isArray(newsEvents) || newsEvents.length === 0) {
    return { valid: true, issues: [], summary: 'No events scheduled' };
  }
  const issues = [];
  const eventsByDay = {};

  newsEvents.forEach((ev) => {
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
 * Prepends single quote if value begins with dangerous spreadsheet execution symbols,
 * escapes double-quotes, and wraps cell in double-quotes.
 */
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Filter sensitive news impact parameters based on role.
 * Only Host terminals may receive raw price impacts and volatility factors.
 */
function sanitizeNewsEventForRole(ev, role, hostRevealedIds = new Set()) {
  if (!ev) return null;
  const isHost = role === 'HOST';
  const isRevealedToHost = isHost && hostRevealedIds.has(ev.id || ev.event_id);

  const sanitized = {
    id: ev.id || ev.event_id,
    event_id: ev.event_id || ev.id,
    day: ev.day,
    trigger_second: ev.trigger_second,
    headline: ev.headline,
    body: ev.body || ev.simple_explanation || '',
    simple_explanation: ev.simple_explanation || ev.body || '',
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
    if (isRevealedToHost || ev.phase === 'COMPLETED' || ev.triggered) {
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
