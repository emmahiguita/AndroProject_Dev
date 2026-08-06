@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\andro.ps1" tool msf
