@echo off
title The Trading Floor — Instant Public Demo Link Generator
color 0A

echo ==============================================================================
echo   THE TRADING FLOOR CHAMPIONSHIP 2026 — INSTANT PUBLIC DEMO TUNNEL
echo   Generate a real-time public HTTPS link for HOD ^& Coordinators
echo ==============================================================================
echo.

:: Detect Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  if exist "%~dp0tools\node.exe" (
    set "PATH=%~dp0tools;%PATH%"
  ) else (
    echo [ERROR] Node.js is not found in system PATH.
    pause
    exit /b 1
  )
)

echo [1/2] Checking if local market server is running on port 3000...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -TimeoutSec 2 -UseBasicParsing; Write-Host '  [OK] Local server is active on port 3000.' } catch { Write-Host '  [NOTE] Starting local server in a background window...'; Start-Process cmd -ArgumentList '/c title TTF-Server && cd /d \"%~dp0\" && node server.js live' -WindowStyle Minimized; Start-Sleep -Seconds 3 }"

echo.
echo [2/2] Launching secure public Cloudflare HTTPS tunnel via untun...
echo ------------------------------------------------------------------------------
echo   A public HTTPS link (e.g. https://xxxx.trycloudflare.com) will appear below.
echo   Share this link with your HOD or Coordinators for instant live access!
echo ------------------------------------------------------------------------------
echo.

npx -y untun tunnel --port 3000

pause
