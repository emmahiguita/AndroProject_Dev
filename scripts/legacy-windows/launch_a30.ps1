[CmdletBinding()]
param(
    [string]$TargetSerial = "",
    [switch]$Multi = $false
)

# ── 1. Resolucion dinamica ultra-rapida de ADB ───────────────────────────────
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
$env:ADB = $adb
$env:ADB_MDNS_AUTO_CONNECT = "0"

# ── 2. Resolucion dinamica ultra-rapida de scrcpy ─────────────────────────────
$scrcpyKnownPaths = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe'),
    'C:\AndroProject\AndroProject.exe',
    'C:\AndroProject\scrcpy.exe'
)
$scrcpy = $scrcpyKnownPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $scrcpy) {
    $wingetPkgs = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetPkgs) {
        $found = Get-ChildItem -Path $wingetPkgs -Filter 'scrcpy.exe' -Recurse -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($found) { $scrcpy = $found.FullName }
    }
}
if (-not $scrcpy) {
    $cmd = Get-Command scrcpy.exe -ErrorAction SilentlyContinue
    $scrcpy = if ($cmd) { $cmd.Source } else { 'scrcpy.exe' }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AndroProject - Proyector de Pantalla de Alta Calidad      " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Verificando servidor ADB..." -ForegroundColor DarkGray
& $adb start-server | Out-Null

# ── 3. Detectar dispositivos activos ──────────────────────────────────────────
$rawDevs = & $adb devices -l
$devLines = $rawDevs | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch 'List of devices' }
$devs = @($devLines | ForEach-Object { ($_ -split '\s+')[0] })

if ($devs.Count -eq 0) {
    Write-Host "[2/3] Buscando dispositivo en la red Wi-Fi (192.168.0.11)..." -ForegroundColor Yellow
    & $adb connect 192.168.0.11:5555 | Out-Null
    Start-Sleep -Milliseconds 800
    $rawDevs = & $adb devices -l
    $devLines = $rawDevs | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch 'List of devices' }
    $devs = @($devLines | ForEach-Object { ($_ -split '\s+')[0] })
}

