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
Located in the repository root for streamlined event operations:
- **`Launch_The_Trading_Floor.bat`**: Master championship desktop launcher. Detects portable or system Node.js, installs dependencies, resolves local LAN IP, starts the authoritative server in live event mode, and automatically opens the Host Operations Desk.
- **`Create_Live_Demo_Link.bat`**: Generates an instant public HTTPS link via Cloudflare Tunnel (`npx untun`) for live remote presentations to HOD and faculty on their phones or laptops.
- **`Pack_Portable_USB_Zip.bat`**: Packages the entire project, including offline documentation and portable tools, into a clean standalone ZIP archive for tournament-day USB drives.

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
