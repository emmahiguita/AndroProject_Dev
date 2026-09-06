@echo off
title AndroProject - Desktop App (Electron)
cd /d "%~dp0androproject-gui"
echo ============================================================
echo   AndroProject Desktop App (Electron + Next.js)
echo   Puerto: 3001
echo ============================================================
echo.
call npm run electron
