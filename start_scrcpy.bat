@echo off
title Proyector Celular - OPPO
echo ============================================================
echo   Iniciando Proyector de Pantalla en Tiempo Real (scrcpy)
echo ============================================================
echo.
cd /d "C:\Users\emman\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1"
scrcpy.exe -s VGL7MVFMDYQG8T55 --window-title "OPPO CPH2557 - Proyeccion" --always-on-top --stay-awake
pause
