@echo off
title AndroProject
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start.ps1"
explorer.exe "http://127.0.0.1:3001"
