@echo off
REM ============================================================
REM   TomeForge Studio - clean start
REM   Double-click this file to launch the app.
REM ============================================================
setlocal
cd /d "%~dp0"
title TomeForge Studio - launcher

REM --- Node present? ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on your PATH.
  echo Install it from https://nodejs.org then run start.bat again.
  echo.
  pause
  exit /b 1
)

REM --- Already running? Just open the browser and leave. ---
netstat -aon | findstr ":5199" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo TomeForge is already running.
  start "" "http://localhost:5199"
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)

REM --- First run: install dependencies. ---
if not exist "node_modules\" (
  echo First run detected - installing dependencies. This can take a minute...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Scroll up for details.
    pause
    exit /b 1
  )
)

echo.
echo Starting TomeForge Studio on http://localhost:5199
echo A server window will open. Leave it running while you write.
echo To stop, run stop.bat (or close the server window).
echo.

REM --- Launch the dev server in its own titled window. ---
start "TomeForge Server" cmd /k "npm run dev"

REM --- Give Vite a moment, then open the browser. ---
REM (ping is used as a sleep: works even when the script is run non-interactively)
ping -n 5 127.0.0.1 >nul
start "" "http://localhost:5199"

ping -n 3 127.0.0.1 >nul
exit /b 0
