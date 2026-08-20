# Samsung A30s (SM-A307G) - Watchdog de estabilidad v3
# Fortalecido:
#  - Health-check ACTIVO (adb shell echo con timeout) en vez de solo listar devices
#  - Failover dual-path: preferencia WiFi (mDNS), respaldo USB automatico
#  - Cambia scrcpy de transporte si el activo se cae (kill + relanzar al sano)
#  - Auto-reparacion del servidor adb (kill-server/start-server si se cuelga)
#  - Backoff: tras fallos consecutivos espera mas (10s -> 15s -> 30s -> 60s)
#  - Log rotativo (rota a .1.log al superar 1MB)
# Uso: powershell -ExecutionPolicy Bypass -File samsung-watchdog.ps1

param(
    [string]$AdbPath     = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    [string]$ScrcpyPath  = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe",
    [string]$PhoneSerial = "R58N21SVSPE",
    [string]$FallbackIp  = "192.168.0.2:5555",
    [int]$BaseIntervalSec = 10,
    [int]$MaxLogBytes = 1048576
)

$LogDir    = "C:\AndroProject\temp"
$LogFile   = Join-Path $LogDir "samsung-watchdog.log"
$StateFile = Join-Path $LogDir "samsung-device-ip.txt"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log([string]$Msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    # Rotacion de log
    if ((Get-Item $LogFile).Length -gt $MaxLogBytes) {
        Move-Item -Path $LogFile -Destination "$LogFile.1.log" -Force -ErrorAction SilentlyContinue
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    }
}

# Ejecuta adb con timeout duro. Devuelve (exitCode, stdout).
function Invoke-AdbTimeout([string]$Arguments, [int]$timeoutSec = 8) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $AdbPath
    $psi.Arguments = $Arguments
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        # Lectura asincrona: evita deadlock con salidas grandes (>4KB pipe buffer)
        $outTask = $p.StandardOutput.ReadToEndAsync()
        $errTask = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit($timeoutSec * 1000)) {
            $p.Kill()
            $p.WaitForExit()
            return @(-1, "")
        }
        return @($p.ExitCode, ($outTask.Result + $errTask.Result))
    } catch {
        return @(-2, $_.Exception.Message)
    }
}

# Health-check activo: el dispositivo responde a un comando real?
function Test-Health([string]$Target, [int]$timeoutSec = 6) {
    if (-not $Target) { return $false }
    $r = Invoke-AdbTimeout "-s $Target shell echo ok" $timeoutSec
    return ($r[0] -eq 0 -and ("$($r[1])" -match "ok"))
}

# Descubre ip:puerto via mDNS. "" si no hay.
function Find-PhoneIp {
    $r = Invoke-AdbTimeout "mdns services" 6
    if ($r[0] -ne 0) { return "" }
    foreach ($line in ("$($r[1])" -split "`r?`n")) {
        if ($line -match "adb-$PhoneSerial.*\t([0-9.]+:[0-9]+)") { return $Matches[1] }
    }
    return ""
}

# Telefono presente por USB?
function Test-UsbSerial {
    $r = Invoke-AdbTimeout "devices" 6
    return ("$($r[1])" -match [regex]::Escape($PhoneSerial) -and "$($r[1])" -match "device")
}

# Target actual de scrcpy segun su linea de comandos (para saber cuando migrarlo)
function Get-ScrcpyTarget {
    $p = Get-CimInstance Win32_Process -Filter "Name='scrcpy.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p -and $p.CommandLine -match "-s\s+([0-9.]+:[0-9]+|R[0-9A-Z]+)") { return $Matches[1] }
    return ""
}

function Start-Scrcpy([string]$Target) {
    Start-Process -FilePath $ScrcpyPath -ArgumentList "-s",$Target,"--stay-awake","--no-audio","--max-size","1080" -WindowStyle Hidden
}

# Hardening idempotente del dispositivo
function Apply-DeviceHardening([string]$Target) {
    Invoke-AdbTimeout "-s $Target shell settings put global adb_wifi_enabled 1" 6 | Out-Null
    Invoke-AdbTimeout "-s $Target shell settings put global wifi_sleep_policy 2" 6 | Out-Null
    Invoke-AdbTimeout "-s $Target shell settings put system screen_off_timeout 2147483647" 6 | Out-Null
    Invoke-AdbTimeout "-s $Target shell settings put global stay_on_while_plugged_in 7" 6 | Out-Null
}

Write-Log "=== Watchdog Samsung A30s v3 iniciado (serial: $PhoneSerial) ==="

