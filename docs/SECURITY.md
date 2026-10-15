# SECURITY & ACCESS CONTROL SPECIFICATION — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. LAN Network Security & Trust Model

The Trading Floor Championship is designed to run over an isolated Local Area Network (Wi-Fi router, campus Ethernet switch, or mobile hotspot).

### 1.1 Network Boundary & Firewall Configuration
- **Port**: Default listener on TCP Port `3000` (configurable via `PORT` environment variable).
- **Windows Firewall**: When running on the host machine for the first time, Windows Defender may ask to allow Node.js on Private Networks. Organizers should click **"Allow Access on Private Networks"**.
- **No External Cloud Exposure**: The server binds to local interfaces and does not require port forwarding, NAT traversal, dynamic DNS, or external cloud tunneling unless intentionally bridged.

---

## 2. Authentication & Session Architecture

### 2.1 Cryptographic Session Tokens
- Upon successful login (`LOGIN` action), the server generates a cryptographically secure 32-character hexadecimal token using Node.js's native `crypto.randomBytes(16).toString('hex')`.
- Tokens are stored in the client's `sessionStorage` (cleared automatically when the browser tab closes).
- Every subsequent WebSocket message (`ORDER`, `HOST_PAUSE`, etc.) must include `session_token`.
- Tokens are mapped in-memory in the server's `sessions` Map.

### 2.2 Role-Based Access Control (RBAC)
Role privileges are strictly enforced on the server before executing any command:

| Role | Permitted Actions | Prohibited Actions |
| :--- | :--- | :--- |
| **`HOST`** | Pause, resume, advance day, create/trigger news, add/edit/delete/toggle shares, randomize prices, apply presets, change settings, export reports, crown winners. | Placing trading orders on behalf of teams. |
| **`TRADER`** | Place market BUY and SELL orders for their own team, view own portfolio, view own trade log, view public market prices. | Market engine control, modifying other teams' cash, triggering news, halting stocks. |
| **`PROJECTOR`**| View public market prices, public top-5 standings, active news flashes, and podium finale. | Placing orders, modifying settings, viewing private team cash or credentials. |

---

## 3. Server-Side Input Validation & Anti-Tamper Guarantees

### 3.1 Order Validation Matrix
The server rejects any order failing the following checks:
1. `session.role === 'TRADER'` (Hosts and Projectors cannot place orders).
2. `market.isPaused === false` and `market.isConcluded === false`.
3. `stock.isEnabled === true` (Stock must exist and be tradeable in the active universe).
4. `stock.isHalted === false` (Circuit breaker must not be active).
5. `quantity` is a positive integer $\ge 1$ and $\le 1,000,000$.
6. For **BUY** orders: $\text{Available Cash} \ge \text{Gross Value} + \text{Fee}$.
7. For **SELL** orders: $\text{Team Holdings} \ge \text{Quantity}$.
8. **Rate Limiting**: Consecutive orders from the same session within 200ms are throttled to prevent script abuse or double-click glitches.

### 3.2 Data Privacy & View Sanitization
When broadcasting state snapshots (`getSanitizedPublicState`):
- Team clients receive only their own cash balance, holdings, and trades. The holdings and cash balances of rival teams are scrubbed from the payload.
- The Projector client receives only top-5 aggregate net worths without passwords or private audit details.

### 3.3 CSV Formula Injection Protection
To prevent malicious code execution in Microsoft Excel or Google Sheets when exporting team names or stock symbols:
- Every cell in standings, trade logs, and universe exports is checked by `sanitizeCsvCell()`.
- If a string begins with dangerous formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`), it is prepended with a single quote (`'`), rendering it as safe plaintext.
