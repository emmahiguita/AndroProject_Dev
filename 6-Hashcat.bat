@echo off
REM Hashcat Benchmark
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\hashcat.ps1" -Benchmark
pause
