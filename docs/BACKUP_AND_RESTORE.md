# BACKUP, RESTORE & DATA INTEGRITY MANUAL — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Overview of Data Assets

The platform maintains two categories of state:
1. **Persistent Configuration**: Saved to disk in `data/universe_active.json` (active stock universe, customized base prices, volatility, and enabled flags).
2. **Runtime Execution & Audits**: Maintained in server memory during the event and continuously flushed to `logs/AUDIT_LOG_*.json`.

---

## 2. Programmatic Backup & Restore (REST APIs)

### 2.1 Complete State Backup (`GET /api/backup`)
- **Endpoint**: `http://localhost:3000/api/backup?token=<HOST_TOKEN>`
- **Output**: A complete JSON snapshot containing:
  - `gameState` (title, day, elapsed seconds, fees, circuit breaker limits)
  - `companies` (full active universe with real-time prices and history)
  - `teams` (team balances, cash, holdings, average buy prices, realized P&L)
  - `executedTrades` (complete audit ledger of all executed transactions)
- **Usage**: Run in browser or cURL to download a point-in-time championship snapshot.

### 2.2 Complete State Restoration (`POST /api/restore`)
- **Endpoint**: `http://localhost:3000/api/restore`
- **Payload**: JSON backup object previously exported from `/api/backup`.
- **Headers**: `Content-Type: application/json`
- **Behavior**: Instantly restores in-memory companies, teams, and game state, writes `data/universe_active.json`, and broadcasts updated state to all connected terminals.

---

## 3. Manual File-Based Backups

Before a major college competition, organizers can create an offline backup in under 10 seconds:

1. **Backup Active Universe**:
   Copy `data/universe_active.json` to a backup location (e.g. `data/backups/universe_day1.json`).
2. **Backup Completed Audit Logs**:
   Copy the `logs/` directory to an external USB drive or faculty records folder.
3. **Export Team Credentials CSV**:
   In the Host Control Panel, open **👥 Teams Setup** and click **Export CSV** to save `teams_roster.csv`.

---

## 4. Resetting Practice Competitions

When transitioning from student practice rounds to the official tournament:
1. Click **🏛️ Market Builder** -> **↺ Reset to Baseline**.
2. Click **👥 Teams Setup** -> check **"Reset existing cash balances to Starting Cash"** -> click **Apply & Save Roster**.
3. All cash balances reset to starting capital (₹5,00,000), team holdings clear to 0, and the trade counter resets.
