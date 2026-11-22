#Requires -Version 5.1
<#
.SYNOPSIS
  Samsung Galaxy A30 / A30s — Auto-Proyeccion Wi-Fi sin Cable v5 (Clean Architecture)
.DESCRIPTION
  Motor de vigilancia y proyeccion continua. Detecta el dispositivo via
  mDNS (Android 11 Wireless Debugging) y via escaneo de red paralelo con
  pool de RunSpaces (sin fugas de threads). Aplica hardening solo cuando
  cambia el target. Usa Get-Process en vez de WMI para verificar scrcpy.
  
  BUGS CORREGIDOS vs v4:
  - BUG#1  CRITICO: 254 System.Thread nuevos cada 3s → fuga de RAM/threads.
           FIX: RunspacePool de 32 workers, reutilizado entre ciclos.
  - BUG#2  CRITICO: $threads += $t → copia O(n²). FIX: List[T] predefinida.
  - BUG#3  CRITICO: Socket no descartado en excepcion. FIX: try/finally.
  - BUG#4  CRITICO: WMI Get-CimInstance cada 3s → COM leak.
           FIX: Get-Process directo (100x mas liviano).
  - BUG#5  IMPORTANTE: Apply-Hardening cada ciclo. FIX: cada 5 minutos.
  - BUG#6  IMPORTANTE: Is-ScrcpyRunningFor → verbo no aprobado. FIX: Test-.
  - BUG#7  IMPORTANTE: threads array con +=. FIX: List[Thread].
  SOLID aplicado: SRP por funcion, OCP para agregar nuevas estrategias de
  descubrimiento sin modificar el bucle principal.
#>

[CmdletBinding()]
param(
    [string]$PhoneSerial      = "R58N21SVSPE",
    [string]$PhoneModel       = "SM-A307G",
    [int]$CheckIntervalSec    = 4,
    [int]$SubnetScanWorkers   = 32,
    [int]$MaxLogBytes         = 1048576,
    [int]$HardeningMinutes    = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

$createdNew = $false
$script:WatchdogMutex = [System.Threading.Mutex]::new($true, 'Global\AndroProject_SamsungA30_Watchdog', [ref]$createdNew)
if (-not $createdNew) { exit 0 }

# ── Rutas de estado ──────────────────────────────────────────────────
$LogDir    = "C:\AndroProject\temp"
$LogFile   = Join-Path $LogDir "samsung-watchdog.log"
$StateFile = Join-Path $LogDir "samsung-device-ip.txt"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# ── RunspacePool (reutilizado en todos los ciclos, evita fuga de threads) ──
$Pool = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspacePool(1, $SubnetScanWorkers)
$Pool.Open()

# ── Cleanup al salir ──────────────────────────────────────────────────
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    if ($Pool -and $Pool.RunspacePoolStateInfo.State -ne 'Closed') {
        $Pool.Close()
        $Pool.Dispose()
    }
    if ($script:WatchdogMutex) {
        try { $script:WatchdogMutex.ReleaseMutex() } catch {}
        try { $script:WatchdogMutex.Dispose() } catch {}
    }
}

