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
