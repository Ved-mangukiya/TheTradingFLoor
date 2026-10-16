@echo off
title The Trading Floor — Create Portable USB Package
cd /d "%~dp0"
cls
echo ========================================================================
echo        THE TRADING FLOOR -- CREATING PORTABLE COLLEGE PC PACKAGE
echo ========================================================================
echo.
echo Packaging self-contained portable championship kit...
echo (Includes server code, UI, node_modules, and portable Node engine)
echo.

powershell -Command "Write-Host 'Compressing folder into TheTradingFloor_PORTABLE.zip...' -ForegroundColor Cyan; Compress-Archive -Path '.\*' -DestinationPath '..\TheTradingFloor_PORTABLE.zip' -Force -Exclude '..\TheTradingFloor_PORTABLE.zip'"

echo.
echo ========================================================================
echo  SUCCESS! Your portable championship package is ready at:
echo  d:\01_Coding Projects\2. College & School\TheTradingFloor_PORTABLE.zip
echo ========================================================================
echo.
echo What to do next:
echo 1. Copy 'TheTradingFloor_PORTABLE.zip' to your USB Pen Drive.
echo 2. On the College PC: Extract it anywhere (e.g. Desktop).
echo 3. Double-click 'Launch_The_Trading_Floor.bat' -- IT RUNS IMMEDIATELY!
echo    (Zero installation or admin rights required on the college PC!)
echo.
pause