# ────────────────────────────────────────────────────────────────────
#region LOGGING
# ────────────────────────────────────────────────────────────────────
function Write-Log {
    [CmdletBinding()]param([string]$Msg)
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Msg"
    try {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8 -ErrorAction Stop
        if ((Get-Item $LogFile -ErrorAction Stop).Length -gt $MaxLogBytes) {
            Move-Item -Path $LogFile -Destination "$LogFile.1.log" -Force -ErrorAction SilentlyContinue
            Add-Content -Path $LogFile -Value $line -Encoding UTF8
        }
    } catch { <# Log dir puede estar lleno o en uso — ignorar #> }
    Write-Host $line -ForegroundColor DarkGray
}
#endregion

# ────────────────────────────────────────────────────────────────────
#region BINARIES — SRP: solo resolucion de rutas
# ────────────────────────────────────────────────────────────────────
function Resolve-AdbPath {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "C:\AndroProject\adb.exe",
        "C:\Program Files\Android\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    return if ($cmd) { $cmd.Source } else { "adb.exe" }
}

function Resolve-ScrcpyPath {
    $wingetPkgs = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    if (Test-Path $wingetPkgs) {
        $found = Get-ChildItem -Path $wingetPkgs -Filter "scrcpy.exe" -Recurse -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    $extras = @(
        "C:\AndroProject\scrcpy.exe",
        "C:\Program Files\scrcpy\scrcpy.exe",
        "$env:LOCALAPPDATA\Programs\scrcpy\scrcpy.exe"
    )
    foreach ($c in $extras) { if (Test-Path $c) { return $c } }
    $cmd = Get-Command scrcpy.exe -ErrorAction SilentlyContinue
    return if ($cmd) { $cmd.Source } else { "scrcpy.exe" }
}

$script:AdbPath    = Resolve-AdbPath
$script:ScrcpyPath = Resolve-ScrcpyPath
Write-Log "Binarios: ADB=$($script:AdbPath) | Scrcpy=$($script:ScrcpyPath)"
#endregion

# ────────────────────────────────────────────────────────────────────
#region ADB EXECUTOR — SRP: solo ejecuta comandos ADB con timeout
# ────────────────────────────────────────────────────────────────────
function Invoke-Adb {
    <#
    .SYNOPSIS Ejecuta adb con timeout. Devuelve [ExitCode, StdOut+StdErr].
    .NOTES   Usa lectura asincrona para evitar deadlock con buffers >4KB.
    #>
    [CmdletBinding()]
    param([string]$Arguments, [int]$TimeoutSec = 5)

    $psi = [System.Diagnostics.ProcessStartInfo]@{
        FileName               = $script:AdbPath
        Arguments              = $Arguments
        UseShellExecute        = $false
        RedirectStandardOutput = $true
        RedirectStandardError  = $true
        CreateNoWindow         = $true
    }
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        $outTask = $p.StandardOutput.ReadToEndAsync()
        $errTask = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit($TimeoutSec * 1000)) {
            try { $p.Kill() } catch {}
            try { $p.WaitForExit(1000) } catch {}
            return [pscustomobject]@{ ExitCode = -1; Output = '' }
        }
        return [pscustomobject]@{ ExitCode = $p.ExitCode; Output = ($outTask.Result + $errTask.Result) }
    } catch {
        return [pscustomobject]@{ ExitCode = -2; Output = '' }
    }
}

function Test-AdbHealth {
    <#
    .SYNOPSIS Health-check activo: el dispositivo responde a un echo?
    #>
    [CmdletBinding()]param([string]$Target, [int]$TimeoutSec = 3)
    if (-not $Target) { return $false }
    $r = Invoke-Adb "-s $Target shell echo __ok__" $TimeoutSec
    return ($r.ExitCode -eq 0 -and $r.Output -match '__ok__')
}
#endregion

# ────────────────────────────────────────────────────────────────────
#region DISCOVERY — SRP: solo descubrimiento de la IP del dispositivo
# ────────────────────────────────────────────────────────────────────

# Estrategia 1: Dispositivos ya conectados en 'adb devices' (USB o Wi-Fi)
function Get-WirelessAttachedDevices {
    $r = Invoke-Adb "devices" 3
    if ($r.ExitCode -ne 0) { return @() }
    $devs = [System.Collections.Generic.List[string]]::new()
    foreach ($line in ($r.Output -split "`r?`n")) {
        if ($line -match '^(\S+)\s+device$') {
            $devs.Add($Matches[1])
        }
    }
    return $devs.ToArray()
}

# Estrategia 2: mDNS / Wireless Debugging TLS de Android 11+
function Get-MdnsTargets {
    $r = Invoke-Adb "mdns services" 4
    if ($r.ExitCode -ne 0) { return @() }
    $targets = [System.Collections.Generic.List[string]]::new()
    foreach ($line in ($r.Output -split "`r?`n")) {
        if ($line -match '\t([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+)') {
            $targets.Add($Matches[1])
        }
    }
    return $targets.ToArray()
}

