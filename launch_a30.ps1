[CmdletBinding()]
param(
    [string]$TargetSerial = "",
    [switch]$Multi = $false
)

$adb = "C:\Users\emman\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$scrcpy = "C:\Users\emman\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe"

if (-not (Test-Path $adb)) { $adb = "adb.exe" }
if (-not (Test-Path $scrcpy)) {
    $found = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter 'scrcpy.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $scrcpy = $found.FullName } else { $scrcpy = 'scrcpy.exe' }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Dexterand - Multi-Device Launcher Ultra HD 60 FPS         " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Verificando servidor ADB..." -ForegroundColor DarkGray
& $adb start-server | Out-Null

# 2. Detectar dispositivos activos
$rawDevs = & $adb devices -l
$devLines = $rawDevs | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch 'List of devices' }
$devs = @($devLines | ForEach-Object { ($_ -split '\s+')[0] })

if ($devs.Count -eq 0) {
    Write-Host "[2/3] Buscando dispositivos en red Wi-Fi..." -ForegroundColor Yellow
    & $adb connect 192.168.0.11:5555 | Out-Null
    & $adb connect 192.168.0.10:34159 | Out-Null
    & $adb connect 192.168.0.10:38693 | Out-Null
    Start-Sleep -Milliseconds 800
    $rawDevs = & $adb devices -l
    $devLines = $rawDevs | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch 'List of devices' }
    $devs = @($devLines | ForEach-Object { ($_ -split '\s+')[0] })
}

if ($devs.Count -gt 0) {
    # Filtrar por target si se especifico
    $selectedDevs = if ($TargetSerial) {
        @($devs | Where-Object { $_ -eq $TargetSerial })
    } elseif ($Multi) {
        $devs
    } else {
        # Si no se pidio multi ni target especifico, proyectar todos si hay mas de 1
        $devs
    }

    Write-Host "[3/3] Dispositivos detectados ($($selectedDevs.Count)): $($selectedDevs -join ', ')" -ForegroundColor Green

    $index = 0
    foreach ($target in $selectedDevs) {
        $isWifi = $target -match ':'
        $connType = if ($isWifi) { 'Wi-Fi' } else { 'USB' }
        $devModel = & $adb -s $target shell getprop ro.product.model 2>$null
        if (-not $devModel) { $devModel = "Android" } else { $devModel = $devModel.Trim() }

        # Parametros adaptativos por dispositivo
        $bitrate = if ($isWifi) { '8M' } else { '16M' }
        $videoBuffer = if ($isWifi) { '10' } else { '0' }
        $xPos = 60 + ($index * 380)
        $portStart = 27180 + ($index * 20)
        $portRange = "$portStart`:$($portStart + 15)"

        $title = "Dexterand - $devModel ($target)"

        Write-Host "Iniciando proyeccion para $devModel ($target) en puerto $portRange [X=$xPos]..." -ForegroundColor Cyan

        $scrcpyArgs = @(
            '-s', $target,
            '--display-id=0',
            '--video-codec=h264',
            '-b', $bitrate,
            '--max-size', '1080',
            '--max-fps', '60',
            "--video-buffer=$videoBuffer",
            '--render-driver=direct3d11',
            '--window-width=350',
            '--window-height=740',
            "--window-x=$xPos",
            '--window-y=60',
            '--no-audio',
            '--stay-awake',
            "--port=$portRange",
            "--window-title=$title"
        )

        Start-Process -FilePath $scrcpy -ArgumentList $scrcpyArgs
        $index++
        Start-Sleep -Milliseconds 400
    }
} else {
    Write-Host "[ERROR] No se detecto ningun dispositivo Android conectado." -ForegroundColor Red
    Write-Host "Por favor conecta tu telefono por cable USB o activa la depuracion Wi-Fi." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..."
    [Console]::ReadKey($true) | Out-Null
}
