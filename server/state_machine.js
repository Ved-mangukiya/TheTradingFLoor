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
