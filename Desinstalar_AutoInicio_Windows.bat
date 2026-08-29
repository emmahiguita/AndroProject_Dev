@echo off
title Desactivar Inicio Automatico con Windows - AndroProject
color 0c
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_DIR%\AndroProject_AutoProyector_A30.lnk
set VBS_STARTUP=%STARTUP_DIR%\Samsung-Watchdog.vbs

set REMOVED=0
if exist "%SHORTCUT%" (
    del "%SHORTCUT%"
    set REMOVED=1
)
if exist "%VBS_STARTUP%" (
    del "%VBS_STARTUP%"
    set REMOVED=1
)

if "%REMOVED%"=="1" (
    echo [EXITO] Se ha removido el Auto-Proyector del inicio de Windows.
) else (
    echo [INFO] No estaba configurado en el inicio de Windows.
)

pause
