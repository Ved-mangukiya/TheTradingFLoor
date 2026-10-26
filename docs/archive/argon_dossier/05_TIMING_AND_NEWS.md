# 05 — TIMING, CLOCKS, DYNAMIC SCHEDULING & NEWS ENGINE

> **Auditor Reference Document**: Complete timing specifications, clock synchronization, cognitive reading windows, dynamic schedule scaling formulas, and news publication lifecycle for **The Trading Floor Championship 2026**.

---

## 1. Engine Clocks & Server Tick Loops

The simulation runs on two primary server-side interval timers hosted in [server.js](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js):

### 1.1 The 1-Second Master Game Clock (`1000ms`)
*Location*: [server.js:1375-1416](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L1375-L1416)

```javascript
setInterval(() => {
  // 1. Check for Scheduled Event Auto-Start
  if (gameState.status === 'SCHEDULED' && gameState.scheduledStartTime) {
    const targetMs = new Date(gameState.scheduledStartTime).getTime();
    if (!isNaN(targetMs)) {
      if (Date.now() >= targetMs) {
        gameState.status = 'COUNTDOWN';
        startResumeCountdown('SCHEDULED_TIMER');
      } else {
        broadcastTick();
      }
    }
  }

  if (gameState.isPaused || gameState.isConcluded || gameState.status === 'DAY_COMPLETED' || gameState.status !== 'LIVE') return;

  gameState.elapsedSeconds++;

  // 2. News Event Triggers & Phase Transitions
  newsEvents.forEach((ev) => {
    if (!ev.triggered && !ev.cancelled && ev.day === gameState.currentDay && ev.trigger_second === gameState.elapsedSeconds) {
      triggerNewsEvent(ev, 'AUTO_CLOCK');
    }
    // Transition from READING to REACTING when decision deadline expires
    if (ev.triggered && !ev.cancelled && ev.phase === 'READING' && gameState.elapsedSeconds >= (ev.reactionStartSecond || (ev.trigger_second + 25))) {
      ev.phase = 'REACTING';
      applyNewsImpactsToStocks(ev);
      broadcastAudioCue('reaction_start_chime', 'news', { event_id: ev.event_id, headline: ev.headline });
      broadcastAll({ type: 'NEWS_REACTION_START', event_id: ev.event_id, headline: ev.headline });
    }
  });

  // 3. Automatic Day Clock Expiration
  if (gameState.elapsedSeconds >= gameState.dayDurationSeconds) {
    recordAuditEvent('DAY_CLOSE_CLOCK_EXPIRED', { day: gameState.currentDay, elapsed: gameState.elapsedSeconds });
    concludeCurrentDay(true);
  }
}, 1000);
```

### 1.2 The High-Frequency Price Generation Loop (`250ms`)
*Location*: [server.js:1418-1540](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L1418-L1540)
- Ticks every $250\text{ ms}$ (4 frames per second).
- Evaluates active cubic Hermite transitions (`s(u) = 3u^2 - 2u^3`).
- Applies GBM stochastic drift ($\sigma_{\text{eff}} \times Z$).
- Enforces $\pm 20\%$ circuit breaker bands and monitors mean-reverting unhalt liquidity.
- Broadcasts `TICK_UPDATE` payload to all active clients.

---

## 2. Dynamic Schedule Ratio Engine

When a host configures or adjusts the trading day duration ($D$), news events cannot be placed at fixed static seconds. A 30-minute schedule would break if scaled down to a 5-minute express heat.

The server uses a **proportional ratio formula** to map event positions across any chosen session length:

$$t_i = \operatorname{round}(D \times p_i)$$

Where:
- $D =$ Day duration in seconds (`dayDurationSeconds`).
- $p_i =$ Relative position fraction ($0.10 \le p_i \le 0.90$).
- $t_i =$ Calculated trigger second (`trigger_second`).

### 2.1 Implementation Code
*Location*: [server.js:938-982](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L938-L982)

```javascript
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
```

---

