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
