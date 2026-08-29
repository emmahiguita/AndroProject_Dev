@echo off
title AndroProject - Auto Proyector Samsung Galaxy A30
color 0b
echo ===============================================================================
echo     AndroProject - AUTO-PROYECCION INTELIGENTE SAMSUNG GALAXY A30 (Wi-Fi/USB)
echo ===============================================================================
echo.
echo  [INFO] El sistema detectara tu Samsung Galaxy A30 automaticamente:
echo         - Si esta en la misma red Wi-Fi: Se proyectara de inmediato.
echo         - Si lo conectas por USB: Se proyectara y activara el modo Wi-Fi.
echo         - Si la red cambia o se reconecta: Auto-reparara la conexion sin lag.
echo.
echo  Optimizacion activa: Video H.264 (Buffer Anti-Lag de 50ms) a 60 FPS.
echo.
echo ===============================================================================
echo  Iniciando vigilancia y auto-proyeccion continua...
echo ===============================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0samsung-watchdog.ps1"

pause
