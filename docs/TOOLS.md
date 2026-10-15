# DEVELOPMENT & OPERATIONAL TOOLS — THE TRADING FLOOR CHAMPIONSHIP 2026

This guide covers the system requirements, development tools, browser support, and testing utilities.

---

## 1. System Requirements

### 1.1 Host Server Machine
- **Operating System**: Windows 10/11 (64-bit), macOS (v12+), or Linux (Ubuntu 20.04+, Debian 11+).
- **Runtime**: Node.js LTS (v18.x or v20.x recommended, minimum v16.0.0).
- **RAM**: Minimum 2 GB (512 MB dedicated to Node process).
- **Network**: Wi-Fi adapter or Ethernet port connected to a local router or hotspot.

### 1.2 Participant Client Devices
- **Hardware**: Any laptop, PC, Chromebook, or tablet capable of running a modern browser.
- **Supported Browsers**:
  - Google Chrome (v90+)
  - Microsoft Edge (v90+)
  - Mozilla Firefox (v88+)
  - Apple Safari (v14+)
  - Brave / Chromium-based browsers

---

## 2. Command-Line & Automation Utilities

### 2.1 1-Click Windows Launchers
Located in the repository root for non-technical event coordinators:
- **`Launch_The_Trading_Floor.bat`**: Comprehensive desktop launcher. Detects Node.js, runs `npm install` if required, resolves local LAN IP, starts the server in live event mode, and automatically opens the Host Controller in your browser.
- **`Open_Host_Panel.bat`**: Shortcut to open `http://localhost:3000/?role=host` in the default browser.
- **`Open_Projector.bat`**: Shortcut to open `http://localhost:3000/?role=projector` in full-screen on secondary stage monitors.
- **`Start_Test_Scenario.bat`**: Launches the engine in dry-run mode (`scenario_test.json`) with fictional companies for training.

### 2.2 Developer NPM Scripts
Configured in `package.json`:
```bash
# Start live competition server
npm start

# Start dry-run test simulation
npm run start:test

# Execute comprehensive automated test suite
npm test

# Refresh distribution ZIP package
npm run pack
```

---

## 3. Git Workflow & Version Control

- **Primary Branch**: `main`
- **Remote URL**: `https://github.com/Ved-mangukiya/TheTradingFLoor.git`
- **Standard Commit Convention**:
  - `feat: ...` for newly added capabilities.
  - `fix: ...` for bug fixes and logic patches.
  - `docs: ...` for specification and documentation updates.
  - `test: ...` for test suite additions and verification.