## 3. Cognitive Reading Windows ($W(D)$)

In physical collegiate competitions, students need sufficient time to read headlines, analyze sectoral implications, and execute strategic trades before market prices move.

The engine scales the **Reading & Discussion Window** ($W$) dynamically using a step function based on day duration:

$$W(D) = \begin{cases} 
12\text{ seconds} & \text{if } D \le 300\text{ s (5 mins)} \\
18\text{ seconds} & \text{if } 300 < D \le 600\text{ s (10 mins)} \\
22\text{ seconds} & \text{if } 600 < D \le 1200\text{ s (20 mins)} \\
25\text{ seconds} & \text{if } D > 1200\text{ s (30+ mins)}
\end{cases}$$

*Location*: [server.js:886-891](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L886-L891)

```javascript
function getReadingWindowForDuration(durationSec) {
  if (durationSec <= 300) return 12;
  if (durationSec <= 600) return 18;
  if (durationSec <= 1200) return 22;
  return 25;
}
```

---

## 4. Schedule Feasibility Constraints

To prevent overlapping shocks or unreadable schedules, the engine runs feasibility validation against 3 physical invariants:

1. **No Pre-Market Triggers**: $t_i > 0$.
2. **Session Boundary**: $t_i + W(D) + T_{\text{shock}} \le D$, where $T_{\text{shock}} = 25\text{ s}$.
3. **Minimum Inter-News Separation**: $t_{i} - t_{i-1} \ge 60\text{ seconds}$.

*Location*: [server.js:894-936](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/server.js#L894-L936)

```javascript
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
```

---

## 5. The 5-Phase News Lifecycle

News events follow a deterministic 5-phase finite state machine:

```
  [SCHEDULED]
       │
       ▼ (clock reaches trigger_second)
   [READING]  ◄── Audio: heavy_news_boom
       │          Duration: W(D) seconds (12s to 25s)
       │          Traders see neutral headline only
       │          Target prices remain static (zero shock)
       ▼ (elapsedSeconds >= reactionStartSecond)
  [REACTING]  ◄── Audio: reaction_start_chime
       │          Duration: 20-25 seconds
       │          Smoothstep price transition active: s(u) = 3u^2 - 2u^3
       │          Target price delta unfolds continuously
       ▼ (transition finishes)
   [SETTLED]  ◄── Target price reached
       │          Normal GBM stochastic fluctuations resume
       ▼ (next news or day conclusion)
  [ARCHIVED]  ◄── Stored in gameState.newsHistory
```

### 5.1 Idempotency & Per-Day Registry
To prevent duplicate triggers caused by clock re-synchronization or host pausing, every triggered event is recorded in a per-day registry map:

```javascript
const firedKey = `day_${gameState.currentDay}_${eventObj.event_id}`;
if (firedNewsEventsPerDay.has(firedKey)) {
  return false; // Already fired today - strictly idempotent
}
firedNewsEventsPerDay.set(firedKey, true);
```

---

## 6. Clock Formatting & 12-Hour AM/PM Standards

All presentation screens, waiting room timers, and audit logs display real-world timestamps formatted in human-readable 12-hour AM/PM notation.

*Location*: [public/app.js:2203-2219](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/public/app.js#L2203-L2219)

```javascript
function formatClock12H(dateOrIso, includeSeconds = false) {
  if (!dateOrIso) return '—';
  if (typeof dateOrIso === 'string' && (dateOrIso.includes('AM') || dateOrIso.includes('PM')) && !dateOrIso.includes('T')) {
    return dateOrIso;
  }
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (isNaN(d.getTime())) return String(dateOrIso);
  const options = {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit'
  };
  if (includeSeconds) {
    options.second = '2-digit';
  }
  return d.toLocaleTimeString('en-US', options);
}
```

*(Note: See [DEF-02](file:///d:/01_Coding%20Projects/2.%20College%20&%20School/TheTradingFLoor/ARGON_DOSSIER/07_DEFECT_REGISTER.md) regarding duplicate definition of this function at line 4948).*
