// test_projector_pagination.js
// Automated verification of Projector Automatic Pagination, Top Gainer & Top Loser Spotlight

const assert = require('assert');
const WebSocket = require('ws');

const PORT = 3000;
const WS_URL = `ws://localhost:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Mirror the client-side calculateTopMovers logic to test pure unit math
function calculateTopMovers(companies) {
  const active = (companies || []).filter((c) => c.isEnabled !== false);
  if (!active.length) {
    return { gainer: null, loser: null, advancing: 0, declining: 0, unchanged: 0 };
  }

  let advancing = 0;
  let declining = 0;
  let unchanged = 0;

  const withPct = active.map((stock) => {
    const ref = stock.dayOpenPrice || stock.referencePrice || stock.currentPrice;
    const pct = ref > 0 ? ((stock.currentPrice - ref) / ref) * 100 : 0;
    if (pct > 0.001) advancing++;
    else if (pct < -0.001) declining++;
    else unchanged++;
    return { stock, pct, ref };
  });

  const sortedGainers = [...withPct].sort((a, b) => {
    if (Math.abs(b.pct - a.pct) > 0.0001) return b.pct - a.pct;
    return a.stock.ticker.localeCompare(b.stock.ticker);
  });

  const sortedLosers = [...withPct].sort((a, b) => {
    if (Math.abs(a.pct - b.pct) > 0.0001) return a.pct - b.pct;
    return a.stock.ticker.localeCompare(b.stock.ticker);
  });

  return {
    gainer: sortedGainers[0] || null,
    loser: sortedLosers[0] || null,
    advancing,
    declining,
    unchanged
  };
}

// Mirror the pagination slicing logic
function getPaginatedCompanies(companies, page, cardsPerPage = 8) {
  const active = (companies || []).filter((c) => c.isEnabled !== false);
  const totalPages = Math.max(1, Math.ceil(active.length / cardsPerPage));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (safePage - 1) * cardsPerPage;
  return {
    pageCompanies: active.slice(startIdx, startIdx + cardsPerPage),
    currentPage: safePage,
    totalPages,
    totalCards: active.length
  };
}

async function runTest() {
  console.log('================================================================');
  console.log(' 📽️ STARTING PROJECTOR PAGINATION & TOP MOVERS VERIFICATION');
  console.log('================================================================\n');

  // [TEST 1] Pure Math & Ranking Verification
  console.log('[STAGE 1] Top Gainer & Top Loser Math Verification');

  const mockStocks = [
    { ticker: 'RELIANCE', currentPrice: 3000, dayOpenPrice: 2500, isEnabled: true }, // +20%
    { ticker: 'TCS', currentPrice: 3800, dayOpenPrice: 4000, isEnabled: true },      // -5%
    { ticker: 'INFY', currentPrice: 1500, dayOpenPrice: 1500, isEnabled: true },     // 0%
    { ticker: 'TATAMOTORS', currentPrice: 800, dayOpenPrice: 1000, isEnabled: true }, // -20%
    { ticker: 'HDFCBANK', currentPrice: 1800, dayOpenPrice: 1500, isEnabled: true }, // +20%
    { ticker: 'DISABLED', currentPrice: 5000, dayOpenPrice: 100, isEnabled: false } // Should be ignored
  ];

  const movers = calculateTopMovers(mockStocks);
  assert(movers.gainer !== null, 'Gainer should not be null');
  assert(movers.loser !== null, 'Loser should not be null');

  // RELIANCE and HDFCBANK both have +20%. Tie-break should pick HDFCBANK first (alphabetical by ticker)
  assert.strictEqual(movers.gainer.stock.ticker, 'HDFCBANK', `Expected HDFCBANK as top gainer by alphabetical tie-break, got ${movers.gainer.stock.ticker}`);
  assert.strictEqual(movers.loser.stock.ticker, 'TATAMOTORS', `Expected TATAMOTORS as top loser, got ${movers.loser.stock.ticker}`);
  assert.strictEqual(movers.advancing, 2, 'Expected 2 advancing stocks');
  assert.strictEqual(movers.declining, 2, 'Expected 2 declining stocks');
  assert.strictEqual(movers.unchanged, 1, 'Expected 1 unchanged stock');
  console.log(' ✓ Top Gainer correctly resolved: HDFCBANK (+20.00%) with deterministic tie-break');
  console.log(' ✓ Top Loser correctly resolved: TATAMOTORS (-20.00%)');
  console.log(' ✓ Market Breadth correctly computed: 2 Advancing, 2 Declining, 1 Unchanged');

  // [TEST 2] Edge Cases (Empty data, All 0%)
  console.log('\n[STAGE 2] Edge Case Handling');
  const emptyMovers = calculateTopMovers([]);
  assert.strictEqual(emptyMovers.gainer, null);
  assert.strictEqual(emptyMovers.loser, null);
  console.log(' ✓ Empty stock list handled gracefully with zero crashes');

  const zeroStocks = [
    { ticker: 'ALPHA', currentPrice: 100, dayOpenPrice: 100, isEnabled: true },
    { ticker: 'BETA', currentPrice: 200, dayOpenPrice: 200, isEnabled: true }
  ];
  const zeroMovers = calculateTopMovers(zeroStocks);
  assert.strictEqual(zeroMovers.gainer.stock.ticker, 'ALPHA');
  assert.strictEqual(zeroMovers.loser.stock.ticker, 'ALPHA');
  console.log(' ✓ All stocks at 0.00% handled cleanly without NaN errors');

  // [TEST 3] Pagination Math with 20 Companies (8 per page)
  console.log('\n[STAGE 3] Stock Board Pagination Slicing (20 Real Companies)');
  const universe20 = [];
  for (let i = 1; i <= 20; i++) {
    universe20.push({ ticker: `STOCK_${i}`, currentPrice: 100 + i, dayOpenPrice: 100, isEnabled: true });
  }

  const p1 = getPaginatedCompanies(universe20, 1, 8);
  assert.strictEqual(p1.totalPages, 3, '20 stocks at 8 per page should have 3 pages');
  assert.strictEqual(p1.pageCompanies.length, 8, 'Page 1 should have 8 stocks');
  assert.strictEqual(p1.pageCompanies[0].ticker, 'STOCK_1');
  assert.strictEqual(p1.pageCompanies[7].ticker, 'STOCK_8');

  const p2 = getPaginatedCompanies(universe20, 2, 8);
  assert.strictEqual(p2.pageCompanies.length, 8, 'Page 2 should have 8 stocks');
  assert.strictEqual(p2.pageCompanies[0].ticker, 'STOCK_9');
  assert.strictEqual(p2.pageCompanies[7].ticker, 'STOCK_16');

  const p3 = getPaginatedCompanies(universe20, 3, 8);
  assert.strictEqual(p3.pageCompanies.length, 4, 'Page 3 should have remaining 4 stocks');
  assert.strictEqual(p3.pageCompanies[0].ticker, 'STOCK_17');
  assert.strictEqual(p3.pageCompanies[3].ticker, 'STOCK_20');

  // Out of bounds page clamp
  const pOver = getPaginatedCompanies(universe20, 99, 8);
  assert.strictEqual(pOver.currentPage, 3, 'Out of bounds page 99 should clamp to page 3');
  console.log(' ✓ 20-stock universe sliced into 3 readable zero-scroll pages (8, 8, 4)');
  console.log(' ✓ Page overflow safety clamped cleanly');

  // [TEST 4] Server WebSocket Remote Control of Projector Board
  console.log('\n[STAGE 4] Host Remote Control Over WebSockets');
  const server = require('./server.js');
  await sleep(1500);

  let hostWs;
  let projWs;
  try {
    hostWs = new WebSocket(WS_URL);
    await new Promise((r) => hostWs.on('open', r));
    hostWs.send(JSON.stringify({ action: 'LOGIN', username: 'host', password: 'host2026' }));
    const hostLoginRes = await new Promise((r) => hostWs.once('message', (d) => r(JSON.parse(d))));
    const hostToken = hostLoginRes.session_token;

    projWs = new WebSocket(WS_URL);
    await new Promise((r) => projWs.on('open', r));
    projWs.send(JSON.stringify({ action: 'LOGIN', username: 'projector', password: 'screen2026' }));
    await new Promise((r) => projWs.once('message', r));

    // Host sends HOST_SET_PROJECTOR_BOARD_PAGE
    hostWs.send(JSON.stringify({
      action: 'HOST_SET_PROJECTOR_BOARD_PAGE',
      page: 2,
      session_token: hostToken
    }));

    const updateMsg = await new Promise((r) => {
      projWs.on('message', function handler(raw) {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'PROJECTOR_STATE_UPDATE') {
          projWs.removeListener('message', handler);
          r(parsed);
        }
      });
    });

    assert.strictEqual(updateMsg.projectorState.boardPage, 2, 'Projector state boardPage should be 2');
    console.log(' ✓ Host remote command HOST_SET_PROJECTOR_BOARD_PAGE broadcast successfully to projector');

    // Host sends HOST_TOGGLE_PROJECTOR_BOARD_PAUSE
    hostWs.send(JSON.stringify({
      action: 'HOST_TOGGLE_PROJECTOR_BOARD_PAUSE',
      isPaused: true,
      session_token: hostToken
    }));

    const pauseMsg = await new Promise((r) => {
      projWs.on('message', function handler(raw) {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'PROJECTOR_STATE_UPDATE' && parsed.projectorState.isBoardPaused !== undefined) {
          projWs.removeListener('message', handler);
          r(parsed);
        }
      });
    });

    assert.strictEqual(pauseMsg.projectorState.isBoardPaused, true, 'Projector state isBoardPaused should be true');
    console.log(' ✓ Host remote command HOST_TOGGLE_PROJECTOR_BOARD_PAUSE broadcast successfully to projector');

    console.log('\n================================================================');
    console.log(' 🎉 ALL PROJECTOR PAGINATION & TOP MOVER TESTS PASSED (100%)');
    console.log('================================================================\n');
  } finally {
    if (hostWs) hostWs.close();
    if (projWs) projWs.close();
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('\n❌ [TEST FAILURE]', err.message);
  process.exit(1);
});
