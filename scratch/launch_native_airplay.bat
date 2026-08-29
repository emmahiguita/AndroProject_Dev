@echo off
title AndroProject - Receptor AirPlay Nativo iOS
cd /d "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev\androproject-gui\bin\airplay"

set PATH=%CD%;%CD%\lib;%PATH%
set GST_PLUGIN_PATH=%CD%\lib\gstreamer-1.0

echo ==========================================================
echo  INICIANDO RECEPTOR AIRPLAY NATIVO DIRECT3D 11
echo ==========================================================
echo Conecte su iPhone desde Centro de Control -^> Duplicar Pantalla -^> AndroProject [PC]
echo.

start "" "uxplay-windows.exe" -n "AndroProject [PC]" -nh -vs d3d11videosink -as wasapisink -fps 60
