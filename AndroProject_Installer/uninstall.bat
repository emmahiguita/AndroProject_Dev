@echo off
title Desinstalador de ANDRO-IOS
echo.
echo  Cerrando procesos de ANDRO-IOS y ADB...
taskkill /F /IM ANDRO-IOS.exe >nul 2>&1
taskkill /F /IM AndroProject_Desktop.exe >nul 2>&1
taskkill /F /IM adb.exe >nul 2>&1
echo  Eliminando acceso directo del Escritorio...
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); Remove-Item \"$d\ANDRO-IOS.lnk\" -Force -ErrorAction SilentlyContinue"
echo  Eliminando carpeta de instalacion C:\AndroProject...
if exist "C:\AndroProject" rmdir /S /Q "C:\AndroProject"
echo.
echo  ANDRO-IOS desinstalado correctamente.
pause