# Estrategia 3: Escaneo de subred en puerto 5555 con RunspacePool
# FIX BUG#1,2,3: Pool reutilizado, List en vez de +=, try/finally en socket.
function Find-SubnetAdbIps {
    [CmdletBinding()]param([int]$Port = 5555)
    
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.IPAddress -notlike '169.254*' } |
        Select-Object -First 1).IPAddress
    $prefix = if ($localIp -and $localIp.Contains('.')) {
        $localIp.Substring(0, $localIp.LastIndexOf('.'))
    } else { '192.168.0' }

    $openIps  = [System.Collections.Concurrent.ConcurrentBag[string]]::new()
    $handles  = [System.Collections.Generic.List[System.Management.Automation.PowerShell]]::new()
    $asyncs   = [System.Collections.Generic.List[System.IAsyncResult]]::new()

    $scanBlock = {
        param([string]$TargetIp, [int]$TargetPort, [System.Collections.Concurrent.ConcurrentBag[string]]$Bag)
        $sock = $null
        try {
            $sock = [System.Net.Sockets.Socket]::new(
                [System.Net.Sockets.AddressFamily]::InterNetwork,
                [System.Net.Sockets.SocketType]::Stream,
                [System.Net.Sockets.ProtocolType]::Tcp
            )
            $sock.Blocking = $false
            try { $sock.Connect($TargetIp, $TargetPort) } catch [System.Net.Sockets.SocketException] {}
            $w = [System.Collections.ArrayList]@($sock)
            [System.Net.Sockets.Socket]::Select($null, $w, $null, 100000) # 100ms
            if ($w.Count -gt 0) { $Bag.Add($TargetIp) }
        } finally {
            if ($sock) { try { $sock.Close() } catch {} }
        }
    }

    1..254 | ForEach-Object {
        $ps = [System.Management.Automation.PowerShell]::Create()
        $ps.RunspacePool = $Pool
        $null = $ps.AddScript($scanBlock).AddArgument("$prefix.$_").AddArgument($Port).AddArgument($openIps)
        $handles.Add($ps)
        $asyncs.Add($ps.BeginInvoke())
    }

    # Esperar a todos los workers (max 2.5s total)
    $deadline = [System.Diagnostics.Stopwatch]::StartNew()
    for ($i = 0; $i -lt $handles.Count; $i++) {
        $remaining = [Math]::Max(0, 2500 - $deadline.ElapsedMilliseconds)
        if ($remaining -gt 0) {
            $null = $asyncs[$i].AsyncWaitHandle.WaitOne($remaining)
        }
        try { $handles[$i].EndInvoke($asyncs[$i]) } catch {}
        $handles[$i].Dispose()
    }

    return @($openIps)
}

# Estrategia 4: IP en cache persistida
function Get-CachedIp {
    if (Test-Path $StateFile) {
        $ip = (Get-Content $StateFile -ErrorAction SilentlyContinue -TotalCount 1).Trim()
        if ($ip -match '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+$') { return $ip }
    }
    return $null
}

function Save-CachedIp([string]$Target) {
    Set-Content -Path $StateFile -Value $Target -Encoding ASCII -Force
}
#endregion

# ────────────────────────────────────────────────────────────────────
# Helper to check if a device is specifically our Samsung
function Test-IsSamsungA30([string]$Device) {
    if (-not $Device) { return $false }
    if ($Device -eq $PhoneSerial) { return $true }
    $m = Invoke-Adb "-s $Device shell getprop ro.product.model" 2
    if ($m.ExitCode -eq 0 -and $m.Output -match 'SM-A307|A30') { return $true }
    return $false
}

function Get-DeviceWifiIp([string]$Device) {
    # Method 1: ip route
    $r = Invoke-Adb "-s $Device shell ip route" 2
    if ($r.ExitCode -eq 0 -and $r.Output -match 'src\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)') {
        $found = $Matches[1]
        if ($found -notlike '127.*') { return $found }
    }
    # Method 2: ip -f inet addr show wlan0
    $r = Invoke-Adb "-s $Device shell ip -f inet addr show wlan0" 2
    if ($r.ExitCode -eq 0 -and $r.Output -match 'inet\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)') {
        $found = $Matches[1]
        if ($found -notlike '127.*') { return $found }
    }
    # Method 3: getprop dhcp.wlan0.ipaddress
    $r = Invoke-Adb "-s $Device shell getprop dhcp.wlan0.ipaddress" 2
    if ($r.ExitCode -eq 0 -and $r.Output -match '([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)') {
        return $Matches[1].Trim()
    }
    return $null
}

# ────────────────────────────────────────────────────────────────────
#region HARDENING — SRP: politicas Android anti-suspension
# Aplicado max 1 vez cada $HardeningMinutes (no en cada ciclo)
# ────────────────────────────────────────────────────────────────────
$lastHardeningTime = [DateTime]::MinValue

