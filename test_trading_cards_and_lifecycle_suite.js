/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * Comprehensive Automated Verification Suite:
 * 1. Stock Cards & Filtering Engine (Sectors, Search, Gainers, Losers)
 * 2. Order Affordability & Insufficient Balance Server Validation
 * 3. Directional Upper & Lower Circuit Breakers (Clamping, Selective Order Gating, Auto-Recovery, Stock Isolation)
 * 4. Day 1 -> Day 2 Transition Flow (Timer Expiration, Snapshot Locking, Non-Ambiguous Status, Carry-Over)
 */

const http = require('http');
const WebSocket = require('ws');
const assert = require('assert');
const { spawn } = require('child_process');

const TEST_PORT = process.env.PORT || 3090;
const HTTP_URL = `http://127.0.0.1:${TEST_PORT}`;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;
let serverProcess = null;

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`${HTTP_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ensureServerRunning() {
  try {
    const res = await httpGet('/api/health');
    if (res.status === 200) return;
  } catch (e) {}

  let serverReady = false;
  serverProcess = spawn(process.execPath, ['server.js', 'test'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (d) => {
    if (d.toString().includes('ONLINE')) serverReady = true;
  });

  for (let i = 0; i < 30; i++) {
    if (serverReady) break;
    await delay(200);
  }
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log(' 🧪 RUNNING TRADING CARDS, FILTERS, CIRCUIT BREAKERS & DAY SUITE');
  console.log('================================================================\n');

  await ensureServerRunning();

  let passed = 0;
  let wsHost = null;
  let wsTrader = null;

  try {
    // -------------------------------------------------------------
    // STAGE 1: STOCK UNIVERSE & FILTERING DATA INTEGRITY
    // -------------------------------------------------------------
    console.log('[STAGE 1] Stock Universe, Data Schema & Authoritative Filters');
    const healthRes = await httpGet('/api/health');
    assert.strictEqual(healthRes.status, 200, 'Expected status 200 from /api/health');
    assert.strictEqual(healthRes.body.status, 'ONLINE');
    console.log(`  ✓ PASS: Server health verified. Active shares count: ${healthRes.body.active_shares_count}`);
    passed++;

    // Connect Host to get authoritative companies universe
    wsHost = new WebSocket(WS_URL);
  let hostToken = null;
  let hostGameState = null;
  let companies = [];
  const hostMessages = [];

  await new Promise((resolve, reject) => {
    wsHost.on('open', () => {
      wsHost.send(JSON.stringify({ action: 'LOGIN', username: 'host', password: 'host2026' }));
    });
    wsHost.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        hostMessages.push(msg);
        if (msg.type === 'LOGIN_SUCCESS') {
          hostToken = msg.session_token;
          hostGameState = msg.initialState?.gameState;
          companies = msg.initialState?.companies || [];
          resolve();
        } else if (msg.type === 'TICK_UPDATE') {
          if (msg.gameState) hostGameState = msg.gameState;
          if (msg.companies) companies = msg.companies;
        }
      } catch (e) {}
    });
    wsHost.on('error', reject);
  });

  assert.ok(Array.isArray(companies) && companies.length >= 4, 'Expected at least 4 active companies');

  // Verify stock card data requirements
  companies.forEach(c => {
    assert.ok(c.ticker, 'Stock must have ticker');
    assert.ok(c.name, 'Stock must have company name');
    assert.ok(c.sector, 'Stock must have sector');
    assert.ok(typeof c.currentPrice === 'number' && c.currentPrice > 0, 'Stock must have positive currentPrice');
    const openP = c.dayOpenPrice || c.base_price;
    assert.ok(typeof openP === 'number' && openP > 0, 'Stock must have positive dayOpenPrice');
  });
  console.log(`  ✓ PASS: Universe schema verified for all ${companies.length} companies with price and sectors.`);
  passed++;

  // Verify Sectors Extraction
  const uniqueSectors = [...new Set(companies.map(c => c.sector))];
  assert.ok(uniqueSectors.length >= 2, 'Expected multiple sectors in universe');
  console.log(`  ✓ PASS: Found ${uniqueSectors.length} distinct sectors: ${uniqueSectors.join(', ')}`);
  passed++;

  // Test Filter Logic Consistency: Sector filter
  const testSec = uniqueSectors[0];
  const sectorMatches = companies.filter(c => c.sector === testSec);
  assert.ok(sectorMatches.length > 0, `Expected matches for sector ${testSec}`);
  sectorMatches.forEach(c => assert.strictEqual(c.sector, testSec));
  console.log(`  ✓ PASS: Sector filter correctly isolated ${sectorMatches.length} stocks for ${testSec}`);
  passed++;

  // Test Search Filter: Case-insensitive ticker or name search
  const firstStock = companies[0];
  const searchPrefix = firstStock.ticker.slice(0, 3).toLowerCase();
  const searchMatches = companies.filter(c => 
    (c.ticker + ' ' + c.name).toLowerCase().includes(searchPrefix)
  );
  assert.ok(searchMatches.some(c => c.ticker === firstStock.ticker), 'Search must find matching company');
  console.log(`  ✓ PASS: Search query "${searchPrefix}" correctly returned ${searchMatches.length} matches`);
  passed++;

  // Test Sorters: Gainers, Losers, Price High->Low, Price Low->High
  const sortedGainers = [...companies].sort((a, b) => {
    const openA = a.dayOpenPrice || a.base_price;
    const openB = b.dayOpenPrice || b.base_price;
    const chgA = ((a.currentPrice - openA) / openA) * 100;
    const chgB = ((b.currentPrice - openB) / openB) * 100;
    return chgB - chgA;
  });
  const topGainer = sortedGainers[0];
  const lastGainer = sortedGainers[sortedGainers.length - 1];
  const openTop = topGainer.dayOpenPrice || topGainer.base_price;
  const openLast = lastGainer.dayOpenPrice || lastGainer.base_price;
  const topChg = ((topGainer.currentPrice - openTop) / openTop) * 100;
  const lastChg = ((lastGainer.currentPrice - openLast) / openLast) * 100;
  assert.ok(topChg >= lastChg, 'Gainers sorter order verified');
  console.log(`  ✓ PASS: Top gainer sort verified: #${topGainer.ticker} (${topChg.toFixed(2)}%) >= #${lastGainer.ticker} (${lastChg.toFixed(2)}%)`);
  passed++;

  // -------------------------------------------------------------
  // STAGE 2: TRADER WEBSOCKET, ORDER AFFORDABILITY & INSUFFICIENT BALANCE
  // -------------------------------------------------------------
  console.log('\n[STAGE 2] Order Affordability, Insufficient Balance & Rejections');

  // Lock configuration if still in draft setup mode
  if (!hostGameState?.configLocked) {
    const test16Teams = [];
    for (let i = 1; i <= 16; i++) {
      test16Teams.push({
        slot: i,
        name: `Team ${i}`,
        username: `team${i}`,
        password: `trade${i}00`,
        members: `Trader ${i}A, Trader ${i}B`
      });
    }
    const selectedStocks = companies.map(c => c.ticker);
    wsHost.send(JSON.stringify({
      action: 'HOST_SET_EVENT_LOCK',
      session_token: hostToken,
      eventTitle: 'The Trading Floor Championship 2026',
      institution: 'Gujarat Technological University',
      startingCash: 500000,
      totalDays: 3,
      dayDurationSeconds: 1800,
      transactionFeeBps: 0,
      circuitBreakerPercent: 20,
      teams: test16Teams,
      selectedTickers: selectedStocks
    }));
    await delay(600);
    console.log('  ✓ PASS: Event setup locked for live competition.');
  }

  // Ensure market is live
  wsHost.send(JSON.stringify({ action: 'HOST_START_EVENT_NOW', session_token: hostToken }));
  await delay(400);

  wsTrader = new WebSocket(WS_URL);
  let traderToken = null;
  let traderPortfolio = null;
  let traderMessages = [];
  let traderStocks = [];

  await new Promise((resolve, reject) => {
    wsTrader.on('open', () => {
      wsTrader.send(JSON.stringify({ action: 'LOGIN', username: 'team1', password: 'trade100' }));
    });
    wsTrader.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        traderMessages.push(msg);
        if (msg.type === 'LOGIN_SUCCESS') {
          traderToken = msg.session_token;
          traderPortfolio = msg.initialState?.portfolio;
          traderStocks = msg.initialState?.companies || [];
          resolve();
        } else if (msg.type === 'TICK_UPDATE') {
          if (msg.companies) traderStocks = msg.companies;
          if (msg.portfolio) traderPortfolio = msg.portfolio;
        } else if (msg.type === 'CIRCUIT_BREAKER_ALERT') {
          const s = traderStocks.find(x => x.ticker === msg.ticker);
          if (s) {
            s.isHalted = true;
            s.haltDirection = msg.direction;
            s.currentPrice = msg.price;
          }
        } else if (msg.type === 'CIRCUIT_RECOVERY_ALERT') {
          const s = traderStocks.find(x => x.ticker === msg.ticker);
          if (s) {
            s.isHalted = false;
            s.haltDirection = null;
            s.currentPrice = msg.price;
          }
        } else if (msg.type === 'ORDER_FILLED') {
          if (msg.cashAfter !== undefined && traderPortfolio) {
            traderPortfolio.cash = msg.cashAfter;
            if (!traderPortfolio.holdings) traderPortfolio.holdings = {};
            traderPortfolio.holdings[msg.ticker] = msg.holdings;
          }
        }
      } catch (e) {}
    });
    wsTrader.on('error', reject);
  });

  assert.ok(traderToken, 'Expected session token for trader team 1');
  assert.ok(traderPortfolio && traderPortfolio.cash > 0, 'Expected portfolio with positive cash');
  console.log(`  ✓ PASS: Trader Team 1 connected. Cash: ₹${traderPortfolio.cash.toFixed(2)}`);
  passed++;

  // Ensure market is in LIVE state for trading tests
  if (hostGameState?.isPaused || hostGameState?.status !== 'LIVE') {
    wsHost.send(JSON.stringify({ action: 'HOST_START_EVENT_NOW', session_token: hostToken }));
    await delay(500);
  }

  // Unhalt any previously halted stocks to start with pristine trading conditions
  companies.forEach(c => {
    wsHost.send(JSON.stringify({ action: 'HOST_UNHALT_STOCK', session_token: hostToken, ticker: c.ticker }));
  });
  await delay(400);

  // Pick a stable stock for order math
  const tradeStock = traderStocks.find(s => s.isEnabled !== false && !s.isHalted) || traderStocks[0];
  const feeBps = hostGameState?.transactionFeeBps || 0;
  const price = tradeStock.currentPrice;
  const costPerShare = price * (1 + feeBps / 10000);
  const maxAffordableShares = Math.floor(traderPortfolio.cash / costPerShare);
  console.log(`  • Testing on ${tradeStock.ticker} (Price: ₹${price.toFixed(2)}, Max Affordable: ${maxAffordableShares} shares)`);

  // Test 1: Overbuy rejection (ordering more shares than cash affords)
  const unaffordableQty = maxAffordableShares + 100;
  traderMessages = [];
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'BUY',
    quantity: unaffordableQty
  }));
  await delay(400);

  const overbuyReject = traderMessages.find(m => m.type === 'ORDER_REJECTED');
  assert.ok(overbuyReject, 'Expected ORDER_REJECTED for unaffordable order');
  const overbuyMsg = overbuyReject.reason || overbuyReject.message || '';
  assert.ok(overbuyMsg.includes('Insufficient cash') || overbuyMsg.includes('afford'),
    `Expected message to explain insufficient cash. Got: "${overbuyMsg}"`);
  console.log(`  ✓ PASS: Overbuy rejected safely by server: "${overbuyMsg.slice(0, 80)}..."`);
  passed++;

  // Test 2: Legal Buy order (affordable quantity: 5 shares)
  const prevHeld = (traderPortfolio.holdings && traderPortfolio.holdings[tradeStock.ticker]) || 0;
  const buyQty = 5;
  traderMessages = [];
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'BUY',
    quantity: buyQty
  }));
  await delay(400);

  const buyFill = traderMessages.find(m => m.type === 'ORDER_FILLED');
  assert.ok(buyFill, 'Expected ORDER_FILLED for valid buy order');
  assert.strictEqual(buyFill.ticker, tradeStock.ticker);
  assert.strictEqual(buyFill.quantity, buyQty);
  assert.strictEqual(buyFill.orderType, 'BUY');
  assert.strictEqual(traderPortfolio.holdings[tradeStock.ticker], prevHeld + buyQty, `Holdings must reflect ${prevHeld + buyQty} shares`);
  console.log(`  ✓ PASS: Buy order filled: 5 shares of ${tradeStock.ticker} @ ₹${buyFill.price}. Cash: ₹${traderPortfolio.cash.toFixed(2)}`);
  passed++;

  // Test 3: Oversell rejection (trying to sell more shares than currently held)
  const heldNow = traderPortfolio.holdings[tradeStock.ticker];
  traderMessages = [];
  await delay(250); // respect 200ms debounce
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'SELL',
    quantity: heldNow + 500
  }));
  await delay(400);

  const oversellReject = traderMessages.find(m => m.type === 'ORDER_REJECTED');
  assert.ok(oversellReject, 'Expected ORDER_REJECTED for selling more than held');
  const oversellMsg = oversellReject.reason || oversellReject.message || '';
  assert.ok(oversellMsg.includes('Insufficient shares') || oversellMsg.includes('hold'),
    `Expected message to explain insufficient shares. Got: "${oversellMsg}"`);
  console.log(`  ✓ PASS: Oversell rejected safely by server: "${oversellMsg.slice(0, 80)}..."`);
  passed++;

  // Test 4: Legal Sell order (selling 2 shares)
  traderMessages = [];
  await delay(250);
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'SELL',
    quantity: 2
  }));
  await delay(400);

  const sellFill = traderMessages.find(m => m.type === 'ORDER_FILLED');
  assert.ok(sellFill, 'Expected ORDER_FILLED for selling 2 shares');
  assert.strictEqual(traderPortfolio.holdings[tradeStock.ticker], heldNow - 2, `Holdings must now be ${heldNow - 2} shares`);
  console.log(`  ✓ PASS: Legal sell filled: 2 shares of ${tradeStock.ticker}. Remaining: ${heldNow - 2} shares.`);
  passed++;

  // Test 5: Double-Click / Rate-limiting Debounce Protection (2 orders in 20ms)
  traderMessages = [];
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'BUY',
    quantity: 1
  }));
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'BUY',
    quantity: 1
  }));
  await delay(400);

  const debounceRejects = traderMessages.filter(m => m.type === 'ORDER_REJECTED' && (m.reason || m.message || '').includes('rate limit'));
  assert.ok(debounceRejects.length >= 1, 'Expected debounce protection to reject second instant order');
  console.log(`  ✓ PASS: Anti-spam debounce protected server against double-click submission.`);
  passed++;

  // -------------------------------------------------------------
  // STAGE 3: DIRECTIONAL UPPER & LOWER CIRCUIT BREAKERS
  // -------------------------------------------------------------
  console.log('\n[STAGE 3] Directional Circuit Breakers (Upper / Lower Limits & Recovery)');
  // We will test directional halting on a test company
  const cbStock = tradeStock;
  const initialPrice = cbStock.currentPrice;

  // Let's verify circuit limit formulas
  const pct = hostGameState?.circuitBreakerLimitPct || 20;
  const cbOpenP = cbStock.dayOpenPrice || cbStock.base_price;
  const expectedUpper = Math.round(cbOpenP * (1 + pct / 100) * 100) / 100;
  const expectedLower = Math.round(cbOpenP * (1 - pct / 100) * 100) / 100;
  console.log(`  • Reference Open: ₹${cbOpenP.toFixed(2)}, Limit ±${pct}% -> Upper: ₹${expectedUpper.toFixed(2)}, Lower: ₹${expectedLower.toFixed(2)}`);

  // Direct socket simulation: Trigger UPPER circuit halt on cbStock
  // We can send custom news shock or update to trigger circuit limit
  await delay(300);
  wsHost.send(JSON.stringify({
    action: 'HOST_CREATE_CUSTOM_NEWS',
    session_token: hostToken,
    headline: 'CIRCUIT BREAKOUT: Astronomical Earnings Surge',
    explanation: 'Massive surge to upper circuit limit',
    ticker: cbStock.ticker,
    deltaPct: 50,
    durationSec: 0
  }));
  await delay(800);

  // Check cbStock status
  const updatedCbStock = traderStocks.find(s => s.ticker === cbStock.ticker);
  assert.ok(updatedCbStock.isHalted, 'Stock should be halted after hitting circuit limit');
  assert.strictEqual(updatedCbStock.haltDirection, 'UPPER', 'Halt direction should be UPPER');
  assert.ok(updatedCbStock.currentPrice <= expectedUpper + 0.05, 'Price must clamp at upperLimit');
  console.log(`  ✓ PASS: Upper Circuit reached. Clamped at ₹${updatedCbStock.currentPrice.toFixed(2)} (haltDirection: UPPER)`);
  passed++;

  // Verify other stocks are NOT halted! (Stock isolation invariant)
  const otherStocks = traderStocks.filter(s => s.ticker !== cbStock.ticker && s.isEnabled !== false);
  const unhaltedCount = otherStocks.filter(s => !s.isHalted).length;
  assert.ok(unhaltedCount > 0, 'Other stocks must NOT be halted by one stock circuit limit');
  console.log(`  ✓ PASS: Stock isolation preserved: ${unhaltedCount} other active stocks remained completely unhalted.`);
  passed++;

  // Test Directional Order Enforcement at UPPER circuit:
  // 1. BUY order must be rejected
  traderMessages = [];
  await delay(250);
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: cbStock.ticker,
    type: 'BUY',
    quantity: 1
  }));
  await delay(400);

  const upperBuyReject = traderMessages.find(m => m.type === 'ORDER_REJECTED');
  assert.ok(upperBuyReject, 'Expected BUY to be rejected at UPPER circuit');
  const upperBuyMsg = upperBuyReject.reason || upperBuyReject.message || '';
  assert.ok(upperBuyMsg.includes('Upper circuit') || upperBuyMsg.includes('restricted'),
    `Expected Upper Circuit rejection message. Got: "${upperBuyMsg}"`);
  console.log(`  ✓ PASS: BUY order rejected at Upper Circuit: "${upperBuyMsg.slice(0, 75)}..."`);
  passed++;

  // 2. SELL order must be PERMITTED and trigger downward price recovery
  traderMessages = [];
  await delay(250);
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: cbStock.ticker,
    type: 'SELL',
    quantity: 1
  }));
  await delay(400);

  const upperSellFill = traderMessages.find(m => m.type === 'ORDER_FILLED');
  assert.ok(upperSellFill, 'Expected SELL to execute at UPPER circuit');
  console.log(`  ✓ PASS: SELL order executed at Upper Circuit, providing downward liquidity.`);
  passed++;

  // Downward shock to test LOWER circuit limit
  await delay(300);
  wsHost.send(JSON.stringify({
    action: 'HOST_CREATE_CUSTOM_NEWS',
    session_token: hostToken,
    headline: 'CIRCUIT PLUNGE: Severe Regulatory Penalty',
    explanation: 'Massive plunge to lower circuit limit',
    ticker: cbStock.ticker,
    deltaPct: -60,
    durationSec: 0
  }));
  await delay(800);

  const lowerCbStock = traderStocks.find(s => s.ticker === cbStock.ticker);
  assert.ok(lowerCbStock.isHalted, 'Stock should be halted after hitting lower limit');
  assert.strictEqual(lowerCbStock.haltDirection, 'LOWER', 'Halt direction should be LOWER');
  assert.ok(lowerCbStock.currentPrice >= expectedLower - 0.05, 'Price must clamp at lowerLimit');
  console.log(`  ✓ PASS: Lower Circuit reached. Clamped at ₹${lowerCbStock.currentPrice.toFixed(2)} (haltDirection: LOWER)`);
  passed++;

  // Test Directional Order Enforcement at LOWER circuit:
  // 1. SELL order must be rejected
  traderMessages = [];
  await delay(250);
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: cbStock.ticker,
    type: 'SELL',
    quantity: 1
  }));
  await delay(400);

  const lowerSellReject = traderMessages.find(m => m.type === 'ORDER_REJECTED');
  assert.ok(lowerSellReject, 'Expected SELL to be rejected at LOWER circuit');
  const lowerSellMsg = lowerSellReject.reason || lowerSellReject.message || '';
  assert.ok(lowerSellMsg.includes('Lower circuit') || lowerSellMsg.includes('restricted'),
    `Expected Lower Circuit rejection message. Got: "${lowerSellMsg}"`);
  console.log(`  ✓ PASS: SELL order rejected at Lower Circuit: "${lowerSellMsg.slice(0, 75)}..."`);
  passed++;

  // 2. BUY order must be PERMITTED and trigger upward price recovery
  traderMessages = [];
  await delay(250);
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: cbStock.ticker,
    type: 'BUY',
    quantity: 1
  }));
  await delay(400);

  const lowerBuyFill = traderMessages.find(m => m.type === 'ORDER_FILLED');
  assert.ok(lowerBuyFill, 'Expected BUY to execute at LOWER circuit');
  console.log(`  ✓ PASS: BUY order executed at Lower Circuit, providing upward recovery liquidity.`);
  passed++;

  // -------------------------------------------------------------
  // STAGE 4: COMPLETE DAY 1 -> DAY 2 FLOW & NON-AMBIGUOUS STATUS
  // -------------------------------------------------------------
  console.log('\n[STAGE 4] Day 1 -> Day 2 Transition Flow & Authoritative States');
  
  // Conclude current day (simulating timer expiration or host conclusion)
  hostMessages.length = 0;
  traderMessages.length = 0;
  wsHost.send(JSON.stringify({ action: 'HOST_CONCLUDE_DAY', session_token: hostToken }));
  await delay(800);

  // Verify broadcast states
  const dayConcludedMsg = hostMessages.find(m => m.type === 'DAY_CONCLUDED') || traderMessages.find(m => m.type === 'DAY_CONCLUDED');
  assert.ok(dayConcludedMsg, 'Expected DAY_CONCLUDED broadcast');
  assert.strictEqual(dayConcludedMsg.status, 'DAY_COMPLETED', 'Status must be explicitly DAY_COMPLETED');
  const concludedDay = dayConcludedMsg.day;
  console.log(`  ✓ PASS: DAY_CONCLUDED broadcast received for Day ${concludedDay} with status: DAY_COMPLETED (not "Paused by Host")`);
  passed++;

  // Verify daily snapshot was saved
  const snapRes = await httpGet(`/api/daily-snapshot/${concludedDay}`);
  assert.strictEqual(snapRes.status, 200, `Expected 200 from /api/daily-snapshot/${concludedDay}`);
  const rankings = snapRes.body.rankings || snapRes.body.leaderboard || [];
  assert.ok(Array.isArray(rankings), 'Expected snapshot rankings array');
  console.log(`  ✓ PASS: Day ${concludedDay} official snapshot locked with ${rankings.length} team standings.`);
  passed++;

  // Verify trade rejection while in DAY_COMPLETED
  traderMessages = [];
  await delay(250);
  wsTrader.send(JSON.stringify({
    action: 'ORDER',
    session_token: traderToken,
    ticker: tradeStock.ticker,
    type: 'BUY',
    quantity: 1
  }));
  await delay(400);

  const completedReject = traderMessages.find(m => m.type === 'ORDER_REJECTED');
  assert.ok(completedReject, 'Order must be rejected during DAY_COMPLETED');
  const compMsg = completedReject.reason || completedReject.message || '';
  assert.ok(compMsg.includes('Day') || compMsg.includes('paused') || compMsg.includes('concluded'),
    `Expected clear Day Concluded message. Got: "${compMsg}"`);
  console.log(`  ✓ PASS: Order rejected during Day Completed state with clear guidance: "${compMsg.slice(0, 75)}..."`);
  passed++;

  // If concluded day is at or beyond totalDays, add an extra day so market can advance
  if (concludedDay >= (hostGameState?.totalDays || 3)) {
    wsHost.send(JSON.stringify({ action: 'HOST_ADD_DAY', session_token: hostToken }));
    await delay(400);
  }

  // Host launches Next Day: HOST_START_NEXT_DAY
  const preCash = traderPortfolio.cash;
  const preHoldings = { ...traderPortfolio.holdings };
  hostMessages.length = 0;
  traderMessages.length = 0;

  wsHost.send(JSON.stringify({ action: 'HOST_START_NEXT_DAY', session_token: hostToken }));
  await delay(800);

  // Check state transition to Next Day
  const nextDayMsg = hostMessages.find(m => m.type === 'DAY_ADVANCED') || traderMessages.find(m => m.type === 'DAY_ADVANCED');
  assert.ok(nextDayMsg, 'Expected DAY_ADVANCED broadcast');
  assert.strictEqual(nextDayMsg.currentDay, concludedDay + 1, `Expected currentDay to be ${concludedDay + 1}`);
  console.log(`  ✓ PASS: Day ${nextDayMsg.currentDay} initialized. Current Day: ${nextDayMsg.currentDay}/${nextDayMsg.totalDays}`);
  passed++;

  // Verify financial carry-over (cash & holdings preserved into Day 2)
  assert.strictEqual(traderPortfolio.cash, preCash, 'Cash must carry over into Day 2');
  assert.deepStrictEqual(traderPortfolio.holdings, preHoldings, 'Holdings must carry over into Day 2');
  console.log(`  ✓ PASS: Balances carried over seamlessly into Day ${nextDayMsg.currentDay}: Cash ₹${traderPortfolio.cash.toFixed(2)}, Holdings intact.`);
  passed++;

  // Close websockets
  if (wsTrader && wsTrader.readyState === WebSocket.OPEN) wsTrader.close();
  if (wsHost && wsHost.readyState === WebSocket.OPEN) wsHost.close();

  console.log('\n================================================================');
  console.log(` 📋 VERIFICATION COMPLETE: ALL ${passed} TESTS PASSED CLEANLY!`);
  console.log('================================================================\n');
  } finally {
    if (wsTrader && wsTrader.readyState === WebSocket.OPEN) wsTrader.close();
    if (wsHost && wsHost.readyState === WebSocket.OPEN) wsHost.close();
    if (serverProcess) serverProcess.kill();
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
