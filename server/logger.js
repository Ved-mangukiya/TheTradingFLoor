/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * HUMAN-READABLE TERMINAL & DIAGNOSTIC LOGGER (server/logger.js)
 *
 * Formats terminal messages for non-technical college organizers with
 * 12-hour timestamps, clear status labels, and actionable guidance,
 * while routing stack traces and debug details to logs/system_debug.log.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
const DEBUG_LOG_FILE = path.join(LOGS_DIR, 'system_debug.log');

if (!fs.existsSync(LOGS_DIR)) {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch (e) {}
}

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[92m',
  cyan: '\x1b[96m',
  yellow: '\x1b[93m',
  red: '\x1b[91m',
  gray: '\x1b[90m'
};

function formatTime12H() {
  const now = new Date();
  return now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toUpperCase();
}

function writeDebugFile(level, event, details, errorObj) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      details: details || {},
      stack: errorObj && errorObj.stack ? errorObj.stack : undefined
    };
    fs.appendFile(DEBUG_LOG_FILE, JSON.stringify(entry) + '\n', () => {});
  } catch (e) {}
}

function logTerminal(severity, badge, whatHappened, actionNeeded = null, debugError = null) {
  const timeStr = formatTime12H();
  let color = ANSI.cyan;
  if (severity === 'SUCCESS') color = ANSI.green;
  else if (severity === 'WARNING') color = ANSI.yellow;
  else if (severity === 'ERROR') color = ANSI.red;

  const badgePadded = `[${badge}]`.padEnd(18, ' ');
  console.log(`  ${ANSI.gray}${timeStr}${ANSI.reset}  ${ANSI.bold}${color}${badgePadded}${ANSI.reset} ${whatHappened}`);
  if (actionNeeded) {
    console.log(`  ${' '.repeat(timeStr.length)}  ${ANSI.dim}└─ Action Needed: ${actionNeeded}${ANSI.reset}`);
  }
  if (debugError || severity === 'ERROR' || severity === 'WARNING') {
    writeDebugFile(severity, badge, { whatHappened, actionNeeded }, debugError);
  }
}

module.exports = {
  info: (badge, whatHappened, actionNeeded = null) => logTerminal('INFO', badge, whatHappened, actionNeeded),
  success: (badge, whatHappened, actionNeeded = null) => logTerminal('SUCCESS', badge, whatHappened, actionNeeded),
  warn: (badge, whatHappened, actionNeeded = null, err = null) => logTerminal('WARNING', badge, whatHappened, actionNeeded, err),
  error: (badge, whatHappened, actionNeeded = null, err = null) => logTerminal('ERROR', badge, whatHappened, actionNeeded, err),
  writeDebugFile
};
