@echo off
REM AndroProject - Auto Proyector Samsung Galaxy A30
REM Lanza el watchdog completamente oculto (sin ventana CMD ni PowerShell visibles).
REM Usa powershell directamente; no usa "start" para evitar abrir ventana CMD intermediaria.
powershell.exe -WindowStyle Hidden -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "%~dp0samsung-watchdog.ps1"

