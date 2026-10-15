@echo off
title The Trading Floor - LIVE EVENT SERVER
cd /d "%~dp0"

echo ================================================================
echo   THE TRADING FLOOR - LIVE CHAMPIONSHIP SERVER 2026
echo ================================================================
echo.

if not exist "node_modules\" (
    echo [1/2] Installing required Node.js dependencies (express, ws)...
    call npm install
) else (
    echo [1/2] Dependencies verified.
)

echo.
echo [2/2] Launching Championship Portal in 2 seconds...
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/"

echo.
echo Starting Price Engine in LIVE EVENT MODE...
echo.
node server.js live
pause