$restarts = 0
$consecutiveFailures = 0
$currentActive = ""
$wifiOkStreak = 0
$lastSwitchTime = Get-Date

while ($true) {
    try {
        # 1. Descubrir targets disponibles
        $wifiIp = Find-PhoneIp
        $usbOnline = Test-UsbSerial
        if (-not $wifiIp) { $wifiIp = $FallbackIp }

        # 2. Health-check activo de cada transporte
        $wifiOk  = Test-Health $wifiIp
        $usbOk   = if ($usbOnline) { Test-Health $PhoneSerial } else { $false }

        # Streak: WiFi sano N ciclos consecutivos (histéresis anti-flap)
        if ($wifiOk) { $wifiOkStreak++ } else { $wifiOkStreak = 0 }

        # 3. Seleccionar target activo con histéresis
        #    - Si ya estamos en WiFi y cae: migrar a USB al instante
        #    - Si estamos en USB y WiFi mejora: migrar solo tras 2 ciclos sanos y 30s desde ultimo cambio
        $active = ""
        if ($wifiOk -and ($currentActive -eq $wifiIp -or $wifiOkStreak -ge 2)) {
            $active = $wifiIp
        }
        elseif ($usbOk) {
            $active = $PhoneSerial
        }

        if ($active) {
            $consecutiveFailures = 0
            Set-Content -Path $StateFile -Value $active -Encoding ASCII

            # 4. Migrar scrcpy si el transporte activo cambio (con intervalo minimo anti-thrash)
            $canSwitch = ((Get-Date) - $lastSwitchTime).TotalSeconds -ge 30
            if ($active -ne $currentActive) {
                if (-not $canSwitch) {
                    Write-Log "Cambio a $active diferido (intervalo minimo 30s)"
                    $active = $currentActive
                }
                else {
                    $lastSwitchTime = Get-Date
                    Write-Log "Transporte activo cambio ($currentActive -> $active). Migrando scrcpy..."
                    Stop-Process -Name scrcpy -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 2
                }
            }
            $currentActive = $active

            # 5. Mantener WiFi caliente en background (si activo=USB y WiFi caido)
            if ($active -eq $PhoneSerial -and -not $wifiOk) {
                $null = Invoke-AdbTimeout "connect $wifiIp" 6
                Start-Sleep -Seconds 2
                $wifiOk = Test-Health $wifiIp
                if ($wifiOk) { $wifiOkStreak = 1; Write-Log "WiFi restaurado en background: $wifiIp" }
            }

            # 6. Relanzar scrcpy si falta
            $scrcpyTarget = Get-ScrcpyTarget
            if (-not $scrcpyTarget) {
                $restarts++
                Write-Log "Relanzando scrcpy hacia $active (restart #$restarts)..."
                Start-Scrcpy $active
                Start-Sleep -Seconds 5
                if (Get-Process scrcpy -ErrorAction SilentlyContinue) { Write-Log "scrcpy activo en $active" }
            }

            # 6. Re-aplicar hardening (idempotente, cubre reinicios del telefono)
            Apply-DeviceHardening $active | Out-Null
        }
        else {
            # 7. Nada sano: intentar reparacion
            $consecutiveFailures++
            if ($wifiIp -and -not $wifiOk) {
                Write-Log "WiFi caido ($wifiIp). Intentando connect..."
                $null = Invoke-AdbTimeout "connect $wifiIp" 6
            }
            if ($usbOnline -and -not $usbOk -and $consecutiveFailures % 3 -eq 0) {
                Write-Log "USB caido (serial $PhoneSerial). Rehabilitando TCP..."
                $null = Invoke-AdbTimeout "-s $PhoneSerial tcpip 5555" 6
            }
            if ($consecutiveFailures -ge 4 -and $consecutiveFailures % 6 -eq 0) {
                Write-Log "Servidor adb posiblemente colgado. Reiniciando servidor adb..."
                $null = Invoke-AdbTimeout "kill-server" 5
                $null = Invoke-AdbTimeout "start-server" 10
                Start-Sleep -Seconds 4
            }
            Write-Log "Sin transporte sano (fallo #$consecutiveFailures). Esperando..."
        }
    }
    catch {
        Write-Log "ERROR: $($_.Exception.Message)"
    }

    # Backoff: 10s -> 15s -> 30s -> 60s (techo)
    $wait = [Math]::Min($BaseIntervalSec * [Math]::Pow(2, [Math]::Min($consecutiveFailures, 3)), 60)
    if ($wait -lt 10) { $wait = 10 }
    Start-Sleep -Seconds ([int]$wait)
}
