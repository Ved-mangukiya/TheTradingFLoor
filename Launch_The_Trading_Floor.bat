@echo off
title The Trading Floor — Championship Platform 2026
cd /d "%~dp0"
cls
color 0F

echo ========================================================================
echo          THE TRADING FLOOR -- CHAMPIONSHIP SIMULATOR 2026
echo             Offline Institutional Stock Exchange Platform
echo ========================================================================
echo.

:: 1. Verify Node.js is installed (Check System PATH or local portable tools/ folder)
set "NODE_EXEC=node"
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "%~dp0tools\node.exe" (
        set "NODE_EXEC=%~dp0tools\node.exe"
        echo [INFO] Running with portable Node engine from tools folder.
    ) else if exist "%~dp0bin\node.exe" (
        set "NODE_EXEC=%~dp0bin\node.exe"
        echo [INFO] Running with portable Node engine from bin folder.
    ) else (
        echo [ERROR] Node.js was not found on this computer!
        echo.
        echo To run this application:
        echo 1. Install Node.js LTS from: https://nodejs.org/
        echo    OR place node.exe directly inside a 'tools' folder in this directory.
        echo 2. Relaunch this file.
        echo.
        pause
        exit /b 1
    )
)

:: 2. Verify or Install local dependencies
if not exist "node_modules\" (
    echo [INFO] First-time setup detected. Installing fast local modules...
    call npm install --silent
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies. Please check your internet connection for first-time setup.
        pause
        exit /b 1
    )
    echo [INFO] Dependencies installed successfully.
    echo.
)

:: 3. Detect Host LAN IP address for participants
set LAN_IP=localhost
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"IP Address"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LAN_IP=%%b
        goto :ip_found
    )
)
:ip_found

echo ------------------------------------------------------------------------
echo   CHAMPIONSHIP ACCESS ADDRESSES:
echo ------------------------------------------------------------------------
echo   * Host Master Deck : http://localhost:3000/?role=host
echo     Username: host  ^|  Password: host2026
echo.
echo   * Stage Projector  : http://localhost:3000/?role=projector
echo     Username: projector  ^|  Password: screen2026
echo.
echo   * Teams on LAN     : http://%LAN_IP%:3000/
echo     Share this link with student participants on the same Wi-Fi.
echo ------------------------------------------------------------------------
echo.
echo Launching Trading Floor in your web browser...
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/?role=host"

echo.
echo Engine running. Keep this window open during the tournament.
echo To safely stop the server, press Ctrl+C or close this window.
echo ========================================================================
echo.

"%NODE_EXEC%" server.js live
pause
