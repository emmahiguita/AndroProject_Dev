@echo off
:: AndroProject — Detener servicios
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0stop.ps1"
pause
