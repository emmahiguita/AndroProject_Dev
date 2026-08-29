@echo off
setlocal enabledelayedexpansion
set PATH=%PATH%;C:\msys64\mingw64\bin;C:\Users\emman\AppData\Local\Android\Sdk\platform-tools;C:\AndroProject

echo ===================================================================
echo             AndroProject - INICIO 100%% INALAMBRICO (SIN CABLE)
echo ===================================================================
echo [RADAR] Buscando tu celular automaticamente en tu red Wi-Fi...
echo ===================================================================

set PS_SCRIPT=%TEMP%\Escaner_Android_Rapido.ps1
(
    echo $localIp = (Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notlike "169.254*" } ^| Select-Object -First 1^).IPAddress
    echo if (-not $localIp^) { exit }
    echo $base = $localIp.Substring(0, $localIp.LastIndexOf('.'^)^)
    echo $openIps = [System.Collections.Concurrent.ConcurrentBag[string]]::new(^)
    echo $threads = @(^)
    echo 1..254 ^| ForEach-Object {
    echo     $ip = "$base.$_"
    echo     $t = [System.Threading.Thread]::new([System.Threading.ThreadStart]{
    echo         param($targetIp, $bag^)
    echo         $sock = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork, [System.Net.Sockets.SocketType]::Stream, [System.Net.Sockets.ProtocolType]::Tcp^)
    echo         $sock.Blocking = $false
    echo         try { $sock.Connect($targetIp, 5555^) } catch {}
    echo         $writeList = [System.Collections.ArrayList]@($sock^)
    echo         [System.Net.Sockets.Socket]::Select($null, $writeList, $null, 150000^)
    echo         if ($writeList.Count -gt 0^) { $bag.Add($targetIp^) }
    echo         $sock.Close(^)
    echo     }.GetNewClosure(^)^)
    echo     $t.Start($ip, $openIps^)
    echo     $threads += $t
    echo }
    echo foreach ($t in $threads^) { $t.Join(250^) ^| Out-Null }
    echo foreach ($found in $openIps^) { Write-Host $found; exit }
) > "%PS_SCRIPT%"

for /f "delims=" %%I in ('powershell -ExecutionPolicy Bypass -NoProfile -File "%PS_SCRIPT%"') do set IP_CELULAR=%%I
del "%PS_SCRIPT%" 2>nul

if "%IP_CELULAR%"=="" (
    echo.
    echo [ERROR] No se pudo encontrar ningun celular con puerto 5555 abierto en la red Wi-Fi.
    echo Asegurate de que tu celular este conectado al mismo Wi-Fi.
    echo Si se reinicio el celular, conectalo por cable USB una vez con "iniciar_wifi_magico.bat".
) else (
    echo [EXITO] Celular encontrado en la IP: %IP_CELULAR%
    echo Conectando...
    adb connect %IP_CELULAR%:5555
    echo.
    echo Iniciando AndroProject con configuracion ultra fluida y cero lag...
    set SCRCPY_SERVER_PATH=AndroProject-server
    set SCRCPY_ICON_PATH=AndroProject.png
    
    if exist ".\AndroProject.exe" (
        .\AndroProject.exe -s %IP_CELULAR%:5555 --video-codec=h264 -b 10M --max-fps 60 --video-buffer=50 --audio-buffer=50 --stay-awake --always-on-top
    ) else (
        scrcpy -s %IP_CELULAR%:5555 --video-codec=h264 -b 10M --max-fps 60 --video-buffer=50 --audio-buffer=50 --stay-awake --always-on-top
    )
)

echo.
pause
