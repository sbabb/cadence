@echo off
title Cadence - dev server
cd /d "%~dp0"

if not exist node_modules (
  echo First run in this folder - installing dependencies. This takes a minute.
  echo.
  call npm install
  echo.
)

echo ============================================
echo  Starting Cadence.
echo  Your browser will open at localhost:3000.
echo  To test on your phone, use the "Network:"
echo  address printed below - same wifi only.
echo.
echo  Leave this window open while you use it.
echo  Press Ctrl+C to stop the server.
echo ============================================
echo.

call npm run dev -- --open
pause
