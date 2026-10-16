# RESET, RESTART & RECOVERY PROTOCOLS

## 1. Separation of Concerns
In live event software, **Event Reset**, **New Event Creation**, and **Server Restart** are distinct operations with different side effects and safety guarantees. They must never be conflated.

---

## 2. Operation A: Reset Current Event (`HOST_FULL_RESET`)
### Purpose
Wipes the active championship state and returns the Host Control Centre to a blank, unconfigured state (Draft Setup Mode).

### Safety Guardrail
- Requires explicit confirmation with an exact case-sensitive confirmation phrase: `"RESET CHAMPIONSHIP"`.
- If the phrase is omitted or incorrect, the server strictly rejects the request and logs a security audit entry.

### Actions Taken on Server Confirmation
1. Cancels all active timers, resume countdowns, and scheduled news timers.
2. Resets all team cash balances to initial capital (₹5,00,000) and wipes holdings (`holdings = {}`, `avgBuyPrice = {}`).
3. Drains trade history (`trades = []`).
4. Re-enables all universe shares to baseline state.
5. Unlocks event configuration (`configLocked = false`).
6. Sets `status = 'STANDBY'`, `day = 1`, `dayTimeRemaining = dayDurationSeconds`.
7. Broadcasts `CHAMPIONSHIP_RESET` to all connected clients with mandatory full-screen notice:
   *"The host has reset the competition. You have been logged out. Please wait for the host to set up a new event."*
8. Immediately invalidates trader sessions server-side to prevent stale orders, clears local trader caches, and redirects to login.

### Preserved Assets (Never Wiped)
- User authentication accounts (`host`, `projector`, `sound`, `team1..16`).
- Master company catalogue (`data/universe_baseline.json`).
- Pre-existing event export CSV files and audit logs in `logs/`.
- Local UI styles, fonts, and assets.

---

## 3. Operation B: Start a New Event
### Purpose
Initializes a new tournament without destroying historical records.
- Creates a new unique `eventId` (timestamp-based UUID).
- Saves the previous tournament's audited final standings and trade ledger in `logs/` and `data/archives/`.
- Prompts host with the 6-step guided setup wizard:
  `Details -> Teams -> Stocks -> Schedule -> News -> Review & Lock`.

---

## 4. Operation C: Server Restart & Crash Recovery
### Purpose
If the Node.js server crashes, reboots, or is restarted due to OS updates or power interruption during an active competition, it must **never** wipe live competition progress.

### Recovery Invariants (`data/state_backup.json`)
Every state transition (order execution, news shock, pause/resume, day transition) flushes an atomic state backup to `data/state_backup.json`.

On startup, `server.js` checks for `data/state_backup.json`:
1. **State Restoration**: Restores event title, day number, elapsed seconds, current stock prices, circuit breaker states, all team cash balances, stock holdings, and trade ledger.
2. **Safe Market State**: Automatically opens the market in `PAUSED` state with a terminal message:
   ```
   ⚡ [CRASH RECOVERY] Previous live session detected and restored cleanly!
   • Day & Second: Day 1 / 3 (142s elapsed)
   • Teams Loaded: 16
   • Trades Restored: 34
   • Market Status: PAUSED (Host must press Resume to continue)
   ```
3. **No Duplicate Execution**: Executed trades are not re-executed; previously applied scheduled news items are marked as processed and are not re-applied.
4. **Resumed Floor**: Connected clients re-establish WebSocket connections, receive the restored snapshot, and await host resume.
