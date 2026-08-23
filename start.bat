@echo off
chcp 65001 >nul 2>&1
title Muye Design Platform - Dev Server
cd /d "%~dp0website"

rem --- make sure npm is available; fall back to default Node.js install path ---
where npm >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\npm.cmd" set "PATH=C:\Program Files\nodejs;%PATH%"
)
where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] npm not found. Please install Node.js from https://nodejs.org first.
  echo.
  pause
  exit /b 1
)

rem --- free ports 3000/3001 if leftover servers are still holding them ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  echo Port 3000 is occupied by PID %%p, stopping it...
  taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
  echo Port 3001 is occupied by PID %%p, stopping it...
  taskkill /PID %%p /F >nul 2>&1
)

echo.
echo =========================================
echo   Muye Dental Design Platform
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:3001
echo   Press Ctrl+C to stop the frontend
echo   (backend runs in its own minimized window)
echo =========================================
echo.

rem --- start the backend API first (frontend now depends on it) ---
start "Muye Backend (3001)" /min cmd /c "cd /d %~dp0server && npm start"

rem --- open the browser after the servers have time to start ---
start "" /min cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

call npm run dev
echo.
echo Server stopped.
pause