function Invoke-DeviceHardening([string]$Target) {
    $now = [DateTime]::Now
    if (($now - $script:lastHardeningTime).TotalMinutes -lt $HardeningMinutes) { return }
    $script:lastHardeningTime = $now
    $null = Invoke-Adb "-s $Target shell settings put global adb_wifi_enabled 1"      2
    $null = Invoke-Adb "-s $Target shell settings put global wifi_sleep_policy 2"     2
    $null = Invoke-Adb "-s $Target shell settings put system screen_off_timeout 2147483647" 2
    $null = Invoke-Adb "-s $Target shell settings put global stay_on_while_plugged_in 7"  2
    Write-Log "Hardening aplicado a $Target"
}
#endregion

# ────────────────────────────────────────────────────────────────────
#region SCRCPY MANAGER — SRP: ciclo de vida de la ventana de proyeccion Samsung
# Aislado exclusivamente al proceso scrcpy de Samsung (NO mata otros dispositivos)
# ────────────────────────────────────────────────────────────────────
$script:SamsungScrcpyPid = $null
$script:CurrentTarget = $null
$script:ProjectionFailures = 0
$script:NextProjectionAttempt = [DateTime]::MinValue

function Test-ScrcpyAlive {
    if (-not $script:SamsungScrcpyPid) { return $false }
    $proc = Get-Process -Id $script:SamsungScrcpyPid -ErrorAction SilentlyContinue
    return ($null -ne $proc -and -not $proc.HasExited)
}

function Test-ScrcpyRunningForTarget([string]$Target) {
    if ($script:SamsungScrcpyPid) {
        $proc = Get-Process -Id $script:SamsungScrcpyPid -ErrorAction SilentlyContinue
        if ($proc -and -not $proc.HasExited) {
            if ($script:CurrentTarget -eq $Target) {
                return $true
            }
        }
    }
    $script:SamsungScrcpyPid = $null
    $script:CurrentTarget = $null
    return $false
}

function Stop-ScrcpyIfRunning {
    if ($script:SamsungScrcpyPid) {
        try { Stop-Process -Id $script:SamsungScrcpyPid -Force -ErrorAction SilentlyContinue } catch {}
        $script:SamsungScrcpyPid = $null
    }
    $script:CurrentTarget = $null
    Start-Sleep -Milliseconds 300
}

function Start-Projection([string]$Target) {
    if ([DateTime]::Now -lt $script:NextProjectionAttempt) {
        return
    }

    Stop-ScrcpyIfRunning

    $args = @(
        '-s', $Target,
        '--display-id=0',
        '--video-codec=h264',
        '-b', '8M',
        '--max-size', '1080',
        '--max-fps', '60',
        '--video-buffer=10',
        '--render-driver=direct3d11',
        '--window-width=320',
        '--window-height=700',
        '--no-audio',
        '--stay-awake',
        '--port=27183:27195',
        "--window-title=AndroProject - Samsung A30 ($Target)"
    )

    $quotedArgs = @($args | ForEach-Object {
        $arg = [string]$_
        if ($arg -match '[\s"]') {
            '"' + ($arg -replace '"', '\"') + '"'
        } else {
            $arg
        }
    })

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:ScrcpyPath
    $psi.Arguments = ($quotedArgs -join ' ')
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $scrcpyDir = Split-Path -Parent $script:ScrcpyPath
    if ($scrcpyDir) { $psi.WorkingDirectory = $scrcpyDir }

    try {
        $proc = [System.Diagnostics.Process]::Start($psi)
        Start-Sleep -Milliseconds 350
        if ($proc -and -not $proc.HasExited) {
            $script:SamsungScrcpyPid = $proc.Id
            $script:CurrentTarget = $Target
            $script:ProjectionFailures = 0
            $script:NextProjectionAttempt = [DateTime]::MinValue
            Write-Log "Proyeccion Samsung activa (PID=$($proc.Id)) -> $Target [Port 27183]"
            return
        }
    } catch {}

    $script:ProjectionFailures++
    $pow = [Math]::Min($script:ProjectionFailures - 1, 4)
    $delaySec = [Math]::Min(120, 5 * [Math]::Pow(2, $pow))
    $script:NextProjectionAttempt = [DateTime]::Now.AddSeconds($delaySec)
    Write-Log "ERROR: scrcpy Samsung no inicio estable. Reintento en $([int]$delaySec)s"
}
#endregion

