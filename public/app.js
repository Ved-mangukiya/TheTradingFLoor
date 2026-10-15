// ==========================================================================
// THE TRADING FLOOR CHAMPIONSHIP 2026 — CLIENT ENGINE & INTERFACE CONTROLLER
// Offline-First Institutional Trading Terminal
// ==========================================================================

let ws = null;
let sessionToken = sessionStorage.getItem('ttf_session_token') || null;
let currentRole = null;
let latestState = null;
let flashTimerHandle = null;
let currentSelectedTickerForChart = null;

// Trader View Filtering & Tab State
let activeTraderTab = 'market';
let activeHostTab = 'stocks';
let traderSearchTerm = '';
let traderSectorFilterVal = 'ALL';

// Modal Trade State
let currentTradeModalTicker = null;

// ==========================================
// 1. INSTITUTIONAL AUDIO SYNTHESIZER (OFFLINE-READY)
// ==========================================
// Self-contained Web Audio API synthesizer — works offline without any external MP3s!
function playInstitutionalSound(cueName) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (cueName === 'bell_open' || cueName === 'bell_close') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.25, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.4);
      });
    } else if (cueName === 'news_siren') {
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now + i * 0.35);
        osc.frequency.linearRampToValueAtTime(880, now + i * 0.35 + 0.3);
        gain.gain.setValueAtTime(0.18, now + i * 0.35);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.35 + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.35);
        osc.stop(now + i * 0.35 + 0.32);
      }
    } else if (cueName === 'circuit_alarm') {
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(620, now + i * 0.22);
        gain.gain.setValueAtTime(0.2, now + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.22 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 0.18);
      }
    } else if (cueName === 'championship_fanfare') {
      const notes = [392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0.3, now + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 1.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 1.8);
      });
    }
  } catch (e) {
    console.warn('[AUDIO NOTE]', e);
  }
}

// ==========================================
// 2. WEBSOCKET ROUTING & SPA SESSION MANAGER
// ==========================================
function getAutoCredentials(roleQuery) {
  if (!roleQuery) return null;
  const lower = roleQuery.toLowerCase().trim();
  if (lower === 'host') return { u: 'host', p: 'host2026' };
  if (lower === 'projector') return { u: 'projector', p: 'screen2026' };
  const teamMatch = lower.match(/^team(\d+)$/);
  if (teamMatch) {
    const num = teamMatch[1];
    return { u: `team${num}`, p: `trade${num}00` };
  }
  return null;
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    const params = new URLSearchParams(window.location.search);
    const autoRole = params.get('autologin');
    const creds = getAutoCredentials(autoRole);

    if (creds) {
      window.history.replaceState(null, '', window.location.pathname);
      ws.send(JSON.stringify({ action: 'LOGIN', username: creds.u, password: creds.p }));
      return;
    }

    if (sessionToken) {
      ws.send(JSON.stringify({ action: 'RESUME_SESSION', session_token: sessionToken }));
    }
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (msg.type === 'LOGIN_ERROR') {
      const errEl = document.getElementById('loginError');
      errEl.textContent = msg.message;
      errEl.classList.remove('hidden');
      return;
    }

    if (msg.type === 'SESSION_EXPIRED') {
      logoutTerminal();
      return;
    }

    if (msg.type === 'LOGIN_SUCCESS') {
      sessionToken = msg.session_token;
      currentRole = msg.role;
      sessionStorage.setItem('ttf_session_token', sessionToken);
      switchSpaView(msg.role);
      handleStateUpdate(msg.initialState);
      return;
    }

    if (msg.type === 'TICK_UPDATE') {
      handleStateUpdate(msg);
      return;
    }

    if (msg.type === 'NEWS_FLASH') {
      playInstitutionalSound('news_siren');
      showNewsFlashModal(msg.news);
      return;
    }

    if (msg.type === 'CIRCUIT_BREAKER_ALERT') {
      playInstitutionalSound('circuit_alarm');
      showOrderToast(`🚨 CIRCUIT BREAKER: ${msg.ticker} halted (${msg.direction} limit at ₹${msg.price.toFixed(2)})`, false);
      return;
    }

    if (msg.type === 'BELL_EVENT') {
      playInstitutionalSound(msg.bell === 'OPEN' ? 'bell_open' : 'bell_close');
      return;
    }

    if (msg.type === 'COUNTDOWN_START') {
      runResumeCountdown(msg.seconds || 3);
      return;
    }

    if (msg.type === 'CHAMPIONSHIP_CONCLUDED') {
      playInstitutionalSound('championship_fanfare');
      showWinnerPodium(msg.winnerData, msg.title);
      return;
    }

    if (msg.type === 'PODIUM_DISMISSED') {
      document.getElementById('winnerPodiumModal').classList.add('hidden');
      return;
    }

    if (msg.type === 'ORDER_FILLED') {
      showOrderToast(`✓ ${msg.orderType} FILLED: ${msg.quantity} ${msg.ticker} @ ₹${msg.price.toFixed(2)} (Net: ₹${msg.totalImpact.toFixed(2)})`, true);
      closeTradeModal();
      return;
    }

    if (msg.type === 'ORDER_REJECTED') {
      showOrderToast(`✗ REJECTED: ${msg.reason}`, false);
      return;
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 2000);
  };
}

function switchSpaView(role) {
  ['loginView', 'traderView', 'hostView', 'projectorView'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (role === 'TRADER') {
    document.getElementById('traderView').classList.remove('hidden');
  } else if (role === 'HOST') {
    document.getElementById('hostView').classList.remove('hidden');
  } else if (role === 'PROJECTOR') {
    document.getElementById('projectorView').classList.remove('hidden');
  } else {
    document.getElementById('loginView').classList.remove('hidden');
  }
}

function logoutTerminal() {
  if (ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'LOGOUT', session_token: sessionToken }));
  }
  sessionStorage.removeItem('ttf_session_token');
  sessionToken = null;
  currentRole = null;
  switchSpaView(null);
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    const errEl = document.getElementById('loginError');
    errEl.textContent = 'Connecting to simulation engine... Please wait 2 seconds.';
    errEl.classList.remove('hidden');
    return;
  }
  ws.send(JSON.stringify({ action: 'LOGIN', username, password }));
});

// ESC key to lock / return from Projector view
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentRole === 'PROJECTOR') {
    logoutTerminal();
  }
});

function toggleProjectorFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ==========================================
// 3. UTILITY FORMATTERS
// ==========================================
function formatMMSS(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatINR(num) {
  return '₹' + Number(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function handleStateUpdate(state) {
  if (!state) return;
  latestState = state;

  // Sync custom Event Title across all views
  if (state.gameState && state.gameState.title) {
    document.title = state.gameState.title;
    const loginTitleEl = document.getElementById('loginEventTitle');
    if (loginTitleEl) loginTitleEl.textContent = state.gameState.title;
    const projTitleEl = document.getElementById('projEventTitleHeader');
    if (projTitleEl) projTitleEl.textContent = state.gameState.title;
  }

  // Check if championship concluded and show podium
  if (state.gameState && state.gameState.isConcluded && state.gameState.winnerData) {
    showWinnerPodium(state.gameState.winnerData, state.gameState.title);
  }

  if (currentRole === 'TRADER') renderTraderView(state);
  else if (currentRole === 'HOST') renderHostView(state);
  else if (currentRole === 'PROJECTOR') renderProjectorView(state);

  // If full chart modal is open, keep updating it live
  if (currentSelectedTickerForChart && !document.getElementById('fullChartModal').classList.contains('hidden')) {
    updateFullChartModalData(currentSelectedTickerForChart);
  }

  // If trade modal is open, keep updating live prices
  if (currentTradeModalTicker && !document.getElementById('tradeModal').classList.contains('hidden')) {
    recalculateTradeModal();
  }
}

// ==========================================
// 4. STUDENT TRADER DESK RENDERER
// ==========================================
function switchTraderTab(tabName) {
  activeTraderTab = tabName;
  ['market', 'positions', 'trades'].forEach((t) => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`traderTabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.className = t === tabName ? 'btn btn-sage' : 'btn btn-outline';
    if (content) {
      if (t === tabName) content.classList.remove('hidden');
      else content.classList.add('hidden');
    }
  });
}

function filterTraderStocks() {
  traderSearchTerm = (document.getElementById('traderStockSearch').value || '').toLowerCase().trim();
  traderSectorFilterVal = document.getElementById('traderSectorFilter').value;
  if (latestState && currentRole === 'TRADER') {
    renderTraderView(latestState);
  }
}

function renderTraderView(state) {
  const { gameState, companies, portfolio, teamTrades } = state;
  if (!gameState || !companies) return;

  document.getElementById('traderDayBadge').textContent = `DAY ${gameState.currentDay} / ${gameState.totalDays}`;
  document.getElementById('traderClock').textContent = formatMMSS(gameState.elapsedSeconds);

  const statusEl = document.getElementById('traderMarketStatus');
  if (gameState.isPaused) {
    statusEl.textContent = 'MARKET PAUSED';
    statusEl.className = 'badge badge-paused';
  } else {
    statusEl.textContent = 'ACTIVE TRADING';
    statusEl.className = 'badge badge-active';
  }

  if (portfolio) {
    document.getElementById('traderTeamName').textContent = portfolio.name.toUpperCase();
    const membersDisplay = document.getElementById('traderTeamMembersDisplay');
    if (membersDisplay) {
      membersDisplay.textContent = portfolio.members ? `Members: ${portfolio.members}` : '';
    }

    document.getElementById('traderCash').textContent = formatINR(portfolio.cash);
    document.getElementById('traderEquity').textContent = formatINR(portfolio.holdingsValue);
    document.getElementById('traderNetWorth').textContent = formatINR(portfolio.netWorth);

    const retEl = document.getElementById('traderReturnPct');
    const isUp = portfolio.pnlPct >= 0;
    retEl.textContent = `${isUp ? '+' : ''}${portfolio.pnlPct.toFixed(2)}%`;
    retEl.className = `metric-value ${isUp ? 'price-up' : 'price-down'}`;

    // Render Tab 2: Positions Table
    const positionsTbody = document.getElementById('traderPositionsTbody');
    const activePositions = companies.filter((c) => (portfolio.holdings[c.ticker] || 0) > 0);

    if (activePositions.length === 0) {
      positionsTbody.innerHTML = `<tr><td colspan="7" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No shares currently held in portfolio. Use the Market Trading Desk to place buy orders.</td></tr>`;
    } else {
      positionsTbody.innerHTML = activePositions.map((stock) => {
        const qty = portfolio.holdings[stock.ticker] || 0;
        const avgCost = portfolio.avgBuyPrice[stock.ticker] || 0;
        const totalInvested = qty * avgCost;
        const currentVal = qty * stock.currentPrice;
        const pnl = currentVal - totalInvested;
        const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
        const isPos = pnl >= 0;

        return `
          <tr style="border-bottom: 1px solid var(--subtle-border);">
            <td style="padding: 10px;">
              <strong style="color: var(--text-forest);">${stock.ticker}</strong>
              <div style="font-size: 11px; color: var(--text-muted);">${stock.name}</div>
            </td>
            <td style="padding: 10px; font-weight: 700;">${qty}</td>
            <td style="padding: 10px;">₹${avgCost.toFixed(2)}</td>
            <td style="padding: 10px; font-weight: 700;">₹${stock.currentPrice.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 800;">₹${currentVal.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; font-weight: 700;" class="${isPos ? 'price-up' : 'price-down'}">
              ${isPos ? '+' : ''}₹${pnl.toFixed(2)} (${isPos ? '+' : ''}${pnlPct.toFixed(2)}%)
            </td>
            <td style="padding: 10px; text-align: center;">
              <button onclick="openTradeModal('${stock.ticker}')" class="btn btn-outline" style="padding: 4px 10px; font-size: 11px;">
                Trade
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Tab 3: Trade Order History Table
    const tradesTbody = document.getElementById('traderTradesTbody');
    if (!teamTrades || teamTrades.length === 0) {
      tradesTbody.innerHTML = `<tr><td colspan="10" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No executed trades recorded yet.</td></tr>`;
    } else {
      tradesTbody.innerHTML = teamTrades.map((tr) => `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px;">#${tr.seq}</td>
          <td style="padding: 8px;">${tr.timestamp}</td>
          <td style="padding: 8px;">Day ${tr.day}</td>
          <td style="padding: 8px;">
            <span class="badge ${tr.type === 'BUY' ? 'badge-active' : 'badge-paused'}" style="font-size: 10px; padding: 2px 6px;">
              ${tr.type}
            </span>
          </td>
          <td style="padding: 8px; font-weight: 700;">${tr.ticker}</td>
          <td style="padding: 8px; text-align: right;">${tr.quantity}</td>
          <td style="padding: 8px; text-align: right;">₹${tr.price.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">₹${tr.grossValue.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; color: var(--text-muted);">₹${tr.fee.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">₹${tr.cashAfter.toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }

  // Filter companies for Tab 1 Grid
  const filteredCompanies = companies.filter((stock) => {
    const matchesSearch = stock.ticker.toLowerCase().includes(traderSearchTerm) ||
      stock.name.toLowerCase().includes(traderSearchTerm);
    const matchesSector = traderSectorFilterVal === 'ALL' || stock.sector === traderSectorFilterVal;
    return matchesSearch && matchesSector;
  });

  const grid = document.getElementById('traderTabContentMarket');
  grid.innerHTML = filteredCompanies.map((stock) => {
    const pctVal = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
    const pct = pctVal.toFixed(2);
    const isUp = pctVal >= 0;
    const heldQty = portfolio ? (portfolio.holdings[stock.ticker] || 0) : 0;
    const avgPrice = portfolio ? (portfolio.avgBuyPrice[stock.ticker] || 0) : 0;

    const quickLots = stock.lot_presets.slice(0, 3).map((lot) => {
      const feeBps = gameState.transactionFeeBps || 0;
      const totalCost = lot * stock.currentPrice * (1 + feeBps / 10000);
      const canBuy = !stock.isHalted && !gameState.isPaused && portfolio && portfolio.cash >= totalCost;
      const canSell = !stock.isHalted && !gameState.isPaused && heldQty >= lot;

      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <button onclick="sendOrder('${stock.ticker}', 'BUY', ${lot})"
            ${canBuy ? '' : 'disabled'}
            class="btn btn-buy">
            BUY +${lot}
          </button>
          <button onclick="sendOrder('${stock.ticker}', 'SELL', ${lot})"
            ${canSell ? '' : 'disabled'}
            class="btn btn-sell">
            SELL -${lot}
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="stock-card ${stock.isHalted ? 'halted' : ''}">
        <div>
          <div class="stock-card-header">
            <div>
              <span class="stock-sector">${stock.sector}</span>
              <div class="stock-ticker">${stock.ticker}</div>
              <div class="stock-name">${stock.name}</div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button onclick="openFullChartModal('${stock.ticker}')" class="btn btn-outline" style="padding: 3px 7px; font-size: 11px;" title="Enlarge Chart">
                📈
              </button>
              <button onclick="openDetailsModal('${stock.ticker}')" class="btn btn-outline" style="padding: 3px 7px; font-size: 11px;" title="Company Profile">
                ℹ
              </button>
            </div>
          </div>

          <div class="stock-price-row">
            <span class="stock-current-price ${isUp ? 'price-up' : 'price-down'}">
              ₹${stock.currentPrice.toFixed(2)}
            </span>
            <span class="stock-delta ${isUp ? 'price-up' : 'price-down'}">
              ${isUp ? '+' : ''}${pct}% ${isUp ? '▲' : '▼'}
            </span>
          </div>

          <!-- Mini Canvas Sparkline -->
          <div class="sparkline-wrapper" onclick="openFullChartModal('${stock.ticker}')">
            <canvas id="traderCanvas_${stock.ticker}" width="280" height="60" style="width: 100%; height: 100%;"></canvas>
          </div>

          ${stock.isHalted ? `
            <div class="badge badge-halted" style="width: 100%; justify-content: center; margin-bottom: 8px;">
              ⛔ CIRCUIT BREAKER HALTED (${stock.haltDirection})
            </div>
          ` : ''}

          <!-- Portfolio Position on Card -->
          <div class="stock-holding-row">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Held</span>
              <strong style="font-family: var(--font-mono); color: var(--text-forest);">${heldQty} shares</strong>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Avg Cost</span>
              <strong style="font-family: var(--font-mono); color: var(--text-muted);">₹${avgPrice.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div>
          <!-- Quick Lot Presets -->
          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px;">
            ${quickLots}
          </div>
          <!-- Custom Quantity Trade Modal Trigger -->
          <button onclick="openTradeModal('${stock.ticker}')" class="btn btn-outline" style="width: 100%; padding: 6px; font-size: 11px;">
            Trade Custom Quantity...
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Render organic Bezier sparkline curves on each stock card
  filteredCompanies.forEach((stock) => {
    const isUp = stock.currentPrice >= stock.dayOpenPrice;
    drawSmoothBezierSparkline(`traderCanvas_${stock.ticker}`, stock.history, stock.dayOpenPrice, isUp, false);
  });

  // Render Market Wire Feed
  const newsList = document.getElementById('traderNewsList');
  if (!gameState.newsHistory || gameState.newsHistory.length === 0) {
    newsList.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); font-style: italic; padding: 12px;">No market announcements released yet.</p>`;
  } else {
    newsList.innerHTML = gameState.newsHistory.map((n) => `
      <div class="news-item">
        <div class="news-meta">
          <span>DAY ${n.day} • ${formatMMSS(n.second)}</span>
          <span class="badge badge-champagne" style="font-size: 9px; padding: 1px 5px;">${n.type}</span>
        </div>
        <div class="news-headline">${n.headline}</div>
        <div class="news-explanation">${n.simple_explanation}</div>
      </div>
    `).join('');
  }
}

// Order Submission
function sendOrder(ticker, type, quantity) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({
    action: 'ORDER',
    session_token: sessionToken,
    ticker,
    type,
    quantity
  }));
}

// Interactive Custom Trade Modal
function openTradeModal(ticker) {
  currentTradeModalTicker = ticker;
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;

  document.getElementById('tradeModalTicker').textContent = `${stock.ticker} — ${stock.name}`;
  document.getElementById('tradeModalSector').textContent = stock.sector;
  document.getElementById('tradeQuantityInput').value = stock.lot_presets[0] || 10;
  recalculateTradeModal();
  document.getElementById('tradeModal').classList.remove('hidden');
}

function closeTradeModal() {
  currentTradeModalTicker = null;
  document.getElementById('tradeModal').classList.add('hidden');
}

function setTradeLot(qty) {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  if (!stock || !p) return;

  const input = document.getElementById('tradeQuantityInput');
  const feeBps = latestState.gameState.transactionFeeBps || 0;

  if (qty === 'MAX_BUY') {
    const costPerShare = stock.currentPrice * (1 + feeBps / 10000);
    const maxShares = Math.floor(p.cash / costPerShare);
    input.value = Math.max(0, maxShares);
  } else if (qty === 'MAX_SELL') {
    input.value = p.holdings[stock.ticker] || 0;
  } else {
    input.value = qty;
  }
  recalculateTradeModal();
}

function recalculateTradeModal() {
  if (!latestState || !currentTradeModalTicker) return;
  const stock = latestState.companies.find((c) => c.ticker === currentTradeModalTicker);
  const p = latestState.portfolio;
  if (!stock || !p) return;

  const qty = parseInt(document.getElementById('tradeQuantityInput').value, 10) || 0;
  const price = stock.currentPrice;
  const gross = +(qty * price).toFixed(2);
  const feeBps = latestState.gameState.transactionFeeBps || 0;
  const fee = +((gross * feeBps) / 10000).toFixed(2);

  document.getElementById('tradeModalPrice').textContent = `₹${price.toFixed(2)}`;
  document.getElementById('tradeModalCash').textContent = formatINR(p.cash);
  document.getElementById('tradeModalHolding').textContent = `${p.holdings[stock.ticker] || 0} shares`;

  document.getElementById('tradeModalGross').textContent = `₹${gross.toFixed(2)}`;
  document.getElementById('tradeModalFee').textContent = `₹${fee.toFixed(2)} (${feeBps} bps)`;
  document.getElementById('tradeModalNet').textContent = `₹${(gross + fee).toFixed(2)}`;

  // Enable/disable execution buttons dynamically
  const isMarketOpen = !latestState.gameState.isPaused && !latestState.gameState.isConcluded && !stock.isHalted;
  const canBuy = isMarketOpen && qty > 0 && p.cash >= (gross + fee);
  const canSell = isMarketOpen && qty > 0 && (p.holdings[stock.ticker] || 0) >= qty;

  document.getElementById('btnExecuteBuy').disabled = !canBuy;
  document.getElementById('btnExecuteSell').disabled = !canSell;
}

function executeModalTrade(type) {
  if (!currentTradeModalTicker) return;
  const qty = parseInt(document.getElementById('tradeQuantityInput').value, 10);
  if (!qty || qty <= 0) return;
  sendOrder(currentTradeModalTicker, type, qty);
}

// Company Details Modal
function openDetailsModal(ticker) {
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;
  const f = stock.fundamentals || {};

  document.getElementById('modalTitle').textContent = `${stock.ticker} — ${stock.name}`;
  document.getElementById('modalSummary').textContent = f.summary || `${stock.name} is a leading corporation in the ${stock.sector} sector.`;
  document.getElementById('modalSector').textContent = stock.sector;
  document.getElementById('modalFaceValue').textContent = `₹${(f.face_value || 1).toFixed(2)}`;
  document.getElementById('modalHigh52').textContent = `₹${(f.high_52w || stock.base_price).toLocaleString('en-IN')}`;
  document.getElementById('modalLow52').textContent = `₹${(f.low_52w || stock.base_price).toLocaleString('en-IN')}`;
  document.getElementById('modalPE').textContent = f.pe_ratio !== undefined ? f.pe_ratio : 'N/A';
  document.getElementById('modalMarketCap').textContent = f.market_cap || 'N/A';
  document.getElementById('modalDE').textContent = f.debt_to_equity !== undefined ? f.debt_to_equity : 'N/A';
  document.getElementById('modalBeta').textContent = stock.beta;

  document.getElementById('detailsModal').classList.remove('hidden');
}

function closeDetailsModal() {
  document.getElementById('detailsModal').classList.add('hidden');
}

// Full interactive chart modal
function openFullChartModal(ticker) {
  currentSelectedTickerForChart = ticker;
  updateFullChartModalData(ticker);
  document.getElementById('fullChartModal').classList.remove('hidden');
}

function closeFullChartModal() {
  currentSelectedTickerForChart = null;
  document.getElementById('fullChartModal').classList.add('hidden');
}

function updateFullChartModalData(ticker) {
  if (!latestState) return;
  const stock = latestState.companies.find((c) => c.ticker === ticker);
  if (!stock) return;

  const pctVal = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
  const isUp = pctVal >= 0;

  document.getElementById('chartModalSector').textContent = stock.sector;
  document.getElementById('chartModalTicker').textContent = stock.ticker;
  document.getElementById('chartModalPrice').textContent = `₹${stock.currentPrice.toFixed(2)}`;
  document.getElementById('chartModalPrice').className = isUp ? 'price-up' : 'price-down';
  document.getElementById('chartModalPct').textContent = `${isUp ? '+' : ''}${pctVal.toFixed(2)}% ${isUp ? '▲' : '▼'}`;
  document.getElementById('chartModalPct').className = isUp ? 'price-up' : 'price-down';

  document.getElementById('chartModalOpen').textContent = `₹${stock.dayOpenPrice.toFixed(2)}`;
  document.getElementById('chartModalHigh').textContent = `₹${stock.dayHigh.toFixed(2)}`;
  document.getElementById('chartModalLow').textContent = `₹${stock.dayLow.toFixed(2)}`;
  document.getElementById('chartModalBeta').textContent = stock.beta;

  drawSmoothBezierSparkline('largeChartCanvas', stock.history, stock.dayOpenPrice, isUp, true);
}

// Rules & Help Modal
function openRulesHelpModal() {
  document.getElementById('rulesHelpModal').classList.remove('hidden');
}

function closeRulesHelpModal() {
  document.getElementById('rulesHelpModal').classList.add('hidden');
}

function showOrderToast(message, isSuccess) {
  const toast = document.getElementById('orderToast');
  toast.textContent = message;
  toast.className = `toast-notice ${isSuccess ? 'toast-success' : 'toast-error'}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

// ==========================================
// 5. PROJECTOR VIEW RENDERER
// ==========================================
function renderProjectorView(state) {
  const { gameState, companies } = state;
  if (!gameState || !companies) return;

  document.getElementById('projDayText').textContent = `DAY ${gameState.currentDay} / ${gameState.totalDays}`;
  document.getElementById('projClockText').textContent = `CLOCK: ${formatMMSS(gameState.elapsedSeconds)}`;

  const statusEl = document.getElementById('projStatusText');
  if (gameState.isPaused) {
    statusEl.textContent = 'MARKET PAUSED';
    statusEl.className = 'badge badge-paused';
  } else {
    statusEl.textContent = 'ACTIVE TRADING';
    statusEl.className = 'badge badge-active';
  }

  if (gameState.newsHistory && gameState.newsHistory.length > 0) {
    const latestNews = gameState.newsHistory[0];
    document.getElementById('projectorTickerText').textContent =
      `[DAY ${latestNews.day} - ${latestNews.type}] "${latestNews.headline.toUpperCase()}" — ${latestNews.simple_explanation}`;
  }

  const grid = document.getElementById('projectorGrid');
  if (grid.children.length !== companies.length) {
    grid.innerHTML = companies.map((stock) => `
      <div id="projCard_${stock.ticker}" class="projector-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div class="projector-ticker">${stock.ticker}</div>
            <div id="projPrice_${stock.ticker}" class="projector-price price-up">₹${stock.currentPrice.toFixed(2)}</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
            <span id="projDelta_${stock.ticker}" style="font-family: var(--font-mono); font-size: 16px; font-weight: 700;">+0.00% ▲</span>
            <span style="font-size: 12px; color: var(--text-muted);">${stock.sector}</span>
          </div>
        </div>
        <div style="height: 70px; margin-top: 6px;">
          <canvas id="projCanvas_${stock.ticker}" width="380" height="70" style="width: 100%; height: 100%;"></canvas>
        </div>
      </div>
    `).join('');
  }

  companies.forEach((stock) => {
    const pctVal = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
    const pct = pctVal.toFixed(1);
    const isUp = pctVal >= 0;

    const cardEl = document.getElementById(`projCard_${stock.ticker}`);
    const priceEl = document.getElementById(`projPrice_${stock.ticker}`);
    const deltaEl = document.getElementById(`projDelta_${stock.ticker}`);

    if (cardEl) {
      cardEl.className = `projector-card ${stock.isHalted ? 'halted' : ''}`;
    }

    if (priceEl) {
      priceEl.textContent = '₹' + stock.currentPrice.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      priceEl.className = `projector-price ${isUp ? 'price-up' : 'price-down'}`;
    }

    if (deltaEl) {
      deltaEl.textContent = stock.isHalted
        ? `⛔ HALTED (${stock.haltDirection})`
        : `${isUp ? '+' : ''}${pct}% ${isUp ? '▲' : '▼'}`;
      deltaEl.className = isUp ? 'price-up' : 'price-down';
    }

    drawSmoothBezierSparkline(`projCanvas_${stock.ticker}`, stock.history, stock.dayOpenPrice, isUp, false);
  });
}

// ==========================================
// 6. ORGANIC BEZIER CANVAS CHART ENGINE
// ==========================================
// High-FPS Bezier spline interpolation with luxury ivory & pastel palette styling
function drawSmoothBezierSparkline(canvasId, history, dayOpenPrice, isUp, isLarge = false) {
  const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
  if (!canvas || !history || history.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const prices = history.map((pt) => pt.price);
  const minP = Math.min(...prices, dayOpenPrice) * 0.998;
  const maxP = Math.max(...prices, dayOpenPrice) * 1.002;
  const range = Math.max(0.01, maxP - minP);

  const paddingY = isLarge ? 24 : 8;
  const usableH = h - paddingY * 2;

  // Map to canvas coordinate space
  const points = history.map((pt, idx) => ({
    x: (idx / (history.length - 1)) * w,
    y: h - ((pt.price - minP) / range) * usableH - paddingY
  }));

  const strokeColor = isUp ? '#218653' : '#C64B4B';
  const glowRgba = isUp ? 'rgba(33, 134, 83, 0.12)' : 'rgba(198, 75, 75, 0.12)';

  // Day Open Reference Line (subtle dashed line)
  const openY = h - ((dayOpenPrice - minP) / range) * usableH - paddingY;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#D5CEBF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, openY);
  ctx.lineTo(w, openY);
  ctx.stroke();
  ctx.restore();

  // Smooth Spline Curve using Cubic Bezier
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = isLarge ? 3.5 : 2.5;
  ctx.stroke();

  // Gradient Area Fill Under Line
  const lastPt = points[points.length - 1];
  ctx.lineTo(lastPt.x, h);
  ctx.lineTo(0, h);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, glowRgba);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Price-head point
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, isLarge ? 5 : 3.5, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
}

// ==========================================
// 7. HOST MATRIX CONTROLLER RENDERER & ACTIONS
// ==========================================
function switchHostTab(tabName) {
  activeHostTab = tabName;
  ['stocks', 'universe', 'news', 'leaderboard', 'trades', 'exports'].forEach((t) => {
    const btn = document.getElementById(`hostTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`hostTabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.className = t === tabName ? 'btn btn-sage' : 'btn btn-outline';
    if (content) {
      if (t === tabName) content.classList.remove('hidden');
      else content.classList.add('hidden');
    }
  });
}

function renderHostView(state) {
  const { gameState, companies, leaderboard, newsEvents, recentTrades, allCompaniesUniverse } = state;
  if (!gameState) return;

  document.getElementById('hostScenarioModeBadge').textContent = `${state.scenarioMode.toUpperCase()} MODE`;
  document.getElementById('hostClockInfo').textContent =
    `Day ${gameState.currentDay} / ${gameState.totalDays} • Clock: ${formatMMSS(gameState.elapsedSeconds)} / ${formatMMSS(gameState.dayDurationSeconds)} • Status: ${
      gameState.isPaused ? 'PAUSED' : 'LIVE'
    } • Shift Offset: ${gameState.totalShiftOffsetSeconds}s • Fee: ${gameState.transactionFeeBps || 0} bps`;

  // 0. Render Universe Market Builder Table
  renderHostUniverseView(allCompaniesUniverse || companies || []);

  // 1. Render Stocks Table
  if (companies) {
    document.getElementById('hostStocksTbody').innerHTML = companies.map((stock) => {
      const pctVal = ((stock.currentPrice - stock.dayOpenPrice) / stock.dayOpenPrice) * 100;
      const isUp = pctVal >= 0;
      return `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px; font-weight: 800; color: var(--text-forest);">${stock.ticker}</td>
          <td style="padding: 8px;">${stock.name}</td>
          <td style="padding: 8px; color: var(--text-muted);">${stock.sector}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">₹${stock.currentPrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">₹${stock.dayOpenPrice.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;" class="${isUp ? 'price-up' : 'price-down'}">
            ${isUp ? '+' : ''}${pctVal.toFixed(2)}%
          </td>
          <td style="padding: 8px; text-align: center;">
            <span class="badge ${stock.isHalted ? 'badge-halted' : 'badge-active'}" style="font-size: 10px; padding: 2px 6px;">
              ${stock.isHalted ? `HALTED (${stock.haltDirection})` : 'ACTIVE'}
            </span>
          </td>
          <td style="padding: 8px; text-align: center;">
            ${stock.isHalted ? `
              <button onclick="hostUnhaltStock('${stock.ticker}')" class="btn btn-primary" style="padding: 3px 8px; font-size: 11px;">
                Release Halt
              </button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. Render News Deck
  if (newsEvents) {
    document.getElementById('hostNewsList').innerHTML = newsEvents.map((ev) => `
      <div class="cream-panel" style="padding: 14px; border: 1px solid ${ev.triggered ? 'var(--subtle-border)' : 'var(--champagne-accent)'};">
        <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-family: var(--font-mono); color: var(--champagne-accent);">
          <span>${ev.event_id} • Day ${ev.day}</span>
          <span class="badge badge-champagne" style="font-size: 9px; padding: 1px 5px;">${ev.type}</span>
        </div>
        <h4 style="font-size: 14px; font-weight: 700; color: var(--text-forest); margin: 6px 0;">${ev.headline}</h4>
        <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">${ev.simple_explanation}</p>
        <button onclick="hostTriggerNews('${ev.event_id}')" class="btn ${ev.triggered ? 'btn-outline' : 'btn-sage'}" style="width: 100%; padding: 5px; font-size: 11px;">
          ${ev.triggered ? 'Re-Trigger Wire Shock' : 'Fire Wire Shock Now'}
        </button>
      </div>
    `).join('');
  }

  // 3. Render Leaderboard Table
  if (leaderboard) {
    document.getElementById('hostLeaderboardTbody').innerHTML = leaderboard.map((t, idx) => {
      const isUp = t.pnlPct >= 0;
      return `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px; font-weight: 800;">#${idx + 1}</td>
          <td style="padding: 8px; font-weight: 700; color: var(--text-forest);">${t.name}</td>
          <td style="padding: 8px; color: var(--text-muted); font-size: 11px;">${t.members || '—'}</td>
          <td style="padding: 8px; text-align: right;">${formatINR(t.cash)}</td>
          <td style="padding: 8px; text-align: right;">${formatINR(t.holdingsValue)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 800;">${formatINR(t.netWorth)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;" class="${isUp ? 'price-up' : 'price-down'}">
            ${isUp ? '+' : ''}${t.pnlPct.toFixed(2)}%
          </td>
          <td style="padding: 8px; text-align: center;">${t.tradeCount}</td>
        </tr>
      `;
    }).join('');
  }

  // 4. Render Trade Stream Table
  if (recentTrades) {
    const tradesTbody = document.getElementById('hostRecentTradesTbody');
    if (recentTrades.length === 0) {
      tradesTbody.innerHTML = `<tr><td colspan="10" style="padding: 16px; text-align: center; color: var(--text-muted); font-style: italic;">No trades executed yet.</td></tr>`;
    } else {
      tradesTbody.innerHTML = recentTrades.map((tr) => `
        <tr style="border-bottom: 1px solid var(--subtle-border);">
          <td style="padding: 8px;">#${tr.seq}</td>
          <td style="padding: 8px;">${tr.timestamp}</td>
          <td style="padding: 8px; font-weight: 700;">${tr.teamName}</td>
          <td style="padding: 8px;"><span class="badge ${tr.type === 'BUY' ? 'badge-active' : 'badge-paused'}" style="font-size: 9px; padding: 2px 5px;">${tr.type}</span></td>
          <td style="padding: 8px; font-weight: 700;">${tr.ticker}</td>
          <td style="padding: 8px; text-align: right;">${tr.quantity}</td>
          <td style="padding: 8px; text-align: right;">₹${tr.price.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">₹${tr.grossValue.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; color: var(--text-muted);">₹${tr.fee.toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 700;">₹${tr.cashAfter.toFixed(2)}</td>
        </tr>
      `).join('');
    }
  }
}

// Host Matrix Actions
function hostPauseMarket() {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_PAUSE', session_token: sessionToken }));
}

function hostResumeMarket() {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_RESUME_COUNTDOWN', session_token: sessionToken }));
}

function hostNextDay() {
  if (!ws || !sessionToken) return;
  if (confirm('Advance to next trading round? Current prices will be recorded as previous close.')) {
    ws.send(JSON.stringify({ action: 'HOST_NEXT_DAY', session_token: sessionToken }));
  }
}

function hostTriggerNews(event_id) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_TRIGGER_NEWS', session_token: sessionToken, event_id }));
}

function hostUnhaltStock(ticker) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_UNHALT_STOCK', session_token: sessionToken, ticker }));
}

function hostSwitchScenario(mode) {
  if (!ws || !sessionToken) return;
  if (confirm(`Switch scenario mode to ${mode.toUpperCase()}? This resets the market engine.`)) {
    ws.send(JSON.stringify({ action: 'HOST_SWITCH_SCENARIO', session_token: sessionToken, mode }));
  }
}

function hostConcludeChampionship() {
  if (!ws || !sessionToken) return;
  if (confirm('Crown Championship Winners and launch Grand Finale ceremony across all terminals?')) {
    ws.send(JSON.stringify({ action: 'HOST_CONCLUDE_CHAMPIONSHIP', session_token: sessionToken }));
  }
}

// ==========================================
// 8. SHARE UNIVERSE MANAGEMENT CONTROLLERS
// ==========================================
function renderHostUniverseView(universe) {
  if (!universe) return;
  const total = universe.length;
  const activeCount = universe.filter((c) => c.isEnabled !== false).length;
  const disabledCount = total - activeCount;
  const sectorsSet = new Set(universe.map((c) => c.sector));

  const statTotal = document.getElementById('universeStatTotal');
  const statActive = document.getElementById('universeStatActive');
  const statDisabled = document.getElementById('universeStatDisabled');
  const statSectors = document.getElementById('universeStatSectors');

  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = activeCount;
  if (statDisabled) statDisabled.textContent = disabledCount;
  if (statSectors) statSectors.textContent = sectorsSet.size;

  const tbody = document.getElementById('hostUniverseTbody');
  if (!tbody) return;

  tbody.innerHTML = universe.map((c) => {
    const isEnabled = c.isEnabled !== false;
    const currentPrice = c.currentPrice !== undefined ? c.currentPrice : c.base_price;
    const basePrice = c.base_price !== undefined ? c.base_price : currentPrice;
    const vol = c.volatility_factor || 0.004;
    const beta = c.beta || 1.0;

    return `
      <tr style="border-bottom: 1px solid var(--subtle-border); ${!isEnabled ? 'opacity: 0.6; background-color: rgba(0,0,0,0.02);' : ''}">
        <td style="padding: 8px; font-weight: 800; color: var(--text-forest);">${c.ticker}</td>
        <td style="padding: 8px;">
          <div style="font-weight: 600;">${c.name}</div>
          ${c.fundamentals && c.fundamentals.summary ? `<div style="font-size: 11px; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.fundamentals.summary}</div>` : ''}
        </td>
        <td style="padding: 8px;">
          <span class="badge" style="background-color: var(--surface-cream); border: 1px solid var(--subtle-border); font-size: 10px;">${c.sector}</span>
        </td>
        <td style="padding: 8px; text-align: right; font-weight: 600;">₹${basePrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; font-weight: 700;">₹${currentPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; font-family: var(--font-mono); color: var(--text-muted);">${(vol * 100).toFixed(2)}%</td>
        <td style="padding: 8px; text-align: right; font-family: var(--font-mono);">${beta.toFixed(2)}</td>
        <td style="padding: 8px; text-align: center;">
          <button onclick="toggleShareActive('${c.ticker}')" class="badge ${isEnabled ? 'badge-active' : 'badge-paused'}" style="cursor: pointer; border: none; font-size: 11px; padding: 4px 8px;" title="Click to ${isEnabled ? 'disable and exclude' : 'enable and include'}">
            ${isEnabled ? '● Active in Market' : '○ Disabled'}
          </button>
        </td>
        <td style="padding: 8px; text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button onclick="openShareEditorModal('${c.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px;" title="Edit share details">✏️</button>
            <button onclick="duplicateShare('${c.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px;" title="Duplicate as template">📋</button>
            <button onclick="deleteShare('${c.ticker}')" class="btn btn-outline" style="padding: 2px 6px; font-size: 10px; color: var(--error-red); border-color: var(--error-border);" title="Delete share">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleShareActive(ticker) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_TOGGLE_SHARE', session_token: sessionToken, ticker }));
}

function openShareEditorModal(ticker) {
  const modal = document.getElementById('shareEditorModal');
  if (!modal) return;

  const originalInput = document.getElementById('shareEditOriginalTicker');
  const tickerInput = document.getElementById('shareEditTicker');
  const nameInput = document.getElementById('shareEditName');
  const sectorInput = document.getElementById('shareEditSector');
  const basePriceInput = document.getElementById('shareEditBasePrice');
  const volInput = document.getElementById('shareEditVol');
  const betaInput = document.getElementById('shareEditBeta');
  const descInput = document.getElementById('shareEditDescription');
  const enabledInput = document.getElementById('shareEditEnabled');
  const title = document.getElementById('shareEditorModalTitle');

  if (ticker && latestState) {
    const list = latestState.allCompaniesUniverse || latestState.companies || [];
    const stock = list.find((c) => c.ticker === ticker);
    if (stock) {
      originalInput.value = stock.ticker;
      tickerInput.value = stock.ticker;
      tickerInput.disabled = true;
      nameInput.value = stock.name;
      sectorInput.value = stock.sector;
      basePriceInput.value = stock.base_price || stock.currentPrice;
      volInput.value = stock.volatility_factor || 0.004;
      betaInput.value = stock.beta || 1.0;
      descInput.value = (stock.fundamentals && stock.fundamentals.summary) || '';
      enabledInput.checked = stock.isEnabled !== false;
      title.textContent = `Edit Company Share — ${stock.ticker}`;
      modal.classList.remove('hidden');
      return;
    }
  }

  // Adding new share
  originalInput.value = '';
  tickerInput.value = '';
  tickerInput.disabled = false;
  nameInput.value = '';
  sectorInput.value = '';
  basePriceInput.value = '100.00';
  volInput.value = '0.004';
  betaInput.value = '1.0';
  descInput.value = '';
  enabledInput.checked = true;
  title.textContent = 'Add New Company to Market Universe';
  modal.classList.remove('hidden');
}

function closeShareEditorModal() {
  const modal = document.getElementById('shareEditorModal');
  if (modal) modal.classList.add('hidden');
}

function saveShareEditorForm(e) {
  if (e) e.preventDefault();
  if (!ws || !sessionToken) return;

  const originalTicker = document.getElementById('shareEditOriginalTicker').value;
  const ticker = document.getElementById('shareEditTicker').value.trim().toUpperCase();
  const name = document.getElementById('shareEditName').value.trim();
  const sector = document.getElementById('shareEditSector').value.trim();
  const base_price = parseFloat(document.getElementById('shareEditBasePrice').value);
  const volatility_factor = parseFloat(document.getElementById('shareEditVol').value) || 0.004;
  const beta = parseFloat(document.getElementById('shareEditBeta').value) || 1.0;
  const summary = document.getElementById('shareEditDescription').value.trim();
  const isEnabled = document.getElementById('shareEditEnabled').checked;

  if (!ticker || isNaN(base_price) || base_price <= 0) {
    alert('Please enter a valid ticker symbol and positive starting base price.');
    return;
  }

  if (originalTicker) {
    ws.send(JSON.stringify({
      action: 'HOST_EDIT_SHARE',
      session_token: sessionToken,
      ticker: originalTicker,
      name,
      sector,
      base_price,
      volatility_factor,
      beta,
      summary
    }));
  } else {
    ws.send(JSON.stringify({
      action: 'HOST_ADD_SHARE',
      session_token: sessionToken,
      ticker,
      name,
      sector,
      base_price,
      volatility_factor,
      beta,
      summary
    }));
  }

  closeShareEditorModal();
}

function duplicateShare(ticker) {
  if (!ws || !sessionToken) return;
  ws.send(JSON.stringify({ action: 'HOST_DUPLICATE_SHARE', session_token: sessionToken, ticker }));
}

function deleteShare(ticker) {
  if (!ws || !sessionToken) return;
  if (confirm(`Permanently remove ${ticker} from the market universe? Existing team holdings in this stock will be cleared.`)) {
    ws.send(JSON.stringify({ action: 'HOST_DELETE_SHARE', session_token: sessionToken, ticker }));
  }
}

function applyMarketTemplate(templateId) {
  if (!ws || !sessionToken) return;
  const map = {
    'balanced': 'all_active',
    'all': 'all_active',
    'tech_auto': 'tech_auto_focus',
    'high_vol': 'high_volatility',
    'defensive': 'banking_defensive'
  };
  const targetId = map[templateId] || templateId;
  ws.send(JSON.stringify({ action: 'HOST_APPLY_MARKET_TEMPLATE', session_token: sessionToken, templateId: targetId }));
}

function hostRandomizePrices(variancePct = 10) {
  if (!ws || !sessionToken) return;
  if (confirm(`Randomize active share base prices by up to ±${variancePct}%? This establishes new baseline prices for tournament rounds.`)) {
    ws.send(JSON.stringify({ action: 'HOST_RANDOMIZE_PRICES', session_token: sessionToken, variancePct }));
  }
}

function hostResetUniverseBaseline() {
  if (!ws || !sessionToken) return;
  if (confirm('Reset the entire stock universe back to the official 12 blue-chip baseline? This discards custom shares.')) {
    ws.send(JSON.stringify({ action: 'HOST_RESET_UNIVERSE_BASELINE', session_token: sessionToken }));
  }
}

function downloadUniverseExport(format = 'json') {
  const url = format === 'csv' ? '/api/export/universe-csv' : '/api/export/universe';
  window.open(url, '_blank');
}

function dismissPodiumCeremony() {
  document.getElementById('winnerPodiumModal').classList.add('hidden');
  if (currentRole === 'HOST' && ws && sessionToken) {
    ws.send(JSON.stringify({ action: 'HOST_DISMISS_PODIUM', session_token: sessionToken }));
  }
}

function downloadReport(type) {
  if (!sessionToken) return;
  let endpoint = '';
  if (type === 'standings') endpoint = '/api/export/standings';
  else if (type === 'trades') endpoint = '/api/export/trades';
  else if (type === 'audit-csv') endpoint = '/api/export/audit-csv';
  else if (type === 'audit-json') endpoint = '/api/audit-log';

  if (endpoint) {
    window.open(`${endpoint}?token=${encodeURIComponent(sessionToken)}`, '_blank');
  }
}

// Custom News Modal
function openCustomNewsModal() {
  if (!latestState) return;
  const select = document.getElementById('newsTickerInput');
  select.innerHTML = `<option value="ALL">ALL COMPANIES (GLOBAL MACRO)</option>` +
    latestState.companies.map((c) => `<option value="${c.ticker}">${c.ticker} — ${c.name}</option>`).join('');
  document.getElementById('customNewsModal').classList.remove('hidden');
}

function closeCustomNewsModal() {
  document.getElementById('customNewsModal').classList.add('hidden');
}

document.getElementById('customNewsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || !sessionToken) return;

  const headline = document.getElementById('newsHeadlineInput').value;
  const explanation = document.getElementById('newsExplanationInput').value;
  const ticker = document.getElementById('newsTickerInput').value;
  const deltaPct = document.getElementById('newsDeltaInput').value;
  const durationSec = document.getElementById('newsDurationInput').value;

  ws.send(JSON.stringify({
    action: 'HOST_CREATE_CUSTOM_NEWS',
    session_token: sessionToken,
    headline,
    explanation,
    ticker,
    deltaPct,
    durationSec
  }));

  closeCustomNewsModal();
});

// Event Settings Modal
function openEventSettingsModal() {
  if (!latestState) return;
  const g = latestState.gameState;
  document.getElementById('settingEventTitle').value = g.title || '';
  document.getElementById('settingDayDuration').value = g.dayDurationSeconds || 1800;
  document.getElementById('settingTotalDays').value = g.totalDays || 3;
  document.getElementById('settingCircuitPercent').value = g.circuitBreakerPercent || 20;
  document.getElementById('settingStartingCash').value = g.startingCash || 500000;
  document.getElementById('settingFeeBps').value = g.transactionFeeBps || 0;
  document.getElementById('eventSettingsModal').classList.remove('hidden');
}

function closeEventSettingsModal() {
  document.getElementById('eventSettingsModal').classList.add('hidden');
}

document.getElementById('eventSettingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!ws || !sessionToken) return;

  const title = document.getElementById('settingEventTitle').value.trim();
  const dayDurationSeconds = parseInt(document.getElementById('settingDayDuration').value, 10);
  const totalDays = parseInt(document.getElementById('settingTotalDays').value, 10);
  const circuitBreakerPercent = parseFloat(document.getElementById('settingCircuitPercent').value);
  const startingCash = parseFloat(document.getElementById('settingStartingCash').value);
  const transactionFeeBps = parseInt(document.getElementById('settingFeeBps').value, 10) || 0;

  ws.send(JSON.stringify({
    action: 'HOST_UPDATE_EVENT_CONFIG',
    session_token: sessionToken,
    title,
    dayDurationSeconds,
    totalDays,
    circuitBreakerPercent,
    startingCash,
    transactionFeeBps
  }));

  closeEventSettingsModal();
});

// Teams Setup Manager & CSV
let localTeamsRoster = [];

function openTeamSetupModal() {
  if (!latestState) return;
  if (latestState.allTeamsList && latestState.allTeamsList.length > 0) {
    localTeamsRoster = JSON.parse(JSON.stringify(latestState.allTeamsList));
  } else if (localTeamsRoster.length === 0) {
    generateTeamRows(12);
    return;
  }
  renderTeamsSetupTable();
  document.getElementById('teamSetupModal').classList.remove('hidden');
}

function closeTeamSetupModal() {
  document.getElementById('teamSetupModal').classList.add('hidden');
}

function generateTeamRows(count) {
  const defaultNames = [
    'Dalal Street Titans', 'Bullish Bears', 'Alpha Hedge', 'Quantum Traders',
    'Apex Capital', 'Vanguard Vipers', 'Sterling Bulls', 'Maverick Fund',
    'Zenith Asset Mgmt', 'Phoenix Wealth', 'Starlight Equity', 'Omega Syndicate',
    'Matrix Capital', 'Falcon Traders', 'Centurion Wealth', 'Ironclad Asset'
  ];

  localTeamsRoster = [];
  for (let i = 1; i <= count; i++) {
    localTeamsRoster.push({
      id: `team_${i}`,
      username: `team${i}`,
      name: defaultNames[i - 1] || `Team ${i}`,
      members: `Trader ${i}A, Trader ${i}B`,
      password: `trade${i}00`,
      startingCash: latestState?.gameState?.startingCash || 500000
    });
  }
  renderTeamsSetupTable();
  document.getElementById('teamSetupModal').classList.remove('hidden');
}

function addNewTeamRow() {
  const newNum = localTeamsRoster.length + 1;
  localTeamsRoster.push({
    id: `team_${newNum}`,
    username: `team${newNum}`,
    name: `Team ${newNum}`,
    members: '',
    password: `trade${newNum}00`,
    startingCash: latestState?.gameState?.startingCash || 500000
  });
  renderTeamsSetupTable();
}

function deleteTeamRow(index) {
  if (localTeamsRoster.length <= 2) {
    alert('At least 2 teams are required for a championship competition.');
    return;
  }
  localTeamsRoster.splice(index, 1);
  localTeamsRoster.forEach((t, idx) => {
    t.id = `team_${idx + 1}`;
    t.username = `team${idx + 1}`;
  });
  renderTeamsSetupTable();
}

function renderTeamsSetupTable() {
  const tbody = document.getElementById('teamsSetupTbody');
  tbody.innerHTML = localTeamsRoster.map((t, idx) => `
    <tr style="border-bottom: 1px solid var(--subtle-border);">
      <td style="padding: 8px; font-family: var(--font-mono); font-weight: 700; color: var(--text-forest);">${t.username}</td>
      <td style="padding: 8px;">
        <input type="text" value="${t.name}" onchange="localTeamsRoster[${idx}].name = this.value"
          class="form-input" style="padding: 4px 8px; font-size: 12px;" />
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${t.members || ''}" onchange="localTeamsRoster[${idx}].members = this.value"
          class="form-input" style="padding: 4px 8px; font-size: 12px;" placeholder="Trader names..." />
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${t.password || `trade${idx + 1}00`}" onchange="localTeamsRoster[${idx}].password = this.value"
          class="form-input" style="padding: 4px 8px; font-size: 12px; font-family: var(--font-mono); width: 110px;" />
      </td>
      <td style="padding: 8px; text-align: center;">
        <button onclick="deleteTeamRow(${idx})" class="modal-close-btn" style="color: var(--error-red);">✕</button>
      </td>
    </tr>
  `).join('');
}

function exportTeamsCsv() {
  const headers = ['Username', 'Team Name', 'Members', 'Password'];
  const rows = localTeamsRoster.map((t) => [
    `"${t.username}"`,
    `"${t.name.replace(/"/g, '""')}"`,
    `"${(t.members || '').replace(/"/g, '""')}"`,
    `"${t.password}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TEAM_ROSTER_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function saveTeamsConfiguration() {
  if (!ws || !sessionToken) return;
  const resetBalances = document.getElementById('resetBalancesCheckbox').checked;

  if (confirm(`Apply and save roster of ${localTeamsRoster.length} teams? ${resetBalances ? 'All portfolios will be reset to Starting Cash.' : ''}`)) {
    ws.send(JSON.stringify({
      action: 'HOST_CONFIGURE_TEAMS',
      session_token: sessionToken,
      teams: localTeamsRoster,
      resetBalances
    }));
    closeTeamSetupModal();
  }
}

// ==========================================
// 8. WINNER PODIUM CEREMONY RENDERER
// ==========================================
function showWinnerPodium(winnerData, title) {
  if (!winnerData) return;
  const modal = document.getElementById('winnerPodiumModal');
  document.getElementById('podiumEventTitle').textContent = title || 'Championship Grand Finale';

  // 1st Place Gold
  const gold = winnerData.first;
  if (gold) {
    document.getElementById('goldTeamName').textContent = gold.name;
    document.getElementById('goldTeamMembers').textContent = gold.members ? `Members: ${gold.members}` : '';
    document.getElementById('goldNetWorth').textContent = formatINR(gold.netWorth);
    document.getElementById('goldPnl').textContent = `${gold.pnlPct >= 0 ? '+' : ''}${gold.pnlPct}% Profit Return`;
  }

  // 2nd Place Silver
  const silver = winnerData.second;
  if (silver) {
    document.getElementById('silverTeamName').textContent = silver.name;
    document.getElementById('silverTeamMembers').textContent = silver.members ? `Members: ${silver.members}` : '';
    document.getElementById('silverNetWorth').textContent = formatINR(silver.netWorth);
    document.getElementById('silverPnl').textContent = `${silver.pnlPct >= 0 ? '+' : ''}${silver.pnlPct}% Return`;
  }

  // 3rd Place Bronze
  const bronze = winnerData.third;
  if (bronze) {
    document.getElementById('bronzeTeamName').textContent = bronze.name;
    document.getElementById('bronzeTeamMembers').textContent = bronze.members ? `Members: ${bronze.members}` : '';
    document.getElementById('bronzeNetWorth').textContent = formatINR(bronze.netWorth);
    document.getElementById('bronzePnl').textContent = `${bronze.pnlPct >= 0 ? '+' : ''}${bronze.pnlPct}% Return`;
  }

  // Complete Rankings Table
  const tbody = document.getElementById('podiumRankingsTbody');
  if (winnerData.fullRankings) {
    tbody.innerHTML = winnerData.fullRankings.map((t, idx) => {
      const isUp = t.pnlPct >= 0;
      let badge = `${idx + 1}`;
      if (idx === 0) badge = '🥇 1st';
      else if (idx === 1) badge = '🥈 2nd';
      else if (idx === 2) badge = '🥉 3rd';

      return `
        <tr style="border-bottom: 1px solid var(--subtle-border); ${idx < 3 ? 'font-weight: 700; background-color: var(--surface-cream);' : ''}">
          <td style="padding: 8px; color: var(--champagne-accent);">${badge}</td>
          <td style="padding: 8px; color: var(--text-forest);">${t.name}</td>
          <td style="padding: 8px; font-family: var(--font-sans); font-size: 11px; color: var(--text-muted);">${t.members || '—'}</td>
          <td style="padding: 8px; text-align: right; color: var(--text-muted);">${formatINR(t.cash)}</td>
          <td style="padding: 8px; text-align: right; font-weight: 800; color: var(--text-charcoal);">${formatINR(t.netWorth)}</td>
          <td style="padding: 8px; text-align: right;" class="${isUp ? 'price-up' : 'price-down'}">
            ${isUp ? '+' : ''}${t.pnlPct}%
          </td>
        </tr>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
  createConfettiBurst();
}

function createConfettiBurst() {
  const container = document.getElementById('confettiContainer');
  container.innerHTML = '';
  const colors = ['#B49A70', '#218653', '#D4AF37', '#8C9CAE', '#263D35', '#E3EBE3'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${Math.random() * 6 + 6}px`;
    piece.style.height = `${Math.random() * 10 + 10}px`;
    piece.style.animationDuration = `${Math.random() * 2.5 + 2.5}s`;
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    container.appendChild(piece);
  }
}

// ==========================================
// 9. GLOBAL OVERLAYS (NEWS & 3-2-1 RESUME)
// ==========================================
function showNewsFlashModal(news) {
  const modal = document.getElementById('newsFlashModal');
  document.getElementById('flashEventType').textContent = `DAY ${news.day} • ${news.type}`;
  document.getElementById('flashHeadline').textContent = news.headline;
  document.getElementById('flashExplanation').textContent = news.simple_explanation;
  modal.classList.remove('hidden');

  let remaining = 20;
  const badge = document.getElementById('flashCountdownBadge');
  badge.textContent = `Closing in ${remaining}s`;

  if (flashTimerHandle) clearInterval(flashTimerHandle);
  flashTimerHandle = setInterval(() => {
    remaining--;
    badge.textContent = `Closing in ${remaining}s`;
    if (remaining <= 0) {
      dismissNewsFlash();
    }
  }, 1000);
}

function dismissNewsFlash() {
  if (flashTimerHandle) clearInterval(flashTimerHandle);
  document.getElementById('newsFlashModal').classList.add('hidden');
}

function runResumeCountdown(seconds) {
  const overlay = document.getElementById('countdownOverlay');
  const numEl = document.getElementById('countdownNumber');
  overlay.classList.remove('hidden');
  let counter = seconds;
  numEl.textContent = counter;

  const timer = setInterval(() => {
    counter--;
    if (counter > 0) {
      numEl.textContent = counter;
    } else {
      clearInterval(timer);
      overlay.classList.add('hidden');
    }
  }, 1000);
}

// Initialize connection on load
connectWebSocket();
