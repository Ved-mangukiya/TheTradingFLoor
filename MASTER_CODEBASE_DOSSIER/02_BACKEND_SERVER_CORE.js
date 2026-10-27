/**
 * ============================================================================
 * THE TRADING FLOOR CHAMPIONSHIP 2026 — BACKEND SERVER CORE
 * File: server.js
 * Size: ~193 KB | Pure Node.js + Express + WebSocket (ws)
 * Zero CDN | Authoritative State Machine | Real-time Market Loop
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const {
  LOCKED_STATUSES,
  CANONICAL_STATUSES,
  syncDerivedStateFlags,
  canExecuteTrades,
  canTransitionTo
} = require('./server/state_machine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// ==========================================
// 1. CREDENTIALS & SESSION TOKEN REGISTRY
// ==========================================
const USERS = {
  host: { username: 'host', password: 'host2026', role: 'HOST', id: 'host', name: 'Master Control' },
  projector: { username: 'projector', password: 'screen2026', role: 'PROJECTOR', id: 'PROJECTOR', name: 'Main Stage Projector' },
  sound: { username: 'sound', password: 'sound2026', role: 'SOUND_CONSOLE', id: 'SOUND_CONSOLE', name: 'Hall Sound System' },
  winner: { username: 'winner', password: 'winner2026', role: 'WINNER_DISPLAY', id: 'WINNER_DISPLAY', name: 'Winner Presentation Stage' }
};

// token -> { token, role, id, name, username, members, lastOrderAt }
const sessions = new Map();

// Dedicated event-hall sound system output clients registry
const soundClients = new Set();
let activeCountdownTimer = null;

// ==========================================
// 2. AUDIT LOGGING & TRADE LEDGER ENGINE
// ==========================================
const sessionStartTimestamp = new Date().toISOString();
const auditFilename = `AUDIT_LOG_${sessionStartTimestamp.replace(/[:.]/g, '-')}.json`;
const auditFilePath = path.join(LOGS_DIR, auditFilename);

const auditLog = {
  event_session: 'THE_TRADING_FLOOR_2026',
  start_time: sessionStartTimestamp,
  export_time: sessionStartTimestamp,
  total_records: 0,
  timeline_events: []
};

// Authoritative global executed trades ledger
const executedTrades = [];
let tradeSeqCounter = 0;

// Per-day fired news events registry to prevent duplicate triggers within same trading day
const firedNewsEventsPerDay = new Map(); // key: `day_${dayNum}_${event_id}`, value: true

let seqCounter = 0;
let isAuditDirty = false;
let isFlushingAudit = false;

function recordAuditEvent(type, extraFields = {}) {
  seqCounter++;
  const entry = {
    seq: seqCounter,
    exact_timestamp: new Date().toISOString(),
    game_day: gameState ? gameState.currentDay : 1,
    game_second: gameState ? gameState.elapsedSeconds : 0,
    type,
    ...extraFields
  };
  auditLog.timeline_events.push(entry);
  auditLog.total_records = auditLog.timeline_events.length;
  auditLog.export_time = entry.exact_timestamp;
  isAuditDirty = true;
}

function flushAuditLogToDisk() {
  if (!isAuditDirty || isFlushingAudit) return;
  isFlushingAudit = true;
  isAuditDirty = false;

  // Asynchronous non-blocking serialization & atomic write
  fs.writeFile(auditFilePath, JSON.stringify(auditLog), (err) => {
    isFlushingAudit = false;
    if (err) {
      isAuditDirty = true;
      console.error('[AUDIT ERROR]', err.message);
    }
  });
}
setInterval(flushAuditLogToDisk, 5000);

// Helper to escape values for CSV and guard against spreadsheet formula injection
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

// ==========================================
// 3. SCENARIO & SHARE UNIVERSE INITIALIZATION
// ==========================================
let activeScenarioMode = 'live'; // 'live' or 'test'
let scenarioData = null;
let companies = [];
let newsEvents = [];
let teams = {};
let gameState = {
  eventId: 'EVT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  stateVersion: 1,
  isReset: false,
  resetMessage: null,
  title: 'The Trading Floor - Championship 2026',
  subtitle: 'Gujarat Technological University • Intra-College Trading Championship',
  institution: 'Gujarat Technological University',
  status: 'SETUP',
  configLocked: false,
  startMode: 'IMMEDIATE',
  scheduledStartTime: null,
  pausePolicy: 'TRADING_TIME',
  currentDay: 1,
  totalDays: 3,
  dayDurationSeconds: 1800,
  startingCash: 500000,
  elapsedSeconds: 0,
  isPaused: true,
  pauseMode: 'VISIBLE_FROZEN',
  pauseStartedAt: null,
  totalShiftOffsetSeconds: 0,
  tickIntervalMs: 1500,
  circuitBreakerPercent: 20,
  transactionFeeBps: 0,
  activeNewsFlash: null,
  newsHistory: [],
  isConcluded: false,
  winnerData: null,
  activeCountdown: null,
  finalResultsSnapshot: null,
  marketIndices: [],
  dailyLeaderboards: {},
  dailyClosingPrices: {},
  projectorState: {
    mode: 'AUTO_CYCLE',
    currentScene: 'SCENE_MARKET_BOARD',
    sceneDurationSeconds: 12,
    isWinnerActive: false,
    winnerScene: 'SCENE_INTRO',
    updatedAt: new Date().toISOString()
  },
  presentationState: {
    active: false,
    scene: 'SCENE_INTRO',
    currentTeamIndex: 0,
    revealedRanks: [],
    updatedAt: new Date().toISOString()
  },
  audioSettings: {
    masterEnabled: true,
    masterVolume: 85,
    categories: {
      lifecycle: true,
      news: true,
      alerts: true,
      presentation: true
    },
    muted: false
  }
};

let priceLoopHandle = null;

// Helper to configure default teams
function setupDefaultTeams(count = 12, startingCash = 500000) {
  Object.keys(USERS).forEach((key) => {
    if (USERS[key].role === 'TRADER') delete USERS[key];
  });

  const defaultNames = [
    'Dalal Street Titans', 'Bullish Bears', 'Alpha Hedge', 'Quantum Traders',
    'Apex Capital', 'Vanguard Vipers', 'Sterling Bulls', 'Maverick Fund',
    'Zenith Asset Mgmt', 'Phoenix Wealth', 'Starlight Equity', 'Omega Syndicate',
    'Matrix Capital', 'Falcon Traders', 'Centurion Wealth', 'Ironclad Asset'
  ];

  teams = {};
  for (let i = 1; i <= count; i++) {
    const teamId = `team_${i}`;
    const username = `team${i}`;
    const password = `trade${i}00`;
    const name = defaultNames[i - 1] || `Team ${i}`;
    const members = `Trader ${i}A, Trader ${i}B`;

    USERS[username] = {
      username,
      password,
      role: 'TRADER',
      id: teamId,
      name,
      members
    };

    const holdings = {};
    const avgBuyPrice = {};
    companies.forEach((c) => {
      holdings[c.ticker] = 0;
      avgBuyPrice[c.ticker] = 0;
    });

    teams[teamId] = {
      id: teamId,
      username,
      name,
      members,
      cash: startingCash,
      startingCash,
      dayOpeningPortfolioValue: startingCash,
      holdings,
      avgBuyPrice,
      realizedPnl: 0,
      tradeCount: 0
    };
  }
}

// Persist customized active universe
const ACTIVE_UNIVERSE_FILE = path.join(DATA_DIR, 'universe_active.json');
const LIVE_STATE_FILE = path.join(DATA_DIR, 'live_game_state.json');
const CHECKPOINTS_DIR = path.join(DATA_DIR, 'checkpoints');
if (!fs.existsSync(CHECKPOINTS_DIR)) {
  fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true });
}

function saveUniverseToDisk() {
  if (activeScenarioMode === 'test') return;
  try {
    const dataToSave = companies.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      base_price: c.base_price,
      lot_presets: c.lot_presets,
      beta: c.beta,
      volatility_factor: c.volatility_factor,
      min_price: c.min_price || 1,
      max_price: c.max_price || 50000,
      isEnabled: c.isEnabled !== false,
      fundamentals: c.fundamentals || {}
    }));
    fs.writeFileSync(ACTIVE_UNIVERSE_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (err) {
    console.error('[UNIVERSE SAVE ERROR]', err.message);
  }
}

function saveLiveGameState() {
  if (activeScenarioMode === 'test') return;
  try {
    const traderUsers = {};
    Object.keys(USERS).forEach((k) => {
      if (USERS[k].role === 'TRADER') traderUsers[k] = USERS[k];
    });

    const activeSessions = Array.from(sessions.entries()).map(([tok, s]) => ({
      token: tok,
      role: s.role,
      id: s.id,
      name: s.name,
      username: s.username,
      members: s.members || '',
      lastOrderAt: s.lastOrderAt || 0
    }));

    const stateToSave = {
      savedAt: new Date().toISOString(),
      activeScenarioMode,
      gameState,
      companies,
      teams,
      executedTrades,
      tradeSeqCounter,
      newsEvents,
      traderUsers,
      activeSessions
    };
    fs.writeFileSync(LIVE_STATE_FILE, JSON.stringify(stateToSave, null, 2));
  } catch (err) {
    console.error('[LIVE STATE SAVE ERROR]', err.message);
  }
}

function createCheckpoint(label = 'manual') {
  try {
    const traderUsers = {};
    Object.keys(USERS).forEach((k) => {
      if (USERS[k].role === 'TRADER') traderUsers[k] = USERS[k];
    });

    const activeSessions = Array.from(sessions.entries()).map(([tok, s]) => ({
      token: tok,
      role: s.role,
      id: s.id,
      name: s.name,
      username: s.username,
      members: s.members || '',
      lastOrderAt: s.lastOrderAt || 0
    }));

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `checkpoint_Day${gameState ? gameState.currentDay : 1}_${gameState ? gameState.elapsedSeconds : 0}s_${label}_${timestampStr}.json`;
    const fullPath = path.join(CHECKPOINTS_DIR, filename);

    const snapshot = {
      version: '2.0.0',
      savedAt: new Date().toISOString(),
      label,
      activeScenarioMode,
      gameState,
      companies,
      teams,
      executedTrades,
      tradeSeqCounter,
      newsEvents,
      traderUsers,
      activeSessions
    };

    fs.writeFileSync(fullPath, JSON.stringify(snapshot, null, 2));
    fs.writeFileSync(LIVE_STATE_FILE, JSON.stringify(snapshot, null, 2));
    recordAuditEvent('CHECKPOINT_SAVED', { filename, day: gameState ? gameState.currentDay : 1, second: gameState ? gameState.elapsedSeconds : 0, label });
    return { filename, fullPath, snapshot };
  } catch (err) {
    console.error('[CHECKPOINT CREATE ERROR]', err.message);
    return null;
  }
}

function listCheckpoints() {
  try {
    if (!fs.existsSync(CHECKPOINTS_DIR)) return [];
    const files = fs.readdirSync(CHECKPOINTS_DIR).filter((f) => f.endsWith('.json'));
    const items = files.map((f) => {
      const p = path.join(CHECKPOINTS_DIR, f);
      const stat = fs.statSync(p);
      let day = 1;
      let second = 0;
      let label = 'manual';
      const m = f.match(/Day(\d+)_(\d+)s_([^_]+)/);
      if (m) {
        day = parseInt(m[1], 10);
        second = parseInt(m[2], 10);
        label = m[3];
      }
      return {
        filename: f,
        sizeKB: (stat.size / 1024).toFixed(1),
        mtime: stat.mtime.toISOString(),
        day,
        second,
        label
      };
    });
    items.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    return items;
  } catch (e) {
    return [];
  }
}

function restoreFromCheckpointData(data, sourceLabel = 'manual') {
  try {
    if (!data || !data.gameState || !Array.isArray(data.companies) || !data.teams) {
      return false;
    }

    activeScenarioMode = data.activeScenarioMode || 'live';
    gameState = data.gameState;
    if (!gameState.eventId) {
      gameState.eventId = 'EVT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    if (!gameState.stateVersion) {
      gameState.stateVersion = 1;
    }
    if (gameState.isReset === undefined) {
      gameState.isReset = false;
    }
    if (gameState.resetMessage === undefined) {
      gameState.resetMessage = null;
    }
    
    // Clear active countdown timer if any to prevent stale countdown from previous session
    if (activeCountdownTimer) {
      clearTimeout(activeCountdownTimer);
      activeCountdownTimer = null;
    }
    gameState.activeCountdown = null;
    
    // Preserve legitimate lifecycle states like DAY_COMPLETED, SETUP, STANDBY, CHAMPIONSHIP_CONCLUDED
    // Only force pause if state was actively trading (LIVE) to ensure safe recovery
    const legitimateStoppedStates = ['SETUP', 'STANDBY', 'DAY_COMPLETED', 'CHAMPIONSHIP_CONCLUDED', 'FINAL_ANALYSIS', 'EMERGENCY_STOP'];
    if (!legitimateStoppedStates.includes(gameState.status)) {
      gameState.status = 'PAUSED';
    }
    gameState.isPaused = true;
    gameState.pauseMode = 'RECOVERY';
    gameState.pauseStartedAt = Date.now();

    companies = data.companies;
    companies.forEach((c) => {
      const basePrice = parseFloat(c.base_price) || 100;
      const f = c.fundamentals || {};
      if (!c.week52High || isNaN(c.week52High)) {
        c.week52High = parseFloat(f.high_52w) || +(basePrice * 1.25).toFixed(2);
      }
      if (!c.week52Low || isNaN(c.week52Low)) {
        c.week52Low = parseFloat(f.low_52w) || +(basePrice * 0.75).toFixed(2);
      }
      if (c.currentPrice > c.week52High) c.week52High = c.currentPrice;
      if (c.currentPrice < c.week52Low) c.week52Low = c.currentPrice;
      c.isNew52WHigh = c.currentPrice >= c.week52High;
      c.isNew52WLow = c.currentPrice <= c.week52Low;
    });
    teams = data.teams;
    if (Array.isArray(data.executedTrades)) {
      executedTrades.length = 0;
      data.executedTrades.forEach((t) => executedTrades.push(t));
      tradeSeqCounter = data.tradeSeqCounter || executedTrades.length;
    }
    if (Array.isArray(data.newsEvents)) {
      newsEvents = data.newsEvents;
    }
    if (data.traderUsers && typeof data.traderUsers === 'object') {
      Object.keys(USERS).forEach((k) => {
        if (USERS[k].role === 'TRADER') delete USERS[k];
      });
      Object.assign(USERS, data.traderUsers);
    }

    if (Array.isArray(data.activeSessions)) {
      sessions.clear();
      data.activeSessions.forEach((s) => {
        if (s && s.token) {
          sessions.set(s.token, s);
        }
      });
    }

    // Rebuild per-day fired news events registry from restored events
    firedNewsEventsPerDay.clear();
    newsEvents.forEach((ev) => {
      if (ev.triggered && ev.day <= gameState.currentDay) {
        const firedKey = `day_${ev.day}_${ev.event_id}`;
        firedNewsEventsPerDay.set(firedKey, true);
      }
    });

    saveLiveGameState();
    restartEngineInterval();
    recordAuditEvent('CHECKPOINT_RESTORED', {
      source: sourceLabel,
      day: gameState.currentDay,
      status: gameState.status,
      elapsedSeconds: gameState.elapsedSeconds,
      tradesCount: executedTrades.length
    });
    return true;
  } catch (err) {
    console.error('[RESTORE CHECKPOINT ERROR]', err.message);
    return false;
  }
}

function restoreLiveGameState() {
  if (!fs.existsSync(LIVE_STATE_FILE)) return false;
  try {
    const raw = fs.readFileSync(LIVE_STATE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const success = restoreFromCheckpointData(data, 'CRASH_RECOVERY');
    if (success) {
      console.log('----------------------------------------------------------------');
      console.log(' ⚡ [CRASH RECOVERY] Previous live session detected and restored cleanly!');
      console.log(` • Title:           ${gameState.title}`);
      console.log(` • Day & Second:    Day ${gameState.currentDay} / ${gameState.totalDays} (${gameState.elapsedSeconds}s elapsed)`);
      console.log(` • Teams Loaded:    ${Object.keys(teams).length}`);
      console.log(` • Trades Restored: ${executedTrades.length}`);
      console.log(' • Market Status:   PAUSED (Host must press Resume to continue)');
      console.log('----------------------------------------------------------------');
    }
    return success;
  } catch (e) {
    console.error('[CRASH RECOVERY RESTORE ERROR]', e.message);
    return false;
  }
}

// Auto-save live state every 4 seconds, and auto-checkpoint every 120 seconds during live trading
let autoCheckpointCounter = 0;
setInterval(() => {
  if (activeScenarioMode !== 'test') {
    saveLiveGameState();
    autoCheckpointCounter += 4;
    if (autoCheckpointCounter >= 120 && gameState && gameState.status === 'LIVE' && !gameState.isPaused) {
      autoCheckpointCounter = 0;
      createCheckpoint('auto');
    }
  }
}, 4000);

function loadScenario(mode = 'live', forceBaseline = false) {
  activeScenarioMode = mode === 'test' ? 'test' : 'live';
  const fileName = activeScenarioMode === 'test' ? 'scenario_test.json' : 'scenario_live.json';
  const filePath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`[WARN] Missing ${fileName} in /data. Falling back.`);
    activeScenarioMode = activeScenarioMode === 'test' ? 'live' : 'test';
  }

  const resolvedPath = path.join(DATA_DIR, activeScenarioMode === 'test' ? 'scenario_test.json' : 'scenario_live.json');
  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  scenarioData = JSON.parse(raw);

  const meta = scenarioData.scenario_metadata;
  gameState = {
    eventId: (gameState && gameState.eventId) || ('EVT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase()),
    stateVersion: (gameState && gameState.stateVersion) || 1,
    isReset: false,
    resetMessage: null,
    title: meta.title || 'The Trading Floor - Championship 2026',
    subtitle: meta.subtitle || 'Gujarat Technological University • Intra-College Trading Championship',
    institution: meta.institution || 'Gujarat Technological University',
    status: 'SETUP',
    configLocked: false,
    startMode: 'IMMEDIATE',
    scheduledStartTime: null,
    pausePolicy: 'TRADING_TIME',
    currentDay: 1,
    totalDays: meta.total_days || 3,
    dayDurationSeconds: meta.day_duration_seconds || 1800,
    startingCash: meta.starting_cash || 500000,
    elapsedSeconds: 0,
    isPaused: true,
    pauseMode: 'VISIBLE_FROZEN',
    pauseStartedAt: Date.now(),
    totalShiftOffsetSeconds: 0,
    tickIntervalMs: meta.tick_interval_ms || 1500,
    circuitBreakerPercent: meta.circuit_breaker_percent || 20,
    transactionFeeBps: gameState.transactionFeeBps || 0,
    activeNewsFlash: null,
    newsHistory: [],
    isConcluded: false,
    winnerData: null,
    activeCountdown: null,
    finalResultsSnapshot: null,
    marketIndices: [],
    dailyLeaderboards: {},
    dailyClosingPrices: {},
    projectorState: {
      mode: 'AUTO_CYCLE',
      currentScene: 'SCENE_MARKET_BOARD',
      sceneDurationSeconds: 12,
      isWinnerActive: false,
      winnerScene: 'SCENE_INTRO',
      updatedAt: new Date().toISOString()
    },
    presentationState: {
      active: false,
      scene: 'SCENE_INTRO',
      currentTeamIndex: 0,
      revealedRanks: [],
      updatedAt: new Date().toISOString()
    },
    audioSettings: gameState.audioSettings || {
      masterEnabled: true,
      masterVolume: 85,
      categories: { lifecycle: true, news: true, alerts: true, presentation: true },
      muted: false
    }
  };

  let rawCompanies = scenarioData.companies;
  if (!forceBaseline && fs.existsSync(ACTIVE_UNIVERSE_FILE) && activeScenarioMode === 'live') {
    try {
      rawCompanies = JSON.parse(fs.readFileSync(ACTIVE_UNIVERSE_FILE, 'utf-8'));
    } catch (e) {
      rawCompanies = scenarioData.companies;
    }
  }

  companies = rawCompanies.map((c, idx) => {
    const basePrice = parseFloat(c.base_price) || 100;
    const f = c.fundamentals || {};
    let week52High = parseFloat(f.high_52w);
    let week52Low = parseFloat(f.low_52w);
    if (isNaN(week52High) || week52High <= 0) week52High = +(basePrice * 1.25).toFixed(2);
    if (isNaN(week52Low) || week52Low <= 0) week52Low = +(basePrice * 0.75).toFixed(2);
    if (week52High < basePrice) week52High = +(basePrice * 1.05).toFixed(2);
    if (week52Low > basePrice) week52Low = +(basePrice * 0.95).toFixed(2);

    // Intraday wave parameters for realistic divergence (prevents all stocks moving together)
    const trendPhase = ((idx * 1.73) % (Math.PI * 2));
    const trendFreq = 0.012 + ((idx % 7) * 0.005);
    // Unbiased market breadth: True statistical fairness (E[ΔP] = 0); divergence driven by cyclical waves
    const sentimentBias = 0;

    return {
      ticker: (c.ticker || '').toUpperCase().trim(),
      name: c.name || c.ticker,
      sector: c.sector || 'General',
      base_price: basePrice,
      lot_presets: Array.isArray(c.lot_presets) && c.lot_presets.length > 0 ? c.lot_presets : [1, 5, 10, 50, 100],
      beta: parseFloat(c.beta) || 1.0,
      volatility_factor: parseFloat(c.volatility_factor) || 0.005,
      min_price: parseFloat(c.min_price) || 1,
      max_price: parseFloat(c.max_price) || 500000,
      isEnabled: c.isEnabled !== false,
      fundamentals: {
        ...f,
        high_52w: week52High,
        low_52w: week52Low
      },
      currentPrice: basePrice,
      dayOpenPrice: basePrice,
      previousClosePrice: basePrice,
      dayHigh: basePrice,
      dayLow: basePrice,
      week52High,
      week52Low,
      isNew52WHigh: false,
      isNew52WLow: false,
      trendPhase,
      trendFreq,
      sentimentBias,
      isHalted: false,
      haltDirection: null,
      activeTransition: null,
      history: [{ time: 0, day: 1, price: basePrice }],
      multiDayHistory: [{ time: 0, cumulativeTime: 0, day: 1, price: basePrice }],
      historyByDay: {}
    };
  });

  newsEvents = scenarioData.news_events.map((ev) => ({
    ...ev,
    triggered: false
  }));

  setupDefaultTeams(16, gameState.startingCash);
  recordAuditEvent('SCENARIO_LOADED', { mode: activeScenarioMode, title: meta.title, companiesCount: companies.length });
  restartEngineInterval();
}

// Box-Muller transform for standard normal Gaussian distribution
function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ==========================================
// 4. NEWS & CIRCUIT BREAKER HANDLERS
// ==========================================

// Smoothstep transition model: P(t) = P0 + (PT - P0) * s(u) where s(u) = 3u^2 - 2u^3
function applyStockTransition(stock, shockPct, durationSec, newsHeadline = null) {
  if (!stock || !stock.isEnabled || stock.isHalted) return;
  // Always begin smoothly from the current official price (never snap):
  const startPrice = stock.currentPrice;
  const targetPrice = +(startPrice * (1 + shockPct / 100)).toFixed(2);
  if (durationSec === 0) {
    stock.activeTransition = null;
    stock.currentPrice = targetPrice;
    const upperLimit = +(stock.dayOpenPrice * (1 + gameState.circuitBreakerPercent / 100)).toFixed(2);
    const lowerLimit = +(stock.dayOpenPrice * (1 - gameState.circuitBreakerPercent / 100)).toFixed(2);
    if (stock.currentPrice >= upperLimit && !stock.isHalted) {
      triggerCircuitBreaker(stock, 'UPPER');
    } else if (stock.currentPrice <= lowerLimit && !stock.isHalted) {
      triggerCircuitBreaker(stock, 'LOWER');
    }
    return;
  }
  const durSec = Math.max(1, durationSec !== undefined ? durationSec : 45);
  const startTimeMs = Date.now();
  const startTimeStr = new Date(startTimeMs).toLocaleTimeString();
  stock.activeTransition = {
    startPrice,
    targetPrice,
    startTimeMs,
    startTimeStr,
    durationMs: durSec * 1000,
    shockPct,
    headline: newsHeadline || 'Market Wire Shock',
    preNewsHistory: (stock.history || []).slice(-10)
  };
}

// Automatic News Template Library (neutral headlines in simple English, realistic sector impacts)
const NEWS_TEMPLATE_LIBRARY = [
  {
    template_id: 'AUTO_PLI_POLICY',
    sector: 'Automobile',
    type: 'SECTOR',
    headline: 'Ministry of Heavy Industries Outlines Updated Production and Component Sourcing Guidelines',
    simple_explanation: 'Regulatory notification revises localization targets and battery sourcing criteria for domestic vehicle manufacturers.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 11.5 : (idx === 1 ? 7.5 : -3.5);
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 45 };
      });
      return impacts;
    }
  },
  {
    template_id: 'STEEL_IMPORT_STANDARDS',
    sector: 'Metals',
    type: 'SECTOR',
    headline: 'Directorate General of Foreign Trade Issues Operational Guidelines for Industrial Steel Shipments',
    simple_explanation: 'Notification establishes standardized quality testing protocols and tariff updates on imported industrial coils.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 12.0 : (idx === 1 ? 8.5 : -4.0);
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 45 };
      });
      return impacts;
    }
  },
  {
    template_id: 'IT_ENTERPRISE_CLOUD',
    sector: 'Information Technology',
    type: 'SECTOR',
    headline: 'North American Enterprise Cloud Modernization Budgets Expand in Q3 Spending Survey',
    simple_explanation: 'Quarterly industry benchmark index highlights resilient offshore IT contract renewals across multinational banking and retail clients.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx % 2 === 0 ? 8.5 : 6.2;
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 45 };
      });
      return impacts;
    }
  },
  {
    template_id: 'BANKING_REPO_RATE',
    sector: 'Banking & Financial Services',
    type: 'MACRO',
    headline: 'Reserve Bank of India Monetary Policy Committee Announces Liquidity Operations Framework',
    simple_explanation: 'Central banking committee calibrates domestic liquidity facilities following latest consumer price stability benchmarks.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 6.5 : (idx === 1 ? 8.0 : 7.2);
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 50 };
      });
      return impacts;
    }
  },
  {
    template_id: 'ENERGY_GRID_EXPANSION',
    sector: 'Energy & Power',
    type: 'SECTOR',
    headline: 'Central Electricity Authority Finalizes Green Energy Transmission Corridor Phase II',
    simple_explanation: 'National transmission roadmap clears capital expenditure allocations for inter-state renewable energy feeding corridors.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 7.8 : 5.4;
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 45 };
      });
      return impacts;
    }
  },
  {
    template_id: 'PHARMA_REGULATORY_CLEARANCE',
    sector: 'Pharmaceuticals & Healthcare',
    type: 'SECTOR',
    headline: 'Global Health Regulators Conclude Multi-Facility Good Manufacturing Practice Audits',
    simple_explanation: 'Inspection reports for domestic active pharmaceutical ingredient sites concluded with standard voluntary action observations.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 10.5 : 4.8;
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 40 };
      });
      return impacts;
    }
  },
  {
    template_id: 'FMCG_RURAL_DEMAND',
    sector: 'Consumer & Retail',
    type: 'SECTOR',
    headline: 'Agricultural Harvest Data Indicates Steady Consumer Household Spending in Rural Markets',
    simple_explanation: 'Seasonal procurement indices point to steady packaged goods replenishment across semi-urban distribution chains.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 6.8 : -2.5;
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 35 };
      });
      return impacts;
    }
  },
  {
    template_id: 'INFRA_PORT_CORRIDOR',
    sector: 'Infrastructure & Engineering',
    type: 'SECTOR',
    headline: 'National Highway and Dedicated Freight Logistics Network Crosses Operational Milestone',
    simple_explanation: 'Cabinet committee reviews multimodal logistics transit times along major industrial expressways and port terminals.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 9.2 : 5.0;
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 45 };
      });
      return impacts;
    }
  },
  {
    template_id: 'TELECOM_SPECTRUM_CLUSTERS',
    sector: 'Telecommunications',
    type: 'SECTOR',
    headline: 'Department of Telecommunications Approves Spectrum Band Harmonization in Metro Circles',
    simple_explanation: 'Regulatory order consolidates contiguous mid-band carrier frequencies across urban clusters to optimize data capacity.',
    generator: (sectorStocks) => {
      const impacts = {};
      sectorStocks.forEach((s, idx) => {
        const delta = idx === 0 ? 9.5 : 4.5;
        impacts[s.ticker] = { delta_pct: delta, duration_sec: 45 };
      });
      return impacts;
    }
  },
  {
    template_id: 'MACRO_INDUSTRIAL_OUTPUT',
    sector: 'MACRO',
    type: 'MACRO',
    headline: 'Ministry of Statistics Reports Manufacturing and Mining Output Indices for Past Quarter',
    simple_explanation: 'Broad-based capital goods and core sector index figures demonstrate sustained domestic industrial utilization.',
    generator: () => ({
      GLOBAL_WEIGHTED: { base_pct: 4.5, duration_sec: 50 }
    })
  }
];

// Generates a balanced, deterministic multi-day news plan strictly for the selected companies
function generateAutoNewsPlan(selectedTickers, totalDays = 3, dayDurationSeconds = 1800) {
  let pool = [];
  if (Array.isArray(selectedTickers) && selectedTickers.length > 0) {
    pool = companies.filter((c) => selectedTickers.includes(c.ticker));
  }
  if (pool.length === 0) {
    pool = companies.filter((c) => c.isEnabled !== false);
  }
  if (pool.length === 0) {
    pool = companies.slice(0, Math.min(10, companies.length));
  }

  const generatedEvents = [];
  // Adapt timing fractions and reading windows intelligently by session duration
  let timeFractions = [0.18, 0.40, 0.65, 0.85];
  let readingWindowSec = 25;
  if (dayDurationSeconds <= 300) {
    timeFractions = [0.35, 0.70];
    readingWindowSec = 12;
  } else if (dayDurationSeconds <= 600) {
    timeFractions = [0.25, 0.55, 0.80];
    readingWindowSec = 18;
  } else if (dayDurationSeconds <= 1200) {
    timeFractions = [0.20, 0.45, 0.70, 0.88];
    readingWindowSec = 22;
  }

  for (let d = 1; d <= totalDays; d++) {
    timeFractions.forEach((frac, fIdx) => {
      const triggerSec = Math.round(dayDurationSeconds * frac);
      const templateIdx = ((d - 1) * timeFractions.length + fIdx) % NEWS_TEMPLATE_LIBRARY.length;
      const tpl = NEWS_TEMPLATE_LIBRARY[templateIdx];

      // Filter pool stocks belonging to template sector
      const sectorStocks = pool.filter((s) => s.sector && s.sector.toLowerCase().includes(tpl.sector.toLowerCase()));
      const targetStocks = sectorStocks.length > 0 ? sectorStocks : pool.slice(0, Math.min(3, pool.length));
      const rawImpacts = tpl.generator(targetStocks);

      // Strictly sanitize impacts so only stocks present in the pool can be affected
      const impacts = {};
      Object.keys(rawImpacts).forEach((ticker) => {
        if (ticker === 'GLOBAL_WEIGHTED' || pool.some((s) => s.ticker === ticker)) {
          impacts[ticker] = rawImpacts[ticker];
        }
      });

      generatedEvents.push({
        event_id: `EVT_D${d}_0${fIdx + 1}`,
        day: d,
        relative_position: frac,
        trigger_second: triggerSec,
        reading_duration_sec: readingWindowSec,
        type: tpl.type,
        headline: tpl.headline,
        simple_explanation: tpl.simple_explanation,
        phase: 'SCHEDULED',
        impacts
      });
    });
  }

  return generatedEvents;
}

function getReadingWindowForDuration(durationSec) {
  if (durationSec <= 300) return 12;
  if (durationSec <= 600) return 18;
  if (durationSec <= 1200) return 22;
  return 25;
}

// Validates schedule feasibility under competition constraints
function validateScheduleFeasibility(events, dayDurationSeconds) {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: true, issues: [], summary: 'No events scheduled' };
  }
  const minSeparationSec = 60;
  const issues = [];
  const eventsByDay = {};

  events.forEach((ev) => {
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
        issues.push(`Day ${day} event "${cur.event_id}" scheduled before trading starts (${trig}s).`);
      }
      if (trig + readSec + 25 > dayDurationSeconds) {
        issues.push(`Day ${day} event "${cur.event_id}" expires after trading day closes (${trig + readSec + 25}s > ${dayDurationSeconds}s).`);
      }
      if (i > 0) {
        const prev = dayEvents[i - 1];
        const gap = trig - (prev.trigger_second || 0);
        if (gap < minSeparationSec) {
          issues.push(`Day ${day} events "${prev.event_id}" and "${cur.event_id}" overlap or have insufficient reading separation (${gap}s < ${minSeparationSec}s).`);
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

// Recalculates news publication offsets dynamically using proportional ratios: t_i = round(D * p_i)
function recalculateNewsScheduleForDuration(newDurationSeconds) {
  if (!Array.isArray(newsEvents) || newsEvents.length === 0) return;
  const oldDuration = gameState.dayDurationSeconds || 1800;
  const readingSec = getReadingWindowForDuration(newDurationSeconds);
  const minSeparationSec = 60;

  const eventsByDay = {};
  newsEvents.forEach((ev) => {
    const d = ev.day || 1;
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  });

  Object.values(eventsByDay).forEach((dayEvents) => {
    dayEvents.sort((a, b) => (a.trigger_second || 0) - (b.trigger_second || 0));
    let lastTrigger = 0;

    dayEvents.forEach((ev, idx) => {
      let p_i = ev.relative_position;
      if (p_i === undefined || p_i === null) {
        p_i = (ev.trigger_second || (idx + 1) * 300) / oldDuration;
        p_i = Math.max(0.10, Math.min(0.90, p_i));
      }
      ev.relative_position = p_i;

      // Proportional ratio formula: t_i = round(D * p_i)
      let targetSec = Math.round(newDurationSeconds * p_i);

      // Enforce minimum separation constraint (>= 60s from prior news)
      if (idx > 0 && targetSec < lastTrigger + minSeparationSec) {
        targetSec = lastTrigger + minSeparationSec;
      }

      // Bound within session end
      const maxAllowed = Math.max(minSeparationSec, newDurationSeconds - readingSec - 25);
      if (targetSec > maxAllowed) {
        targetSec = maxAllowed;
      }

      ev.trigger_second = targetSec;
      ev.reading_duration_sec = readingSec;
      lastTrigger = targetSec;
    });
  });

  recordAuditEvent('NEWS_SCHEDULE_SCALED', {
    oldDuration,
    newDuration: newDurationSeconds,
    recalculatedEventsCount: newsEvents.length
  });
}

function extendNewsPlanForDay(dayNumber) {
  const pool = companies.filter((c) => c.isEnabled !== false);
  const totalSec = gameState.dayDurationSeconds || 1800;
  let timeFractions = [0.18, 0.40, 0.65, 0.85];
  let readingWindowSec = 25;
  if (totalSec <= 300) { timeFractions = [0.35, 0.70]; readingWindowSec = 12; }
  else if (totalSec <= 600) { timeFractions = [0.25, 0.55, 0.80]; readingWindowSec = 18; }
  else if (totalSec <= 1200) { timeFractions = [0.20, 0.45, 0.70, 0.88]; readingWindowSec = 22; }

  timeFractions.forEach((frac, fIdx) => {
    const triggerSec = Math.round(totalSec * frac);
    const templateIdx = ((dayNumber - 1) * timeFractions.length + fIdx) % NEWS_TEMPLATE_LIBRARY.length;
    const tpl = NEWS_TEMPLATE_LIBRARY[templateIdx];
    const sectorStocks = pool.filter((s) => s.sector && s.sector.toLowerCase().includes(tpl.sector.toLowerCase()));
    const targetStocks = sectorStocks.length > 0 ? sectorStocks : pool.slice(0, Math.min(3, pool.length));
    const rawImpacts = tpl.generator(targetStocks);
    const impacts = {};
    Object.keys(rawImpacts).forEach((ticker) => {
      if (ticker === 'GLOBAL_WEIGHTED' || pool.some((s) => s.ticker === ticker)) {
        impacts[ticker] = rawImpacts[ticker];
      }
    });

    newsEvents.push({
      event_id: `EVT_D${dayNumber}_0${fIdx + 1}`,
      day: dayNumber,
      relative_position: frac,
      trigger_second: triggerSec,
      reading_duration_sec: readingWindowSec,
      type: tpl.type,
      headline: tpl.headline,
      simple_explanation: tpl.simple_explanation,
      phase: 'SCHEDULED',
      impacts
    });
  });
}

function applyNewsImpactsToStocks(eventObj) {
  if (eventObj.impactsApplied) return; // Idempotent: prevent duplicate shock application
  eventObj.impactsApplied = true;

  const impacts = eventObj.impacts || {};
  const oppMult = (gameState && gameState.opportunityMultiplier) || 1.0;
  const headline = eventObj.headline || 'Market Wire Reaction';

  if (impacts.GLOBAL_WEIGHTED) {
    const basePct = impacts.GLOBAL_WEIGHTED.base_pct * oppMult;
    const durationSec = impacts.GLOBAL_WEIGHTED.duration_sec || 45;

    companies.forEach((stock) => {
      if (!stock.isEnabled || stock.isHalted) return;
      const betaSensitivity = 1 + ((stock.beta || 1.0) - 1) * 0.5;
      const shockPct = +(basePct * betaSensitivity).toFixed(2);
      applyStockTransition(stock, shockPct, durationSec, headline);
    });
  } else {
    // 1. Process specific company impacts
    Object.keys(impacts).forEach((ticker) => {
      if (ticker.startsWith('SECTOR_')) return;
      const stock = companies.find((s) => s.ticker === ticker);
      if (!stock || !stock.isEnabled) return;
      const { delta_pct, duration_sec } = impacts[ticker];
      const betaSensitivity = (eventObj.type === 'SECTOR' || eventObj.type === 'MACRO') ? (1 + ((stock.beta || 1.0) - 1) * 0.5) : 1.0;
      const shockPct = +(delta_pct * betaSensitivity * oppMult).toFixed(2);
      if (stock.isHalted) {
        if (stock.haltDirection === 'UPPER' && shockPct < 0) releaseCircuitBreaker(stock);
        else if (stock.haltDirection === 'LOWER' && shockPct > 0) releaseCircuitBreaker(stock);
        else return;
      }
      applyStockTransition(stock, shockPct, duration_sec, headline);
    });

    // 2. Process sector-wide impacts
    Object.keys(impacts).forEach((key) => {
      if (!key.startsWith('SECTOR_')) return;
      const targetSector = key.replace('SECTOR_', '').toLowerCase();
      const { delta_pct, duration_sec } = impacts[key];
      companies.forEach((stock) => {
        if (!stock.isEnabled || stock.isHalted) return;
        if (stock.sector && stock.sector.toLowerCase().includes(targetSector)) {
          const betaSensitivity = 1 + ((stock.beta || 1.0) - 1) * 0.5;
          const sectorShock = +(delta_pct * betaSensitivity * oppMult).toFixed(2);
          applyStockTransition(stock, sectorShock, duration_sec, headline);
        }
      });
    });
  }
}

function triggerNewsEvent(eventObj, triggeredBy = 'SCHEDULE') {
  if (eventObj.triggered && eventObj.phase !== 'SCHEDULED') {
    return false; // Idempotent: prevent duplicate news triggers
  }

  // Per-day fired event tracking: prevent same event firing multiple times within same trading day
  const firedKey = `day_${gameState.currentDay}_${eventObj.event_id}`;
  if (firedNewsEventsPerDay.has(firedKey)) {
    return false; // Already fired today
  }
  
  eventObj.triggered = true;
  firedNewsEventsPerDay.set(firedKey, true);
  
  const impacts = eventObj.impacts || {};

  // 5-Phase News Flow: Reading & Discussion Window (No instant price shock!)
  let readingSec = 0;
  if (eventObj.reading_duration_sec !== undefined) {
    readingSec = eventObj.reading_duration_sec;
  } else if (triggeredBy === 'HOST_MANUAL' && eventObj.immediate) {
    readingSec = 0;
  } else if (triggeredBy === 'HOST_CUSTOM' && eventObj.reading_duration_sec === undefined) {
    readingSec = 0; // immediate for custom test/host shocks unless specified
  } else {
    const totalSec = gameState.dayDurationSeconds || 1800;
    if (totalSec <= 300) readingSec = 12;
    else if (totalSec <= 600) readingSec = 18;
    else readingSec = 25;
  }

  eventObj.readingDurationSec = readingSec;
  eventObj.reactionStartSecond = (gameState.elapsedSeconds || 0) + readingSec;

  if (readingSec === 0) {
    eventObj.phase = 'REACTING';
    applyNewsImpactsToStocks(eventObj);
  } else {
    eventObj.phase = 'READING';
  }

  let sentiment = 'NEUTRAL';
  let trafficLightBadge = '📰 BREAKING NEWS • REGULATORY & INDUSTRY NOTICE';
  if (eventObj.type === 'SECTOR') {
    trafficLightBadge = '📰 SECTOR NEWS • INDUSTRY NOTIFICATION';
  } else if (eventObj.type === 'MACRO' || impacts.GLOBAL_WEIGHTED) {
    trafficLightBadge = '📰 MACRO NEWS • MONETARY POLICY UPDATE';
  } else if (eventObj.type && eventObj.type.includes('RUMOR')) {
    trafficLightBadge = '📰 MARKET DESK • UNVERIFIED TRADING SPECULATION';
  } else if (eventObj.type && eventObj.type.includes('FACT_CHECK')) {
    trafficLightBadge = '📰 EXCHANGE FILING • OFFICIAL CORPORATE DISCLOSURE';
  }

  const nowTime = new Date();
  const publishedWallClock = (nowTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST').toUpperCase();
  eventObj.publishedWallClock = publishedWallClock;
  eventObj.publishedTimestamp = nowTime.toISOString();
  eventObj.publishedEpochMs = nowTime.getTime();

  const newsRecord = {
    id: eventObj.event_id,
    event_id: eventObj.event_id,
    day: gameState.currentDay,
    second: gameState.elapsedSeconds,
    type: eventObj.type,
    headline: eventObj.headline,
    simple_explanation: eventObj.simple_explanation,
    sentiment,
    trafficLightBadge,
    phase: eventObj.phase,
    readingDurationSec: eventObj.readingDurationSec,
    reactionStartSecond: eventObj.reactionStartSecond,
    impacts: eventObj.impacts,
    timestamp: nowTime.toISOString(),
    publishedWallClock,
    publishedTimestamp: nowTime.toISOString(),
    publishedEpochMs: nowTime.getTime()
  };

  gameState.activeNewsFlash = newsRecord;
  gameState.newsHistory.unshift(newsRecord);

  recordAuditEvent('NEWS_TRIGGERED', {
    triggered_by: triggeredBy,
    event_id: eventObj.event_id,
    headline: eventObj.headline,
    phase: eventObj.phase,
    reading_seconds: eventObj.readingDurationSec,
    impacts: eventObj.impacts
  });

  broadcastAudioCue('heavy_news_boom', 'news', { headline: eventObj.headline, event_id: eventObj.event_id });

  // Confidentiality: Broadcast private impacts only to HOST; traders and projector receive neutral text only
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (client.session && client.session.role === 'HOST') {
        client.send(JSON.stringify({ type: 'NEWS_FLASH', news: newsRecord }));
      } else {
        const publicNews = { ...newsRecord };
        delete publicNews.impacts;
        client.send(JSON.stringify({ type: 'NEWS_FLASH', news: publicNews }));
      }
    }
  });
}

function triggerCircuitBreaker(stock, direction) {
  stock.isHalted = true;
  stock.haltDirection = direction;
  stock.activeTransition = null;

  const limitFactor = direction === 'UPPER'
    ? (1 + gameState.circuitBreakerPercent / 100)
    : (1 - gameState.circuitBreakerPercent / 100);
  stock.currentPrice = +(stock.dayOpenPrice * limitFactor).toFixed(2);

  recordAuditEvent('CIRCUIT_BREAKER', {
    ticker: stock.ticker,
    direction,
    halted_at_price: stock.currentPrice,
    day_open_price: stock.dayOpenPrice
  });

  broadcastAudioCue('circuit_alarm', 'alerts', { ticker: stock.ticker, direction, price: stock.currentPrice });

  broadcastAll({
    type: 'CIRCUIT_BREAKER_ALERT',
    ticker: stock.ticker,
    name: stock.name,
    direction,
    price: stock.currentPrice
  });
  broadcastTick();
}

function releaseCircuitBreaker(stock) {
  if (!stock.isHalted) return;
  const oldDir = stock.haltDirection;
  stock.isHalted = false;
  stock.haltDirection = null;

  recordAuditEvent('CIRCUIT_RECOVERY', {
    ticker: stock.ticker,
    previous_direction: oldDir,
    price: stock.currentPrice,
    day_open_price: stock.dayOpenPrice
  });

  broadcastAll({
    type: 'CIRCUIT_RECOVERY_ALERT',
    ticker: stock.ticker,
    name: stock.name,
    previousDirection: oldDir,
    price: stock.currentPrice
  });
  broadcastTick();
}

// Authoritative Unified Day Conclusion Function (handles both auto-clock expiry and host action)
function concludeCurrentDay(isAutoClose = false) {
  if (gameState.status === 'DAY_COMPLETED' || gameState.isConcluded) {
    return gameState.dailyLeaderboards ? gameState.dailyLeaderboards[`day_${gameState.currentDay}`] : null;
  }

  const day = gameState.currentDay;
  gameState.isAutomaticEnd = !!isAutoClose;
  gameState.concludedReason = isAutoClose ? 'TIMER_EXPIRY' : 'MANUAL_HOST_ACTION';
  const standings = calculateLeaderboard();
  const closingPrices = {};
  companies.forEach((c) => { closingPrices[c.ticker] = c.currentPrice; });

  const prevSnapshot = gameState.dailyLeaderboards && gameState.dailyLeaderboards[`day_${day - 1}`];

  const dailyRankings = standings.map((item) => {
    const t = teams[item.id] || {};
    const startingCash = t.startingCash || gameState.startingCash || 500000;
    const currentPortfolioValue = item.netWorth;
    const prevClosingValue = prevSnapshot
      ? (prevSnapshot.rankings.find((r) => r.teamId === item.id)?.closingPortfolioValue || t.dayOpeningPortfolioValue || startingCash)
      : (t.dayOpeningPortfolioValue || startingCash);

    const dailyPnl = +(currentPortfolioValue - prevClosingValue).toFixed(2);
    const dailyReturnPct = prevClosingValue > 0 ? +(((currentPortfolioValue - prevClosingValue) / prevClosingValue) * 100).toFixed(2) : 0;
    const cumulativePnl = +(currentPortfolioValue - startingCash).toFixed(2);
    const cumulativeReturnPct = startingCash > 0 ? +(((currentPortfolioValue - startingCash) / startingCash) * 100).toFixed(2) : 0;

    let prevRank = 1;
    if (prevSnapshot && prevSnapshot.rankings) {
      const pIdx = prevSnapshot.rankings.findIndex((r) => r.teamId === item.id);
      if (pIdx !== -1) prevRank = pIdx + 1;
    }

    return {
      id: item.id,
      name: item.name,
      teamId: item.id,
      teamName: item.name,
      members: item.members || t.members || '',
      prevRank,
      openingPortfolioValue: prevClosingValue,
      dayOpeningValuation: prevClosingValue,
      closingPortfolioValue: currentPortfolioValue,
      dailyPnl,
      dayPnl: dailyPnl,
      dailyReturnPct,
      dayReturnPercent: dailyReturnPct,
      cumulativePnl,
      cumulativeReturnPct,
      cash: item.cash,
      holdingsValue: item.holdingsValue,
      netWorth: currentPortfolioValue,
      tradeCount: item.tradeCount
    };
  });

  // Sort dailyRankings strictly by that specific day's profit/loss only!
  dailyRankings.sort((a, b) => {
    if (b.dailyPnl !== a.dailyPnl) return b.dailyPnl - a.dailyPnl;
    if (b.dailyReturnPct !== a.dailyReturnPct) return b.dailyReturnPct - a.dailyReturnPct;
    if (b.cash !== a.cash) return b.cash - a.cash;
    return a.tradeCount - b.tradeCount;
  });

  // Assign authoritative Day rank and compute daily rank deltas
  dailyRankings.forEach((item, idx) => {
    item.rank = idx + 1;
    item.dayRank = idx + 1;
    item.rankDelta = item.prevRank - (idx + 1);
  });

  const daySnapshot = {
    day,
    finalizedAt: new Date().toISOString(),
    closingPrices,
    rankings: dailyRankings,
    dailyRankings,
    cumulativeRankings: standings,
    isAutomaticEnd: isAutoClose
  };

  if (!gameState.dailyLeaderboards) gameState.dailyLeaderboards = {};
  if (!gameState.dailyClosingPrices) gameState.dailyClosingPrices = {};
  gameState.dailyLeaderboards[`day_${day}`] = daySnapshot;
  gameState.dailyClosingPrices[`day_${day}`] = closingPrices;

  // Transition market state explicitly to DAY_COMPLETED (not paused by host)
  gameState.isPaused = false;
  gameState.status = 'DAY_COMPLETED';
  gameState.pauseMode = 'NONE';
  gameState.pauseStartedAt = null;
  if (activeCountdownTimer) {
    clearTimeout(activeCountdownTimer);
    activeCountdownTimer = null;
  }
  gameState.activeCountdown = null;

  const conclusionReason = isAutoClose ? 'TIMER_EXPIRY' : 'MANUAL_HOST_ACTION';
  recordAuditEvent('DAY_CONCLUDED', { day, teamsCount: dailyRankings.length, isAutomaticEnd: isAutoClose, reason: conclusionReason });
  broadcastAudioCue('bell_close', 'lifecycle', { day });
  broadcastAll({ type: 'BELL_EVENT', bell: 'CLOSE', day });
  broadcastAll({
    type: 'DAY_CONCLUDED',
    day,
    status: gameState.status,
    daySnapshot,
    dailyRankings,
    dailyLeaderboards: gameState.dailyLeaderboards,
    isAutomaticEnd: isAutoClose,
    reason: conclusionReason
  });
  broadcastAll({
    type: 'DAY_FINALIZED',
    day,
    status: gameState.status,
    daySnapshot,
    isAutomaticEnd: isAutoClose,
    reason: conclusionReason
  });

  // CRITICAL: Do NOT auto-finalize championship when final day ends
  // Host must explicitly finalize to review standings and ensure integrity
  // Pre-generate final results for host review, but do not mark as concluded
  if (gameState.currentDay >= gameState.totalDays) {
    const winnerData = getConcludedLeaderboard();
    const snapshot = generateOfficialResultsSnapshot();
    gameState.winnerData = winnerData;
    gameState.finalResultsSnapshot = snapshot;
    // Do NOT set isConcluded here - require explicit HOST_FINALIZE_CHAMPIONSHIP action
    broadcastAll({
      type: 'FINAL_DAY_COMPLETED',
      day: gameState.currentDay,
      winnerData,
      snapshot,
      title: gameState.title,
      requiresExplicitFinalization: true
    });
  }

  broadcastTick();
  broadcastPublicEventStatus();
  return daySnapshot;
}

// ==========================================
// 5. REAL-TIME ENGINE LOOPS
// ==========================================
setInterval(() => {
  // Check for Scheduled Event Auto-Start
  if (gameState.status === 'SCHEDULED' && gameState.scheduledStartTime) {
    const targetMs = new Date(gameState.scheduledStartTime).getTime();
    if (!isNaN(targetMs)) {
      if (Date.now() >= targetMs) {
        gameState.status = 'COUNTDOWN';
        startResumeCountdown('SCHEDULED_TIMER');
      } else {
        // Broadcast tick every second so all screens and waiting room timers stay live and synced
        broadcastTick();
      }
    }
  }

  if (gameState.isPaused || gameState.isConcluded || gameState.status === 'DAY_COMPLETED' || gameState.status !== 'LIVE') return;

  gameState.elapsedSeconds++;

  newsEvents.forEach((ev) => {
    if (!ev.triggered && !ev.cancelled && ev.day === gameState.currentDay && ev.trigger_second === gameState.elapsedSeconds) {
      triggerNewsEvent(ev, 'AUTO_CLOCK');
    }
    // 5-Phase News Flow: Transition from READING to REACTING when decision deadline expires
    if (ev.triggered && !ev.cancelled && ev.phase === 'READING' && gameState.elapsedSeconds >= (ev.reactionStartSecond || (ev.trigger_second + 25))) {
      ev.phase = 'REACTING';
      applyNewsImpactsToStocks(ev);
      broadcastAudioCue('reaction_start_chime', 'news', { event_id: ev.event_id, headline: ev.headline });
      broadcastAll({
        type: 'NEWS_REACTION_START',
        event_id: ev.event_id,
        headline: ev.headline
      });
    }
  });

  // Automatic Day Clock Expiration
  if (gameState.elapsedSeconds >= gameState.dayDurationSeconds) {
    recordAuditEvent('DAY_CLOSE_CLOCK_EXPIRED', { day: gameState.currentDay, elapsed: gameState.elapsedSeconds });
    concludeCurrentDay(true);
  }
}, 1000);

function recordStockHistoryPoint(stock) {
  const pt = { time: gameState.elapsedSeconds, day: gameState.currentDay, price: stock.currentPrice };
  stock.history.push(pt);
  if (stock.history.length > 360) stock.history.shift();

  if (!Array.isArray(stock.multiDayHistory)) {
    stock.multiDayHistory = [{ time: 0, cumulativeTime: 0, day: 1, price: stock.base_price || stock.dayOpenPrice }];
  }
  const cumTime = ((gameState.currentDay - 1) * (gameState.dayDurationSeconds || 1800)) + gameState.elapsedSeconds;
  stock.multiDayHistory.push({
    time: gameState.elapsedSeconds,
    cumulativeTime: cumTime,
    day: gameState.currentDay,
    price: stock.currentPrice
  });
  if (stock.multiDayHistory.length > 1080) stock.multiDayHistory.shift();
}

function restartEngineInterval() {
  if (priceLoopHandle) clearInterval(priceLoopHandle);

  priceLoopHandle = setInterval(() => {
    if (gameState.isPaused || gameState.isConcluded || gameState.status === 'DAY_COMPLETED' || gameState.status !== 'LIVE') return;

    companies.forEach((stock) => {
      if (!stock.isEnabled) return;

      const upperLimit = +(stock.dayOpenPrice * (1 + gameState.circuitBreakerPercent / 100)).toFixed(2);
      const lowerLimit = +(stock.dayOpenPrice * (1 - gameState.circuitBreakerPercent / 100)).toFixed(2);

      if (stock.isHalted) {
        // While at UPPER circuit limit: upward drift is clamped.
        // Background drift requires at least 0.8% buffer away from ceiling before unhalting (or active counter-order execution)
        const unhaltUpperThreshold = +(upperLimit - (stock.dayOpenPrice * 0.008)).toFixed(2);
        const unhaltLowerThreshold = +(lowerLimit + (stock.dayOpenPrice * 0.008)).toFixed(2);

        if (stock.haltDirection === 'UPPER') {
          const meanReversion = -0.0004 * (stock.currentPrice - stock.base_price);
          const randDrift = (Math.random() - 0.58) * stock.volatility_factor * stock.currentPrice * 0.2;
          const downwardPull = Math.min(0, meanReversion + randDrift);
          if (downwardPull < -0.02) {
            stock.currentPrice = Math.min(upperLimit, +(stock.currentPrice + downwardPull).toFixed(2));
            if (stock.currentPrice <= unhaltUpperThreshold) {
              releaseCircuitBreaker(stock);
            }
          }
        } else if (stock.haltDirection === 'LOWER') {
          // While at LOWER circuit limit: downward drift is clamped.
          // Background drift requires at least 0.8% buffer away from floor before unhalting (or active counter-order execution)
          const meanReversion = -0.0004 * (stock.currentPrice - stock.base_price);
          const randDrift = (Math.random() - 0.42) * stock.volatility_factor * stock.currentPrice * 0.2;
          const upwardPull = Math.max(0, meanReversion + randDrift);
          if (upwardPull > 0.02) {
            stock.currentPrice = Math.max(lowerLimit, +(stock.currentPrice + upwardPull).toFixed(2));
            if (stock.currentPrice >= unhaltLowerThreshold) {
              releaseCircuitBreaker(stock);
            }
          }
        }
        recordStockHistoryPoint(stock);
        return;
      }

      // 1. Process active news transition using mathematically bounded smoothstep
      // Formula: u = clamp((t - t0) / T, 0, 1), s(u) = 3*u^2 - 2*u^3, P(t) = P0 + (PT - P0) * s(u)
      if (stock.activeTransition) {
        const elapsedMs = Date.now() - stock.activeTransition.startTimeMs;
        const durationMs = stock.activeTransition.durationMs || 45000;
        const u = Math.min(1, Math.max(0, elapsedMs / durationMs));
        const s = 3 * u * u - 2 * u * u * u;
        const smoothVal = stock.activeTransition.startPrice + (stock.activeTransition.targetPrice - stock.activeTransition.startPrice) * s;
        stock.currentPrice = +smoothVal.toFixed(2);
        if (u >= 1) {
          stock.currentPrice = stock.activeTransition.targetPrice;
          const tr = stock.activeTransition;
          stock.activeTransition = null;

          const endTimeStr = new Date().toLocaleTimeString();
          const startP = tr.startPrice || stock.dayOpenPrice;
          const endP = stock.currentPrice;
          const deltaPct = startP > 0 ? +(((endP - startP) / startP) * 100).toFixed(2) : 0;
          const isUp = deltaPct >= 0;

          const spotlightPayload = {
            ticker: stock.ticker,
            name: stock.name,
            sector: stock.sector || 'Equities',
            headline: tr.headline || 'Market Wire Reaction',
            startPrice: startP,
            startTimeStr: tr.startTimeStr || 'Earlier',
            endPrice: endP,
            endTimeStr,
            deltaPct,
            isUp,
            history: (stock.history || []).slice(-25)
          };

          broadcastAll({
            type: 'NEWS_REACTION_SPOTLIGHT',
            reaction: spotlightPayload
          });
        }

        // Bounded trajectory tracking: update high/lows and history, bypassing random drift
        if (stock.currentPrice > stock.dayHigh) stock.dayHigh = stock.currentPrice;
        if (stock.currentPrice < stock.dayLow) stock.dayLow = stock.currentPrice;
        if (!stock.week52High || isNaN(stock.week52High)) stock.week52High = +(stock.base_price * 1.25).toFixed(2);
        if (!stock.week52Low || isNaN(stock.week52Low)) stock.week52Low = +(stock.base_price * 0.75).toFixed(2);
        if (stock.currentPrice > stock.week52High) stock.week52High = stock.currentPrice;
        if (stock.currentPrice < stock.week52Low) stock.week52Low = stock.currentPrice;
        recordStockHistoryPoint(stock);
        return;
      }

      // 2. Realistic Gaussian + micro-drift + cyclical waves + mean-reversion
      // Dynamic volatility calibrated to institutional simulation: balanced, exciting, no positive bias
      const effectiveVol = Math.max(0.0035, (stock.volatility_factor || 0.004) * (stock.beta || 1.0) * 1.5);
      const gaussianComponent = gaussianRandom() * effectiveVol * stock.currentPrice * 0.45;
      // UNBIASED microDrift: Mean is exactly 0 (Math.random() - 0.50) to prevent artificial upward profit creep
      const microDrift = (Math.random() - 0.50) * effectiveVol * stock.currentPrice * 0.35;
      // Intraday cyclical sine wave creates natural swings and divergences across stocks
      const cyclicalWave = Math.cos((gameState.elapsedSeconds * (stock.trendFreq || 0.02)) + (stock.trendPhase || 0)) * effectiveVol * stock.currentPrice * 0.35;
      // Mild sentiment drift creates clear winning and losing stocks to prevent ties
      const trendDrift = (stock.sentimentBias || 0) * stock.currentPrice;
      // Gentle mean-reversion towards dayOpenPrice prevents runaway divergence
      const meanReversion = -0.00015 * (stock.currentPrice - stock.dayOpenPrice);
      const totalDrift = gaussianComponent + microDrift + cyclicalWave + trendDrift + meanReversion;

      const minBound = stock.min_price || 1;
      const maxBound = stock.max_price || 500000;
      stock.currentPrice = Math.max(minBound, Math.min(maxBound, +(stock.currentPrice + totalDrift).toFixed(2)));

      if (stock.currentPrice > stock.dayHigh) stock.dayHigh = stock.currentPrice;
      if (stock.currentPrice < stock.dayLow) stock.dayLow = stock.currentPrice;

      // 52-Week High / Low Real-Time Breakout Check & Dynamic Update
      if (!stock.week52High || isNaN(stock.week52High)) {
        stock.week52High = parseFloat(stock.fundamentals?.high_52w) || +(stock.base_price * 1.25).toFixed(2);
      }
      if (!stock.week52Low || isNaN(stock.week52Low)) {
        stock.week52Low = parseFloat(stock.fundamentals?.low_52w) || +(stock.base_price * 0.75).toFixed(2);
      }
      if (stock.currentPrice > stock.week52High) {
        stock.week52High = stock.currentPrice;
        if (!stock.fundamentals) stock.fundamentals = {};
        stock.fundamentals.high_52w = stock.currentPrice;
        stock.isNew52WHigh = true;
        stock.isNew52WLow = false;
      } else if (stock.currentPrice < stock.week52Low) {
        stock.week52Low = stock.currentPrice;
        if (!stock.fundamentals) stock.fundamentals = {};
        stock.fundamentals.low_52w = stock.currentPrice;
        stock.isNew52WLow = true;
        stock.isNew52WHigh = false;
      } else {
        stock.isNew52WHigh = false;
        stock.isNew52WLow = false;
      }

      // 3. Track history with O(1) rolling window cap (prevents fs.writeFileSync bloat)
      recordStockHistoryPoint(stock);

      // 4. Exact Integer-Paise Circuit Breaker Check & Boundary Clamping
      const curPaise = Math.round(stock.currentPrice * 100);
      const upperPaise = Math.round(upperLimit * 100);
      const lowerPaise = Math.round(lowerLimit * 100);
      if (curPaise >= upperPaise && !stock.isHalted) {
        triggerCircuitBreaker(stock, 'UPPER');
      } else if (curPaise <= lowerPaise && !stock.isHalted) {
        triggerCircuitBreaker(stock, 'LOWER');
      }
    });

    broadcastTick();
    appendSecondLog();
  }, gameState.tickIntervalMs);
}

function appendSecondLog() {
  // Sample snapshot every 5 seconds to optimize memory and disk I/O while preserving fine-grained audit records
  if (gameState.elapsedSeconds % 5 !== 0) return;
  const marketPrices = {};
  companies.forEach((s) => {
    if (s.isEnabled) marketPrices[s.ticker] = s.currentPrice;
  });
  recordAuditEvent('TICK_SNAPSHOT', { market_prices: marketPrices });
}

// ==========================================
// 6. WEBSOCKET & STATE BROADCASTERS
// ==========================================
function calculateLeaderboard() {
  return Object.values(teams).map((t) => {
    let holdingsValue = 0;
    let unrealizedPnl = 0;
    companies.forEach((c) => {
      const qty = t.holdings[c.ticker] || 0;
      const cost = t.avgBuyPrice[c.ticker] || 0;
      holdingsValue += qty * c.currentPrice;
      if (qty > 0) {
        unrealizedPnl += qty * (c.currentPrice - cost);
      }
    });
    const netWorth = +(t.cash + holdingsValue).toFixed(2);
    const pnlPct = +(((netWorth - t.startingCash) / t.startingCash) * 100).toFixed(2);
    const totalPnl = +(netWorth - t.startingCash).toFixed(2);
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
      tradeCount: t.tradeCount,
      holdings: t.holdings
    };
  }).sort((a, b) => {
    if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
    if (b.pnlPct !== a.pnlPct) return b.pnlPct - a.pnlPct;
    if (b.cash !== a.cash) return b.cash - a.cash;
    return a.tradeCount - b.tradeCount;
  });
}

function calculateTeamInvestments() {
  return Object.values(teams).map((t) => {
    let investedCost = 0;
    let holdingsMarketValue = 0;
    let distinctHoldingsCount = 0;
    const holdingsDetail = [];

    companies.forEach((c) => {
      const qty = t.holdings[c.ticker] || 0;
      if (qty > 0) {
        distinctHoldingsCount++;
        const avgPrice = t.avgBuyPrice[c.ticker] || 0;
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

    const startingCapital = t.startingCash || gameState.startingCash || 500000;
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
      username: t.username || t.id.replace('_', ''),
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
      connected: t.connected || false
    };
  });
}

function getConcludedLeaderboard() {
  const standings = calculateLeaderboard();
  return {
    first: standings[0] || null,
    second: standings[1] || null,
    third: standings[2] || null,
    fullRankings: standings,
    concludedAt: new Date().toLocaleTimeString()
  };
}

function calculateMarketIndices() {
  const enabled = companies.filter((c) => c.isEnabled !== false);
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

  const list = [
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

  return list;
}

function calculateTeamSectorAllocations() {
  const standings = calculateLeaderboard();
  return standings.map((item) => {
    const t = teams[item.id];
    if (!t) return null;
    const cash = t.cash || 0;
    let totalHoldingsVal = 0;
    const sectorValues = {};

    companies.forEach((c) => {
      const qty = t.holdings[c.ticker] || 0;
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

function generateAnchorCommentary() {
  const commentary = [];
  const standings = calculateLeaderboard();
  const allocations = calculateTeamSectorAllocations();
  const indices = calculateMarketIndices();

  if (standings.length > 0) {
    const leader = standings[0];
    const leaderAlloc = allocations.find((a) => a.teamId === leader.id);
    const topSec = leaderAlloc && Object.keys(leaderAlloc.sectorPcts)[0];
    commentary.push({
      type: 'LEADER',
      badge: '🏆 LEADER FOCUS',
      text: `${leader.name} commands 1st Place at ₹${leader.netWorth.toLocaleString('en-IN')}${topSec ? ` with heavy ${topSec} weighting (${leaderAlloc.sectorPcts[topSec]}%)` : ''}.`
    });
  }

  // High concentration check
  allocations.forEach((al) => {
    const entries = Object.entries(al.sectorPcts);
    if (entries.length > 0 && entries[0][1] >= 45) {
      commentary.push({
        type: 'CONCENTRATION',
        badge: '🎯 HIGH CONVICTION BET',
        text: `${al.teamName} has allocated ${entries[0][1]}% of their fund directly into ${entries[0][0]}.`
      });
    }
  });

  // High cash reserve check
  allocations.forEach((al) => {
    if (al.cashPct >= 40) {
      commentary.push({
        type: 'CASH',
        badge: '💰 DRY POWDER WATCH',
        text: `${al.teamName} is holding ${al.cashPct}% in pure cash (₹${al.cashAmount.toLocaleString('en-IN')}), poised for market dips.`
      });
    }
  });

  // Macro Index shift
  indices.forEach((idx) => {
    if (Math.abs(idx.changePct) >= 1.5) {
      commentary.push({
        type: 'INDEX',
        badge: idx.changePct > 0 ? '📈 INDEX RALLY' : '📉 INDEX DROP',
        text: `${idx.name} has moved ${idx.changePct > 0 ? '+' : ''}${idx.changePct}% from session open, shifting portfolio valuations.`
      });
    }
  });

  // Multi-Day Rank Movement check if previous day exists
  const prevDaySnapshot = gameState.dailyLeaderboards && gameState.dailyLeaderboards[`day_${gameState.currentDay - 1}`];
  if (prevDaySnapshot && prevDaySnapshot.rankings) {
    standings.slice(0, 5).forEach((curr, idx) => {
      const prevIdx = prevDaySnapshot.rankings.findIndex((r) => r.teamId === curr.id);
      if (prevIdx !== -1) {
        const delta = (prevIdx + 1) - (idx + 1); // positive = moved up
        if (delta >= 2) {
          commentary.push({
            type: 'MOMENTUM',
            badge: '🚀 RANK SURGE',
            text: `${curr.name} has surged +${delta} spots on the leaderboard today into Rank #${idx + 1}!`
          });
        }
      }
    });
  }

  return commentary.slice(0, 6);
}

function getSanitizedPublicState(role, teamId) {
  const enabledStocks = companies.filter((c) => c.isEnabled !== false);
  const marketIndices = calculateMarketIndices();
  const teamSectorAllocations = calculateTeamSectorAllocations();
  const isHost = role === 'HOST';

  // Sanitize newsHistory: strip private 'impacts' from non-host screens
  const sanitizedNewsHistory = gameState.newsHistory.map((n) => {
    if (isHost) return n;
    const clean = { ...n };
    delete clean.impacts;
    return clean;
  });

  const payload = {
    type: 'TICK_UPDATE',
    eventId: gameState.eventId,
    stateVersion: gameState.stateVersion,
    scenarioMode: activeScenarioMode,
    serverTimeMs: Date.now(),
    soundConsoleConnected: soundClients.size > 0,
    marketIndices,
    teamSectorAllocations,
    gameState: {
      eventId: gameState.eventId,
      stateVersion: gameState.stateVersion,
      isReset: !!gameState.isReset,
      resetMessage: gameState.resetMessage || null,
      title: gameState.title,
      subtitle: gameState.subtitle || '',
      institution: gameState.institution || '',
      status: gameState.status || (gameState.isPaused ? 'PAUSED' : 'LIVE'),
      configLocked: !!gameState.configLocked,
      startMode: gameState.startMode || 'IMMEDIATE',
      scheduledStartTime: gameState.scheduledStartTime,
      pausePolicy: gameState.pausePolicy || 'TRADING_TIME',
      currentDay: gameState.currentDay,
      totalDays: gameState.totalDays,
      dayDurationSeconds: gameState.dayDurationSeconds,
      startingCash: gameState.startingCash,
      elapsedSeconds: gameState.elapsedSeconds,
      isPaused: gameState.isPaused,
      pauseMode: gameState.pauseMode,
      totalShiftOffsetSeconds: gameState.totalShiftOffsetSeconds,
      circuitBreakerPercent: gameState.circuitBreakerPercent,
      transactionFeeBps: gameState.transactionFeeBps,
      newsHistory: sanitizedNewsHistory,
      isConcluded: gameState.isConcluded,
      winnerData: gameState.winnerData,
      activeCountdown: gameState.activeCountdown,
      audioSettings: gameState.audioSettings,
      presentationState: gameState.presentationState,
      projectorState: gameState.projectorState,
      dailyLeaderboards: gameState.dailyLeaderboards,
      marketIndices,
      teamSectorAllocations
    },
    companies: enabledStocks.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      exchange: c.exchange || 'NSE',
      currency: c.currency || 'INR',
      base_price: c.base_price,
      currentPrice: c.currentPrice,
      dayOpenPrice: c.dayOpenPrice,
      dayHigh: c.dayHigh,
      dayLow: c.dayLow,
      week52High: c.week52High || (c.fundamentals && parseFloat(c.fundamentals.high_52w)) || +(c.base_price * 1.25).toFixed(2),
      week52Low: c.week52Low || (c.fundamentals && parseFloat(c.fundamentals.low_52w)) || +(c.base_price * 0.75).toFixed(2),
      isNew52WHigh: !!(c.isNew52WHigh || c.currentPrice >= (c.week52High || 999999)),
      isNew52WLow: !!(c.isNew52WLow || c.currentPrice <= (c.week52Low || 0)),
      lot_presets: c.lot_presets,
      ...(isHost ? { beta: c.beta, volatility_factor: c.volatility_factor } : {}),
      isHalted: c.isHalted,
      haltDirection: c.haltDirection,
      fundamentals: c.fundamentals,
      history: c.history.slice(-180),
      multiDayHistory: (c.multiDayHistory || c.history || []).slice(-540),
      historyByDay: c.historyByDay || {}
    }))
  };

  if (role === 'TRADER' && teams[teamId]) {
    const t = teams[teamId];
    let holdingsValue = 0;
    let unrealizedPnl = 0;
    companies.forEach((c) => {
      const qty = t.holdings[c.ticker] || 0;
      const cost = t.avgBuyPrice[c.ticker] || 0;
      holdingsValue += qty * c.currentPrice;
      if (qty > 0) {
        unrealizedPnl += qty * (c.currentPrice - cost);
      }
    });
    const netWorth = +(t.cash + holdingsValue).toFixed(2);
    const pnlPct = +(((netWorth - t.startingCash) / t.startingCash) * 100).toFixed(2);

    payload.portfolio = {
      ...t,
      holdingsValue: +holdingsValue.toFixed(2),
      netWorth,
      pnlPct,
      unrealizedPnl: +unrealizedPnl.toFixed(2)
    };
    payload.teamTrades = executedTrades
      .filter((tr) => tr.teamId === teamId)
      .slice(-30)
      .reverse();
  }

  if (role === 'HOST') {
    payload.leaderboard = calculateLeaderboard();
    payload.newsEvents = newsEvents;
    payload.anchorCommentary = generateAnchorCommentary();
    payload.marketIndices = marketIndices;
    payload.teamSectorAllocations = teamSectorAllocations;
    payload.projectorState = gameState.projectorState;
    payload.dailyLeaderboards = gameState.dailyLeaderboards;
    // Host receives all scheduled news with individual publication countdowns and statuses
    payload.allScheduledNews = newsEvents.map((ev) => {
      let status = 'SCHEDULED';
      let appearsInSeconds = 0;
      const evDay = ev.day || 1;
      if (ev.cancelled) {
        status = 'CANCELLED';
      } else if (ev.triggered) {
        status = 'PUBLISHED';
        appearsInSeconds = 0;
      } else if (evDay < gameState.currentDay) {
        status = 'CONCLUDED';
        appearsInSeconds = 0;
      } else if (evDay > gameState.currentDay) {
        status = 'FUTURE_DAY';
        appearsInSeconds = ev.trigger_second || 0;
      } else {
        // Current active competition day
        status = 'SCHEDULED';
        appearsInSeconds = Math.max(0, (ev.trigger_second || 0) - gameState.elapsedSeconds);
      }
      let estimatedWallClock = null;
      if (status === 'SCHEDULED' && appearsInSeconds > 0) {
        estimatedWallClock = (new Date(Date.now() + appearsInSeconds * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) + ' IST').toUpperCase();
      }
      return {
        ...ev,
        status,
        appearsInSeconds,
        estimatedWallClock,
        publishedWallClock: ev.publishedWallClock || null
      };
    });
    payload.finalResultsSnapshot = gameState.finalResultsSnapshot;
    payload.soundClientsCount = soundClients.size;
    payload.recentTrades = executedTrades.slice(-25).reverse();
    // Complete share universe for Host Share Universe Manager
    payload.allCompaniesUniverse = companies.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      base_price: c.base_price,
      currentPrice: c.currentPrice,
      dayOpenPrice: c.dayOpenPrice,
      dayHigh: c.dayHigh,
      dayLow: c.dayLow,
      week52High: c.week52High || (c.fundamentals && parseFloat(c.fundamentals.high_52w)) || +(c.base_price * 1.25).toFixed(2),
      week52Low: c.week52Low || (c.fundamentals && parseFloat(c.fundamentals.low_52w)) || +(c.base_price * 0.75).toFixed(2),
      isNew52WHigh: !!(c.isNew52WHigh || c.currentPrice >= (c.week52High || 999999)),
      isNew52WLow: !!(c.isNew52WLow || c.currentPrice <= (c.week52Low || 0)),
      beta: c.beta,
      volatility_factor: c.volatility_factor,
      lot_presets: c.lot_presets,
      isEnabled: c.isEnabled !== false,
      isHalted: c.isHalted,
      haltDirection: c.haltDirection,
      fundamentals: c.fundamentals
    }));
    payload.allTeamsList = Object.values(teams).map((t) => {
      const u = t.username || t.id.replace('_', '');
      return {
        id: t.id,
        username: u,
        name: t.name,
        members: t.members || '',
        password: USERS[u] ? USERS[u].password : `trade${t.id.replace('team_', '')}00`,
        startingCash: t.startingCash,
        cash: t.cash,
        tradeCount: t.tradeCount
      };
    });
    payload.teamInvestments = calculateTeamInvestments();
  }

  if (role === 'PROJECTOR') {
    payload.leaderboard = calculateLeaderboard(); // Full leaderboard for Projector sceneLeaderboard
    payload.cumulativeLeaderboard = calculateLeaderboard();
    const curDaySnap = gameState.dailyLeaderboards && gameState.dailyLeaderboards[`day_${gameState.currentDay}`];
    payload.dailyLeaderboard = curDaySnap ? (curDaySnap.dailyRankings || curDaySnap.rankings) : null;
    payload.dailySnapshots = gameState.dailyLeaderboards;
    payload.marketIndices = marketIndices;
    payload.teamSectorAllocations = teamSectorAllocations;
    payload.projectorState = gameState.projectorState;
    payload.teamInvestmentSummaries = calculateTeamInvestments().map((t) => ({
      id: t.id,
      name: t.name,
      portfolioValue: t.portfolioValue,
      availableCash: t.availableCash,
      investedCost: t.investedCost,
      holdingsMarketValue: t.holdingsMarketValue,
      returnPct: t.returnPct,
      distinctHoldingsCount: t.distinctHoldingsCount
    }));
    payload.finalResultsSnapshot = gameState.finalResultsSnapshot || (gameState.isConcluded ? generateOfficialResultsSnapshot() : null);
    payload.presentationState = gameState.presentationState;
  }

  if (role === 'WINNER_DISPLAY') {
    payload.finalResultsSnapshot = gameState.finalResultsSnapshot || (gameState.isConcluded ? generateOfficialResultsSnapshot() : null);
    payload.presentationState = gameState.presentationState;
  }

  if (role === 'SOUND_CONSOLE') {
    payload.audioSettings = gameState.audioSettings;
  }

  return payload;
}

function broadcastAudioCue(cueName, category = 'lifecycle', metadata = {}) {
  const cueId = `CUE_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const vol = (gameState.audioSettings && gameState.audioSettings.masterVolume !== undefined)
    ? gameState.audioSettings.masterVolume
    : 85;

  const payload = {
    type: 'AUDIO_CUE',
    cueId,
    cueName,
    category,
    volume: vol,
    serverTimeMs: Date.now(),
    metadata
  };

  if (soundClients.size > 0) {
    soundClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
    // Explicit Host self-test cues also dispatch to HOST sockets for immediate feedback
    if (metadata && metadata.isTest) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.session && client.session.role === 'HOST') {
          client.send(JSON.stringify(payload));
        }
      });
    }
  } else {
    // Fallback: If no dedicated sound console is attached, dispatch only to HOST terminals
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.session && client.session.role === 'HOST') {
        client.send(JSON.stringify(payload));
      }
    });
  }

  recordAuditEvent('AUDIO_CUE_DISPATCHED', { cueId, cueName, category });
  return cueId;
}

function startResumeCountdown(triggeredBy = 'HOST') {
  if (!gameState.configLocked || gameState.status === 'SETUP' || gameState.status === 'RESET') {
    return { ok: false, reason: 'Cannot start or resume trading: Event configuration is incomplete. Complete and lock event setup first.' };
  }
  if (gameState.activeCountdown) {
    return { ok: false, reason: 'A resume countdown is already active in progress' };
  }
  if (gameState.status === 'DAY_COMPLETED') {
    return { ok: false, reason: `Day ${gameState.currentDay} has ended. Trading cannot be resumed. Review the results and prepare the next day.` };
  }
  if (gameState.isConcluded) {
    return { ok: false, reason: 'Cannot resume: The championship is already concluded.' };
  }
  if (!gameState.isPaused && gameState.status !== 'STANDBY' && gameState.status !== 'SCHEDULED') {
    return { ok: false, reason: 'Trading is already active. Market is running live.' };
  }

  const now = Date.now();
  const durationMs = 3000;
  const targetServerTimeMs = now + durationMs;
  const countdownId = `CD_${now}`;

  gameState.activeCountdown = {
    id: countdownId,
    type: 'RESUME',
    seconds: 3,
    startServerTimeMs: now,
    targetServerTimeMs,
    totalDurationMs: durationMs
  };
  gameState.status = 'COUNTDOWN';
  syncDerivedStateFlags(gameState);

  const pausedDurationSec = gameState.pauseStartedAt
    ? Math.round((now - gameState.pauseStartedAt) / 1000)
    : 0;

  if (gameState.pausePolicy !== 'ELAPSED_TIME') {
    gameState.totalShiftOffsetSeconds += pausedDurationSec;
  }

  broadcastAudioCue('countdown_tick', 'lifecycle', { countdownId, second: 3 });

  broadcastAll({
    type: 'COUNTDOWN_START',
    countdownId,
    seconds: 3,
    startServerTimeMs: now,
    targetServerTimeMs,
    serverTimeMs: now
  });
  broadcastTick();
  broadcastPublicEventStatus();

  if (activeCountdownTimer) clearTimeout(activeCountdownTimer);

  activeCountdownTimer = setTimeout(() => {
    activeCountdownTimer = null;
    if (gameState.status === 'DAY_COMPLETED' || gameState.isConcluded) {
      return;
    }
    gameState.activeCountdown = null;
    gameState.status = 'LIVE';
    gameState.pauseMode = 'NONE';
    gameState.pauseStartedAt = null;
    syncDerivedStateFlags(gameState);

    recordAuditEvent('MARKET_RESUMED', {
      triggered_by: triggeredBy,
      countdown_id: countdownId,
      shift_offset_applied_seconds: pausedDurationSec,
      cumulative_shift_offset_seconds: gameState.totalShiftOffsetSeconds
    });

    if (gameState.elapsedSeconds === 0) {
      broadcastAudioCue('bell_open', 'lifecycle', { day: gameState.currentDay });
      broadcastAll({ type: 'BELL_EVENT', bell: 'OPEN', day: gameState.currentDay });
    }

    broadcastAll({
      type: 'COUNTDOWN_FINISH',
      countdownId,
      serverTimeMs: Date.now()
    });
    broadcastAll({ type: 'MARKET_RESUMED' });
    broadcastTick();
    broadcastPublicEventStatus();
  }, durationMs);

  return { ok: true, countdownId, targetServerTimeMs };
}

function generateOfficialResultsSnapshot() {
  const standings = calculateLeaderboard();
  const snapshotId = `SNAP_${Date.now()}`;
  const closingPrices = {};
  companies.forEach((c) => {
    closingPrices[c.ticker] = c.currentPrice;
  });

  const teamAnalysis = standings.map((item, idx) => {
    const t = teams[item.id] || {};
    const startingCash = t.startingCash || gameState.startingCash || 500000;
    const finalCash = +(t.cash || 0).toFixed(2);
    let holdingsValue = 0;
    let unrealizedPnl = 0;
    const holdingsBreakdown = [];

    companies.forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      const cost = (t.avgBuyPrice && t.avgBuyPrice[c.ticker]) || 0;
      const val = +(qty * c.currentPrice).toFixed(2);
      holdingsValue += val;
      if (qty > 0) {
        const uPnl = +(qty * (c.currentPrice - cost)).toFixed(2);
        unrealizedPnl += uPnl;
        holdingsBreakdown.push({
          ticker: c.ticker,
          name: c.name,
          quantity: qty,
          avgBuyPrice: cost,
          closingPrice: c.currentPrice,
          marketValue: val,
          unrealizedPnl: uPnl
        });
      }
    });

    holdingsValue = +holdingsValue.toFixed(2);
    const finalPortfolioValue = +(finalCash + holdingsValue).toFixed(2);
    const netProfitOrLoss = +(finalPortfolioValue - startingCash).toFixed(2);
    const returnPct = +((netProfitOrLoss / startingCash) * 100).toFixed(2);

    const teamTrades = executedTrades.filter((tr) => tr.teamId === item.id);
    const buys = teamTrades.filter((tr) => tr.type === 'BUY');
    const sells = teamTrades.filter((tr) => tr.type === 'SELL');
    let totalInvested = 0;
    let totalSalesValue = 0;
    let totalFees = 0;
    buys.forEach((b) => { totalInvested += b.grossValue || 0; totalFees += b.fee || 0; });
    sells.forEach((s) => { totalSalesValue += s.grossValue || 0; totalFees += s.fee || 0; });

    let summaryText = '';
    if (returnPct > 15) {
      summaryText = `Outstanding aggressive alpha generation with +${returnPct}% return. Mastered market momentum and volatility.`;
    } else if (returnPct > 0) {
      summaryText = `Disciplined profitable performance gaining +₹${netProfitOrLoss.toLocaleString('en-IN')} (+${returnPct}%). Strong risk balance.`;
    } else if (returnPct === 0) {
      summaryText = `Neutral capital preservation. Retained 100% principal safe without portfolio drawdown.`;
    } else {
      summaryText = `Defensive capital drawdown of ${returnPct}%. Impacted by late market price corrections.`;
    }

    return {
      rank: idx + 1,
      teamId: item.id,
      teamName: item.name,
      members: item.members,
      startingCash,
      finalCash,
      holdingsValue,
      finalPortfolioValue,
      netProfitOrLoss,
      returnPct,
      tradeCount: teamTrades.length,
      buyCount: buys.length,
      sellCount: sells.length,
      totalInvested: +totalInvested.toFixed(2),
      totalSalesValue: +totalSalesValue.toFixed(2),
      totalFees: +totalFees.toFixed(2),
      realizedPnl: +(t.realizedPnl || 0).toFixed(2),
      unrealizedPnl: +unrealizedPnl.toFixed(2),
      holdingsBreakdown,
      summaryText
    };
  });

  const snapshot = {
    snapshotId,
    generatedAt: new Date().toISOString(),
    eventTitle: gameState.title,
    closingDay: gameState.currentDay,
    totalTeams: teamAnalysis.length,
    closingPrices,
    champion: teamAnalysis[0] || null,
    runnerUp: teamAnalysis[1] || null,
    thirdPlace: teamAnalysis[2] || null,
    rankings: teamAnalysis,
    teams: teamAnalysis
  };

  gameState.finalResultsSnapshot = snapshot;
  return snapshot;
}

function broadcastTick() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.session) {
      const data = getSanitizedPublicState(client.session.role, client.session.id);
      client.send(JSON.stringify(data));
    }
  });
}

function broadcastAll(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcastPublicEventStatus() {
  const publicLocked = !!gameState.configLocked;
  const payload = JSON.stringify({
    type: 'PUBLIC_EVENT_STATUS',
    eventId: gameState.eventId,
    stateVersion: gameState.stateVersion,
    isReset: !!gameState.isReset,
    resetMessage: gameState.resetMessage || null,
    status: gameState.status,
    configLocked: publicLocked,
    title: gameState.title,
    subtitle: gameState.subtitle,
    institution: gameState.institution,
    currentDay: gameState.currentDay,
    totalDays: gameState.totalDays,
    elapsedSeconds: gameState.elapsedSeconds,
    isPaused: !!gameState.isPaused,
    isConcluded: !!gameState.isConcluded
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (e) {}
    }
  });
}

// ==========================================
// 7. WEBSOCKET MESSAGE ROUTER
// ==========================================
wss.on('connection', (ws) => {
  // Push authoritative public event access status immediately upon socket connection
  const publicLocked = !!gameState.configLocked;
  try {
    ws.send(JSON.stringify({
      type: 'PUBLIC_EVENT_STATUS',
      eventId: gameState.eventId,
      stateVersion: gameState.stateVersion,
      isReset: !!gameState.isReset,
      resetMessage: gameState.resetMessage || null,
      status: gameState.status,
      configLocked: publicLocked,
      title: gameState.title,
      subtitle: gameState.subtitle,
      institution: gameState.institution,
      currentDay: gameState.currentDay,
      totalDays: gameState.totalDays,
      elapsedSeconds: gameState.elapsedSeconds,
      isPaused: !!gameState.isPaused,
      isConcluded: !!gameState.isConcluded
    }));
  } catch (e) {}

  ws.on('message', (rawMessage) => {
    let data;
    try {
      data = JSON.parse(rawMessage);
    } catch (e) {
      return;
    }

    // --- 1. LOGIN ---
    if (data.action === 'LOGIN') {
      const usernameKey = (data.username || '').trim().toLowerCase();
      const userRecord = USERS[usernameKey];

      if (!userRecord || userRecord.password !== data.password) {
        ws.send(JSON.stringify({ type: 'LOGIN_ERROR', message: 'Invalid terminal credentials.' }));
        return;
      }

      // TRADER login gating: Teams cannot log in until host completes and locks event setup
      if (userRecord.role === 'TRADER' && !gameState.configLocked) {
        ws.send(JSON.stringify({
          type: 'LOGIN_ERROR',
          message: 'The host is preparing the event. Team login will open once setup is complete.'
        }));
        return;
      }

      const token = crypto.randomBytes(16).toString('hex');
      const sessionObj = {
        token,
        role: userRecord.role,
        id: userRecord.id,
        name: userRecord.name,
        username: userRecord.username,
        members: userRecord.members || '',
        lastOrderAt: 0
      };

      sessions.set(token, sessionObj);
      ws.session = sessionObj;

      if (sessionObj.role === 'SOUND_CONSOLE') {
        soundClients.add(ws);
        recordAuditEvent('SOUND_CONSOLE_ATTACHED', { id: sessionObj.id });
      }

      recordAuditEvent('CLIENT_LOGIN', { role: sessionObj.role, id: sessionObj.id });

      ws.send(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        session_token: token,
        role: sessionObj.role,
        id: sessionObj.id,
        name: sessionObj.name,
        members: sessionObj.members,
        initialState: getSanitizedPublicState(sessionObj.role, sessionObj.id)
      }));
      return;
    }

    // --- 2. RESUME SESSION ---
    if (data.action === 'RESUME_SESSION') {
      const existing = sessions.get(data.session_token);
      if (!existing) {
        ws.send(JSON.stringify({ type: 'SESSION_EXPIRED' }));
        return;
      }

      // TRADER session gating: Reject resumed sessions if host has reset or unlocked setup
      if (existing.role === 'TRADER' && !gameState.configLocked) {
        sessions.delete(data.session_token);
        ws.send(JSON.stringify({
          type: 'LOGIN_ERROR',
          message: 'The host is preparing the event. Team login will open once setup is complete.'
        }));
        return;
      }

      ws.session = existing;
      if (existing.role === 'SOUND_CONSOLE') {
        soundClients.add(ws);
      }
      ws.send(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        session_token: existing.token,
        role: existing.role,
        id: existing.id,
        name: existing.name,
        members: existing.members || '',
        initialState: getSanitizedPublicState(existing.role, existing.id)
      }));
      return;
    }

    // --- 3. LOGOUT ---
    if (data.action === 'LOGOUT') {
      if (ws.session) {
        if (ws.session.role === 'SOUND_CONSOLE') {
          soundClients.delete(ws);
        }
        sessions.delete(ws.session.token);
        recordAuditEvent('CLIENT_LOGOUT', { role: ws.session.role, id: ws.session.id });
        ws.session = null;
      }
      ws.send(JSON.stringify({ type: 'LOGOUT_SUCCESS' }));
      return;
    }

    const session = sessions.get(data.session_token);
    if (!session) {
      ws.send(JSON.stringify({
        type: 'ORDER_REJECTED',
        reason: '🔒 Unauthorized or expired session: Your trading session has expired. Please log in again.'
      }));
      return;
    }

    if (data.action === 'GET_STATE' || data.action === 'REQUEST_STATE' || data.action === 'HOST_GET_STATE') {
      const state = getSanitizedPublicState(session.role, session.id);
      ws.send(JSON.stringify(state));
      return;
    }

    if (data.action === 'ORDER' && session.role === 'TRADER') {
      if (!canExecuteTrades(gameState)) {
        const reason = gameState.status === 'DAY_COMPLETED'
          ? `🔔 Day ${gameState.currentDay} trading has concluded. All portfolios are locked until the Host opens Day ${gameState.currentDay + 1}.`
          : gameState.isConcluded
          ? '🏆 Championship trading has concluded. All portfolios and standings are finalized.'
          : '⏸️ Market is currently paused or championship concluded. Trading is paused right now by the host. Please wait for the floor to resume.';
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason
        }));
        return;
      }

      const team = teams[session.id];
      if (!team) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: `⚠️ Team account error: Profile '${session.id}' was not found in the active team database.` }));
        return;
      }

      // Authoritative Team-Level + Session-Level 200ms Anti-Spam Debounce (Blocks Multi-Tab Circumvention)
      const nowMs = Date.now();
      session.lastOrderAtByTicker = session.lastOrderAtByTicker || {};
      team.lastOrderAtByTicker = team.lastOrderAtByTicker || {};
      const tickerKey = (data.ticker || 'GLOBAL').toUpperCase().trim();
      const lastSessionTickerOrder = session.lastOrderAtByTicker[tickerKey] || 0;
      const lastTeamTickerOrder = team.lastOrderAtByTicker[tickerKey] || 0;

      if (nowMs - lastSessionTickerOrder < 200 || nowMs - lastTeamTickerOrder < 200) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason: '⏳ Order rate limit exceeded: Please wait a moment between placing trades. A 200ms anti-spam protection delay protects against accidental double orders.'
        }));
        return;
      }
      session.lastOrderAtByTicker[tickerKey] = nowMs;
      session.lastOrderAt = nowMs;
      team.lastOrderAtByTicker[tickerKey] = nowMs;
      team.lastOrderAt = nowMs;

      const stock = companies.find((c) => c.ticker === tickerKey);
      const qty = parseInt(data.quantity, 10);

      if (!stock) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: `⚠️ Stock not found: Symbol '${data.ticker}' does not exist in the active trading universe.` }));
        return;
      }

      if (isNaN(qty) || qty <= 0) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: `⚠️ Invalid order quantity: Please enter a whole positive number of shares (minimum 1 share). You submitted '${data.quantity}'.` }));
        return;
      }

      if (qty > 1000000) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: `⚠️ Order exceeds maximum limit: Maximum single trade size is 10,00,000 shares. You submitted ${qty.toLocaleString('en-IN')} shares.` }));
        return;
      }

      // Check if stock is enabled in universe
      if (stock.isEnabled === false) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason: `Trading is not enabled for ${stock.ticker} in this market universe. The host has marked this company as inactive.`
        }));
        return;
      }

      const orderSide = (data.type || data.orderType || data.side || (data.action === 'ORDER_BUY' ? 'BUY' : data.action === 'ORDER_SELL' ? 'SELL' : '')).toUpperCase();
      const upperLimit = +(stock.dayOpenPrice * (1 + gameState.circuitBreakerPercent / 100)).toFixed(2);
      const lowerLimit = +(stock.dayOpenPrice * (1 - gameState.circuitBreakerPercent / 100)).toFixed(2);

      if (stock.isHalted) {
        if (stock.haltDirection === 'UPPER' && orderSide === 'BUY') {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Upper circuit ceiling reached (₹${stock.currentPrice.toFixed(2)}). Buying is restricted under market rules. Selling is permitted.`
          }));
          return;
        }
        if (stock.haltDirection === 'LOWER' && orderSide === 'SELL') {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Lower circuit floor reached (₹${stock.currentPrice.toFixed(2)}). Selling is restricted under market rules. Buying is permitted.`
          }));
          return;
        }
        if (!stock.haltDirection || stock.haltDirection === 'BOTH' || stock.haltDirection === 'CIRCUIT' || stock.haltDirection === 'HALT') {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Trading in ${stock.ticker} is currently halted under circuit breaker / regulatory restrictions.`
          }));
          return;
        }
      }

      const execPrice = stock.currentPrice;
      const grossValue = +(execPrice * qty).toFixed(2);
      const feeBps = gameState.transactionFeeBps || 0;
      const feeAmount = +((grossValue * feeBps) / 10000).toFixed(2);
      const cashBefore = +team.cash.toFixed(2);

      if (orderSide === 'BUY') {
        const totalDeduction = +(grossValue + feeAmount).toFixed(2);
        if (team.cash < totalDeduction) {
          const shortfall = +(totalDeduction - team.cash).toFixed(2);
          const costPerUnit = execPrice * (1 + feeBps / 10000);
          const maxAffordable = Math.max(0, Math.floor(team.cash / costPerUnit));
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Insufficient cash. Needed ₹${totalDeduction.toLocaleString('en-IN')} (incl. ₹${feeAmount} fee), available ₹${team.cash.toLocaleString('en-IN')}. Shortfall: ₹${shortfall.toLocaleString('en-IN')}. Maximum shares you can afford: ${maxAffordable}.`
          }));
          return;
        }

        const prevQty = team.holdings[stock.ticker] || 0;
        const prevCost = prevQty * (team.avgBuyPrice[stock.ticker] || 0);
        team.cash = +(team.cash - totalDeduction).toFixed(2);
        team.holdings[stock.ticker] = prevQty + qty;
        team.avgBuyPrice[stock.ticker] = +((prevCost + grossValue) / (prevQty + qty)).toFixed(2);
        team.tradeCount++;

        // Dynamic market impact (order flow buying pressure)
        const buyImpact = +(Math.max(0.15, stock.currentPrice * Math.min(0.005, Math.max(0.0003, (qty / 50) * 0.001)))).toFixed(2);
        const candidatePrice = +(stock.currentPrice + buyImpact).toFixed(2);
        if (candidatePrice >= upperLimit) {
          stock.currentPrice = upperLimit;
          if (!stock.isHalted) {
            triggerCircuitBreaker(stock, 'UPPER');
          }
        } else {
          stock.currentPrice = Math.min(stock.max_price || 500000, candidatePrice);
        }
        if (stock.currentPrice > stock.dayHigh) stock.dayHigh = stock.currentPrice;
        if (stock.currentPrice > stock.week52High) {
          stock.week52High = stock.currentPrice;
          if (!stock.fundamentals) stock.fundamentals = {};
          stock.fundamentals.high_52w = stock.currentPrice;
          stock.isNew52WHigh = true;
          stock.isNew52WLow = false;
        }

        // Circuit Recovery: If stock was at lower limit and buying pressure lifts it above floor, unhalt
        if (stock.isHalted && stock.haltDirection === 'LOWER' && stock.currentPrice > lowerLimit) {
          releaseCircuitBreaker(stock);
        }

        tradeSeqCounter++;
        const tradeRecord = {
          tradeId: crypto.randomUUID(),
          seq: tradeSeqCounter,
          timestamp: new Date().toLocaleTimeString(),
          exactIso: new Date().toISOString(),
          day: gameState.currentDay,
          second: gameState.elapsedSeconds,
          teamId: team.id,
          teamName: team.name,
          type: 'BUY',
          ticker: stock.ticker,
          quantity: qty,
          price: execPrice,
          grossValue,
          fee: feeAmount,
          totalImpact: totalDeduction,
          cashBefore,
          cashAfter: team.cash
        };
        executedTrades.push(tradeRecord);

        recordAuditEvent('ORDER_EXECUTE', { team_id: team.id, trade_record: tradeRecord });

        ws.send(JSON.stringify({
          type: 'ORDER_FILLED',
          orderType: 'BUY',
          ticker: stock.ticker,
          quantity: qty,
          price: execPrice,
          grossValue,
          fee: feeAmount,
          totalImpact: totalDeduction,
          cashAfter: team.cash,
          holdings: team.holdings[stock.ticker]
        }));

        broadcastTick();
        return;
      } else if (orderSide === 'SELL') {
        const currentHolding = team.holdings[stock.ticker] || 0;
        if (currentHolding < qty) {
          const shortfallShares = qty - currentHolding;
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Insufficient shares. You hold ${currentHolding} of ${stock.ticker}, tried to sell ${qty}. Shortfall: ${shortfallShares} shares. You cannot sell more shares than you own.`
          }));
          return;
        }

        const avgCost = team.avgBuyPrice[stock.ticker] || 0;
        const profitOnSold = +(qty * (execPrice - avgCost)).toFixed(2);
        const netCredit = +(grossValue - feeAmount).toFixed(2);

        team.cash = +(team.cash + netCredit).toFixed(2);
        team.holdings[stock.ticker] = currentHolding - qty;
        team.realizedPnl = +(team.realizedPnl + profitOnSold - feeAmount).toFixed(2);
        if (team.holdings[stock.ticker] === 0) team.avgBuyPrice[stock.ticker] = 0;
        team.tradeCount++;

        // Dynamic market impact (order flow selling pressure)
        const sellImpact = +(Math.max(0.15, stock.currentPrice * Math.min(0.005, Math.max(0.0003, (qty / 50) * 0.001)))).toFixed(2);
        const candidatePrice = +(stock.currentPrice - sellImpact).toFixed(2);
        if (candidatePrice <= lowerLimit) {
          stock.currentPrice = lowerLimit;
          if (!stock.isHalted) {
            triggerCircuitBreaker(stock, 'LOWER');
          }
        } else {
          stock.currentPrice = Math.max(stock.min_price || 1, candidatePrice);
        }
        if (stock.currentPrice < stock.dayLow) stock.dayLow = stock.currentPrice;
        if (stock.currentPrice < stock.week52Low) {
          stock.week52Low = stock.currentPrice;
          if (!stock.fundamentals) stock.fundamentals = {};
          stock.fundamentals.low_52w = stock.currentPrice;
          stock.isNew52WLow = true;
          stock.isNew52WHigh = false;
        }

        // Circuit Recovery: If stock was at upper limit and selling pressure drops it below ceiling, unhalt
        if (stock.isHalted && stock.haltDirection === 'UPPER' && stock.currentPrice < upperLimit) {
          releaseCircuitBreaker(stock);
        }

        tradeSeqCounter++;
        const tradeRecord = {
          tradeId: crypto.randomUUID(),
          seq: tradeSeqCounter,
          timestamp: new Date().toLocaleTimeString(),
          exactIso: new Date().toISOString(),
          day: gameState.currentDay,
          second: gameState.elapsedSeconds,
          teamId: team.id,
          teamName: team.name,
          type: 'SELL',
          ticker: stock.ticker,
          quantity: qty,
          price: execPrice,
          grossValue,
          fee: feeAmount,
          totalImpact: netCredit,
          cashBefore,
          cashAfter: team.cash
        };
        executedTrades.push(tradeRecord);

        recordAuditEvent('ORDER_EXECUTE', { team_id: team.id, trade_record: tradeRecord });

        ws.send(JSON.stringify({
          type: 'ORDER_FILLED',
          orderType: 'SELL',
          ticker: stock.ticker,
          quantity: qty,
          price: execPrice,
          grossValue,
          fee: feeAmount,
          totalImpact: netCredit,
          cashAfter: team.cash,
          holdings: team.holdings[stock.ticker]
        }));

        broadcastTick();
        return;
      }
      return;
    }

    // --- 4.1 TRADER LIQUIDATE ENTIRE PORTFOLIO (SELL ALL HELD SHARES) ---
    if (data.action === 'LIQUIDATE_ALL' && session.role === 'TRADER') {
      if (!canExecuteTrades(gameState)) {
        const reason = gameState.status === 'DAY_COMPLETED'
          ? `🔔 Day ${gameState.currentDay} trading has concluded. All portfolios are locked until the Host opens Day ${gameState.currentDay + 1}.`
          : gameState.isConcluded
          ? '🏆 Championship trading has concluded. All portfolios and standings are finalized.'
          : '⏸️ Market is currently paused or championship concluded. Trading is paused right now by the host. Please wait for the floor to resume.';
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason
        }));
        return;
      }

      const team = teams[session.id];
      if (!team) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: `⚠️ Team account error: Profile '${session.id}' was not found in the active team database.` }));
        return;
      }

      const nowMs = Date.now();
      if (nowMs - (session.lastOrderAt || 0) < 200 || nowMs - (team.lastOrderAt || 0) < 200) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason: '⏳ Order rate limit exceeded: Please wait a moment between placing trades. A 200ms anti-spam protection delay protects against accidental double orders.'
        }));
        return;
      }
      session.lastOrderAt = nowMs;
      team.lastOrderAt = nowMs;

      // Identify all held shares with qty > 0
      const activeHoldings = Object.entries(team.holdings || {}).filter(([ticker, q]) => q > 0);
      if (activeHoldings.length === 0) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason: `💼 No active holdings to sell: Your portfolio already holds 100% Cash in Hand (₹${team.cash.toLocaleString('en-IN')}). Buy shares from the Market Desk first.`
        }));
        return;
      }

      const feeBps = gameState.transactionFeeBps || 0;
      const liquidatedTrades = [];
      const skippedHalted = [];
      let totalNetCredit = 0;
      let totalFeesCharged = 0;

      for (const [ticker, qty] of activeHoldings) {
        const stock = companies.find((c) => c.ticker === ticker);
        if (!stock) continue;

        // Respect directional circuit breakers: Upper circuit (+20%) permits SELL; Lower circuit (-20%) blocks SELL!
        if (stock.isHalted && stock.haltDirection !== 'UPPER') {
          skippedHalted.push({
            ticker: stock.ticker,
            name: stock.name,
            qty,
            reason: `Circuit Breaker Halted (${stock.haltDirection || 'LOWER'}) - Selling restricted under circuit floor`
          });
          continue;
        }

        const upperLimit = +(stock.dayOpenPrice * (1 + gameState.circuitBreakerPercent / 100)).toFixed(2);
        const lowerLimit = +(stock.dayOpenPrice * (1 - gameState.circuitBreakerPercent / 100)).toFixed(2);

        const execPrice = stock.currentPrice;
        const grossValue = +(execPrice * qty).toFixed(2);
        const feeAmount = +((grossValue * feeBps) / 10000).toFixed(2);
        const netCredit = +(grossValue - feeAmount).toFixed(2);
        const avgCost = team.avgBuyPrice[stock.ticker] || 0;
        const profitOnSold = +(qty * (execPrice - avgCost)).toFixed(2);
        const cashBefore = +team.cash.toFixed(2);

        team.cash = +(team.cash + netCredit).toFixed(2);
        team.holdings[stock.ticker] = 0;
        team.avgBuyPrice[stock.ticker] = 0;
        team.realizedPnl = +(team.realizedPnl + profitOnSold - feeAmount).toFixed(2);
        team.tradeCount++;

        totalNetCredit += netCredit;
        totalFeesCharged += feeAmount;

        // Dynamic market impact with full Circuit Breaker clamping & Upper Circuit recovery
        const sellImpact = +(stock.currentPrice * Math.min(0.003, (qty / 1000) * 0.0005)).toFixed(2);
        const candidatePrice = +(stock.currentPrice - sellImpact).toFixed(2);
        if (Math.round(candidatePrice * 100) <= Math.round(lowerLimit * 100)) {
          stock.currentPrice = lowerLimit;
          if (!stock.isHalted) {
            triggerCircuitBreaker(stock, 'LOWER');
          }
        } else {
          stock.currentPrice = Math.max(stock.min_price || 1, candidatePrice);
        }
        if (stock.currentPrice < stock.dayLow) stock.dayLow = stock.currentPrice;
        if (stock.isHalted && stock.haltDirection === 'UPPER' && Math.round(stock.currentPrice * 100) < Math.round(upperLimit * 100)) {
          releaseCircuitBreaker(stock);
        }

        tradeSeqCounter++;
        const tradeRecord = {
          tradeId: crypto.randomUUID(),
          seq: tradeSeqCounter,
          timestamp: new Date().toLocaleTimeString(),
          exactIso: new Date().toISOString(),
          day: gameState.currentDay,
          second: gameState.elapsedSeconds,
          teamId: team.id,
          teamName: team.name,
          type: 'SELL',
          ticker: stock.ticker,
          quantity: qty,
          price: execPrice,
          grossValue,
          fee: feeAmount,
          totalImpact: netCredit,
          cashBefore,
          cashAfter: team.cash,
          isLiquidation: true
        };
        executedTrades.push(tradeRecord);
        liquidatedTrades.push({
          ticker: stock.ticker,
          name: stock.name,
          quantity: qty,
          price: execPrice,
          grossValue,
          fee: feeAmount,
          netCredit,
          profitOnSold
        });

        recordAuditEvent('ORDER_EXECUTE', { team_id: team.id, trade_record: tradeRecord });
      }

      totalNetCredit = +totalNetCredit.toFixed(2);
      totalFeesCharged = +totalFeesCharged.toFixed(2);

      ws.send(JSON.stringify({
        type: 'PORTFOLIO_LIQUIDATED',
        teamId: team.id,
        tradesCount: liquidatedTrades.length,
        totalNetCredit,
        totalFeesCharged,
        cashAfter: team.cash,
        liquidatedTrades,
        skippedHalted
      }));

      broadcastTick();
      return;
    }

    // --- 5. HOST MATRIX & ADVANCED SHARE MANAGEMENT ---
    if (session.role === 'HOST') {
      const isConfigLocked = !!gameState.configLocked;

      // Enforce configuration lock: prevent modifying shares while tournament is active
      if (gameState.configLocked) {
        if (['HOST_ADD_SHARE', 'HOST_REMOVE_SHARE', 'HOST_DELETE_SHARE', 'HOST_EDIT_SHARE', 'HOST_DUPLICATE_SHARE', 'HOST_APPLY_MARKET_TEMPLATE', 'HOST_RESET_UNIVERSE_BASELINE'].includes(data.action)) {
          ws.send(JSON.stringify({
            type: 'EVENT_CONFIG_LOCKED',
            reason: 'EVENT_CONFIG_LOCKED: Configuration is permanently frozen for competition integrity. Tradeable stock universe cannot be modified while tournament is active.'
          }));
          return;
        }
        if (data.action === 'HOST_UPDATE_EVENT_CONFIG') {
          const cashChanged = data.startingCash !== undefined && !isNaN(data.startingCash) && parseFloat(data.startingCash) !== gameState.startingCash;
          const daysChanged = data.totalDays !== undefined && !isNaN(data.totalDays) && parseInt(data.totalDays, 10) !== gameState.totalDays;
          if (cashChanged || daysChanged) {
            ws.send(JSON.stringify({
              type: 'EVENT_CONFIG_LOCKED',
              reason: 'Starting capital and total days cannot be changed mid-tournament while the market is live. Title, duration, fee, and circuit breaker were updated.'
            }));
            delete data.startingCash;
            delete data.totalDays;
          }
        }
      }

      // 5.0 Explicit Host Event Lock (Pre-Event Setup Freeze & Team Credential Activation)
      if (data.action === 'HOST_SET_EVENT_LOCK' || data.action === 'HOST_LOCK_EVENT') {
        if (gameState.status === 'LIVE' || gameState.elapsedSeconds > 0 || gameState.currentDay > 1) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot modify event configuration: The tournament is already underway. Event settings are permanently locked.'
          }));
          return;
        }

        const errors = [];
        if (data.eventTitle !== undefined && (!data.eventTitle || !data.eventTitle.trim())) {
          errors.push('Event title cannot be blank.');
        }

        // Validate stock selection (at least 4 verified stocks)
        let selectedTickers = data.selectedTickers;
        if (Array.isArray(selectedTickers)) {
          if (selectedTickers.length < 4) {
            errors.push('Please select at least 4 tradeable stocks for the market universe.');
          }
        } else {
          const currentEnabled = companies.filter((c) => c.isEnabled !== false);
          if (currentEnabled.length < 4) {
            errors.push('Please select at least 4 tradeable stocks for the market universe.');
          } else {
            selectedTickers = currentEnabled.map((c) => c.ticker);
          }
        }

        // Validate dynamic teams roster (supports any dynamic count >= 1)
        if (Array.isArray(data.teams)) {
          if (data.teams.length < 1) {
            errors.push('At least 1 team is required for the competition roster.');
          }
          const seenUsernames = new Set();
          data.teams.forEach((t, i) => {
            if (!t.name || !t.name.trim()) errors.push(`Team ${i + 1} display name is required.`);
            if (!t.password || !t.password.trim()) errors.push(`Team ${i + 1} password is required.`);
            const u = (t.username || `team${i + 1}`).trim().toLowerCase();
            if (seenUsernames.has(u)) errors.push(`Duplicate username "${u}" found on team ${i + 1}.`);
            seenUsernames.add(u);
          });
        }

        if (errors.length > 0) {
          ws.send(JSON.stringify({
            type: 'SETUP_VALIDATION_ERROR',
            errors,
            message: 'Setup validation failed: ' + errors.join(' ')
          }));
          return;
        }

        // Apply Event Parameters
        if (data.eventTitle) gameState.title = data.eventTitle.trim();
        if (data.institution) gameState.institution = data.institution.trim();
        if (data.startingCash && !isNaN(data.startingCash) && parseFloat(data.startingCash) > 0) {
          gameState.startingCash = parseFloat(data.startingCash);
        }
        if (data.totalDays && !isNaN(data.totalDays) && parseInt(data.totalDays, 10) > 0) {
          gameState.totalDays = parseInt(data.totalDays, 10);
        }
        if (data.dayDurationSeconds && !isNaN(data.dayDurationSeconds) && parseInt(data.dayDurationSeconds, 10) >= 60) {
          gameState.dayDurationSeconds = parseInt(data.dayDurationSeconds, 10);
        }
        if (data.transactionFeeBps !== undefined && !isNaN(data.transactionFeeBps)) {
          gameState.transactionFeeBps = Math.max(0, parseInt(data.transactionFeeBps, 10));
        }
        if (data.circuitBreakerPercent && !isNaN(data.circuitBreakerPercent)) {
          gameState.circuitBreakerPercent = Math.max(5, Math.min(50, parseFloat(data.circuitBreakerPercent)));
        }

        // Apply Simulation Risk Profile
        if (data.riskProfile) {
          gameState.riskProfile = ['CONSERVATIVE', 'BALANCED', 'HIGH_OPPORTUNITY', 'CUSTOM'].includes(data.riskProfile) ? data.riskProfile : 'BALANCED';
        }
        if (gameState.riskProfile === 'HIGH_OPPORTUNITY') {
          gameState.opportunityMultiplier = 1.45;
        } else if (gameState.riskProfile === 'CONSERVATIVE') {
          gameState.opportunityMultiplier = 0.75;
        } else {
          gameState.opportunityMultiplier = 1.0;
        }

        // Apply Stock Selection
        if (Array.isArray(selectedTickers)) {
          companies.forEach((c) => {
            c.isEnabled = selectedTickers.includes(c.ticker);
            if (c.isEnabled) {
              const base = c.base_price || c.currentPrice || 1000;
              c.currentPrice = base;
              c.dayOpenPrice = base;
              c.dayHigh = base;
              c.dayLow = base;
              c.isHalted = false;
              c.activeTransition = null;
              c.history = [{ time: 0, price: base }];
            }
          });
          saveUniverseToDisk();
        }

        // Apply Dynamic Teams Roster & Credentials (supports any count >= 1)
        if (Array.isArray(data.teams) && data.teams.length >= 1) {
          Object.keys(USERS).forEach((k) => {
            if (USERS[k].role === 'TRADER') delete USERS[k];
          });
          teams = {};

          data.teams.forEach((tData, idx) => {
            const i = idx + 1;
            const teamId = tData.id || `team_${i}`;
            const username = (tData.username || `team${i}`).trim().toLowerCase();
            const password = (tData.password || `trade${i}00`).trim();
            const name = (tData.name || `Team ${i}`).trim();
            const members = (tData.members || `Trader ${i}A, Trader ${i}B`).trim();

            USERS[username] = {
              username,
              password,
              role: 'TRADER',
              id: teamId,
              name,
              members
            };

            const holdings = {};
            const avgBuyPrice = {};
            companies.forEach((c) => {
              holdings[c.ticker] = 0;
              avgBuyPrice[c.ticker] = 0;
            });

            teams[teamId] = {
              id: teamId,
              username,
              name,
              members,
              cash: gameState.startingCash,
              startingCash: gameState.startingCash,
              holdings,
              avgBuyPrice,
              realizedPnl: 0,
              tradeCount: 0
            };
          });
        }

        // Auto-generate Multi-Day News Plan from the selected enabled stocks
        const enabledTickers = companies.filter((c) => c.isEnabled !== false).map((c) => c.ticker);
        newsEvents = generateAutoNewsPlan(enabledTickers, gameState.totalDays, gameState.dayDurationSeconds);

        // Permanently lock event setup for competition integrity
        gameState.configLocked = true;
        gameState.status = 'STANDBY';
        gameState.isPaused = true;
        gameState.isReset = false;
        gameState.resetMessage = null;
        gameState.elapsedSeconds = 0;
        gameState.currentDay = 1;
        gameState.isConcluded = false;

        saveLiveGameState();
        recordAuditEvent('EVENT_CONFIG_LOCKED', {
          triggered_by: 'HOST',
          title: gameState.title,
          teamsCount: Object.keys(teams).length,
          stocksCount: enabledTickers.length
        });

        broadcastAll({
          type: 'EVENT_CONFIG_LOCKED',
          message: 'Your event setup is complete. Team logins are now open and settings are locked.',
          gameState
        });

        const activeTeamCount = Object.keys(teams).length;
        const hostState = getSanitizedPublicState('HOST');
        ws.send(JSON.stringify({
          type: 'EVENT_CONFIG_LOCKED_ACK',
          ok: true,
          message: `Event setup confirmed and locked. All ${activeTeamCount} team credentials are now active!`,
          teamsCount: activeTeamCount,
          gameState,
          companies: hostState.companies,
          allCompaniesUniverse: hostState.allCompaniesUniverse,
          scenarioMode: activeScenarioMode
        }));

        broadcastTick();
        broadcastPublicEventStatus();
        return;
      }

      // 5.0b Bulk Stock Selection Update (Allowed only before lock)
      if (data.action === 'HOST_SET_SELECTED_STOCKS') {
        if (gameState.configLocked) {
          ws.send(JSON.stringify({
            type: 'EVENT_CONFIG_LOCKED',
            reason: 'Configuration is permanently frozen for competition integrity. Stock selection cannot be changed after setup is locked.'
          }));
          return;
        }
        if (Array.isArray(data.selectedTickers)) {
          companies.forEach((c) => {
            c.isEnabled = data.selectedTickers.includes(c.ticker);
          });
          saveUniverseToDisk();
          broadcastTick();
        }
        return;
      }

      // 5.0b Host Unlock Event Configuration (Allowed ONLY before competition starts)
      if (data.action === 'HOST_UNLOCK_EVENT_CONFIG' || data.action === 'HOST_UNLOCK_EVENT') {
        if (gameState.status === 'LIVE' || gameState.elapsedSeconds > 0 || gameState.currentDay > 1) {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: 'Cannot unlock settings: The competition has already started. Event settings are permanently frozen during live trading.'
          }));
          return;
        }
        gameState.configLocked = false;
        recordAuditEvent('EVENT_CONFIG_UNLOCKED', { triggered_by: 'HOST', title: gameState.title });
        broadcastAll({
          type: 'EVENT_CONFIG_UNLOCKED',
          message: 'Event settings have been unlocked for editing. Settings will re-lock automatically when complete.',
          gameState
        });
        ws.send(JSON.stringify({
          type: 'EVENT_CONFIG_UNLOCKED_ACK',
          ok: true,
          message: 'Event settings unlocked successfully.'
        }));
        broadcastTick();
        return;
      }

      // 5.0c Automatic News Plan Generation from Selected Companies
      if (data.action === 'HOST_GENERATE_AUTO_NEWS_PLAN') {
        if (gameState.configLocked || gameState.status === 'LIVE') {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: 'Event settings are locked. Cannot regenerate news plan.'
          }));
          return;
        }
        const selected = Array.isArray(data.selectedTickers) ? data.selectedTickers : null;
        const days = parseInt(data.totalDays, 10) || gameState.totalDays || 3;
        const dur = parseInt(data.dayDurationSeconds, 10) || gameState.dayDurationSeconds || 1800;
        newsEvents = generateAutoNewsPlan(selected, days, dur);
        recordAuditEvent('AUTO_NEWS_PLAN_GENERATED', { count: newsEvents.length, totalDays: days });
        ws.send(JSON.stringify({
          type: 'AUTO_NEWS_PLAN_GENERATED_ACK',
          ok: true,
          newsEvents
        }));
        broadcastTick();
        return;
      }

      // 5.1 Market Pause (Supports Soft Freeze 'VISIBLE_FROZEN' and Blind 'BLACKOUT')
      if (data.action === 'HOST_PAUSE' || data.action === 'HOST_SET_PAUSE_MODE') {
        if (!gameState.configLocked || gameState.status === 'SETUP' || gameState.status === 'RESET') {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot pause market: Event configuration is incomplete. Complete and lock event setup first.'
          }));
          return;
        }
        if (gameState.status === 'DAY_COMPLETED' || gameState.isConcluded) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: `Cannot pause market: Day ${gameState.currentDay} is already concluded.`
          }));
          return;
        }

        const requestedMode = data.pauseMode === 'BLACKOUT' ? 'BLACKOUT' : 'VISIBLE_FROZEN';

        // If already paused (and not in countdown), allow clean mode toggle between VISIBLE_FROZEN and BLACKOUT!
        if (gameState.isPaused && gameState.status === 'PAUSED' && !activeCountdownTimer) {
          if (data.action === 'HOST_SET_PAUSE_MODE' || (data.allowModeSwitch && gameState.pauseMode !== requestedMode)) {
            gameState.pauseMode = requestedMode;
            recordAuditEvent('PAUSE_MODE_SWITCHED', { triggered_by: 'HOST', pauseMode: requestedMode });
            broadcastAll({ type: 'MARKET_PAUSED', pauseMode: requestedMode });
            broadcastTick();
            broadcastPublicEventStatus();
            return;
          }
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Trading is already paused. Resume trading when you are ready.'
          }));
          return;
        }
        const mode = requestedMode;
        if (activeCountdownTimer) {
          clearTimeout(activeCountdownTimer);
          activeCountdownTimer = null;
        }
        const cancelledCountdownId = gameState.activeCountdown ? gameState.activeCountdown.id : null;
        gameState.activeCountdown = null;
        gameState.isPaused = true;
        gameState.pauseMode = mode;
        gameState.status = 'PAUSED'; // Always canonical PAUSED; pauseMode distinguishes BLACKOUT vs VISIBLE_FROZEN
        gameState.pauseStartedAt = Date.now();
        recordAuditEvent('EMERGENCY_PAUSE', { triggered_by: 'HOST', pauseMode: mode, shift_offset_applied_seconds: gameState.totalShiftOffsetSeconds });
        if (cancelledCountdownId) {
          broadcastAll({ type: 'COUNTDOWN_CANCELLED', countdownId: cancelledCountdownId });
        }
        broadcastAll({ type: 'MARKET_PAUSED', pauseMode: mode });
        broadcastTick();
        broadcastPublicEventStatus();
        return;
      }

      // 5.2 Market Resume with Authoritative 3-2-1 Server Countdown
      if (data.action === 'HOST_RESUME_COUNTDOWN' || data.action === 'HOST_START_DAY1_NOW' || data.action === 'RESUME_MARKET') {
        const res = startResumeCountdown('HOST');
        if (!res.ok) {
          ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: res.reason }));
          ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: res.reason }));
        }
        return;
      }

      // 5.2b Schedule Event for future date/time
      if (data.action === 'HOST_SCHEDULE_EVENT') {
        gameState.startMode = 'SCHEDULED';
        gameState.scheduledStartTime = data.scheduledStartTime; // ISO string e.g. "2026-10-15T09:00:00"
        gameState.pausePolicy = data.pausePolicy === 'ELAPSED_TIME' ? 'ELAPSED_TIME' : 'TRADING_TIME';
        gameState.status = 'SCHEDULED';
        gameState.configLocked = true;
        gameState.isPaused = true;
        gameState.isConcluded = false;
        gameState.winnerData = null;
        gameState.elapsedSeconds = 0;
        if (data.durationSec || data.dayDurationSeconds) gameState.dayDurationSeconds = parseInt(data.durationSec || data.dayDurationSeconds, 10);
        if (data.eventTitle) gameState.title = data.eventTitle;
        if (data.institution) gameState.institution = data.institution;
        recordAuditEvent('EVENT_SCHEDULED', { scheduledStartTime: data.scheduledStartTime, pausePolicy: gameState.pausePolicy, title: gameState.title });
        broadcastAll({ type: 'EVENT_SCHEDULED', scheduledStartTime: data.scheduledStartTime, pausePolicy: gameState.pausePolicy, gameState });
        broadcastTick();
        broadcastPublicEventStatus();
      }

      // 5.2b2 Cancel Scheduled Countdown
      if (data.action === 'HOST_CANCEL_SCHEDULE') {
        gameState.status = 'STANDBY';
        gameState.scheduledStartTime = null;
        gameState.startMode = 'MANUAL';
        gameState.isPaused = true;
        recordAuditEvent('SCHEDULE_CANCELLED', { triggered_by: 'HOST' });
        broadcastAll({ type: 'SCHEDULE_CANCELLED', gameState });
        broadcastTick();
        broadcastPublicEventStatus();
      }

      // 5.2c Start Event Now (Immediate Launch)
      if (data.action === 'HOST_START_EVENT_NOW' || data.action === 'HOST_START_MARKET') {
        if (!gameState.configLocked || gameState.status === 'SETUP' || gameState.status === 'RESET') {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot start event: Event configuration is incomplete. Complete and lock event setup first.'
          }));
          return;
        }
        if (gameState.status === 'DAY_COMPLETED' || gameState.isConcluded) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: gameState.isConcluded
              ? 'Championship is already concluded.'
              : `Day ${gameState.currentDay} is already concluded. Advance to Day ${gameState.currentDay + 1} first.`
          }));
          return;
        }

        const wasPreOpen = ['SETUP', 'STANDBY', 'SCHEDULED'].includes(gameState.status);
        if (wasPreOpen) {
          gameState.elapsedSeconds = 0;
        }
        gameState.startMode = 'IMMEDIATE';
        gameState.status = 'LIVE';
        gameState.scheduledStartTime = null;
        gameState.pauseMode = 'NONE';
        gameState.pauseStartedAt = null;
        if (data.durationSec || data.dayDurationSeconds) gameState.dayDurationSeconds = parseInt(data.durationSec || data.dayDurationSeconds, 10);
        if (data.eventTitle) gameState.title = data.eventTitle;
        if (data.institution) gameState.institution = data.institution;
        syncDerivedStateFlags(gameState);

        recordAuditEvent('EVENT_STARTED_NOW', { triggered_by: 'HOST', title: gameState.title });
        if (wasPreOpen) {
          broadcastAudioCue('bell_open', 'lifecycle', { day: gameState.currentDay });
          broadcastAll({ type: 'BELL_EVENT', bell: 'OPEN', day: gameState.currentDay });
        }
        broadcastAll({ type: 'MARKET_RESUMED' });
        broadcastTick();
        broadcastPublicEventStatus();
      }

      // 5.2d News Control Center: Publish Now, Cancel, Edit, Duplicate
      if (data.action === 'HOST_PUBLISH_NEWS_NOW') {
        const ev = newsEvents.find((e) => e.event_id === data.event_id);
        if (ev) {
          if (ev.triggered) {
            ws.send(JSON.stringify({
              type: 'ORDER_REJECTED',
              reason: `"${ev.headline}" has already been published for today. Each news event can only be published once.`
            }));
            return;
          }
          triggerNewsEvent(ev, 'HOST_MANUAL');
          broadcastTick();
        }
      }

      if (data.action === 'HOST_CANCEL_NEWS') {
        if (gameState.configLocked) {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: 'Schedule is locked. News items cannot be cancelled during active competition.'
          }));
          return;
        }
        const ev = newsEvents.find((e) => e.event_id === data.event_id);
        if (ev) {
          ev.cancelled = true;
          recordAuditEvent('NEWS_CANCELLED', { event_id: ev.event_id });
          broadcastTick();
        }
      }

      if (data.action === 'HOST_EDIT_NEWS') {
        if (gameState.configLocked) {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: 'Schedule is locked. News items cannot be edited during active competition.'
          }));
          return;
        }
        const ev = newsEvents.find((e) => e.event_id === data.event_id);
        if (ev) {
          if (data.headline) ev.headline = data.headline.trim();
          if (data.explanation) ev.simple_explanation = data.explanation.trim();
          if (data.trigger_second !== undefined) ev.trigger_second = parseInt(data.trigger_second, 10);
          if (data.impacts) ev.impacts = data.impacts;
          recordAuditEvent('NEWS_EDITED', { event_id: ev.event_id });
          broadcastTick();
        }
      }

      if (data.action === 'HOST_DUPLICATE_NEWS') {
        if (gameState.configLocked) {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: 'Schedule is locked. New events cannot be added to a locked schedule.'
          }));
          return;
        }
        const ev = newsEvents.find((e) => e.event_id === data.event_id);
        if (ev) {
          const clone = {
            ...ev,
            event_id: `NEWS_COPY_${Date.now().toString().slice(-4)}`,
            headline: `${ev.headline} (Follow-Up)`,
            triggered: false,
            cancelled: false,
            trigger_second: Math.min((gameState.dayDurationSeconds || 1800) - 60, gameState.elapsedSeconds + 60)
          };
          newsEvents.push(clone);
          recordAuditEvent('NEWS_DUPLICATED', { original: ev.event_id, clone: clone.event_id });
          broadcastTick();
        }
      }

      // 5.2d2 Recalculate News Schedule when duration changes before lock
      if (data.action === 'HOST_RECALCULATE_SCHEDULE') {
        if (gameState.configLocked) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Configuration is permanently locked. Schedule cannot be modified.'
          }));
          return;
        }
        const newDur = parseInt(data.dayDurationSeconds, 10) || gameState.dayDurationSeconds || 1800;
        gameState.dayDurationSeconds = newDur;
        recalculateNewsScheduleForDuration(newDur);
        const feasibility = validateScheduleFeasibility(newsEvents, newDur);
        ws.send(JSON.stringify({
          type: 'SCHEDULE_RECALCULATED_ACK',
          ok: true,
          dayDurationSeconds: newDur,
          feasibility,
          allScheduledNews: newsEvents
        }));
        broadcastTick();
        return;
      }

      // 5.2e Host Audio Controls (Remote Event Hall Audio Console)
      if (data.action === 'HOST_UPDATE_AUDIO_SETTINGS') {
        if (!gameState.audioSettings) {
          gameState.audioSettings = { masterEnabled: true, masterVolume: 85, categories: { lifecycle: true, news: true, alerts: true, presentation: true }, muted: false };
        }
        if (data.masterVolume !== undefined) gameState.audioSettings.masterVolume = Math.max(0, Math.min(100, parseInt(data.masterVolume, 10)));
        if (data.masterEnabled !== undefined) gameState.audioSettings.masterEnabled = !!data.masterEnabled;
        if (data.muted !== undefined) gameState.audioSettings.muted = !!data.muted;
        if (data.categories) gameState.audioSettings.categories = { ...gameState.audioSettings.categories, ...data.categories };

        recordAuditEvent('AUDIO_SETTINGS_UPDATED', { audioSettings: gameState.audioSettings });
        broadcastAll({ type: 'AUDIO_SETTINGS_UPDATED', audioSettings: gameState.audioSettings });
        broadcastTick();
      }

      if (data.action === 'HOST_TEST_SOUND_CUE') {
        const cueName = data.cueName || 'countdown_tick';
        const category = data.category || 'lifecycle';
        broadcastAudioCue(cueName, category, { isTest: true });
      }

      // 5.2f Host Winner Presentation Stage Controls (Embedded Directly in Projector)
      if (data.action === 'HOST_START_WINNER_PRESENTATION') {
        if (!gameState.isConcluded && (gameState.status !== 'DAY_COMPLETED' || gameState.currentDay < gameState.totalDays)) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: `Stage Presentation requires all tournament days (Day ${gameState.totalDays}/${gameState.totalDays}) to be concluded first.`
          }));
          return;
        }
        const snapshot = generateOfficialResultsSnapshot();
        gameState.isPaused = true;
        gameState.isConcluded = true;
        gameState.status = 'WINNER_ANNOUNCEMENT';
        if (!gameState.projectorState) gameState.projectorState = {};
        gameState.projectorState.isWinnerActive = true;
        gameState.projectorState.winnerScene = 'SCENE_INTRO';
        gameState.presentationState = {
          active: true,
          scene: 'SCENE_INTRO',
          currentTeamIndex: 0,
          revealedRanks: [],
          updatedAt: new Date().toISOString()
        };

        recordAuditEvent('WINNER_PRESENTATION_STARTED', { snapshotId: snapshot.snapshotId });
        broadcastAudioCue('championship_fanfare', 'presentation', { scene: 'SCENE_INTRO' });
        broadcastAll({
          type: 'PRESENTATION_SCENE_UPDATE',
          scene: 'SCENE_INTRO',
          presentationState: gameState.presentationState,
          snapshot
        });
        broadcastAll({
          type: 'PROJECTOR_STATE_UPDATE',
          projectorState: gameState.projectorState
        });
        broadcastTick();
        broadcastPublicEventStatus();
      }

      if (data.action === 'HOST_EXIT_WINNER_PRESENTATION') {
        if (!gameState.projectorState) gameState.projectorState = {};
        gameState.projectorState.isWinnerActive = false;
        if (gameState.presentationState) gameState.presentationState.active = false;
        recordAuditEvent('WINNER_PRESENTATION_EXITED', {});
        broadcastAll({
          type: 'PROJECTOR_STATE_UPDATE',
          projectorState: gameState.projectorState
        });
        broadcastTick();
        broadcastPublicEventStatus();
      }

      if (data.action === 'HOST_SET_PRESENTATION_SCENE') {
        const rawScene = data.scene || 'INTRO';
        const sceneKey = rawScene.replace(/^SCENE_/, '');
        const normalizedScene = 'SCENE_' + sceneKey;
        if (!gameState.presentationState) {
          gameState.presentationState = { active: true, scene: normalizedScene, currentScene: normalizedScene, currentTeamIndex: 0, revealedRanks: [] };
        }
        gameState.presentationState.scene = normalizedScene;
        gameState.presentationState.currentScene = normalizedScene;
        gameState.presentationState.rawScene = sceneKey;
        gameState.presentationState.updatedAt = new Date().toISOString();
        if (!gameState.projectorState) gameState.projectorState = {};
        gameState.projectorState.winnerScene = normalizedScene;

        if (sceneKey === 'BRONZE') {
          broadcastAudioCue('presentation_bronze', 'presentation', { rank: 3 });
        } else if (sceneKey === 'SILVER') {
          broadcastAudioCue('presentation_silver', 'presentation', { rank: 2 });
        } else if (sceneKey === 'CHAMPION') {
          broadcastAudioCue('winner_trumpet', 'presentation', { rank: 1 });
        } else if (sceneKey === 'PODIUM') {
          broadcastAudioCue('championship_fanfare', 'presentation');
        }

        recordAuditEvent('PRESENTATION_SCENE_CHANGED', { scene: normalizedScene });
        broadcastAll({
          type: 'PROJECTOR_STATE_UPDATE',
          projectorState: gameState.projectorState
        });
        broadcastAll({
          type: 'PRESENTATION_SCENE_UPDATE',
          scene: rawScene,
          normalizedScene,
          presentationState: gameState.presentationState,
          snapshot: gameState.finalResultsSnapshot || generateOfficialResultsSnapshot()
        });
        broadcastTick();
      }

      // 5.2g Host Intelligent Projector Cycle Mode & Board Pagination Controls
      if (data.action === 'HOST_UPDATE_PROJECTOR_MODE') {
        if (!gameState.projectorState) {
          gameState.projectorState = { mode: 'AUTO_CYCLE', currentScene: 'SCENE_MARKET_BOARD', sceneDurationSeconds: 12, isWinnerActive: false, boardPage: 1, isBoardPaused: false };
        }
        if (data.mode) gameState.projectorState.mode = data.mode;
        if (data.scene) gameState.projectorState.currentScene = data.scene;
        if (data.sceneDurationSeconds) gameState.projectorState.sceneDurationSeconds = Math.max(3, parseInt(data.sceneDurationSeconds, 10));
        if (data.boardPage) gameState.projectorState.boardPage = Math.max(1, parseInt(data.boardPage, 10));
        if (data.isBoardPaused !== undefined) gameState.projectorState.isBoardPaused = !!data.isBoardPaused;
        gameState.projectorState.updatedAt = new Date().toISOString();

        recordAuditEvent('PROJECTOR_MODE_CHANGED', { projectorState: gameState.projectorState });
        broadcastAll({ type: 'PROJECTOR_STATE_UPDATE', projectorState: gameState.projectorState });
        broadcastTick();
        return;
      }

      if (data.action === 'HOST_SET_PROJECTOR_BOARD_PAGE') {
        if (!gameState.projectorState) {
          gameState.projectorState = { mode: 'AUTO_CYCLE', currentScene: 'SCENE_MARKET_BOARD', sceneDurationSeconds: 12, isWinnerActive: false, boardPage: 1, isBoardPaused: false };
        }
        gameState.projectorState.boardPage = Math.max(1, parseInt(data.page, 10) || 1);
        gameState.projectorState.updatedAt = new Date().toISOString();
        broadcastAll({ type: 'PROJECTOR_STATE_UPDATE', projectorState: gameState.projectorState });
        return;
      }

      if (data.action === 'HOST_TOGGLE_PROJECTOR_BOARD_PAUSE') {
        if (!gameState.projectorState) {
          gameState.projectorState = { mode: 'AUTO_CYCLE', currentScene: 'SCENE_MARKET_BOARD', sceneDurationSeconds: 12, isWinnerActive: false, boardPage: 1, isBoardPaused: false };
        }
        gameState.projectorState.isBoardPaused = data.isPaused !== undefined ? !!data.isPaused : !gameState.projectorState.isBoardPaused;
        gameState.projectorState.updatedAt = new Date().toISOString();
        broadcastAll({ type: 'PROJECTOR_STATE_UPDATE', projectorState: gameState.projectorState });
        return;
      }

      // 5.2h Host Conclude / Finalize Current Day Results
      if (data.action === 'HOST_FINALIZE_DAY' || data.action === 'HOST_CONCLUDE_DAY') {
        if (!gameState.configLocked || gameState.status === 'SETUP' || gameState.status === 'RESET') {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot conclude day: No event is currently active or configured. Complete event setup first.'
          }));
          return;
        }
        if (gameState.status === 'DAY_COMPLETED') {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: `Day ${gameState.currentDay} is already concluded. Stand by to advance to Day ${gameState.currentDay + 1} or finalize the championship.`
          }));
          return;
        }
        concludeCurrentDay(false);
        return;
      }

      // 5.2i Start Next Day (Requires Current Day to be Completed)
      if (data.action === 'HOST_NEXT_DAY' || data.action === 'HOST_START_NEXT_DAY') {
        // Validate that current day has been properly concluded
        if (gameState.status !== 'DAY_COMPLETED') {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot advance to next day. Current day must be concluded first.'
          }));
          return;
        }

        if (gameState.currentDay < gameState.totalDays) {
          const oldDay = gameState.currentDay;
          gameState.currentDay++;
          gameState.elapsedSeconds = 0;
          gameState.isPaused = true;
          gameState.status = 'STANDBY';
          gameState.pauseMode = 'VISIBLE_FROZEN';
          gameState.pauseStartedAt = Date.now();
          gameState.activeCountdown = null;

          // Clear fired news events for new day
          firedNewsEventsPerDay.clear();

          // Reset news events triggered status for new day
          newsEvents.forEach((ev) => {
            if (ev.day === gameState.currentDay) {
              ev.triggered = false;
              ev.phase = 'SCHEDULED';
              ev.impactsApplied = false;
            }
          });

          companies.forEach((stock) => {
            if (!stock.historyByDay) stock.historyByDay = {};
            // Archive completed day's intraday curve before starting the new day
            stock.historyByDay[`day_${oldDay}`] = {
              day: oldDay,
              openPrice: stock.dayOpenPrice,
              closePrice: stock.currentPrice,
              highPrice: stock.dayHigh,
              lowPrice: stock.dayLow,
              history: (stock.history || []).slice(-360)
            };

            stock.previousClosePrice = stock.currentPrice;
            stock.dayOpenPrice = stock.currentPrice;
            stock.dayHigh = stock.currentPrice;
            stock.dayLow = stock.currentPrice;
            stock.isHalted = false;
            stock.haltDirection = null;
            stock.activeTransition = null;
            stock.history = [{ time: 0, day: gameState.currentDay, price: stock.currentPrice }];

            if (!Array.isArray(stock.multiDayHistory)) stock.multiDayHistory = [];
            const cumStart = (gameState.currentDay - 1) * (gameState.dayDurationSeconds || 1800);
            stock.multiDayHistory.push({
              time: 0,
              cumulativeTime: cumStart,
              day: gameState.currentDay,
              price: stock.currentPrice,
              isDayBoundary: true
            });
          });

          // Establish authoritative baseline opening portfolio value for the new day
          Object.values(teams).forEach((t) => {
            let holdingsVal = 0;
            companies.forEach((c) => {
              if (c.isEnabled !== false) {
                holdingsVal += (t.holdings[c.ticker] || 0) * c.currentPrice;
              }
            });
            t.dayOpeningPortfolioValue = +(t.cash + holdingsVal).toFixed(2);
          });

          recordAuditEvent('ADVANCE_DAY', { old_day: oldDay, new_day: gameState.currentDay, total_days: gameState.totalDays });
          broadcastAll({
            type: 'DAY_TRANSITION',
            oldDay,
            newDay: gameState.currentDay,
            currentDay: gameState.currentDay,
            totalDays: gameState.totalDays
          });
          broadcastAll({
            type: 'DAY_ADVANCED',
            oldDay,
            newDay: gameState.currentDay,
            currentDay: gameState.currentDay,
            totalDays: gameState.totalDays
          });
          broadcastTick();
          broadcastPublicEventStatus();
        } else {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Cannot advance: Day ${gameState.currentDay} is the final planned day. Use 'Finish Championship' or 'Add Next Day'.`
          }));
        }
      }

      // 5.2j Add Extra Day to Championship
      if (data.action === 'HOST_ADD_DAY') {
        if (gameState.isConcluded) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot add a day: The championship is already finalized.'
          }));
          return;
        }
        if (gameState.totalDays >= 10) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: 'Cannot add a day: Maximum tournament limit is 10 days.'
          }));
          return;
        }
        const oldTotal = gameState.totalDays;
        gameState.totalDays++;
        extendNewsPlanForDay(gameState.totalDays);

        recordAuditEvent('DAY_ADDED', { oldTotalDays: oldTotal, newTotalDays: gameState.totalDays });
        broadcastAll({
          type: 'DAY_ADDED',
          totalDays: gameState.totalDays
        });
        broadcastAll({
          type: 'EVENT_DAYS_UPDATED',
          totalDays: gameState.totalDays
        });
        broadcastTick();
      }

      // 5.2k Finish Event (Enter Final Results Review)
      if (data.action === 'HOST_FINISH_EVENT') {
        if (!gameState.isConcluded && (gameState.status !== 'DAY_COMPLETED' || gameState.currentDay < gameState.totalDays)) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: `Finishing the event requires final Day ${gameState.totalDays} to be completed. Current: Day ${gameState.currentDay}/${gameState.totalDays}, Status: ${gameState.status}`
          }));
          return;
        }
        const winnerData = getConcludedLeaderboard();
        const snapshot = generateOfficialResultsSnapshot();
        gameState.isPaused = true;
        gameState.isConcluded = true;
        gameState.status = 'FINAL_ANALYSIS';
        gameState.winnerData = winnerData;
        gameState.finalResultsSnapshot = snapshot;

        recordAuditEvent('CHAMPIONSHIP_FINISHED', { totalDays: gameState.totalDays, winners: winnerData });
        broadcastAll({
          type: 'CHAMPIONSHIP_CONCLUDED',
          winnerData,
          snapshot,
          title: gameState.title
        });
        broadcastTick();
      }

      // 5.2l Emergency Stop (Full Event Emergency Freeze)
      if (data.action === 'HOST_EMERGENCY_STOP') {
        const hadCountdown = !!activeCountdownTimer || !!gameState.activeCountdown;
        const cancelledCountdownId = gameState.activeCountdown ? gameState.activeCountdown.id : null;
        if (activeCountdownTimer) {
          clearTimeout(activeCountdownTimer);
          activeCountdownTimer = null;
        }
        gameState.activeCountdown = null;
        gameState.status = 'PAUSED';
        gameState.pauseMode = 'EMERGENCY_HALT';
        gameState.pauseStartedAt = Date.now();
        syncDerivedStateFlags(gameState);

        companies.forEach((c) => {
          c.activeTransition = null;
        });

        recordAuditEvent('EMERGENCY_STOP', { reason: data.reason || 'Host initiated emergency market freeze.' });
        if (hadCountdown) {
          broadcastAll({ type: 'COUNTDOWN_CANCELLED', countdownId: cancelledCountdownId, reason: 'Emergency Stop' });
        }
        broadcastAudioCue('circuit_alarm', 'alerts', { type: 'EMERGENCY_STOP' });
        broadcastAll({
          type: 'EMERGENCY_STOP',
          reason: data.reason || 'Host initiated emergency market freeze across all trading terminals.'
        });
        broadcastAll({
          type: 'EMERGENCY_STOP_TRIGGERED',
          reason: data.reason || 'Host initiated emergency market freeze across all trading terminals.'
        });
        broadcastTick();
      }

      // 5.4 Trigger Existing Scheduled News
      if (data.action === 'HOST_TRIGGER_NEWS') {
        const ev = newsEvents.find((e) => e.event_id === data.event_id);
        if (!ev) {
          ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: 'News event not found' }));
          return;
        }
        if (ev.triggered) {
          ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `News event "${ev.headline}" has already been triggered.` }));
          return;
        }
        const ok = triggerNewsEvent(ev, 'HOST_MANUAL');
        if (!ok) {
          ws.send(JSON.stringify({ type: 'ACTION_REJECTED', reason: `News event "${ev.headline}" has already been triggered today.` }));
          return;
        }
        broadcastTick();
      }

      // 5.5 Create Custom Breaking News
      if (data.action === 'HOST_CREATE_CUSTOM_NEWS') {
        const headline = (data.headline || '').trim();
        const explanation = (data.explanation || '').trim();
        const type = (data.type || 'SPECIAL SHOCK').toUpperCase().trim();
        const ticker = (data.ticker || '').trim().toUpperCase();
        const durationSec = data.durationSec !== undefined ? parseInt(data.durationSec, 10) : 45;
        const deltaPct = parseFloat(data.deltaPct);

        let impacts = data.impacts || null;
        if (!impacts && ticker && !isNaN(deltaPct)) {
          impacts = {};
          if (ticker === 'ALL' || ticker === 'GLOBAL') {
            impacts.GLOBAL_WEIGHTED = { base_pct: deltaPct, duration_sec: durationSec };
          } else {
            impacts[ticker] = { delta_pct: deltaPct, duration_sec: durationSec };
          }
        }

        if (headline && impacts && Object.keys(impacts).length > 0) {
          const customId = `CUSTOM_${Date.now().toString().slice(-4)}`;
          const customEventObj = {
            event_id: customId,
            day: gameState.currentDay,
            trigger_second: gameState.elapsedSeconds,
            type,
            headline,
            simple_explanation: explanation || `Market impact: ${Object.keys(impacts).join(', ')}`,
            impacts
          };

          newsEvents.unshift(customEventObj);
          triggerNewsEvent(customEventObj, 'HOST_CUSTOM');
          broadcastTick();
        }
      }

      // 5.6 Unhalt Stock / Release Circuit Breaker
      if (data.action === 'HOST_UNHALT_STOCK' || data.action === 'HOST_RELEASE_CIRCUIT_BREAKER') {
        const stock = companies.find((c) => c.ticker === data.ticker);
        if (stock) {
          releaseCircuitBreaker(stock);
          broadcastTick();
        }
      }

      // 5.6b Direct Circuit Breaker Trigger / Halt Simulation
      if (data.action === 'HOST_TRIGGER_CIRCUIT_BREAKER' || data.action === 'HOST_HALT_STOCK') {
        const stock = companies.find((c) => c.ticker === data.ticker);
        const direction = (data.direction || 'UPPER').toUpperCase();
        if (stock) {
          triggerCircuitBreaker(stock, direction);
          broadcastTick();
        }
      }

      // 5.7 Switch Scenario / Reset Universe
      if (data.action === 'HOST_SWITCH_SCENARIO') {
        const targetMode = data.mode === 'test' ? 'test' : 'live';
        loadScenario(targetMode, data.resetToBaseline || false);
        broadcastTick();
      }

      // ==========================================
      // ADVANCED SHARE UNIVERSE MANAGEMENT ACTIONS
      // ==========================================
      // 5.8 Add Brand New Share
      if (data.action === 'HOST_ADD_SHARE') {
        const ticker = (data.ticker || '').toUpperCase().trim();
        const name = (data.name || ticker).trim();
        const sector = (data.sector || 'General').trim();
        const base_price = parseFloat(data.base_price);
        const beta = parseFloat(data.beta) || 1.0;
        const volatility_factor = parseFloat(data.volatility_factor) || 0.004;
        const summary = (data.summary || '').trim();

        if (ticker && !isNaN(base_price) && base_price > 0) {
          const existing = companies.find((c) => c.ticker === ticker);
          if (existing) {
            ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: `Stock with symbol ${ticker} already exists.` }));
            return;
          }

          const newStock = {
            ticker,
            name,
            sector,
            base_price,
            currentPrice: base_price,
            dayOpenPrice: base_price,
            previousClosePrice: base_price,
            dayHigh: base_price,
            dayLow: base_price,
            lot_presets: [1, 5, 10, 50, 100],
            beta,
            volatility_factor,
            min_price: 1,
            max_price: base_price * 10,
            isEnabled: true,
            isHalted: false,
            haltDirection: null,
            activeTransition: null,
            week52High: +(base_price * 1.25).toFixed(2),
            week52Low: +(base_price * 0.75).toFixed(2),
            isNew52WHigh: false,
            isNew52WLow: false,
            trendPhase: (companies.length * 1.73) % (Math.PI * 2),
            trendFreq: 0.012 + ((companies.length % 7) * 0.005),
            sentimentBias: 0,
            history: [{ time: gameState.elapsedSeconds, price: base_price }],
            fundamentals: {
              summary,
              high_52w: +(base_price * 1.25).toFixed(2),
              low_52w: +(base_price * 0.75).toFixed(2)
            }
          };

          companies.push(newStock);

          // Update existing team holding registries
          Object.values(teams).forEach((t) => {
            t.holdings[ticker] = 0;
            t.avgBuyPrice[ticker] = 0;
          });

          saveUniverseToDisk();
          recordAuditEvent('SHARE_ADDED', { ticker, name, sector, base_price });
          broadcastTick();
        }
      }

      // 5.9 Edit Existing Share
      if (data.action === 'HOST_EDIT_SHARE') {
        const stock = companies.find((c) => c.ticker === data.ticker);
        if (stock) {
          if (data.name) stock.name = data.name.trim();
          if (data.sector) stock.sector = data.sector.trim();
          if (data.beta && !isNaN(data.beta)) stock.beta = parseFloat(data.beta);
          if (data.volatility_factor && !isNaN(data.volatility_factor)) stock.volatility_factor = parseFloat(data.volatility_factor);
          if (data.summary) stock.fundamentals.summary = data.summary.trim();
          if (data.base_price && !isNaN(data.base_price)) {
            stock.base_price = parseFloat(data.base_price);
            if (gameState.elapsedSeconds === 0) {
              stock.currentPrice = stock.base_price;
              stock.dayOpenPrice = stock.base_price;
            }
          }

          saveUniverseToDisk();
          recordAuditEvent('SHARE_EDITED', { ticker: stock.ticker, updates: data });
          broadcastTick();
        }
      }

      // 5.10 Toggle Share Active / Disabled Status
      if (data.action === 'HOST_TOGGLE_SHARE') {
        const stock = companies.find((c) => c.ticker === data.ticker);
        if (stock) {
          stock.isEnabled = !stock.isEnabled;
          saveUniverseToDisk();
          recordAuditEvent('SHARE_TOGGLED', { ticker: stock.ticker, isEnabled: stock.isEnabled });
          broadcastTick();
        }
      }

      // 5.11 Duplicate Existing Share Template
      if (data.action === 'HOST_DUPLICATE_SHARE') {
        const source = companies.find((c) => c.ticker === data.ticker);
        if (source) {
          let copyNum = 2;
          let newTicker = `${source.ticker}_${copyNum}`;
          while (companies.some((c) => c.ticker === newTicker)) {
            copyNum++;
            newTicker = `${source.ticker}_${copyNum}`;
          }

          const dupStock = {
            ...source,
            ticker: newTicker,
            name: `${source.name} (Series ${copyNum})`,
            trendPhase: ((companies.length + copyNum) * 1.73) % (Math.PI * 2),
            trendFreq: 0.012 + (((companies.length + copyNum) % 7) * 0.005),
            sentimentBias: 0,
            history: [{ time: gameState.elapsedSeconds, price: source.currentPrice }]
          };

          companies.push(dupStock);
          Object.values(teams).forEach((t) => {
            t.holdings[newTicker] = 0;
            t.avgBuyPrice[newTicker] = 0;
          });

          saveUniverseToDisk();
          recordAuditEvent('SHARE_DUPLICATED', { source: source.ticker, newTicker });
          broadcastTick();
        }
      }

      // 5.12 Delete Share from Universe
      if (data.action === 'HOST_DELETE_SHARE') {
        const idx = companies.findIndex((c) => c.ticker === data.ticker);
        if (idx !== -1) {
          if (companies.length <= 2) {
            ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'At least 2 shares are required in the universe.' }));
            return;
          }
          const removed = companies.splice(idx, 1)[0];
          Object.values(teams).forEach((t) => {
            delete t.holdings[removed.ticker];
            delete t.avgBuyPrice[removed.ticker];
          });

          saveUniverseToDisk();
          recordAuditEvent('SHARE_DELETED', { ticker: removed.ticker });
          broadcastTick();
        }
      }

      // 5.13 Sector-Wide Halt / Unhalt
      if (data.action === 'HOST_SECTOR_HALT') {
        const targetSector = data.sector;
        const haltAction = data.isHalted !== false;

        companies.forEach((c) => {
          if (c.sector === targetSector && c.isEnabled) {
            c.isHalted = haltAction;
            c.haltDirection = haltAction ? 'MANUAL' : null;
            // CRITICAL: Do NOT reset dayOpenPrice when unhalting sector
          }
        });

        recordAuditEvent('SECTOR_HALT_CHANGED', { sector: targetSector, isHalted: haltAction });
        broadcastTick();
      }

      // 5.14 Randomize Eligible Starting Prices (±5% or ±10%)
      if (data.action === 'HOST_RANDOMIZE_PRICES') {
        const variance = Math.max(1, Math.min(25, parseFloat(data.variancePct) || 5));
        companies.forEach((stock) => {
          if (!stock.isEnabled) return;
          const factor = 1 + (Math.random() * 2 - 1) * (variance / 100);
          stock.base_price = +(stock.base_price * factor).toFixed(2);
          stock.currentPrice = stock.base_price;
          // ONLY reset dayOpenPrice if we're in SETUP mode, not during live trading
          if (gameState.status === 'SETUP' || gameState.elapsedSeconds === 0) {
            stock.dayOpenPrice = stock.base_price;
          }
          stock.dayHigh = stock.base_price;
          stock.dayLow = stock.base_price;
          stock.history = [{ time: gameState.elapsedSeconds, day: gameState.currentDay, price: stock.base_price }];
          stock.multiDayHistory = [{ time: gameState.elapsedSeconds, cumulativeTime: 0, day: gameState.currentDay, price: stock.base_price }];
          stock.historyByDay = {};
        });

        saveUniverseToDisk();
        recordAuditEvent('PRICES_RANDOMIZED', { variancePct: variance });
        broadcastTick();
      }

      // 5.15 Apply Predefined Market Universe Template
      if (data.action === 'HOST_APPLY_MARKET_TEMPLATE') {
        const template = data.templateId; // 'all_active', 'tech_auto_focus', 'high_volatility', 'banking_defensive'

        if (template === 'all_active') {
          companies.forEach((c) => (c.isEnabled = true));
        } else if (template === 'tech_auto_focus') {
          companies.forEach((c) => {
            c.isEnabled = c.sector.includes('Tech') || c.sector.includes('Auto');
          });
        } else if (template === 'high_volatility') {
          companies.forEach((c) => {
            c.isEnabled = true;
            c.volatility_factor = 0.008;
            c.beta = 1.6;
          });
        } else if (template === 'banking_defensive') {
          companies.forEach((c) => {
            c.isEnabled = c.sector.includes('Bank') || c.sector.includes('Pharma');
            c.volatility_factor = 0.003;
          });
        }

        saveUniverseToDisk();
        recordAuditEvent('TEMPLATE_APPLIED', { templateId: template });
        broadcastTick();
      }

      // 5.16 Reset Universe to Clean Factory Baseline
      if (data.action === 'HOST_RESET_UNIVERSE_BASELINE') {
        if (fs.existsSync(ACTIVE_UNIVERSE_FILE)) {
          fs.unlinkSync(ACTIVE_UNIVERSE_FILE);
        }
        loadScenario('live', true);
        broadcastTick();
      }

      // 5.17 Update Event Title & Global Tournament Settings
      if (data.action === 'HOST_UPDATE_EVENT_CONFIG') {
        if (data.title && typeof data.title === 'string') gameState.title = data.title.trim();
        if (data.dayDurationSeconds && !isNaN(data.dayDurationSeconds)) {
          const newDur = parseInt(data.dayDurationSeconds, 10);
          if (newDur >= 60 && newDur !== gameState.dayDurationSeconds) {
            gameState.dayDurationSeconds = newDur;
            if (!gameState.configLocked) {
              recalculateNewsScheduleForDuration(newDur);
            }
          }
        }
        if (data.totalDays && !isNaN(data.totalDays)) gameState.totalDays = parseInt(data.totalDays, 10);
        if (data.circuitBreakerPercent && !isNaN(data.circuitBreakerPercent)) gameState.circuitBreakerPercent = parseFloat(data.circuitBreakerPercent);
        if (data.startingCash && !isNaN(data.startingCash)) gameState.startingCash = parseFloat(data.startingCash);
        if (data.transactionFeeBps !== undefined && !isNaN(data.transactionFeeBps)) {
          gameState.transactionFeeBps = Math.max(0, Math.min(200, parseInt(data.transactionFeeBps, 10)));
        }

        recordAuditEvent('EVENT_CONFIG_UPDATED', { gameState });
        broadcastAll({ type: 'EVENT_CONFIG_CHANGED', title: gameState.title, gameState });
        broadcastTick();
      }

      // 5.18 Custom Team Roster Setup
      if (data.action === 'HOST_CONFIGURE_TEAMS') {
        if (gameState.configLocked) {
          ws.send(JSON.stringify({
            type: 'EVENT_CONFIG_LOCKED',
            reason: 'Team roster and credentials cannot be modified while tournament setup is locked.'
          }));
          return;
        }

        if (Array.isArray(data.teams) && data.teams.length > 0) {
          Object.keys(USERS).forEach((key) => {
            if (USERS[key].role === 'TRADER') delete USERS[key];
          });

          const newTeams = {};
          data.teams.forEach((t, idx) => {
            const teamNum = idx + 1;
            const teamId = `team_${teamNum}`;
            const username = (t.username || `team${teamNum}`).toLowerCase().trim();
            const password = t.password || `trade${teamNum}00`;
            const name = (t.name || `Team ${teamNum}`).trim();
            const members = (t.members || '').trim();
            const startingCash = (t.startingCash && !isNaN(t.startingCash))
              ? parseFloat(t.startingCash)
              : gameState.startingCash;

            USERS[username] = { username, password, role: 'TRADER', id: teamId, name, members };

            const existing = teams[teamId];
            const holdings = {};
            const avgBuyPrice = {};
            companies.forEach((c) => {
              holdings[c.ticker] = existing && !data.resetBalances ? (existing.holdings[c.ticker] || 0) : 0;
              avgBuyPrice[c.ticker] = existing && !data.resetBalances ? (existing.avgBuyPrice[c.ticker] || 0) : 0;
            });

            newTeams[teamId] = {
              id: teamId,
              username,
              name,
              members,
              cash: existing && !data.resetBalances ? existing.cash : startingCash,
              startingCash,
              holdings,
              avgBuyPrice,
              realizedPnl: existing && !data.resetBalances ? (existing.realizedPnl || 0) : 0,
              tradeCount: existing && !data.resetBalances ? existing.tradeCount : 0
            };
          });

          teams = newTeams;
          recordAuditEvent('TEAMS_CONFIGURED', { count: data.teams.length });
          broadcastTick();
        }
      }

      // 5.19 Finalize Championship Explicitly (Separate from Day Completion)
      if (data.action === 'HOST_CONCLUDE_CHAMPIONSHIP' || data.action === 'HOST_FINALIZE_CHAMPIONSHIP') {
        // Require final day to be completed first
        if (gameState.status !== 'DAY_COMPLETED' || gameState.currentDay !== gameState.totalDays) {
          ws.send(JSON.stringify({
            type: 'ACTION_REJECTED',
            reason: `Championship finalization requires the final day (Day ${gameState.totalDays}) to be completed. Current: Day ${gameState.currentDay}/${gameState.totalDays}, Status: ${gameState.status}`
          }));
          return;
        }

        // Generate official final results
        const winnerData = getConcludedLeaderboard();
        const snapshot = generateOfficialResultsSnapshot();
        
        gameState.isPaused = true;
        gameState.isConcluded = true;
        gameState.status = 'CHAMPIONSHIP_CONCLUDED';
        gameState.winnerData = winnerData;
        gameState.finalResultsSnapshot = snapshot;

        recordAuditEvent('CHAMPIONSHIP_FINALIZED', { winners: winnerData, totalDays: gameState.currentDay });
        
        // Send acknowledgment to requesting client first
        ws.send(JSON.stringify({
          type: 'CHAMPIONSHIP_CONCLUDED',
          winnerData,
          snapshot,
          title: gameState.title,
          finalDay: gameState.currentDay
        }));
        
        // Then broadcast to all other clients
        broadcastAll({
          type: 'CHAMPIONSHIP_CONCLUDED',
          winnerData,
          snapshot,
          title: gameState.title,
          finalDay: gameState.currentDay
        });
        broadcastTick();
      }

      // 5.20 Dismiss Podium
      if (data.action === 'HOST_DISMISS_PODIUM') {
        if (!gameState.projectorState) gameState.projectorState = {};
        gameState.projectorState.isWinnerActive = false;
        if (gameState.presentationState) gameState.presentationState.active = false;
        if (gameState.status === 'WINNER_ANNOUNCEMENT') {
          gameState.status = 'CHAMPIONSHIP_CONCLUDED';
        }
        syncDerivedStateFlags(gameState);
        recordAuditEvent('PODIUM_DISMISSED', {});
        broadcastAll({ type: 'PODIUM_DISMISSED' });
        broadcastAll({ type: 'PROJECTOR_STATE_UPDATE', projectorState: gameState.projectorState });
        broadcastTick();
      }

      // 5.21 Host Reset Entire Championship (Dangerous & Secure)
      if (data.action === 'HOST_RESET_ENTIRE_CHAMPIONSHIP') {
        // High-friction verification phrase check
        const confirmVal = (data.confirmation || '').trim().toUpperCase();
        if (confirmVal !== 'RESET' && confirmVal !== 'RESET CHAMPIONSHIP' && confirmVal !== 'RESET THE ENTIRE CHAMPIONSHIP') {
          ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Confirmation phrase "RESET" or "RESET CHAMPIONSHIP" required.' }));
          return;
        }

        // 1. Cancel any active countdown timers or scheduled timers
        if (activeCountdownTimer) {
          clearTimeout(activeCountdownTimer);
          activeCountdownTimer = null;
        }

        // 2. Delete persistent live game state so a reboot won't resurrect old game
        if (fs.existsSync(LIVE_STATE_FILE)) {
          try { fs.unlinkSync(LIVE_STATE_FILE); } catch (e) {}
        }

        // 3. Generate a brand-new Authoritative Event Identity and increment stateVersion
        const oldEventId = gameState.eventId;
        gameState.eventId = 'EVT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        gameState.stateVersion = (gameState.stateVersion || 1) + 1;
        gameState.isReset = true;
        gameState.resetMessage = 'The host has reset the competition. The previous event has ended. Please wait for the host to set up a new event.';

        // 4. Broadcast authoritative reset message with fresh eventId to all connected clients
        broadcastAll({
          type: 'CHAMPIONSHIP_RESET',
          eventId: gameState.eventId,
          oldEventId,
          stateVersion: gameState.stateVersion,
          message: 'The host has reset the competition. You have been logged out. Please wait for the host to set up a new event.'
        });

        // Invalidate active trader sessions so stale orders cannot be placed
        for (const [tkn, sess] of sessions.entries()) {
          if (sess.role === 'TRADER') {
            sessions.delete(tkn);
          }
        }
        wss.clients.forEach((client) => {
          if (client.session && client.session.role === 'TRADER') {
            client.session = null;
            try {
              client.send(JSON.stringify({
                type: 'SESSION_EXPIRED',
                eventId: gameState.eventId,
                message: 'The championship has been reset by the host. Please wait for the host to complete event setup.'
              }));
            } catch (e) {}
          }
        });

        // 5. Reset Game State to pristine Day 1 Setup
        gameState.status = 'RESET';
        gameState.isPaused = true;
        gameState.pauseMode = 'VISIBLE_FROZEN';
        gameState.haltReason = null;
        gameState.elapsedSeconds = 0;
        gameState.currentDay = 1;
        gameState.isConcluded = false;
        gameState.winnerData = null;
        gameState.activeNewsFlash = null;
        gameState.newsHistory = [];
        gameState.scheduledStartTime = null;
        gameState.activeCountdown = null;
        gameState.configLocked = false;
        gameState.totalShiftOffsetSeconds = 0;
        gameState.pauseStartedAt = null;
        gameState.dailyLeaderboards = {};
        gameState.dailyClosingPrices = {};
        gameState.finalResultsSnapshot = null;
        gameState.projectorState = {
          mode: 'AUTO_CYCLE',
          currentScene: 'SCENE_RESET',
          sceneDurationSeconds: 12,
          isWinnerActive: false,
          winnerScene: 'SCENE_INTRO',
          boardPage: 1,
          isBoardPaused: false,
          updatedAt: new Date().toISOString()
        };
        gameState.presentationState = {
          active: false,
          scene: 'SCENE_INTRO',
          currentTeamIndex: 0,
          revealedRanks: [],
          updatedAt: new Date().toISOString()
        };
        executedTrades.length = 0;
        tradeSeqCounter = 0;

        // 6. Reset all teams back to starting cash and zero holdings
        const startingCash = gameState.startingCash || 500000;
        Object.values(teams).forEach((t) => {
          t.cash = startingCash;
          t.startingCash = startingCash;
          t.dayOpeningPortfolioValue = startingCash;
          t.holdings = {};
          t.avgBuyPrice = {};
          t.realizedPnl = 0;
          t.tradeCount = 0;
          companies.forEach((c) => {
            t.holdings[c.ticker] = 0;
            t.avgBuyPrice[c.ticker] = 0;
          });
        });

        // 7. Reset all companies back to starting base prices
        companies.forEach((c) => {
          const base = c.base_price || c.currentPrice || 1000;
          c.currentPrice = base;
          c.dayOpenPrice = base;
          c.previousClosePrice = base;
          c.dayHigh = base;
          c.dayLow = base;
          c.week52High = c.fundamentals && c.fundamentals.high_52w ? parseFloat(c.fundamentals.high_52w) : +(base * 1.25).toFixed(2);
          c.week52Low = c.fundamentals && c.fundamentals.low_52w ? parseFloat(c.fundamentals.low_52w) : +(base * 0.75).toFixed(2);
          c.isNew52WHigh = false;
          c.isNew52WLow = false;
          c.isHalted = false;
          c.haltDirection = null;
          c.activeTransition = null;
          c.history = [{ time: 0, price: base }];
        });

        // 8. Reset all news events and clear per-day fired registry
        newsEvents.forEach((ev) => {
          ev.triggered = false;
          ev.cancelled = false;
          ev.phase = 'SCHEDULED';
          ev.impactsApplied = false;
        });
        firedNewsEventsPerDay.clear();

        recordAuditEvent('CHAMPIONSHIP_FULL_RESET', { triggered_by: 'HOST', newEventId: gameState.eventId });

        // 9. Confirm to Host and broadcast clean state tick
        ws.send(JSON.stringify({
          type: 'CHAMPIONSHIP_RESET_ACK',
          eventId: gameState.eventId,
          message: 'Championship reset successfully. Returned to Day 1 Standby.'
        }));
        broadcastTick();
        broadcastPublicEventStatus();
      }

      // 5.21b Host Disaster Recovery Checkpoints (Save, List, Restore)
      if (data.action === 'HOST_CREATE_CHECKPOINT') {
        const result = createCheckpoint(data.label || 'manual');
        ws.send(JSON.stringify({
          type: 'CHECKPOINT_CREATED_ACK',
          ok: !!result,
          filename: result ? result.filename : null,
          message: result ? `Checkpoint saved successfully (${result.filename})` : 'Failed to create checkpoint.'
        }));
        return;
      }

      if (data.action === 'HOST_LIST_CHECKPOINTS') {
        const list = listCheckpoints();
        ws.send(JSON.stringify({
          type: 'CHECKPOINTS_LIST_ACK',
          ok: true,
          checkpoints: list
        }));
        return;
      }

      if (data.action === 'HOST_RESTORE_CHECKPOINT') {
        let restored = false;
        let sourceDesc = 'manual';
        if (data.filename) {
          const targetFile = path.join(CHECKPOINTS_DIR, path.basename(data.filename));
          if (fs.existsSync(targetFile)) {
            try {
              const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
              restored = restoreFromCheckpointData(parsed, data.filename);
              sourceDesc = data.filename;
            } catch (e) {
              restored = false;
            }
          }
        } else if (data.checkpointData) {
          restored = restoreFromCheckpointData(data.checkpointData, 'uploaded_file');
          sourceDesc = 'uploaded_file';
        }

        if (restored) {
          broadcastAll({
            type: 'MARKET_RESTORED',
            message: `Competition state restored from checkpoint (${sourceDesc}). Market is paused — press Resume 3-2-1 to continue.`,
            gameState
          });
          broadcastTick();
          ws.send(JSON.stringify({
            type: 'CHECKPOINT_RESTORED_ACK',
            ok: true,
            message: 'Game state restored cleanly! Market is paused ready for Host Resume.',
            gameState
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: 'Failed to restore checkpoint: Invalid or missing backup data.'
          }));
        }
        return;
      }

      // 5.22 Host Initialize & Launch New Championship from Setup Wizard
      if (data.action === 'HOST_INITIALIZE_NEW_CHAMPIONSHIP') {
        const config = data.config || {};
        const title = (config.title || 'The Trading Floor Championship 2026').trim();
        const totalDays = Math.max(1, Math.min(10, parseInt(config.totalDays, 10) || 3));
        const dayDurationSeconds = Math.max(60, Math.min(7200, parseInt(config.dayDurationSeconds, 10) || 1800));
        const startingCash = Math.max(1000, parseFloat(config.startingCash) || 500000);
        const transactionFeeBps = Math.max(0, Math.min(200, parseInt(config.transactionFeeBps, 10) || 0));
        const circuitBreakerPercent = Math.max(5, Math.min(50, parseFloat(config.circuitBreakerPercent) || 20));

        // 1. Configure Game State
        gameState.title = title;
        gameState.status = 'STANDBY';
        gameState.configLocked = true;
        gameState.totalDays = totalDays;
        gameState.dayDurationSeconds = dayDurationSeconds;
        gameState.startingCash = startingCash;
        gameState.transactionFeeBps = transactionFeeBps;
        gameState.circuitBreakerPercent = circuitBreakerPercent;
        gameState.currentDay = 1;
        gameState.elapsedSeconds = 0;
        gameState.isPaused = true;
        gameState.pauseStartedAt = Date.now();
        gameState.totalShiftOffsetSeconds = 0;
        gameState.isConcluded = false;
        gameState.winnerData = null;
        gameState.activeNewsFlash = null;
        gameState.newsHistory = [];
        gameState.isReset = false;
        gameState.resetMessage = null;
        gameState.dailyLeaderboards = {};
        gameState.dailyClosingPrices = {};
        gameState.finalResultsSnapshot = null;
        gameState.projectorState = {
          mode: 'AUTO_CYCLE',
          currentScene: 'SCENE_READY',
          sceneDurationSeconds: 12,
          isWinnerActive: false,
          winnerScene: 'SCENE_INTRO',
          boardPage: 1,
          isBoardPaused: false,
          updatedAt: new Date().toISOString()
        };
        gameState.presentationState = {
          active: false,
          scene: 'SCENE_INTRO',
          currentTeamIndex: 0,
          revealedRanks: [],
          updatedAt: new Date().toISOString()
        };

        // 2. Clear Executed Trades & Audit
        executedTrades.length = 0;
        tradeSeqCounter = 0;

        // 3. Reset Company Universe
        const selectedTickers = Array.isArray(config.selectedTickers) && config.selectedTickers.length > 0
          ? config.selectedTickers.map((t) => t.toUpperCase())
          : null;

        companies.forEach((c) => {
          if (selectedTickers) {
            c.isEnabled = selectedTickers.includes(c.ticker);
          }
          c.currentPrice = c.base_price;
          c.dayOpenPrice = c.base_price;
          c.previousClosePrice = c.base_price;
          c.dayHigh = c.base_price;
          c.dayLow = c.base_price;
          c.week52High = c.fundamentals && c.fundamentals.high_52w ? parseFloat(c.fundamentals.high_52w) : +(c.base_price * 1.25).toFixed(2);
          c.week52Low = c.fundamentals && c.fundamentals.low_52w ? parseFloat(c.fundamentals.low_52w) : +(c.base_price * 0.75).toFixed(2);
          c.isNew52WHigh = false;
          c.isNew52WLow = false;
          c.isHalted = false;
          c.haltDirection = null;
          c.activeTransition = null;
          c.history = [{ time: 0, price: c.base_price }];
        });

        // 4. Configure Teams & Passwords
        if (Array.isArray(config.teams) && config.teams.length > 0) {
          Object.keys(USERS).forEach((key) => {
            if (USERS[key].role === 'TRADER') delete USERS[key];
          });

          const newTeams = {};
          config.teams.forEach((t, idx) => {
            const teamNum = idx + 1;
            const teamId = `team_${teamNum}`;
            const username = (t.username || `team${teamNum}`).toLowerCase().trim();
            const password = t.password || `trade${teamNum}00`;
            const name = (t.name || `Team ${teamNum}`).trim();
            const members = (t.members || `Trader ${teamNum}A, Trader ${teamNum}B`).trim();
            const teamCash = (t.startingCash && !isNaN(t.startingCash)) ? parseFloat(t.startingCash) : startingCash;

            USERS[username] = { username, password, role: 'TRADER', id: teamId, name, members };

            const holdings = {};
            const avgBuyPrice = {};
            companies.forEach((c) => {
              holdings[c.ticker] = 0;
              avgBuyPrice[c.ticker] = 0;
            });

            newTeams[teamId] = {
              id: teamId,
              username,
              name,
              members,
              cash: teamCash,
              startingCash: teamCash,
              dayOpeningPortfolioValue: teamCash,
              holdings,
              avgBuyPrice,
              realizedPnl: 0,
              tradeCount: 0
            };
          });
          teams = newTeams;
        } else {
          setupDefaultTeams(12, startingCash);
        }

        // 5. Regenerate fresh news plan for selected stocks and duration
        const enabledTickers = companies.filter((c) => c.isEnabled !== false).map((c) => c.ticker);
        newsEvents = generateAutoNewsPlan(enabledTickers, totalDays, dayDurationSeconds);
        firedNewsEventsPerDay.clear();
        syncDerivedStateFlags(gameState);

        // 6. Persist to disk
        saveUniverseToDisk();
        saveLiveGameState();

        recordAuditEvent('NEW_CHAMPIONSHIP_INITIALIZED', {
          title,
          teamsCount: Object.keys(teams).length,
          activeSharesCount: companies.filter((c) => c.isEnabled).length
        });

        ws.send(JSON.stringify({
          type: 'CHAMPIONSHIP_INITIALIZED_SUCCESS',
          title: gameState.title,
          message: 'New championship configured and ready for live trading.'
        }));
        broadcastTick();
      }
    }
  });

  ws.on('close', () => {
    if (ws.session && ws.session.role === 'SOUND_CONSOLE') {
      soundClients.delete(ws);
      recordAuditEvent('SOUND_CONSOLE_DETACHED', { id: ws.session.id });
      broadcastTick();
    }
  });
});

// ==========================================
// 8. REST ENDPOINTS & CSV/JSON EXPORTS
// ==========================================
function requireHostAuth(req, res, next) {
  const token = req.query.token || req.headers['x-session-token'];
  const session = sessions.get(token);
  if (!session || session.role !== 'HOST') {
    return res.status(403).json({ error: 'Host authorization required.' });
  }
  next();
}

// 8.1 System Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    uptime_seconds: Math.floor(process.uptime()),
    active_scenario: activeScenarioMode,
    is_paused: gameState.isPaused,
    configLocked: !!gameState.configLocked,
    status_phase: gameState.status,
    current_day: gameState.currentDay,
    elapsed_seconds: gameState.elapsedSeconds,
    connected_clients: wss.clients.size,
    total_trades_executed: executedTrades.length,
    companies_count: companies.length,
    active_shares_count: companies.filter((c) => c.isEnabled !== false).length
  });
});

// 8.1b Public Event Status (for login screen & external monitors)
app.get('/api/event-status', (req, res) => {
  res.json({
    eventId: gameState.eventId,
    stateVersion: gameState.stateVersion,
    serverTimeMs: Date.now(),
    title: gameState.title,
    subtitle: gameState.subtitle,
    institution: gameState.institution,
    status: gameState.status,
    configLocked: !!gameState.configLocked,
    totalDays: gameState.totalDays,
    dayDurationSeconds: gameState.dayDurationSeconds,
    startingCash: gameState.startingCash,
    teamsCount: Object.keys(teams).length,
    activeStocksCount: companies.filter((c) => c.isEnabled !== false).length
  });
});

// 8.1c Team Investment Analytics Endpoint (HOST AUTH REQUIRED)
app.get('/api/team-investments', requireHostAuth, (req, res) => {
  const teams = calculateTeamInvestments();
  res.json({
    success: true,
    day: gameState.currentDay,
    totalDays: gameState.totalDays,
    totalTeams: teams.length,
    teams: teams,
    teamInvestments: teams
  });
});

app.get('/api/team-investments/:teamId', requireHostAuth, (req, res) => {
  const teamId = req.params.teamId;
  const investments = calculateTeamInvestments();
  const teamInv = investments.find((t) => t.id === teamId || t.teamId === teamId || t.username === teamId);
  if (!teamInv) {
    return res.status(404).json({ success: false, error: 'Team not found.' });
  }
  // Attach team trade history - filter by actual team_id field from trades
  const teamTrades = executedTrades.filter((tr) => tr.team_id === teamInv.id || tr.teamId === teamInv.id);
  res.json({
    success: true,
    ...teamInv,
    orderHistory: teamTrades.slice(-50).reverse()
  });
});

// 8.2 JSON Audit Log
app.get('/api/audit-log', requireHostAuth, (req, res) => {
  flushAuditLogToDisk();
  res.setHeader('Content-Disposition', `attachment; filename="${auditFilename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(auditLog, null, 2));
});

// 8.3 CSV Final Standings Export
app.get('/api/export/standings', requireHostAuth, (req, res) => {
  const standings = calculateLeaderboard();
  const headers = [
    'Rank', 'Team ID', 'Team Name', 'Members', 'Cash Balance (INR)',
    'Holdings Value (INR)', 'Final Net Worth (INR)', 'Starting Capital (INR)',
    'Absolute P&L (INR)', 'Return Percentage (%)', 'Trades Count'
  ];

  const rows = standings.map((t, idx) => [
    idx + 1,
    sanitizeCsvCell(t.id),
    sanitizeCsvCell(t.name),
    sanitizeCsvCell(t.members),
    t.cash.toFixed(2),
    t.holdingsValue.toFixed(2),
    t.netWorth.toFixed(2),
    t.startingCash ? t.startingCash.toFixed(2) : gameState.startingCash.toFixed(2),
    t.totalPnl.toFixed(2),
    t.pnlPct.toFixed(2) + '%',
    t.tradeCount
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="CHAMPIONSHIP_STANDINGS_${dateStr}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csvContent);
});

// 8.4 CSV Trade History Export
app.get('/api/export/trades', requireHostAuth, (req, res) => {
  const headers = [
    'Trade Seq', 'Time', 'Day', 'Second', 'Team ID', 'Team Name',
    'Action', 'Ticker', 'Quantity', 'Price (INR)', 'Gross Value (INR)',
    'Transaction Fee (INR)', 'Net Impact (INR)', 'Cash Before (INR)', 'Cash After (INR)'
  ];

  const rows = executedTrades.map((t) => [
    t.seq,
    sanitizeCsvCell(t.timestamp),
    t.day,
    t.second,
    sanitizeCsvCell(t.teamId),
    sanitizeCsvCell(t.teamName),
    t.type,
    sanitizeCsvCell(t.ticker),
    t.quantity,
    t.price.toFixed(2),
    t.grossValue.toFixed(2),
    t.fee.toFixed(2),
    t.totalImpact.toFixed(2),
    t.cashBefore.toFixed(2),
    t.cashAfter.toFixed(2)
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="EXECUTED_TRADES_${dateStr}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csvContent);
});

// 8.5 CSV Audit Timeline Export
app.get('/api/export/audit-csv', requireHostAuth, (req, res) => {
  const headers = ['Seq', 'Exact Timestamp', 'Game Day', 'Game Second', 'Event Type', 'Details'];
  const rows = auditLog.timeline_events.map((ev) => {
    const details = JSON.stringify(ev).replace(/"/g, '""');
    return [
      ev.seq,
      sanitizeCsvCell(ev.exact_timestamp),
      ev.game_day,
      ev.game_second,
      sanitizeCsvCell(ev.type),
      `"${details}"`
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="AUDIT_TIMELINE_${dateStr}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csvContent);
});

// 8.6 Export Share Universe (JSON & CSV)
app.get('/api/export/universe', requireHostAuth, (req, res) => {
  const data = companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
    base_price: c.base_price,
    volatility_factor: c.volatility_factor,
    beta: c.beta,
    isEnabled: c.isEnabled !== false,
    lot_presets: c.lot_presets,
    fundamentals: c.fundamentals
  }));
  res.setHeader('Content-Disposition', `attachment; filename="SHARE_UNIVERSE_${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

app.get('/api/export/universe-csv', requireHostAuth, (req, res) => {
  const headers = ['Ticker', 'Company Name', 'Sector', 'Starting Price (INR)', 'Volatility Factor', 'Beta Multiplier', 'Active Status'];
  const rows = companies.map((c) => [
    sanitizeCsvCell(c.ticker),
    sanitizeCsvCell(c.name),
    sanitizeCsvCell(c.sector),
    c.base_price.toFixed(2),
    c.volatility_factor,
    c.beta,
    c.isEnabled ? 'ACTIVE' : 'DISABLED'
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  res.setHeader('Content-Disposition', `attachment; filename="SHARE_UNIVERSE_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + csvContent);
});

// 8.8 Official Results Snapshot
app.get('/api/results-snapshot', requireHostAuth, (req, res) => {
  const snapshot = gameState.finalResultsSnapshot || generateOfficialResultsSnapshot();
  res.setHeader('Content-Disposition', `attachment; filename="RESULTS_SNAPSHOT_${snapshot.snapshotId}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(snapshot, null, 2));
});

// 8.9 Real-Company Market Indices API
app.get('/api/market-indices', (req, res) => {
  const list = calculateMarketIndices();
  const map = {};
  list.forEach((idx) => { map[idx.id] = idx; });
  res.json({
    timestamp: new Date().toISOString(),
    indices: map,
    indicesList: list
  });
});

// 8.10 Team Macro Sector Allocations API (Public Privacy-Safe, Zero Ticker Leakage)
app.get('/api/sector-allocations', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    allocations: calculateTeamSectorAllocations()
  });
});

// 8.11 Event Anchor Commentary Prompts API
app.get('/api/anchor-commentary', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    prompts: generateAnchorCommentary()
  });
});

// 8.12 Projector State API
app.get('/api/projector-state', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    projectorState: gameState.projectorState || {
      mode: 'AUTO_CYCLE',
      currentScene: 'SCENE_MARKET_BOARD',
      sceneDurationSeconds: 12,
      isWinnerActive: false,
      winnerScene: 'SCENE_INTRO'
    }
  });
});

// 8.13 Daily Results & Leaderboard Snapshots API
app.get('/api/daily-snapshot/:day', (req, res) => {
  const day = req.params.day;
  const snapshot = gameState.dailyLeaderboards && gameState.dailyLeaderboards[`day_${day}`];
  if (!snapshot) {
    return res.status(404).json({ error: `Daily snapshot for Day ${day} not finalized yet.` });
  }
  res.json(snapshot);
});

// 8.7 Complete Competition Backup & Restore
app.get('/api/backup', requireHostAuth, (req, res) => {
  const backupData = {
    backup_timestamp: new Date().toISOString(),
    gameState,
    companies,
    newsEvents,
    teams,
    executedTrades,
    auditLog
  };
  res.setHeader('Content-Disposition', `attachment; filename="COMPETITION_BACKUP_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(backupData, null, 2));
});

app.post('/api/restore', requireHostAuth, (req, res) => {
  try {
    const backup = req.body;
    const ok = restoreFromCheckpointData(backup, 'http_restore');
    if (ok) {
      broadcastAll({
        type: 'MARKET_RESTORED',
        message: 'Competition state restored from backup file. Market is paused — press Resume 3-2-1 to continue.',
        gameState
      });
      broadcastTick();
      res.json({ success: true, message: 'Championship state restored successfully. Market is paused ready for Host Resume.' });
    } else {
      res.status(400).json({ error: 'Invalid competition backup file format.' });
    }
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

app.get('/api/checkpoints', requireHostAuth, (req, res) => {
  res.json({ checkpoints: listCheckpoints() });
});

// Boot Initial Scenario
const cliMode = (process.argv[2] || '').toLowerCase();
const initialScenario = cliMode === 'test'
  ? 'test'
  : (fs.existsSync(path.join(DATA_DIR, 'scenario_live.json')) ? 'live' : 'test');

if (cliMode !== 'test' && restoreLiveGameState()) {
  // Restored from crash recovery cleanly
} else {
  loadScenario(initialScenario);
}

// Detect LAN IP for projector and student laptops/phones
server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let lanIp = 'localhost';
  Object.keys(nets).forEach((name) => {
    nets[name].forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
      }
    });
  });

  console.log('================================================================');
  console.log(` 🚀 THE TRADING FLOOR ENGINE ONLINE [${activeScenarioMode.toUpperCase()} MODE]`);
  console.log('================================================================');
  console.log(` • Event Title:       ${gameState.title}`);
  console.log(` • Local PC URL:      http://localhost:${PORT}`);
  console.log(` • Router LAN URL:    http://${lanIp}:${PORT}`);
  console.log('----------------------------------------------------------------');
  console.log(' Credentials:');
  console.log('   Host Matrix:       host / host2026');
  console.log('   Stage Projector:   projector / screen2026');
  console.log('   Trader Teams:      team1..team16 / trade100..trade1600');
  console.log('================================================================');
});
