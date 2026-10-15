# KNOWN ISSUES & SYSTEM BOUNDARIES — THE TRADING FLOOR CHAMPIONSHIP 2026

This document honestly outlines verified system boundaries, operational limitations, and documented workarounds.

---

## 1. Verified System Boundaries

### 1.1 Web Audio Autoplay Gesture Policy
- **Behavior**: On first page load, browsers (Chrome, Edge, Safari) prohibit background audio synthesis until the user performs at least one physical click or interaction on the page.
- **Impact**: Opening bell or siren will be silent if no one has clicked on the screen yet.
- **Workaround**: Click anywhere on the dashboard once after loading the page (e.g. click "Market Desk" or the screen background).

### 1.2 Campus Wi-Fi Access Point (AP) Client Isolation
- **Behavior**: Certain enterprise campus Wi-Fi networks block peer-to-peer communication between connected laptops to prevent unauthorized network scanning.
- **Impact**: Student laptops receive "Connection Timed Out" when attempting to reach `http://<HOST_IP>:3000/`.
- **Workaround**: Use a standalone offline travel router, a dedicated access point, or a smartphone mobile hotspot for the event. No active internet is required.

### 1.3 Recommended Team Concurrency
- **Boundary**: Extensively tested and optimized for 1 to 24 concurrent teams on standard dual/quad-core laptops.
- **Guidance**: For mega-events exceeding 32 teams, run the host server on a machine with at least 8 GB RAM and modern multi-core CPU.

### 1.4 Intraday Tick History Pruning
- **Behavior**: To prevent client and server memory bloat over multi-hour competitions, intraday price coordinate history is maintained in rolling arrays per day and archived on day advance.
- **Impact**: Sparkline curves reflect the active trading day rather than multi-day cumulative curves.

---

## 2. Defect Tracking & Resolution Status

| Issue ID | Description | Severity | Status | Workaround / Resolution |
| :---: | :--- | :---: | :---: | :--- |
| **SEC-01** | Rapid double-click order duplicate spam | Medium | RESOLVED | 200ms per-session debounce enforced in `server.js`. |
| **SEC-02** | CSV Formula Injection vulnerability | High | RESOLVED | `sanitizeCsvCell()` prepends `'` to dangerous `=+-@` characters. |
| **NET-01** | Sudden LAN drop or browser refresh | Medium | RESOLVED | `RESUME_SESSION` token protocol automatically restores portfolio. |
| **UI-01** | Disabled stocks visible on trader screens | High | RESOLVED | Server filters `companies` payload by `isEnabled !== false`. |
