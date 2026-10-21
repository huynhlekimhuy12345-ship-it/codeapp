@echo off
title BI99 - Khoi dong web
cd /d %~dp0

echo ============================================
echo   BI99 - Dang khoi dong web, vui long doi...
echo ============================================
echo.

if not exist backend\node_modules (
  echo Lan dau chay: dang cai dat thu vien cho backend...
  pushd backend && call npm install && popd
  echo.
)
if not exist frontend\node_modules (
  echo Lan dau chay: dang cai dat thu vien cho frontend...
  pushd frontend && call npm install && popd
  echo.
)

start "BI99 - Backend (dung dong cua so nay)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul
start "BI99 - Frontend (dung dong cua so nay)" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo Da mo web tai http://localhost:5173
echo.
echo LUU Y: de web chay, giu nguyen 2 cua so Backend va Frontend.
echo Muon tat web thi dong 2 cua so do lai.
echo.
pause
