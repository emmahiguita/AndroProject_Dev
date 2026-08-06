@echo off
REM ============================================
REM  AndroProject - Quick Launch Scripts
REM  Doble click para ejecutar
REM ============================================

set SCRIPT_DIR=%~dp0
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set PHONE=192.168.0.13

REM Verificar si se paso un argumento
if "%1"=="" goto menu

REM Ejecutar accion directa
if "%1"=="vnc" goto vnc
if "%1"=="shell" goto shell
if "%1"=="msf" goto msf
if "%1"=="scan" goto scan
if "%1"=="status" goto status
if "%1"=="server" goto server
if "%1"=="connect" goto connect
if "%1"=="optimize" goto optimize

REM Si no es un comando, es una herramienta
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" tool %*
goto end

:menu
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1"
goto end

:vnc
start http://localhost:6080/vnc.html
echo Escritorio Linux abierto en navegador.
goto end

:shell
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" shell
goto end

:msf
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" tool msf
goto end

:scan
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" scan
goto end

:status
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" status
goto end

:server
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" server
goto end

:connect
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" connect
goto end

:optimize
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%andro.ps1" optimize
goto end

:end
