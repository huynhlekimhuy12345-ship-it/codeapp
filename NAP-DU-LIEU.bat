@echo off
title BI99 - Nap du lieu mau
cd /d %~dp0backend

echo ============================================
echo   BI99 - Nap du lieu mau vao database
echo   (chay lai nhieu lan van an toan, khong trung)
echo ============================================
echo.

if not exist node_modules (
  echo Dang cai dat thu vien cho backend truoc...
  call npm install
  echo.
)

echo [1/3] Nap khach ao + don hang mau...
call node seed-customers.js
echo.
echo [2/3] Nap du lieu mau hau mai (bao hanh / doi tra / chat)...
call node seed-aftersales-demo.js
echo.
echo [3/3] Nap du lieu mau don hang / thanh toan / su kien...
call node seed-demo.js
echo.
echo ============================================
echo   Xong! Mo web, vao trang quan tri,
echo   tab Bao hanh de xem du lieu mau.
echo ============================================
pause