if ($devs.Count -gt 0) {
    $selectedDevs = @()
    if ($TargetSerial) {
        $selectedDevs = @($devs | Where-Object { $_ -eq $TargetSerial })
    } elseif ($Multi) {
        # En modo Multi: proyectar todos los teléfonos físicos distintos conectados
        $usbSerials = @($devs | Where-Object { $_ -notmatch ':' })
        $wifiSerials = @($devs | Where-Object { $_ -match ':' })
        
        $selectedDevs = [System.Collections.Generic.List[string]]::new()
        foreach ($u in $usbSerials) { $selectedDevs.Add($u) }

        # Desduplicar si el mismo teléfono está por USB y Wi-Fi a la vez
        foreach ($w in $wifiSerials) {
            $wModel = & $adb -s $w shell getprop ro.product.model 2>$null
            $duplicate = $false
            foreach ($u in $usbSerials) {
                $uModel = & $adb -s $u shell getprop ro.product.model 2>$null
                if ($uModel -and $wModel -and ($uModel.Trim() -eq $wModel.Trim())) {
                    $duplicate = $true
                    break
                }
            }
            if (-not $duplicate) {
                $selectedDevs.Add($w)
            }
        }
        if ($selectedDevs.Count -eq 0) { $selectedDevs = @($devs) }
    } else {
        # Modo individual (por defecto): Priorizar Samsung Galaxy A30/A30s USB
        $samsungUsb = $devLines | Where-Object { ($_ -match 'R58N21SVSPE' -or $_ -match 'a30' -or $_ -match 'SM_A307G') -and $_ -notmatch ':' } | Select-Object -First 1
        if ($samsungUsb) {
            $selectedDevs = @(($samsungUsb -split '\s+')[0])
        } else {
            # Prioridad 2: Cualquier dispositivo USB conectado
            $anyUsb = $devs | Where-Object { $_ -notmatch ':' } | Select-Object -First 1
            if ($anyUsb) {
                $selectedDevs = @($anyUsb)
            } else {
                # Prioridad 3: Samsung Wi-Fi
                $samsungWifi = $devLines | Where-Object { ($_ -match '192.168.0.11' -or $_ -match 'SM_A307G' -or $_ -match 'a30') } | Select-Object -First 1
                if ($samsungWifi) {
                    $selectedDevs = @(($samsungWifi -split '\s+')[0])
                } else {
                    # Prioridad 4: Primer dispositivo disponible
                    $selectedDevs = @($devs[0])
                }
            }
        }
    }

    Write-Host "[2/3] Dispositivo(s) seleccionado(s) ($($selectedDevs.Count)): $($selectedDevs -join ', ')" -ForegroundColor Green

    $index = 0
    foreach ($target in $selectedDevs) {
        $isWifi = $target -match ':'
        $connType = if ($isWifi) { "Wi-Fi" } else { "USB" }
        $devModel = & $adb -s $target shell getprop ro.product.model 2>$null
        if (-not $devModel) {
            $devModel = if ($target -match 'R58N21SVSPE|192.168.0.11') { "Samsung Galaxy A30s" } else { "Dispositivo Movil" }
        } else {
            $devModel = $devModel.Trim()
        }

        # Parametros optimizados para maxima estabilidad y fluidez (GPU Direct3D11, H.264 hardware)
        $bitrate     = if ($isWifi) { "8M" } else { "16M" }
        $maxFps      = if ($isWifi) { "30" } else { "60" }
        $maxSize     = "1080"
        $videoBuffer = if ($isWifi) { "40" } else { "0" }

        $xPos = 100 + ($index * 400)
        $portStart = 27180 + ($index * 20)
        $portRange = "$portStart`:$($portStart + 15)"
        $title = "AndroProject - $devModel ($connType)"

        Write-Host "[3/3] Iniciando proyeccion en vivo para $devModel [$connType]..." -ForegroundColor Cyan

        $scrcpyArgs = @(
            "-s", $target,
            "--display-id=0",
            "--video-codec=h264",
            "-b", $bitrate,
            "--max-size", $maxSize,
            "--max-fps=$maxFps",
            "--video-buffer=$videoBuffer",
            "--render-driver=direct3d11",
            "--window-width=380",
            "--window-height=820",
            "--window-x=$xPos",
            "--window-y=80",
            "--no-audio",
            "--stay-awake",
            "--port=$portRange",
            "--window-title=$title"
        )

        # Quoting seguro para que ningun argumento con espacios o caracteres especiales rompa scrcpy
        $quotedArgs = @($scrcpyArgs | ForEach-Object {
            $arg = [string]$_
            if ($arg -match '[\s"]') {
                '"' + ($arg -replace '"', '\"') + '"'
            } else {
                $arg
            }
        })

        if ($selectedDevs.Count -eq 1) {
            Write-Host "[3/3] Iniciando proyeccion scrcpy Direct3D11..." -ForegroundColor Green
            & $scrcpy $scrcpyArgs
        } else {
            try {
                $proc = Start-Process -FilePath $scrcpy -ArgumentList $scrcpyArgs -PassThru
                Write-Host "[OK] Proyeccion iniciada para $devModel (PID: $($proc.Id))" -ForegroundColor Green
            } catch {
                Write-Host "[ERROR] Error al iniciar proyeccion para $devModel : $_" -ForegroundColor Red
            }
        }
        $index++
    }
} else {
    Write-Host "[ERROR] No se detecto ningun dispositivo Android conectado." -ForegroundColor Red
    Write-Host "Verifica que el telefono este en la misma red Wi-Fi o conectado por USB con Depuracion USB activada." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Cerrando en 5 segundos..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}

