@echo off
setlocal enabledelayedexpansion
echo Reiniciando conexion con el celular (ADB)...
set PATH=%PATH%;C:\msys64\mingw64\bin;C:\Users\emman\AppData\Local\Android\Sdk\platform-tools

:: Forzar reinicio de la conexion
adb kill-server >nul 2>&1
adb start-server >nul 2>&1

echo.
echo ==============================================================
echo Por favor, revisa la PANTALLA DE TU CELULAR. 
echo Si aparece un mensaje preguntando "Permitir depuracion USB", 
echo presiona ACEPTAR.
echo ==============================================================
echo.

echo Detectando dispositivos Android conectados por USB...

set PS_SCRIPT=%TEMP%\Select_ADB_Device.ps1
(
    echo $devices = @(adb devices ^| Where-Object { $_ -match "\tdevice$" } ^| ForEach-Object { ($_ -split "\t")[0] }^)
    echo if ($devices.Count -eq 0^) {
    echo     Write-Host "NO_DEVICE"
    echo } else if ($devices.Count -eq 1^) {
    echo     Write-Host "ONE:$($devices[0])"
    echo } else {
    echo     Write-Host "MULTI:$($devices.Count)"
    echo }
) > "%PS_SCRIPT%"

for /f "tokens=1,* delims=:" %%A in ('powershell -ExecutionPolicy Bypass -NoProfile -File "%PS_SCRIPT%"') do (
    set DEV_STATUS=%%A
    set SINGLE_DEV=%%B
)
del "%PS_SCRIPT%" 2>nul

if "%DEV_STATUS%"=="NO_DEVICE" (
    echo.
    echo [ADVERTENCIA] No se detecto ningun celular.
    echo Esperando a que conectes tu celular por USB...
    adb wait-for-device
    set SELECT_FLAG=-d
) else if "%DEV_STATUS%"=="MULTI" (
    echo.
    echo ==============================================================
    echo  SE DETECTARON MULTIPLES DISPOSITIVOS CONECTADOS POR USB:
    echo ==============================================================
    
    set PS_MENU=%TEMP%\Menu_ADB_Device.ps1
    (
        echo $devices = @(adb devices ^| Where-Object { $_ -match "\tdevice$" } ^| ForEach-Object { ($_ -split "\t")[0] }^)
        echo $i = 1
        echo $devMap = @{}
        echo foreach ($dev in $devices^) {
        echo     $model = (adb -s $dev shell getprop ro.product.model 2^>$null^).Trim(^)
        echo     if (-not $model^) { $model = "Desconocido" }
        echo     Write-Host " [$i] $model (Serial: $dev)"
        echo     $devMap[$i.ToString(^)] = $dev
        echo     $i++
        echo }
        echo Write-Host ""
        echo $selection = Read-Host " Selecciona el numero de celular a transmitir (1-$($devices.Count^))"
        echo if ($devMap.ContainsKey($selection^)^) {
        echo     Write-Host "SELECTED:$($devMap[$selection])"
        echo } else {
        echo     Write-Host "SELECTED:$($devices[0])"
        echo }
    ) > "%PS_MENU%"

    for /f "tokens=1,* delims=:" %%A in ('powershell -ExecutionPolicy Bypass -NoProfile -File "%PS_MENU%"') do (
        if "%%A"=="SELECTED" set CHOSEN_SERIAL=%%B
    )
    del "%PS_MENU%" 2>nul

    echo.
    echo -^> Transmitiendo dispositivo: !CHOSEN_SERIAL!
    set SELECT_FLAG=-s !CHOSEN_SERIAL!
) else (
    echo.
    echo -^> Celular detectado: %SINGLE_DEV%
    set SELECT_FLAG=-s %SINGLE_DEV%
)

:: Configurar variables de scrcpy
set SCRCPY_SERVER_PATH=AndroProject-server
set SCRCPY_ICON_PATH=AndroProject.png

:: Iniciar AndroProject con audio
echo.
echo Iniciando AndroProject...
.\AndroProject.exe %SELECT_FLAG% --video-codec=h265 -b 100M --max-fps 60

echo.
pause
