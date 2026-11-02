@echo off
title The Trading Floor - Championship Platform
cd /d "%~dp0"
cls
color 0F

echo ========================================================================
echo          THE TRADING FLOOR -- CHAMPIONSHIP PLATFORM
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

:: 3. Launch Host browser deck and start engine
echo [OK] Pre-flight system checks complete.
echo [OK] Opening Host Master Control in your default browser...
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/?role=host"
echo.

"%NODE_EXEC%" server.js live
pause
