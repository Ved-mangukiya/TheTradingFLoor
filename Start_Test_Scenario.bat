@echo off
title The Trading Floor - TEST SCENARIO LAUNCHER
cd /d "%~dp0"

echo ================================================================
echo   THE TRADING FLOOR 2026 - DRY-RUN TEST SANDBOX
echo ================================================================
echo.

if not exist "node_modules\" (
    echo [1/3] Installing required Node.js dependencies (express, ws)...
    call npm install
) else (
    echo [1/3] Dependencies verified.
)

echo.
echo [2/3] Launching Host, Projector, and Team 1 test windows in 3 seconds...
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000/?autologin=host & start http://localhost:3000/?autologin=projector & start http://localhost:3000/?autologin=team1"

echo.
echo [3/3] Starting Price Engine in TEST MODE...
echo.
node server.js test
pause