# ────────────────────────────────────────────────────────────────────
#region BUCLE PRINCIPAL — Orchestrador (no logica de negocio propia)
# ────────────────────────────────────────────────────────────────────
Write-Log "=== Watchdog Samsung A30 v6 Iniciado (Multi-Dispositivo Aislado) ==="
Write-Host "[AndroProject] Auto-Proyeccion Wi-Fi Samsung activa. Vigilando..." -ForegroundColor Green

$lastTarget   = $null
$cachedIp     = Get-CachedIp

while ($true) {
    try {
        $chosen = $null

        # PASO 1: Verificar si Samsung esta conectado por USB -> Promover automaticamente a Wi-Fi
        $attached = Get-WirelessAttachedDevices
        $usbSamsung = $attached | Where-Object { $_ -eq $PhoneSerial -or (Test-IsSamsungA30 $_ -and $_ -notmatch ':') } | Select-Object -First 1
        if ($usbSamsung) {
            $wifiIp = Get-DeviceWifiIp $usbSamsung
            if (-not $wifiIp) { $wifiIp = "192.168.0.11" }
            if ($wifiIp) {
                $null = Invoke-Adb "-s $usbSamsung tcpip 5555" 3
                Start-Sleep -Milliseconds 400
                $targetWifi = "$wifiIp`:5555"
                $null = Invoke-Adb "connect $targetWifi" 3
                if (Test-AdbHealth $targetWifi) {
                    $chosen = $targetWifi
                    $cachedIp = $targetWifi
                    Save-CachedIp $chosen
                    Write-Log "Samsung detectado en USB -> Auto-promovido a Wi-Fi: $chosen"
                }
            }
        }

        # PASO 2: Dispositivos ya asociados en adb devices que sean Samsung Wi-Fi
        if (-not $chosen) {
            foreach ($dev in $attached) {
                if ($dev -match ':' -and (Test-IsSamsungA30 $dev) -and (Test-AdbHealth $dev)) {
                    $chosen = $dev
                    break
                }
            }
        }

        # PASO 3: IP en cache
        if (-not $chosen -and $cachedIp) {
            $null = Invoke-Adb "connect $cachedIp" 3
            if ((Test-IsSamsungA30 $cachedIp) -and (Test-AdbHealth $cachedIp)) {
                $chosen = $cachedIp
            }
        }

        # PASO 4: mDNS — Wireless Debugging TLS de Android 11+
        if (-not $chosen) {
            foreach ($mdns in (Get-MdnsTargets)) {
                $null = Invoke-Adb "connect $mdns" 3
                if ((Test-IsSamsungA30 $mdns) -and (Test-AdbHealth $mdns)) {
                    $chosen = $mdns
                    Save-CachedIp $chosen
                    Write-Log "Samsung A30 conectado via mDNS: $chosen"
                    break
                }
            }
        }

        # PASO 5: Escaneo de subred (RunspacePool)
        if (-not $chosen) {
            foreach ($ip in (Find-SubnetAdbIps)) {
                $t = "$ip`:5555"
                $null = Invoke-Adb "connect $t" 3
                if ((Test-IsSamsungA30 $t) -and (Test-AdbHealth $t)) {
                    $chosen = $t
                    $cachedIp = $t
                    Save-CachedIp $chosen
                    Write-Log "Samsung A30 encontrado via escaneo de red: $chosen"
                    break
                }
            }
        }

        # PASO 6: Si solo esta en USB y Wi-Fi fallo, usar USB como respaldo
        if (-not $chosen -and $usbSamsung -and (Test-AdbHealth $usbSamsung)) {
            $chosen = $usbSamsung
        }

        # PASO 7: Gestion de scrcpy para Samsung
        if ($chosen) {
            Invoke-DeviceHardening $chosen

            if (-not (Test-ScrcpyRunningForTarget $chosen)) {
                if ($lastTarget -and $lastTarget -ne $chosen) {
                    Write-Log "Migrando proyeccion Samsung $lastTarget -> $chosen"
                }
                Start-Projection $chosen
            }
            $lastTarget = $chosen
        } else {
            if ($lastTarget) {
                Write-Log "Samsung A30 fuera de alcance. Vigilando..."
                Stop-ScrcpyIfRunning
                $lastTarget = $null
            }
        }
    } catch {
        Write-Log "Error inesperado en bucle: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $CheckIntervalSec
}
#endregion
