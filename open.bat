@echo off
chcp 65001 >nul 2>&1
title Muye Design Platform - Preview Build
cd /d "%~dp0website"

where npm >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\npm.cmd" set "PATH=C:\Program Files\nodejs;%PATH%"
)
where npx >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js / npm not found. Please install Node.js from https://nodejs.org first.
  echo.
  pause
  exit /b 1
)

rem --- build first if dist is missing ---
if not exist "dist\index.html" (
  echo dist folder not found, building first...
  call npm run build
  if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Please run start.bat instead.
    pause
    exit /b 1
  )
)

cd /d "%~dp0website\dist"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080 " ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)

echo.
echo =========================================
echo   Muye Dental Design Platform (built)
echo   http://localhost:8080
echo =========================================
echo.

start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:8080"

call npx serve . -p 8080
echo.
echo Server stopped.
pause
