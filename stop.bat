@echo off
REM ============================================================
REM   TomeForge Studio - clean stop
REM   Kills only the server on port 5199 (not your other Node apps).
REM ============================================================
setlocal enabledelayedexpansion
title TomeForge Studio - stop

set "PORT=5199"
set "FOUND="

echo Looking for TomeForge on port %PORT% ...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set "FOUND=1"
  echo Stopping server process PID %%p ...
  taskkill /F /PID %%p >nul 2>nul
)

REM Also close the launcher's server window if it lingered open.
taskkill /F /FI "WINDOWTITLE eq TomeForge Server*" >nul 2>nul

echo.
if defined FOUND (
  echo TomeForge has been stopped.
) else (
  echo Nothing was running on port %PORT%.
)
ping -n 3 127.0.0.1 >nul
exit /b 0
