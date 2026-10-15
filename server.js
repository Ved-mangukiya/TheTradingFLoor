const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

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
  projector: { username: 'projector', password: 'screen2026', role: 'PROJECTOR', id: 'PROJECTOR', name: 'Main Stage Projector' }
};

// token -> { token, role, id, name, username, members, lastOrderAt }
const sessions = new Map();

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

let seqCounter = 0;
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
}

function flushAuditLogToDisk() {
  fs.writeFile(auditFilePath, JSON.stringify(auditLog, null, 2), (err) => {
    if (err) console.error('[AUDIT ERROR]', err.message);
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
  title: 'The Trading Floor - Championship 2026',
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
  winnerData: null
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
      holdings,
      avgBuyPrice,
      realizedPnl: 0,
      tradeCount: 0
    };
  }
}

// Persist customized active universe
const ACTIVE_UNIVERSE_FILE = path.join(DATA_DIR, 'universe_active.json');

function saveUniverseToDisk() {
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
    title: meta.title || 'The Trading Floor - Championship 2026',
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
    winnerData: null
  };

  let rawCompanies = scenarioData.companies;
  if (!forceBaseline && fs.existsSync(ACTIVE_UNIVERSE_FILE) && activeScenarioMode === 'live') {
    try {
      rawCompanies = JSON.parse(fs.readFileSync(ACTIVE_UNIVERSE_FILE, 'utf-8'));
    } catch (e) {
      rawCompanies = scenarioData.companies;
    }
  }

  companies = rawCompanies.map((c) => ({
    ticker: (c.ticker || '').toUpperCase().trim(),
    name: c.name || c.ticker,
    sector: c.sector || 'General',
    base_price: parseFloat(c.base_price) || 100,
    lot_presets: Array.isArray(c.lot_presets) && c.lot_presets.length > 0 ? c.lot_presets : [1, 5, 10, 50, 100],
    beta: parseFloat(c.beta) || 1.0,
    volatility_factor: parseFloat(c.volatility_factor) || 0.004,
    min_price: parseFloat(c.min_price) || 1,
    max_price: parseFloat(c.max_price) || 50000,
    isEnabled: c.isEnabled !== false,
    fundamentals: c.fundamentals || {},
    currentPrice: parseFloat(c.base_price) || 100,
    dayOpenPrice: parseFloat(c.base_price) || 100,
    previousClosePrice: parseFloat(c.base_price) || 100,
    dayHigh: parseFloat(c.base_price) || 100,
    dayLow: parseFloat(c.base_price) || 100,
    isHalted: false,
    haltDirection: null,
    activeTransition: null,
    history: [{ time: 0, price: parseFloat(c.base_price) || 100 }]
  }));

  newsEvents = scenarioData.news_events.map((ev) => ({
    ...ev,
    triggered: false
  }));

  setupDefaultTeams(12, gameState.startingCash);
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
function triggerNewsEvent(eventObj, triggeredBy = 'SCHEDULE') {
  eventObj.triggered = true;
  const impacts = eventObj.impacts || {};
  const tickMs = gameState.tickIntervalMs;

  if (impacts.GLOBAL_WEIGHTED) {
    const basePct = impacts.GLOBAL_WEIGHTED.base_pct;
    const durationSec = impacts.GLOBAL_WEIGHTED.duration_sec || 60;
    const steps = Math.max(1, Math.round((durationSec * 1000) / tickMs));

    companies.forEach((stock) => {
      if (!stock.isEnabled || stock.isHalted) return;
      const shockPct = basePct * stock.beta;
      const currentRef = stock.activeTransition ? stock.activeTransition.targetPrice : stock.currentPrice;
      const targetPrice = +(currentRef * (1 + shockPct / 100)).toFixed(2);
      stock.activeTransition = {
        targetPrice,
        stepsRemaining: steps,
        stepDelta: (targetPrice - stock.currentPrice) / steps
      };
    });
  } else {
    Object.keys(impacts).forEach((ticker) => {
      const stock = companies.find((s) => s.ticker === ticker);
      if (!stock || !stock.isEnabled || stock.isHalted) return;
      const { delta_pct, duration_sec } = impacts[ticker];
      const steps = Math.max(1, Math.round(((duration_sec || 45) * 1000) / tickMs));
      const currentRef = stock.activeTransition ? stock.activeTransition.targetPrice : stock.currentPrice;
      const targetPrice = +(currentRef * (1 + delta_pct / 100)).toFixed(2);
      stock.activeTransition = {
        targetPrice,
        stepsRemaining: steps,
        stepDelta: (targetPrice - stock.currentPrice) / steps
      };
    });
  }

  const newsRecord = {
    event_id: eventObj.event_id,
    day: gameState.currentDay,
    second: gameState.elapsedSeconds,
    type: eventObj.type,
    headline: eventObj.headline,
    simple_explanation: eventObj.simple_explanation,
    impacts: eventObj.impacts,
    timestamp: new Date().toLocaleTimeString()
  };

  gameState.activeNewsFlash = newsRecord;
  gameState.newsHistory.unshift(newsRecord);

  recordAuditEvent('NEWS_TRIGGERED', {
    triggered_by: triggeredBy,
    event_id: eventObj.event_id,
    headline: eventObj.headline,
    impacts: eventObj.impacts
  });

  broadcastAll({
    type: 'NEWS_FLASH',
    news: newsRecord
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

  broadcastAll({
    type: 'CIRCUIT_BREAKER_ALERT',
    ticker: stock.ticker,
    name: stock.name,
    direction,
    price: stock.currentPrice
  });
}

// ==========================================
// 5. REAL-TIME ENGINE LOOPS
// ==========================================
setInterval(() => {
  if (gameState.isPaused || gameState.isConcluded) return;

  gameState.elapsedSeconds++;

  newsEvents.forEach((ev) => {
    if (!ev.triggered && ev.day === gameState.currentDay && ev.trigger_second === gameState.elapsedSeconds) {
      triggerNewsEvent(ev, 'AUTO_CLOCK');
    }
  });

  if (gameState.elapsedSeconds >= gameState.dayDurationSeconds) {
    gameState.isPaused = true;
    gameState.pauseStartedAt = Date.now();
    recordAuditEvent('DAY_CLOSE', { day: gameState.currentDay });
    broadcastAll({ type: 'BELL_EVENT', bell: 'CLOSE', day: gameState.currentDay });

    if (gameState.currentDay >= gameState.totalDays) {
      const winnerData = getConcludedLeaderboard();
      gameState.isConcluded = true;
      gameState.winnerData = winnerData;
      broadcastAll({
        type: 'CHAMPIONSHIP_CONCLUDED',
        winnerData,
        title: gameState.title
      });
    }
    broadcastTick();
  }
}, 1000);

function restartEngineInterval() {
  if (priceLoopHandle) clearInterval(priceLoopHandle);

  priceLoopHandle = setInterval(() => {
    if (gameState.isPaused || gameState.isConcluded) return;

    companies.forEach((stock) => {
      if (!stock.isEnabled) return;

      if (stock.isHalted) {
        stock.history.push({ time: gameState.elapsedSeconds, price: stock.currentPrice });
        return;
      }

      // 1. Process active news transition
      if (stock.activeTransition && stock.activeTransition.stepsRemaining > 0) {
        stock.activeTransition.stepDelta = (stock.activeTransition.targetPrice - stock.currentPrice) / stock.activeTransition.stepsRemaining;
        stock.currentPrice += stock.activeTransition.stepDelta;
        stock.activeTransition.stepsRemaining--;
        if (stock.activeTransition.stepsRemaining <= 0) {
          stock.activeTransition = null;
        }
      }

      // 2. Realistic Gaussian + micro-drift
      const gaussianComponent = gaussianRandom() * stock.volatility_factor * stock.currentPrice * 0.35;
      const microDrift = (Math.random() - 0.495) * 2 * stock.volatility_factor * stock.currentPrice * 0.65;
      const totalDrift = gaussianComponent + microDrift;

      const minBound = stock.min_price || 1;
      const maxBound = stock.max_price || 100000;
      stock.currentPrice = Math.max(minBound, Math.min(maxBound, +(stock.currentPrice + totalDrift).toFixed(2)));

      if (stock.currentPrice > stock.dayHigh) stock.dayHigh = stock.currentPrice;
      if (stock.currentPrice < stock.dayLow) stock.dayLow = stock.currentPrice;

      // 3. Track history
      stock.history.push({ time: gameState.elapsedSeconds, price: stock.currentPrice });

      // 4. Circuit Breaker Check
      const dayDelta = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
      if (Math.abs(dayDelta) >= gameState.circuitBreakerPercent && !stock.isHalted) {
        triggerCircuitBreaker(stock, dayDelta > 0 ? 'UPPER' : 'LOWER');
      }
    });

    broadcastTick();
    appendSecondLog();
  }, gameState.tickIntervalMs);
}

function appendSecondLog() {
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
      if (!c.isEnabled) return;
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
    return b.tradeCount - a.tradeCount;
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

function getSanitizedPublicState(role, teamId) {
  // Publicly visible stocks: only enabled stocks
  const enabledStocks = companies.filter((c) => c.isEnabled !== false);

  const payload = {
    type: 'TICK_UPDATE',
    scenarioMode: activeScenarioMode,
    gameState: {
      title: gameState.title,
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
      newsHistory: gameState.newsHistory,
      isConcluded: gameState.isConcluded,
      winnerData: gameState.winnerData
    },
    companies: enabledStocks.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      base_price: c.base_price,
      currentPrice: c.currentPrice,
      dayOpenPrice: c.dayOpenPrice,
      dayHigh: c.dayHigh,
      dayLow: c.dayLow,
      lot_presets: c.lot_presets,
      beta: c.beta,
      isHalted: c.isHalted,
      haltDirection: c.haltDirection,
      fundamentals: c.fundamentals,
      history: c.history.slice(-180)
    }))
  };

  if (role === 'TRADER' && teams[teamId]) {
    const t = teams[teamId];
    let holdingsValue = 0;
    let unrealizedPnl = 0;
    companies.forEach((c) => {
      if (!c.isEnabled) return;
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
    payload.recentTrades = executedTrades.slice(-25).reverse();
    // Complete share universe for Host Share Universe Manager
    payload.allCompaniesUniverse = companies.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      base_price: c.base_price,
      currentPrice: c.currentPrice,
      dayOpenPrice: c.dayOpenPrice,
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
  }

  if (role === 'PROJECTOR') {
    payload.leaderboard = calculateLeaderboard().slice(0, 5);
  }

  return payload;
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

// ==========================================
// 7. WEBSOCKET MESSAGE ROUTER
// ==========================================
wss.on('connection', (ws) => {
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
      ws.session = existing;
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
        sessions.delete(ws.session.token);
        recordAuditEvent('CLIENT_LOGOUT', { role: ws.session.role, id: ws.session.id });
        ws.session = null;
      }
      ws.send(JSON.stringify({ type: 'LOGOUT_SUCCESS' }));
      return;
    }

    const session = sessions.get(data.session_token);
    if (!session) {
      ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Unauthorized or expired session.' }));
      return;
    }

    // --- 4. TRADER ORDER EXECUTION ---
    if (data.action === 'ORDER' && session.role === 'TRADER') {
      if (gameState.isPaused || gameState.isConcluded) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Market is currently paused or championship concluded.' }));
        return;
      }

      const nowMs = Date.now();
      if (nowMs - session.lastOrderAt < 200) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Order rate limit exceeded. Please wait a moment.' }));
        return;
      }
      session.lastOrderAt = nowMs;

      const team = teams[session.id];
      const stock = companies.find((c) => c.ticker === data.ticker);
      const qty = parseInt(data.quantity, 10);

      if (!team || !stock || isNaN(qty) || qty <= 0 || qty > 1000000) {
        ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Invalid order parameters.' }));
        return;
      }

      // Check if stock is enabled in universe
      if (stock.isEnabled === false) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason: `Trading is not enabled for ${stock.ticker} in this market universe.`
        }));
        return;
      }

      if (stock.isHalted) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          reason: `Trading halted in ${stock.ticker} (${stock.haltDirection} Circuit Breaker).`
        }));
        return;
      }

      const execPrice = stock.currentPrice;
      const grossValue = +(execPrice * qty).toFixed(2);
      const feeBps = gameState.transactionFeeBps || 0;
      const feeAmount = +((grossValue * feeBps) / 10000).toFixed(2);
      const cashBefore = +team.cash.toFixed(2);

      if (data.type === 'BUY') {
        const totalDeduction = +(grossValue + feeAmount).toFixed(2);
        if (team.cash < totalDeduction) {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Insufficient cash. Needed ₹${totalDeduction.toLocaleString('en-IN')} (incl. ₹${feeAmount} fee), available ₹${team.cash.toLocaleString('en-IN')}.`
          }));
          return;
        }

        const prevQty = team.holdings[stock.ticker] || 0;
        const prevCost = prevQty * (team.avgBuyPrice[stock.ticker] || 0);
        team.cash = +(team.cash - totalDeduction).toFixed(2);
        team.holdings[stock.ticker] = prevQty + qty;
        team.avgBuyPrice[stock.ticker] = +((prevCost + grossValue) / (prevQty + qty)).toFixed(2);
        team.tradeCount++;

        tradeSeqCounter++;
        const tradeRecord = {
          tradeId: `TRD_${tradeSeqCounter}`,
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
      } else if (data.type === 'SELL') {
        const currentHolding = team.holdings[stock.ticker] || 0;
        if (currentHolding < qty) {
          ws.send(JSON.stringify({
            type: 'ORDER_REJECTED',
            reason: `Insufficient shares. You hold ${currentHolding} of ${stock.ticker}, tried to sell ${qty}.`
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

        tradeSeqCounter++;
        const tradeRecord = {
          tradeId: `TRD_${tradeSeqCounter}`,
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

    // --- 5. HOST MATRIX & ADVANCED SHARE MANAGEMENT ---
    if (session.role === 'HOST') {
      // 5.1 Market Pause
      if (data.action === 'HOST_PAUSE') {
        if (!gameState.isPaused) {
          gameState.isPaused = true;
          gameState.pauseStartedAt = Date.now();
          recordAuditEvent('EMERGENCY_PAUSE', { triggered_by: 'HOST', shift_offset_applied_seconds: gameState.totalShiftOffsetSeconds });
          broadcastAll({ type: 'MARKET_PAUSED' });
          broadcastTick();
        }
      }

      // 5.2 Market Resume with 3-2-1
      if (data.action === 'HOST_RESUME_COUNTDOWN') {
        if (gameState.isPaused) {
          const pausedDurationSec = gameState.pauseStartedAt
            ? Math.round((Date.now() - gameState.pauseStartedAt) / 1000)
            : 0;
          gameState.totalShiftOffsetSeconds += pausedDurationSec;

          broadcastAll({ type: 'COUNTDOWN_START', seconds: 3 });

          setTimeout(() => {
            gameState.isPaused = false;
            gameState.pauseStartedAt = null;
            recordAuditEvent('MARKET_RESUMED', {
              triggered_by: 'HOST',
              shift_offset_applied_seconds: pausedDurationSec,
              cumulative_shift_offset_seconds: gameState.totalShiftOffsetSeconds
            });
            if (gameState.elapsedSeconds === 0) {
              broadcastAll({ type: 'BELL_EVENT', bell: 'OPEN', day: gameState.currentDay });
            }
            broadcastTick();
          }, 3000);
        }
      }

      // 5.3 Next Day
      if (data.action === 'HOST_NEXT_DAY') {
        if (gameState.currentDay < gameState.totalDays) {
          gameState.currentDay++;
          gameState.elapsedSeconds = 0;
          gameState.isPaused = true;
          gameState.pauseStartedAt = Date.now();

          companies.forEach((stock) => {
            stock.previousClosePrice = stock.currentPrice;
            stock.dayOpenPrice = stock.currentPrice;
            stock.dayHigh = stock.currentPrice;
            stock.dayLow = stock.currentPrice;
            stock.isHalted = false;
            stock.haltDirection = null;
            stock.activeTransition = null;
            stock.history = [{ time: 0, price: stock.currentPrice }];
          });

          recordAuditEvent('ADVANCE_DAY', { new_day: gameState.currentDay });
          broadcastTick();
        }
      }

      // 5.4 Trigger Existing Scheduled News
      if (data.action === 'HOST_TRIGGER_NEWS') {
        const ev = newsEvents.find((e) => e.event_id === data.event_id);
        if (ev) {
          triggerNewsEvent(ev, 'HOST_MANUAL');
          broadcastTick();
        }
      }

      // 5.5 Create Custom Breaking News
      if (data.action === 'HOST_CREATE_CUSTOM_NEWS') {
        const headline = (data.headline || '').trim();
        const explanation = (data.explanation || '').trim();
        const type = (data.type || 'SPECIAL SHOCK').toUpperCase().trim();
        const ticker = (data.ticker || '').trim().toUpperCase();
        const deltaPct = parseFloat(data.deltaPct);
        const durationSec = parseInt(data.durationSec, 10) || 45;

        if (headline && !isNaN(deltaPct)) {
          const customId = `CUSTOM_${Date.now().toString().slice(-4)}`;
          const impacts = {};

          if (ticker === 'ALL' || ticker === 'GLOBAL') {
            impacts.GLOBAL_WEIGHTED = { base_pct: deltaPct, duration_sec: durationSec };
          } else {
            impacts[ticker] = { delta_pct: deltaPct, duration_sec: durationSec };
          }

          const customEventObj = {
            event_id: customId,
            day: gameState.currentDay,
            trigger_second: gameState.elapsedSeconds,
            type,
            headline,
            simple_explanation: explanation || `${ticker} impacted by ${deltaPct > 0 ? '+' : ''}${deltaPct}%`,
            impacts
          };

          newsEvents.unshift(customEventObj);
          triggerNewsEvent(customEventObj, 'HOST_CUSTOM');
          broadcastTick();
        }
      }

      // 5.6 Unhalt Stock
      if (data.action === 'HOST_UNHALT_STOCK') {
        const stock = companies.find((c) => c.ticker === data.ticker);
        if (stock) {
          stock.isHalted = false;
          stock.haltDirection = null;
          stock.dayOpenPrice = stock.currentPrice;
          recordAuditEvent('CIRCUIT_BREAKER_RELEASED', { ticker: stock.ticker, new_reference_price: stock.currentPrice });
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
            history: [{ time: gameState.elapsedSeconds, price: base_price }],
            fundamentals: { summary }
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
            if (!haltAction) c.dayOpenPrice = c.currentPrice;
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
          stock.dayOpenPrice = stock.base_price;
          stock.dayHigh = stock.base_price;
          stock.dayLow = stock.base_price;
          stock.history = [{ time: gameState.elapsedSeconds, price: stock.base_price }];
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
        if (data.dayDurationSeconds && !isNaN(data.dayDurationSeconds)) gameState.dayDurationSeconds = parseInt(data.dayDurationSeconds, 10);
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

      // 5.19 Conclude Championship & Launch Winner Podium
      if (data.action === 'HOST_CONCLUDE_CHAMPIONSHIP') {
        const winnerData = getConcludedLeaderboard();
        gameState.isPaused = true;
        gameState.isConcluded = true;
        gameState.winnerData = winnerData;

        recordAuditEvent('CHAMPIONSHIP_CONCLUDED', { winners: winnerData });
        broadcastAll({ type: 'CHAMPIONSHIP_CONCLUDED', winnerData, title: gameState.title });
        broadcastTick();
      }

      // 5.20 Dismiss Podium
      if (data.action === 'HOST_DISMISS_PODIUM') {
        gameState.isConcluded = false;
        gameState.winnerData = null;
        recordAuditEvent('PODIUM_DISMISSED', {});
        broadcastAll({ type: 'PODIUM_DISMISSED' });
        broadcastTick();
      }
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
    current_day: gameState.currentDay,
    elapsed_seconds: gameState.elapsedSeconds,
    connected_clients: wss.clients.size,
    total_trades_executed: executedTrades.length,
    companies_count: companies.length,
    active_shares_count: companies.filter((c) => c.isEnabled).length
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
    if (!backup || !backup.gameState || !Array.isArray(backup.companies)) {
      return res.status(400).json({ error: 'Invalid competition backup file format.' });
    }

    gameState = backup.gameState;
    companies = backup.companies;
    if (Array.isArray(backup.newsEvents)) newsEvents = backup.newsEvents;
    if (backup.teams && typeof backup.teams === 'object') teams = backup.teams;
    if (Array.isArray(backup.executedTrades)) {
      executedTrades.length = 0;
      backup.executedTrades.forEach((t) => executedTrades.push(t));
      tradeSeqCounter = executedTrades.length;
    }

    saveUniverseToDisk();
    recordAuditEvent('COMPETITION_RESTORED', { timestamp: backup.backup_timestamp });
    broadcastTick();
    res.json({ success: true, message: 'Championship state restored successfully.' });
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

// Boot Initial Scenario
const cliMode = (process.argv[2] || '').toLowerCase();
const initialScenario = cliMode === 'test'
  ? 'test'
  : (fs.existsSync(path.join(DATA_DIR, 'scenario_live.json')) ? 'live' : 'test');

loadScenario(initialScenario);

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
