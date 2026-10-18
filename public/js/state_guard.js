/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * CLIENT MONOTONIC STATE GUARD (public/js/state_guard.js)
 *
 * Prevents race conditions between HTTP polling fallbacks and WebSocket broadcasts (DEF-024).
 * Drops out-of-order or stale state packets whose stateVersion is older than the last-applied version.
 */

(function(window) {
  'use strict';

  let currentClientEventId = null;
  let lastAppliedStateVersion = 0;

  /**
   * Evaluates incoming state payload against monotonicity invariants.
   * @param {Object} incoming - State payload from WebSocket or HTTP polling
   * @returns {boolean} - true if the packet should be applied, false if dropped as stale
   */
  function shouldAcceptIncomingState(incoming) {
    if (!incoming) return false;

    // Extract eventId and stateVersion from top-level or nested gameState
    const eventId = incoming.eventId || (incoming.gameState && incoming.gameState.eventId) || null;
    const rawVersion = incoming.stateVersion !== undefined
      ? incoming.stateVersion
      : (incoming.gameState && incoming.gameState.stateVersion !== undefined ? incoming.gameState.stateVersion : null);

    const stateVersion = (rawVersion !== null && rawVersion !== undefined && !isNaN(rawVersion))
      ? Number(rawVersion)
      : null;

    // Case 1: First time receiving an event, or eventId has changed (e.g., Host reset / new tournament)
    if (eventId && eventId !== currentClientEventId) {
      currentClientEventId = eventId;
      lastAppliedStateVersion = (stateVersion !== null) ? stateVersion : 0;
      return true;
    }

    // Case 2: Matching eventId with versioned packet
    if (stateVersion !== null) {
      if (stateVersion < lastAppliedStateVersion) {
        // Drop stale packet arriving out-of-order
        return false;
      }
      lastAppliedStateVersion = stateVersion;
      return true;
    }

    // Case 3: Unversioned message (e.g. static ack)
    return true;
  }

  function resetStateGuard() {
    currentClientEventId = null;
    lastAppliedStateVersion = 0;
  }

  function getCurrentEventId() {
    return currentClientEventId;
  }

  function getLastStateVersion() {
    return lastAppliedStateVersion;
  }

  window.StateGuard = {
    shouldAcceptIncomingState: shouldAcceptIncomingState,
    resetStateGuard: resetStateGuard,
    getCurrentEventId: getCurrentEventId,
    getLastStateVersion: getLastStateVersion
  };

  // Also bind directly on window for simple call sites
  window.shouldAcceptIncomingState = shouldAcceptIncomingState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateGuard: window.StateGuard, shouldAcceptIncomingState };
  }
})(typeof window !== 'undefined' ? window : global);
