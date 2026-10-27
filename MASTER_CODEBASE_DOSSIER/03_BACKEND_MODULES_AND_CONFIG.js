/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP 2026 — BACKEND MODULES & CONFIGURATION
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
  "description": "Real-time LAN stock market simulation engine for The Trading Floor Championship 2026",
  "author": "Ved Mangukiya (Surat, Gujarat, India)",
  "main": "server.js",
  "scripts": {
    "start": "node server.js live",
    "dev": "node server.js live",
    "start:live": "node server.js live",
    "start:test": "node server.js test",
    "test": "node tests/test_unified_master_flow.js",
    "test:chunk2": "node tests/test_chunk2_state_machine.js",
    "test:chunk3": "node tests/test_chunk3_ui_and_overlays.js",
    "test:chunk4": "node tests/test_chunk4_action_contracts.js",
    "test:unified": "node tests/test_unified_master_flow.js",
    "test:all": "node tests/test_unified_master_flow.js",
    "test:legacy": "node tests/test_master_suite.js && node tests/test_dynamic_upgrade_suite.js && node tests/test_trading_cards_and_lifecycle_suite.js && node tests/test_master_lifecycle_and_isolation.js && node tests/test_interaction_logic_and_state_machine.js && node tests/test_master_quantitative_and_security_suite.js",
    "test:cards": "node tests/test_trading_cards_and_lifecycle_suite.js",
    "test:upgrade": "node tests/test_dynamic_upgrade_suite.js",
    "test:lifecycle": "node tests/test_master_lifecycle_and_isolation.js",
    "test:qa": "node tests/test_interaction_logic_and_state_machine.js",
    "test:quant": "node tests/test_master_quantitative_and_security_suite.js"
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
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * AUTHORITATIVE STATE MACHINE MODULE (server/state_machine.js)
 *
 * Implements the 4-dimensional orthogonal state model and authoritative
 * lifecycle transitions (T01 through T20) per Chunk 2 specifications.
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
 * map deterministically to boolean flags with zero contradictory states.
 *
 * Resolves:
 * - DEF-001: Day completed trading lockout
 * - DEF-002: Unified configLocked across all endpoints
 * - DEF-010: Preserved concluded state after podium dismissal
 * - DEF-020: Normalized pause modes (EMERGENCY_HALT, BLACKOUT, RECOVERY)
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

  // 2. Authoritative configLocked invariant (Fixes DEF-002)
  gs.configLocked = LOCKED_STATUSES.has(gs.status);

  // 3. Authoritative isConcluded invariant (Fixes DEF-010)
  gs.isConcluded = (gs.status === 'CHAMPIONSHIP_CONCLUDED' || gs.status === 'WINNER_ANNOUNCEMENT');

  // 4. Authoritative isPaused invariant
  // Note: DAY_COMPLETED has isPaused = false so terminals render Day Concluded rather than Paused by Host
  gs.isPaused = (gs.status !== 'LIVE' && gs.status !== 'DAY_COMPLETED');

  // 5. Clean up pauseMode when not in PAUSED
  if (gs.status !== 'PAUSED') {
    gs.pauseMode = 'NONE';
    gs.pauseStartedAt = null;
  } else if (!gs.pauseMode || gs.pauseMode === 'NONE') {
    gs.pauseMode = 'VISIBLE_FROZEN';
  }

  // 6. Authoritative tradeable check helper (Fixes DEF-001)
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
 * Validates whether a requested Host transition action is permitted from current state.
 */
function canTransitionTo(currentStatus, action, meta = {}) {
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
      return true; // Allowed from any state with authoritative confirmation phrase

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
  canTransitionTo
};


// ============================================================================
// 3. SERVER / ACCOUNTING.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
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
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * MATHEMATICAL MARKET & PRICE ENGINE (server/market_engine.js)
 *
 * Implements smoothstep shock interpolation, Gaussian random walk,
 * and circuit breaker clamping utilities.
 */

'use strict';

/**
 * Standard smoothstep polynomial: S(u) = 3*u^2 - 2*u^3 for u in [0, 1].
 * Yields continuous zero first-derivatives at both endpoints (S'(0)=0, S'(1)=0).
 */
function smoothstep(u) {
  const clamped = Math.max(0, Math.min(1, u));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Box-Muller transform for zero-mean standard Gaussian variate.
 */
function randomGaussian(mean = 0, stdev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

/**
 * Clamp numeric value between min and max bounds.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

module.exports = {
  smoothstep,
  randomGaussian,
  clamp
};


// ============================================================================
// 5. SERVER / NEWS_SCHEDULER.JS
// ============================================================================
/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
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
 * THE TRADING FLOOR CHAMPIONSHIP 2026
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
 * THE TRADING FLOOR CHAMPIONSHIP 2026
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
