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
