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
