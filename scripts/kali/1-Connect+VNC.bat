@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\andro.ps1" connect
start http://localhost:6080/vnc.html
pause
