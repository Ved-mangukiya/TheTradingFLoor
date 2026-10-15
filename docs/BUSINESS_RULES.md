# BUSINESS RULES & TRADING LOGIC — THE TRADING FLOOR CHAMPIONSHIP 2026

## 1. Capital Accounting & Order Execution Rules

### 1.1 Buy Order Execution
- **Pre-Conditions**:
  1. Market must be ACTIVE (`isPaused === false`, `isConcluded === false`).
  2. Target stock must be ENABLED (`isEnabled !== false`) in the active market universe.
  3. Target stock must NOT be halted (`isHalted === false`).
  4. Requested share quantity $Q > 0$ and $Q \le 1,000,000$.
  5. Required total funds must not exceed team available cash:
     $$\text{Gross Value} = Q \times P_{\text{current}}$$
     $$\text{Fee} = \text{round}\left(\frac{\text{Gross Value} \times \text{FeeBps}}{10000}, 2\right)$$
     $$\text{Required Cash} = \text{Gross Value} + \text{Fee} \le \text{Team Cash}$$
- **Post-Execution State Updates**:
  1. $\text{Team Cash}_{\text{new}} = \text{Team Cash}_{\text{old}} - (\text{Gross Value} + \text{Fee})$
  2. $\text{Holdings}_{\text{new}} = \text{Holdings}_{\text{old}} + Q$
  3. **Weighted Average Cost Basis (Average Buy Price)**:
     $$\bar{P}_{\text{new}} = \frac{(\text{Holdings}_{\text{old}} \times \bar{P}_{\text{old}}) + (Q \times P_{\text{current}})}{\text{Holdings}_{\text{new}}}$$
  4. Trade count incremented by 1.

### 1.2 Sell Order Execution
- **Pre-Conditions**:
  1. Market must be ACTIVE.
  2. Target stock must be ENABLED in the universe.
  3. Target stock must NOT be halted.
  4. Team must possess sufficient share quantity:
     $$Q \le \text{Team Holdings}[T]$$
- **Post-Execution State Updates**:
  1. $\text{Gross Value} = Q \times P_{\text{current}}$
  2. $\text{Fee} = \text{round}\left(\frac{\text{Gross Value} \times \text{FeeBps}}{10000}, 2\right)$
  3. $\text{Net Credit} = \text{Gross Value} - \text{Fee}$
  4. $\text{Team Cash}_{\text{new}} = \text{Team Cash}_{\text{old}} + \text{Net Credit}$
  5. $\text{Holdings}_{\text{new}} = \text{Holdings}_{\text{old}} - Q$
  6. **Realized Profit / Loss**:
     $$\text{Profit on Sold} = Q \times (P_{\text{current}} - \bar{P}_{\text{old}})$$
     $$\text{Realized P&L}_{\text{new}} = \text{Realized P&L}_{\text{old}} + \text{Profit on Sold} - \text{Fee}$$
  7. If $\text{Holdings}_{\text{new}} == 0$, reset $\bar{P} = 0$.

---

## 2. Valuation & Performance Scoring

### 2.1 Total Portfolio Net Worth
$$\text{Equity Value} = \sum_{i=1}^{N} \left(\text{Holdings}_i \times P_{i,\text{current}}\right)$$
$$\text{Net Worth} = \text{Available Cash} + \text{Equity Value}$$

### 2.2 Unrealized P&L per Position
$$\text{Unrealized P&L}_i = \text{Holdings}_i \times (P_{i,\text{current}} - \bar{P}_i)$$

### 2.3 Percentage Return on Capital
$$\text{Return \%} = \left(\frac{\text{Net Worth} - \text{Starting Capital}}{\text{Starting Capital}}\right) \times 100$$

### 2.4 Championship Ranking & Deterministic Tie-Breaker
Teams are ranked strictly by:
1. **Primary Sort**: Total Net Worth (Descending).
2. **Secondary Tie-Breaker**: Total Trade Count (Ascending) — favoring higher capital efficiency and disciplined execution.
3. **Tertiary Tie-Breaker**: Team Registration Sequence.

---

## 3. Circuit Breaker Rules & Halts

### 3.1 Trigger Conditions
On each 1500ms market tick, every stock's price is evaluated against its official **Day Open Reference Price** ($P_{\text{day\_open}}$):
$$\Delta P = \frac{P_{\text{current}} - P_{\text{day\_open}}}{P_{\text{day\_open}}} \times 100$$
If $|\Delta P| \ge \text{CircuitBreakerLimit}$ (Default: 20%):
1. Stock trading status is flagged `isHalted = true`.
2. `haltDirection` is recorded as `'UPPER'` ($\Delta P \ge +20\%$) or `'LOWER'` ($\Delta P \le -20\%$).
3. Synthetic circuit breaker alarm chimes on all connected clients.
4. An authoritative audit event (`CIRCUIT_BREAKER_TRIGGERED`) is recorded.
5. All subsequent buy and sell orders in that stock are rejected with `"Trading halted on {TICKER} due to circuit breaker limit."`

### 3.2 Halt Release Behavior
- Circuit breaker halts remain in effect until the Host clicks **Release Halt** in the Host Control Panel.
- Upon release:
  1. `isHalted` is set to `false`.
  2. $P_{\text{day\_open}}$ is reset to the current price ($P_{\text{current}}$) to establish a fresh reference baseline.
  3. Normal trading resumes immediately.

---

## 4. Anti-Tamper & Security Rules
- **Rate Limit Window**: A 200ms throttle is enforced per team session token. Rapid-fire duplicate clicks are rejected.
- **Role Isolation**: Only authenticated Host sessions (`role === 'HOST'`) can trigger pauses, resumes, day advances, news injections, or universe modifications.
- **Formula Injection Mitigation**: All CSV reports sanitize cell values starting with `=`, `+`, `-`, or `@` by prefixing a single quote (`'`).
