/**
 * THE TRADING FLOOR CHAMPIONSHIP 2026
 * AUTHORITATIVE ACCOUNTING & VALUATION ENGINE (server/accounting.js)
 *
 * Implements server-side portfolio valuation, synchronized leaderboard tie-breakers,
 * macro sector allocations, and official results snapshots.
 */

'use strict';

/**
 * Calculates current leaderboard across all teams with synchronized tie-breaker hierarchy:
 * 1. Net Worth (descending)
 * 2. Return % / PnL % (descending)
 * 3. Cash in Hand (descending)
 * 4. Trade Count (ascending — fewer trades wins)
 * 5. Team ID (alphabetical deterministic fallback)
 *
 * Resolves DEF-004 (Tie-breaker consistency) and DEF-005 (Preserves disabled stock holdings value).
 */
function calculateLeaderboard(teams, companies) {
  return Object.values(teams || {}).map((t) => {
    let holdingsValue = 0;
    let unrealizedPnl = 0;
    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      const cost = (t.avgBuyPrice && t.avgBuyPrice[c.ticker]) || 0;
      holdingsValue += qty * c.currentPrice;
      if (qty > 0) {
        unrealizedPnl += qty * (c.currentPrice - cost);
      }
    });
    const startingCash = t.startingCash || 500000;
    const netWorth = +(t.cash + holdingsValue).toFixed(2);
    const pnlPct = +(((netWorth - startingCash) / startingCash) * 100).toFixed(2);
    const totalPnl = +(netWorth - startingCash).toFixed(2);

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
      tradeCount: t.tradeCount || 0,
      holdings: t.holdings || {}
    };
  }).sort((a, b) => {
    if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
    if (b.pnlPct !== a.pnlPct) return b.pnlPct - a.pnlPct;
    if (b.cash !== a.cash) return b.cash - a.cash;
    if (a.tradeCount !== b.tradeCount) return a.tradeCount - b.tradeCount;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calculates detailed investment analytics per team.
 */
function calculateTeamInvestments(teams, companies) {
  return Object.values(teams || {}).map((t) => {
    let investedCost = 0;
    let holdingsMarketValue = 0;
    let distinctHoldingsCount = 0;
    const holdingsDetail = [];

    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      if (qty > 0) {
        distinctHoldingsCount++;
        const avgPrice = (t.avgBuyPrice && t.avgBuyPrice[c.ticker]) || 0;
        const cost = +(qty * avgPrice).toFixed(2);
        const mktVal = +(qty * c.currentPrice).toFixed(2);
        const unPnl = +(mktVal - cost).toFixed(2);
        const retPct = cost > 0 ? +((unPnl / cost) * 100).toFixed(2) : 0;

        investedCost += cost;
        holdingsMarketValue += mktVal;

        holdingsDetail.push({
          ticker: c.ticker,
          name: c.name,
          sector: c.sector,
          quantity: qty,
          avgBuyPrice: avgPrice,
          currentPrice: c.currentPrice,
          totalCost: cost,
          marketValue: mktVal,
          unrealizedPnl: unPnl,
          returnPct: retPct
        });
      }
    });

    const netWorth = +(t.cash + holdingsMarketValue).toFixed(2);
    const startingCash = t.startingCash || 500000;
    const netPnl = +(netWorth - startingCash).toFixed(2);
    const returnPct = +(((netWorth - startingCash) / startingCash) * 100).toFixed(2);

    return {
      id: t.id,
      teamId: t.id,
      name: t.name,
      username: t.username || t.id.replace('_', ''),
      members: t.members || '',
      cash: +t.cash.toFixed(2),
      investedCost: +investedCost.toFixed(2),
      holdingsMarketValue: +holdingsMarketValue.toFixed(2),
      netWorth,
      netPnl,
      returnPct,
      tradeCount: t.tradeCount || 0,
      distinctHoldingsCount,
      realizedPnl: +(t.realizedPnl || 0).toFixed(2),
      holdings: holdingsDetail
    };
  });
}

/**
 * Calculates market indices (NIFTY_CAMPUS, AUTO_INDEX, IT_INDEX, etc.)
 */
function calculateMarketIndices(companies) {
  const enabled = (companies || []).filter((c) => c.isEnabled !== false);
  if (enabled.length === 0) return [];

  let totalCur = 0;
  let totalOpen = 0;
  const sectors = {};

  enabled.forEach((c) => {
    const cur = c.currentPrice || c.base_price;
    const opn = c.dayOpenPrice || c.base_price;
    totalCur += cur;
    totalOpen += opn;

    const sec = c.sector || 'General';
    if (!sectors[sec]) sectors[sec] = { cur: 0, opn: 0, count: 0 };
    sectors[sec].cur += cur;
    sectors[sec].opn += opn;
    sectors[sec].count++;
  });

  const campusBase = 10000;
  const broadChangePct = totalOpen > 0 ? +(((totalCur - totalOpen) / totalOpen) * 100).toFixed(2) : 0;
  const campusValue = +(campusBase * (1 + broadChangePct / 100)).toFixed(2);

  const indices = [
    {
      id: 'NIFTY_CAMPUS',
      name: 'NIFTY Campus 20',
      value: campusValue,
      baseValue: campusBase,
      changePct: broadChangePct,
      changeValue: +(campusValue - campusBase).toFixed(2),
      direction: broadChangePct >= 0 ? 'UP' : 'DOWN'
    }
  ];

  Object.entries(sectors).forEach(([secName, data]) => {
    const sChangePct = data.opn > 0 ? +(((data.cur - data.opn) / data.opn) * 100).toFixed(2) : 0;
    const sValue = +(5000 * (1 + sChangePct / 100)).toFixed(2);
    indices.push({
      id: `SECTOR_${secName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
      name: `${secName} Index`,
      value: sValue,
      baseValue: 5000,
      changePct: sChangePct,
      changeValue: +(sValue - 5000).toFixed(2),
      direction: sChangePct >= 0 ? 'UP' : 'DOWN'
    });
  });

  return indices;
}

/**
 * Calculates privacy-safe macro sector allocations per team.
 */
function calculateTeamSectorAllocations(teams, companies) {
  return Object.values(teams || {}).map((t) => {
    let holdingsValue = 0;
    const sectorValues = {};

    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
      if (qty > 0) {
        const val = qty * c.currentPrice;
        holdingsValue += val;
        const sec = c.sector || 'Other';
        sectorValues[sec] = (sectorValues[sec] || 0) + val;
      }
    });

    const netWorth = t.cash + holdingsValue;
    const cashPct = netWorth > 0 ? +((t.cash / netWorth) * 100).toFixed(1) : 100;
    const sectorPcts = {};

    Object.entries(sectorValues).forEach(([sec, val]) => {
      sectorPcts[sec] = netWorth > 0 ? +((val / netWorth) * 100).toFixed(1) : 0;
    });

    return {
      teamId: t.id,
      teamName: t.name,
      cashPct,
      holdingsPct: +(100 - cashPct).toFixed(1),
      sectorPcts
    };
  });
}

module.exports = {
  calculateLeaderboard,
  calculateTeamInvestments,
  calculateMarketIndices,
  calculateTeamSectorAllocations
};
