@echo off
set PATH=%PATH%;C:\msys64\mingw64\bin;C:\Users\emman\AppData\Local\Android\Sdk\platform-tools

echo ===================================================================
echo             AndroProject - INICIO 100%% INALAMBRICO (SIN CABLE)
echo.
echo ===================================================================
echo [RADAR] Buscando tu celular automaticamente en tu red Wi-Fi...
echo ===================================================================

set PS_SCRIPT=%TEMP%\Escaner_Android.ps1
(
    echo $localIp = (Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notlike "169.254*" } ^| Select-Object -First 1^).IPAddress
    echo if (-not $localIp^) { exit }
    echo $base = $localIp.Substring(0, $localIp.LastIndexOf('.'^)^)
    echo $ips = 1..254 ^| ForEach-Object { "$base.$_" }
    echo $results = @(^)
    echo foreach ($ip in $ips^) {
    echo     $tcp = New-Object System.Net.Sockets.TcpClient
    echo     $result = $tcp.BeginConnect($ip, 5555, $null, $null^)
    echo     $results += [PSCustomObject]@{ IP = $ip; AsyncResult = $result; Tcp = $tcp }
    echo }
    echo Start-Sleep -Milliseconds 600
    echo foreach ($r in $results^) {
    echo     if ($r.AsyncResult.IsCompleted -and $r.Tcp.Connected^) {
    echo         Write-Host $r.IP
    echo         $r.Tcp.Close(^)
    echo         exit
    echo     }
    echo     $r.Tcp.Close(^)
    echo }
) > "%PS_SCRIPT%"

for /f "delims=" %%I in ('powershell -ExecutionPolicy Bypass -NoProfile -File "%PS_SCRIPT%"') do set IP_CELULAR=%%I
del "%PS_SCRIPT%"

if "%IP_CELULAR%"=="" (
    echo.
    echo [ERROR] No se pudo encontrar ningun celular en la red Wi-Fi.
    echo Asegurate de que tu celular no se haya reiniciado y este conectado al mismo Wi-Fi.
    echo O usa el acceso directo "AndroProject Iniciar Wi-Fi (Cable)" UNA VEZ para reactivarlo.
) else (
    echo [EXITO] Celular encontrado en la IP: %IP_CELULAR%
    echo Conectando...
    adb connect %IP_CELULAR%:5555
    echo.
    echo Iniciando AndroProject con la configuracion de cero lag...
    set SCRCPY_SERVER_PATH=AndroProject-server
    set SCRCPY_ICON_PATH=AndroProject.png
    .\AndroProject.exe -e --video-codec=h265 -b 25M --max-fps 60 --video-buffer=150 --audio-buffer=150
)

echo.
echo ===================================================================
echo SI FALLO Y SE CERRO, SIGNIFICA QUE:
echo 1. Tu router le cambio la IP al celular.
echo 2. O reiniciaste el celular (lo que cierra el puerto de Wi-Fi).
echo Si es asi, usa el "AndroProject Iniciar Wi-Fi (Cable)" con cable UNA VEZ.
echo ===================================================================
pause
