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
