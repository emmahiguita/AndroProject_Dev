@echo off
title Configurar Inicio Automatico con Windows - AndroProject
color 0a
echo ===============================================================================
echo   ACTIVAR AUTO-PROYECCION INALAMBRICA AL INICIAR WINDOWS
echo ===============================================================================
echo.
echo Este instalador agregara el Auto-Proyector a tu inicio de Windows.
echo Cada vez que enciendas la PC y tu Samsung A30 este conectado al Wi-Fi,
echo se proyectara automaticamente en tu pantalla sin tocar ningun cable.
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_SCRIPT=%TEMP%\CrearAccesoDirecto.vbs

(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo sLinkFile = "%STARTUP_DIR%\AndroProject_AutoProyector_A30.lnk"
    echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
    echo oLink.TargetPath = "powershell.exe"
    echo oLink.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File ""%~dp0samsung-watchdog.ps1"""
    echo oLink.WorkingDirectory = "%~dp0"
    echo oLink.Description = "Auto Proyector Inalambrico Samsung A30"
    echo oLink.Save
) > "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%" 2>nul

echo [EXITO] Auto-Proyector configurado en el inicio de Windows.
echo.
echo Ahora se ejecutara silenciosamente en segundo plano cada vez que inicie Windows.
echo.
pause
