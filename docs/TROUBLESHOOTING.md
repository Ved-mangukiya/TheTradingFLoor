# TROUBLESHOOTING GUIDE — THE TRADING FLOOR CHAMPIONSHIP 2026

This guide provides instant solutions for the most common technical hurdles encountered before or during a live competition.

---

## 1. Installation & Startup Issues

### 1.1 "node is not recognized as an internal or external command"
- **Cause**: Node.js is not installed, or its directory is not added to your system's PATH.
- **Solution**:
  1. Download and install Node.js LTS from `https://nodejs.org/`.
  2. Restart your terminal or double-click `Launch_The_Trading_Floor.bat`.

### 1.2 "Error: listen EADDRINUSE: address already in use :::3000"
- **Cause**: Another instance of the server or another application is already using port 3000.
- **Solution**:
  - Close any existing Command Prompt or PowerShell windows running `node server.js`.
  - In PowerShell or CMD, find and kill the process:
    ```powershell
    # Find process ID on port 3000
    netstat -ano | findstr :3000
    # Kill the process (replace PID with the number in the last column)
    taskkill /PID <PID> /F
    ```
  - Alternatively, launch on a custom port: `set PORT=3050 && node server.js live`.

---

## 2. Local Network (LAN) & Connectivity Issues

### 2.1 Student laptops cannot connect to `http://<HOST_IP>:3000/`
- **Cause 1: Windows Firewall Blocking Port 3000**:
  - Open **Windows Defender Firewall** -> **Advanced Settings** -> **Inbound Rules**.
  - Ensure Node.js has incoming traffic allowed on Private Networks.
  - Or run in Admin PowerShell:
    ```powershell
    New-NetFirewallRule -DisplayName "TheTradingFloor" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
    ```
- **Cause 2: Wi-Fi "Client Isolation" on Campus Routers**:
  - Many institutional Wi-Fi networks enable "AP Isolation", preventing connected devices from talking to one another.
  - **Remedy**: Use a private travel router, an offline Wi-Fi access point, or a mobile hotspot from the host's phone. No cellular data is consumed.
- **Cause 3: Incorrect LAN IP**:
  - Run `ipconfig` in CMD on the host machine. Look for the active **IPv4 Address** (e.g. `192.168.1.15`).

---

## 3. Market & Simulation Operations

### 3.1 "Orders are not executing / Market is paused"
- **Cause**: The host paused the market or Day 1 has not started yet.
- **Solution**: On the Host Control Panel, click **▶ Resume (3-2-1)** to initiate the countdown and start trading.

### 3.2 "Stock shows HALTED and orders are rejected"
- **Cause**: The stock reached the 20% circuit breaker threshold.
- **Solution**: On the Host Control Panel, navigate to **📈 Stock Engine & Halts** and click **Release Halt** next to the affected stock.

### 3.3 "Audio alerts and chimes are silent"
- **Cause**: Modern browsers block Web Audio autoplay until the user clicks somewhere on the page.
- **Solution**: Click anywhere on the browser window once (e.g. click "Market Desk" tab or the volume icon).

### 3.4 "Student closed browser tab accidentally"
- **Solution**: Simply reopen the browser and go to `http://<HOST_IP>:3000/`. The session token in `sessionStorage` automatically reconnects to the server, preserving their portfolio, trade log, and cash balance.

---

## 4. Emergency Factory Reset
To discard all custom modifications, team balances, and return to clean factory defaults:
1. Close all active terminal windows.
2. In the project folder, delete `data/universe_active.json` (if it exists).
3. Delete files inside `logs/` (or archive them).
4. Run `Launch_The_Trading_Floor.bat`. The server will regenerate fresh factory data.
