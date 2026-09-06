[CmdletBinding()]
param(
    [string]$TargetSerial = "",
    [switch]$Multi = $false
)

# ── Resolución dinámica de ADB (no hardcodeado) ─────────────────────────────
$adbCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    'C:\AndroProject\adb.exe',
    'C:\Program Files\Android\platform-tools\adb.exe'
)
$adb = $adbCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $adb) {
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    $adb = if ($cmd) { $cmd.Source } else { 'adb.exe' }
}

# ── Resolución dinámica de scrcpy/AndroProject.exe ──────────────────────────
$scrcpyCandidates = @(
    'C:\AndroProject\AndroProject.exe',
    'C:\AndroProject\scrcpy.exe'
)
$scrcpy = $scrcpyCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $scrcpy) {
    $wingetPkgs = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    $found = Get-ChildItem -Path $wingetPkgs -Filter 'scrcpy.exe' -Recurse -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $scrcpy = if ($found) { $found.FullName } else { 'scrcpy.exe' }
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

        $quotedArgs = @($scrcpyArgs | ForEach-Object {
            $arg = [string]$_
            if ($arg -match '[\s"]') {
                '"' + ($arg -replace '"', '\"') + '"'
            } else {
                $arg
            }
        })
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $scrcpy
        $psi.Arguments = ($quotedArgs -join ' ')
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $null = [System.Diagnostics.Process]::Start($psi)
        $index++
        Start-Sleep -Milliseconds 400
    }
} else {
    Write-Host "[ERROR] No se detecto ningun dispositivo Android conectado." -ForegroundColor Red
    Write-Host "Por favor conecta tu telefono por cable USB o activa la depuracion Wi-Fi." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Cerrando en 5 segundos..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
