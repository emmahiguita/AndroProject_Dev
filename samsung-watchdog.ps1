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
#region SCRCPY MANAGER — SRP: ciclo de vida de la ventana de proyeccion
# FIX BUG#4: usa Get-Process (nativo) en vez de WMI Get-CimInstance
# FIX BUG#6: nombre de funcion con verbo aprobado 'Test-'
# ────────────────────────────────────────────────────────────────────
$script:ScrcpyPid = $null
$script:CurrentTarget = $null

function Test-ScrcpyAlive {
    if (-not $script:ScrcpyPid) { return $false }
    $proc = Get-Process -Id $script:ScrcpyPid -ErrorAction SilentlyContinue
    return ($null -ne $proc -and -not $proc.HasExited)
}

function Test-ScrcpyRunningForTarget([string]$Target) {
    if ($script:ScrcpyPid) {
        $proc = Get-Process -Id $script:ScrcpyPid -ErrorAction SilentlyContinue
        if ($proc -and -not $proc.HasExited) {
            if ($script:CurrentTarget -eq $Target) {
                return $true
            }
        }
    }
    # Fallback: si hay algun scrcpy activo en el sistema, lo adoptamos si corresponde
    $procs = @(Get-Process -Name scrcpy -ErrorAction SilentlyContinue | Where-Object { -not $_.HasExited })
    if ($procs.Count -gt 0) {
        if ($null -eq $script:CurrentTarget -or $script:CurrentTarget -eq $Target) {
            $script:ScrcpyPid = $procs[0].Id
            $script:CurrentTarget = $Target
            return $true
        }
    }
    $script:ScrcpyPid = $null
    $script:CurrentTarget = $null
    return $false
}

function Stop-ScrcpyIfRunning {
    if ($script:ScrcpyPid) {
        try { Stop-Process -Id $script:ScrcpyPid -Force -ErrorAction SilentlyContinue } catch {}
        $script:ScrcpyPid = $null
    }
    # Matar cualquier scrcpy huerfano
    Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object {
        try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    $script:CurrentTarget = $null
    Start-Sleep -Milliseconds 500
}

function Start-Projection([string]$Target) {
    # Asegurar que no queden instancias viejas duplicadas
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
        "--window-title=`"AndroProject 60 FPS - $Target`""
    )
    $proc = Start-Process -FilePath $script:ScrcpyPath -ArgumentList $args -PassThru -ErrorAction SilentlyContinue
    if ($proc -and -not $proc.HasExited) {
        $script:ScrcpyPid = $proc.Id
        $script:CurrentTarget = $Target
        Write-Log "Proyeccion activa (PID=$($proc.Id)) → $Target"
    } else {
        Write-Log "ERROR: No se pudo iniciar scrcpy para $Target"
    }
}
#endregion

# ────────────────────────────────────────────────────────────────────
#region BUCLE PRINCIPAL — Orchestrador (no logica de negocio propia)
# ────────────────────────────────────────────────────────────────────
Write-Log "=== Watchdog Samsung A30 v5 Iniciado ==="
Write-Host "[AndroProject] Auto-Proyeccion Wi-Fi activa. Esperando Samsung A30..." -ForegroundColor Green

$lastTarget   = $null
$cachedIp     = Get-CachedIp

while ($true) {
    try {
        $chosen = $null

        # PASO 1: Dispositivos ya asociados en adb devices (mas rapido)
        foreach ($dev in (Get-WirelessAttachedDevices)) {
            if (Test-AdbHealth $dev) { $chosen = $dev; break }
        }

        # PASO 2: mDNS — Wireless Debugging TLS de Android 11+
        if (-not $chosen) {
            foreach ($mdns in (Get-MdnsTargets)) {
                $null = Invoke-Adb "connect $mdns" 3
                if (Test-AdbHealth $mdns) {
                    $chosen = $mdns
                    Save-CachedIp $chosen
                    Write-Log "A30 conectado via mDNS: $chosen"
                    break
                }
            }
        }

        # PASO 3: IP en cache
        if (-not $chosen -and $cachedIp) {
            $null = Invoke-Adb "connect $cachedIp" 3
            if (Test-AdbHealth $cachedIp) { $chosen = $cachedIp }
        }

        # PASO 4: Escaneo de subred (RunspacePool — sin fugas de threads)
        if (-not $chosen) {
            foreach ($ip in (Find-SubnetAdbIps)) {
                $t = "$ip`:5555"
                $null = Invoke-Adb "connect $t" 3
                if (Test-AdbHealth $t) {
                    $chosen = $t
                    $cachedIp = $t
                    Save-CachedIp $chosen
                    Write-Log "A30 encontrado via escaneo de red: $chosen"
                    break
                }
            }
        }

        # PASO 5: Gestion de scrcpy
        if ($chosen) {
            Invoke-DeviceHardening $chosen

            if (-not (Test-ScrcpyRunningForTarget $chosen)) {
                if ($lastTarget -and $lastTarget -ne $chosen) {
                    Write-Log "Migrando proyeccion $lastTarget → $chosen"
                }
                Start-Projection $chosen
            }
            $lastTarget = $chosen
        } else {
            if ($lastTarget) {
                Write-Log "Samsung A30 fuera de rango Wi-Fi. Vigilando..."
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
