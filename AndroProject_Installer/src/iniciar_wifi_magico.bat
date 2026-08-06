@echo off
setlocal enabledelayedexpansion
set PATH=%PATH%;C:\msys64\mingw64\bin;C:\Users\emman\AppData\Local\Android\Sdk\platform-tools

echo ===================================================================
echo     AndroProject - CONEXION WI-FI MAGICA AUTOMATICA
echo ===================================================================
echo.
echo IMPORTANTE: Conecta el celular por cable USB ahora mismo.
echo Si aparece un mensaje en la pantalla de tu celular, presiona ACEPTAR.
echo.

:: Desconectar IPs viejas que pueden causar conflicto de "multiples dispositivos"
adb disconnect >nul 2>&1

echo Detectando dispositivo USB...

set PS_SCRIPT=%TEMP%\Select_Wifi_Device.ps1
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
    echo Esperando a que conectes el cable y autorices...
    adb wait-for-device
    set CHOSEN_SERIAL=
    set ADB_DEV_FLAG=-d
) else if "%DEV_STATUS%"=="MULTI" (
    echo.
    echo ==============================================================
    echo  SE DETECTARON MULTIPLES DISPOSITIVOS CONECTADOS POR USB:
    echo ==============================================================
    
    set PS_MENU=%TEMP%\Menu_Wifi_Device.ps1
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
        echo $selection = Read-Host " Selecciona el celular para activar Wi-Fi (1-$($devices.Count^))"
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

    set ADB_DEV_FLAG=-s !CHOSEN_SERIAL!
) else (
    set CHOSEN_SERIAL=%SINGLE_DEV%
    set ADB_DEV_FLAG=-s %SINGLE_DEV%
)

echo.
echo ¡Celular detectado! Buscando tu IP automaticamente...
set CELULAR_IP=
for /f "tokens=9" %%a in ('adb %ADB_DEV_FLAG% shell ip route ^| findstr wlan0') do set CELULAR_IP=%%a

if "!CELULAR_IP!"=="" (
    for /f "tokens=9" %%a in ('adb %ADB_DEV_FLAG% shell ip route ^| findstr src') do set CELULAR_IP=%%a
)

if "!CELULAR_IP!"=="" (
    echo [ERROR] No se pudo obtener la IP del celular. Asegurate de estar conectado a Wi-Fi.
    pause
    exit /b 1
)

echo.
echo -^> ¡Encontre tu IP!: !CELULAR_IP!
echo.
echo Cambiando tu celular a modo Wi-Fi...
adb %ADB_DEV_FLAG% tcpip 5555

timeout /t 3 >nul

echo.
echo Conectando la PC a !CELULAR_IP! por Wi-Fi...
adb connect !CELULAR_IP!:5555

echo.
echo ===================================================================
echo  ¡LISTO! YA PUEDES DESCONECTAR EL CABLE USB DE TU CELULAR AHORA MISMO.
echo ===================================================================
echo.
echo Iniciando AndroProject...
set SCRCPY_SERVER_PATH=AndroProject-server
set SCRCPY_ICON_PATH=AndroProject.png
.\AndroProject.exe -e --video-codec=h265 -b 25M --max-fps 60 --video-buffer=150 --audio-buffer=150

pause
