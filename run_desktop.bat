@echo off
title AndroProject - Desktop App (Tauri + Next.js)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0androproject-gui"
echo ============================================================
echo   AndroProject Desktop App (Tauri + Next.js)
echo   Puerto: 3000
echo ============================================================
echo.
call npm run tauri:dev
