$adb = "C:\Users\emman\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$scrcpy = "C:\Users\emman\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe"

if (-not (Test-Path $adb)) { $adb = "adb.exe" }
if (-not (Test-Path $scrcpy)) {
    $found = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter 'scrcpy.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $scrcpy = $found.FullName } else { $scrcpy = 'scrcpy.exe' }
}

# 1. Limpiar procesos scrcpy anteriores si existen
Stop-Process -Name scrcpy -Force -ErrorAction SilentlyContinue

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Dexterand - Lanzador Ultra HD de Proyeccion 60 FPS        " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Verificando servidor ADB..." -ForegroundColor DarkGray
& $adb start-server | Out-Null

# 2. Detectar dispositivos activos
$rawDevs = & $adb devices -l
$devLines = $rawDevs | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch 'List of devices' }
$devs = @($devLines | ForEach-Object { ($_ -split '\s+')[0] })

if ($devs.Count -eq 0) {
    Write-Host "[2/3] Buscando dispositivo en red Wi-Fi..." -ForegroundColor Yellow
    & $adb connect 192.168.0.10:38693 | Out-Null
    & $adb connect 192.168.0.3:43033 | Out-Null
    & $adb connect 192.168.0.3:5555 | Out-Null
    Start-Sleep -Milliseconds 800
    $rawDevs = & $adb devices -l
    $devLines = $rawDevs | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch 'List of devices' }
    $devs = @($devLines | ForEach-Object { ($_ -split '\s+')[0] })
}

# 3. Lanzar proyeccion real optimizada
if ($devs.Count -gt 0) {
    $target = $devs[0]
    $isWifi = $target -match ':'
    $connType = if ($isWifi) { 'Wi-Fi' } else { 'USB' }
    $devModel = & $adb -s $target shell getprop ro.product.model 2>$null
    if (-not $devModel) { $devModel = "Dispositivo Android" } else { $devModel = $devModel.Trim() }

    Write-Host "[3/3] Dispositivo conectado: $devModel ($target) [$connType]" -ForegroundColor Green
    Write-Host "Iniciando proyeccion H.264 Direct3D11 a 60 FPS (Latencia Cero)..." -ForegroundColor Cyan
    Write-Host ""

    $title = "AndroProject 60 FPS - $devModel ($target)"
    
    # Parametros adaptativos para evitar bufferbloat y desconexiones en Wi-Fi
    $bitrate = if ($isWifi) { '8M' } else { '16M' }
    $videoBuffer = if ($isWifi) { '10' } else { '0' }

    # 1. Eliminar duplicados para evitar instancias dobles en ejecución
    Get-Process -Name scrcpy -ErrorAction SilentlyContinue | Stop-Process -Force

    $scrcpyArgs = @(
        '-s', $target,
        '--display-id=0',
        '--video-codec=h264',
        '-b', $bitrate,
        '--max-size', '960',
        '--max-fps', '60',
        '--video-buffer=0',
        '--render-driver=direct3d11',
        '--window-width=320',
        '--window-height=700',
        '--no-audio',
        '--stay-awake',
        "--window-title=$title"
    )

    # Ejecutar proyección en 1 sola ventana limpia
    & $scrcpy @scrcpyArgs
} else {
    Write-Host "[ERROR] No se detecto ningun dispositivo Android conectado." -ForegroundColor Red
    Write-Host "Por favor conecta tu telefono por cable USB o activa la depuracion Wi-Fi." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Presiona cualquier tecla para cerrar..."
    [Console]::ReadKey($true) | Out-Null
}
