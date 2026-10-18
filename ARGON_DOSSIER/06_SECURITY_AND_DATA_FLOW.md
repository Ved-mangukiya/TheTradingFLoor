# 06 — PRIVACY, SECURITY BOUNDARIES & DATA FLOW ARCHITECTURE

> **Auditor Reference Document**: Complete security model, session authentication tokens, role-based permission matrix, parameter sanitization rules, 60-second host privacy reveal model, and anti-formula injection safeguards for **The Trading Floor Championship 2026**.

---

## 1. Authentication & Session Registry

The application uses an in-memory cryptographically secure session token mechanism:

### 1.1 Token Generation
*Location*: [server.js:2381-2392](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2381-L2392)

Upon successful credential validation via WebSocket `LOGIN` action:
```javascript
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
```

Tokens are returned to the client in `LOGIN_SUCCESS` and persisted in browser `localStorage.getItem('ttfc_session_token')`.

### 1.2 Session Resumption & Validation
*Location*: [server.js:2415-2446](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2415-L2446)
- Clients reconnecting send `RESUME_SESSION` with `session_token`.
- If found in `sessions` Map, `ws.session` is re-bound to the socket.
- If not found (e.g. server restart), server replies with `{ type: 'SESSION_EXPIRED' }`, clearing browser `localStorage` and routing the user to `#loginView`.

---

## 2. Role Permission Matrix

The application identifies 4 distinct client roles with strict permission boundaries:

| Capability / Action | `HOST` | `TRADER` | `PROJECTOR` | `SOUND_CONSOLE` |
| :--- | :---: | :---: | :---: | :---: |
| **Market Lifecycle Control** (Start, Pause, Resume, Conclude) | ✅ Yes | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Event Configuration & Universe Builder** | ✅ Yes | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Order Placement** (BUY, SELL) | ❌ No | ✅ Yes (Own Team) | ❌ Blocked | ❌ Blocked |
| **Portfolio & Holdings Visibility** | ✅ All Teams | ✅ Own Team Only | ❌ Public Index Only | ❌ No |
| **Stock Quantitative Parameters** ($\beta$, $\sigma$) | ✅ Visible | ❌ Sanitized / Stripped | ❌ Sanitized / Stripped | ❌ No |
| **Unpublished / Future News Events** | ✅ Visible | ❌ Sanitized / Stripped | ❌ Sanitized / Stripped | ❌ No |
| **Private News Impact Deliberations** | ✅ Hidden by Default (Revealable for 60s) | ❌ Stripped from Payload | ❌ Stripped from Payload | ❌ No |
| **Public Stock Tickers & Prices** | ✅ Visible | ✅ Visible | ✅ Visible | ❌ Background Only |
| **Full Leaderboard Standings** | ✅ Visible | ✅ Visible (Rank/P&L) | ✅ Paginated Display | ❌ No |
| **Web Audio API Synthesizer Playback** | ❌ Muted | ❌ Muted | ❌ Muted | ✅ Active Sound Engine |

---

## 3. Pre-Market Setup Gating

To prevent premature trading and data leakage before the Host finalizes company selections, day durations, and initial allocations, a strict login gate is enforced on the server:

*Location*: [server.js:2372-2379](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2372-L2379)

```javascript
// TRADER login gating: Teams cannot log in until host completes and locks event setup
if (userRecord.role === 'TRADER' && !gameState.configLocked) {
  ws.send(JSON.stringify({
    type: 'LOGIN_ERROR',
    message: 'The host is preparing the event. Team login will open once setup is complete.'
  }));
  return;
}
```

If a host unlocks configuration or resets the competition while teams are logged in, resumed sessions are also immediately invalidated:

*Location*: [server.js:2422-2430](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L2422-L2430)

---

## 4. Sensitive Parameter Sanitization (`getSanitizedPublicState`)

State broadcasts are strictly filtered on the Node.js server before serialization into WebSocket frames.

*Location*: [server.js:1871-1980](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L1871-L1980)

### 4.1 Company Parameter Stripping
Stock volatility factors ($\sigma$) and CAPM betas ($\beta$) govern the price shock engine. If leaked to trader terminals, quantitative students could reverse-engineer market sensitivity before news arrives:

```javascript
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
  // Host receives proprietary parameters; non-host payloads completely omit them
  ...(isHost ? { beta: c.beta, volatility_factor: c.volatility_factor } : {}),
  isHalted: c.isHalted,
  haltDirection: c.haltDirection,
  fundamentals: c.fundamentals,
  history: c.history.slice(-180)
}))
```

### 4.2 News Impact Stripping
When news flashes trigger or historical news is distributed:
```javascript
// Sanitize newsHistory: strip private 'impacts' from non-host screens
const sanitizedNewsHistory = gameState.newsHistory.map((n) => {
  if (isHost) return n;
  const clean = { ...n };
  delete clean.impacts;
  return clean;
});
```

And on real-time news push:
```javascript
if (client.session && client.session.role === 'HOST') {
  client.send(JSON.stringify({ type: 'NEWS_FLASH', news: newsRecord }));
} else {
  const publicNews = { ...newsRecord };
  delete publicNews.impacts;
  client.send(JSON.stringify({ type: 'NEWS_FLASH', news: publicNews }));
}
```

Traders and projectors receive **only** the textual headline, categorization badge, and cognitive reading countdown.

### 4.3 Portfolio Privacy Isolation
Trader clients receive strictly isolated portfolio payloads:
```javascript
if (role === 'TRADER' && teams[teamId]) {
  payload.portfolio = { ...t, holdingsValue, netWorth, pnlPct, unrealizedPnl };
  payload.teamTrades = executedTrades
    .filter((tr) => tr.teamId === teamId)
    .slice(-30)
    .reverse();
}
```
No team can inspect another team's cash balance, specific stock quantities, or transaction audit trail over the network wire.

---

## 5. Host 60-Second Privacy Reveal Safeguard

In collegiate competition halls, the Host's laptop is frequently connected to an external display, projector, or video stream. If upcoming news impacts or target multipliers were visible on the Host News Tab by default, participants glancing at the host desk would gain unfair insider advantages.

### 5.1 Architecture
*Location*: [public/app.js:7700-7750](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L7700-L7750) and [public/app.js:9556-9618](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L9556-L9618)

1. **Default Masked State**: Impacts are masked behind an ivory placeholder:
   `[🔒 Private Price Impact Details Hidden • Fairness Safeguard]`
2. **Explicit Reveal Trigger**: Clicking `#btnRevealPrivateNews` unmasks the details and starts a 60-second countdown.
3. **Auto-Hide Timer**:
   ```javascript
   hostRevealSecondsLeft = 60;
   hostRevealCountdownTimer = setInterval(() => {
     hostRevealSecondsLeft--;
     if (hostRevealSecondsLeft <= 0) {
       hidePrivateNewsDetailsNow();
     }
   }, 1000);
   ```
4. **Instant Invalidation**: Navigating away from the news tab immediately clears the timer and re-engages the mask.

---

## 6. CSV Formula Injection Protection

Spreadsheet applications (Excel, Google Sheets, LibreOffice Calc) interpret leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) as formula expressions or DDE commands, creating code execution or data exfiltration risks when event hosts download competition reports.

The server enforces formula escaping on all exported CSV columns:

*Location*: [server.js:98-107](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L98-L107)

```javascript
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}
```

Any cell starting with a formula trigger character is neutralized by prepending an apostrophe (`'`).
