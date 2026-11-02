/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
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
      username: t.username || (t.id ? t.id.replace('_', '') : ''),
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
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Calculates detailed investment analytics per team.
 */
function calculateTeamInvestments(teams, companies, defaultStartingCash = 500000) {
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

    const startingCapital = t.startingCash || defaultStartingCash || 500000;
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
      username: t.username || (t.id ? t.id.replace('_', '') : ''),
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
      connected: !!t.connected
    };
  });
}

/**
 * Calculates market indices (NIFTY_TF20 benchmark + 6 sector indices).
 */
function calculateMarketIndices(companies) {
  const enabled = (companies || []).filter((c) => c.isEnabled !== false);
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

  return [
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
}

/**
 * Calculates privacy-safe macro sector allocations per team.
 */
function calculateTeamSectorAllocations(teams, companies) {
  const standings = calculateLeaderboard(teams, companies);
  return standings.map((item) => {
    const t = teams ? teams[item.id] : null;
    if (!t) return null;
    const cash = t.cash || 0;
    let totalHoldingsVal = 0;
    const sectorValues = {};

    (companies || []).forEach((c) => {
      const qty = (t.holdings && t.holdings[c.ticker]) || 0;
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

module.exports = {
  calculateLeaderboard,
  calculateTeamInvestments,
  calculateMarketIndices,
  calculateTeamSectorAllocations
};
