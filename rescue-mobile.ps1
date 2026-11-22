#Requires -Version 5.1
<#
.SYNOPSIS
  AndroProject — Rescate Permanente Universal para Cualquier Móvil Android
.DESCRIPTION
  QUÉ HACE: Mantiene cualquier teléfono Android (con táctil roto o dañado)
            conectado y proyectado en el PC de forma 100% estable (USB o Wi-Fi).
  CÓMO FUNCIONA: Detecta automáticamente el primer móvil conectado por ADB
            (o el indicado en -Serial), aplica hardening anti-suspensión,
            promueve USB -> Wi-Fi (puerto 5555) si está habilitado, y mantiene
            scrcpy vivo con --stay-awake (y --turn-screen-off opcional).
  POR QUÉ: Reemplazar scripts atados a un solo modelo y ofrecer activación/
           desactivación simple desde PC para cualquier dispositivo (< 200L).
#>

[CmdletBinding()]
param(
    [string]$Serial           = "",
    [switch]$TurnScreenOff,
    [switch]$UsbOnly,
    [int]$CheckIntervalSec    = 4,
    [int]$HardeningMinutes    = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

$createdNew = $false
$script:Mutex = [System.Threading.Mutex]::new($true, 'Global\AndroProject_Universal_Rescue', [ref]$createdNew)
if (-not $createdNew) {
    Write-Host "[Rescate] Ya existe una instancia activa." -ForegroundColor Yellow
    exit 0
}

function Resolve-Binary([string]$Name, [string[]]$Candidates) {
    foreach ($c in $Candidates) { if (Test-Path $c) { return $c } }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $Name
}

$script:AdbPath = Resolve-Binary "adb.exe" @(
    "C:\AndroProject\adb.exe",
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "C:\Program Files\Android\platform-tools\adb.exe"
)
$wingetScrcpy = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "scrcpy.exe" -Recurse -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
$script:ScrcpyPath = Resolve-Binary "scrcpy.exe" @(
    "C:\AndroProject\scrcpy.exe",
    $(if ($wingetScrcpy) { $wingetScrcpy.FullName } else { "" })
)

$script:ScrcpyPid = $null
$script:CurrentTarget = $null
$script:LastHardening = [DateTime]::MinValue
$StateFile = Join-Path $env:TEMP "androproject-rescue-ip.txt"

function Stop-Scrcpy {
    if ($script:ScrcpyPid) {
        try { Stop-Process -Id $script:ScrcpyPid -Force -ErrorAction SilentlyContinue } catch {}
        $script:ScrcpyPid = $null
        $script:CurrentTarget = $null
    }
}

$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-Scrcpy
    if ($script:Mutex) {
        try { $script:Mutex.ReleaseMutex() } catch {}
        try { $script:Mutex.Dispose() } catch {}
    }
}

function Invoke-Adb([string]$ArgsText, [int]$TimeoutSec = 4) {
    $psi = [System.Diagnostics.ProcessStartInfo]::new($script:AdbPath, $ArgsText)
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    try {
        $p = [System.Diagnostics.Process]::Start($psi)
        $outTask = $p.StandardOutput.ReadToEndAsync()
        if (-not $p.WaitForExit($TimeoutSec * 1000)) { try { $p.Kill() } catch {}; return @{ Ok = $false; Out = "" } }
        return @{ Ok = ($p.ExitCode -eq 0); Out = $outTask.Result }
    } catch { return @{ Ok = $false; Out = "" } }
}

function Get-OnlineDevices {
    $r = Invoke-Adb "devices" 3
    if (-not $r.Ok) { return @() }
    $list = @()
    foreach ($line in ($r.Out -split "`r?`n")) {
        if ($line -match '^(\S+)\s+device\b') { $list += $Matches[1] }
    }
    return $list
}

function Get-WifiIp([string]$Target) {
    $r = Invoke-Adb "-s $Target shell ip route" 3
    if ($r.Ok -and $r.Out -match 'src\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)') {
        if ($Matches[1] -notlike '127.*') { return $Matches[1] }
    }
    return $null
}

function Invoke-Hardening([string]$Target) {
    if (([DateTime]::Now - $script:LastHardening).TotalMinutes -lt $HardeningMinutes) { return }
    $script:LastHardening = [DateTime]::Now
    $cmds = @(
        "settings put global adb_wifi_enabled 1",
        "settings put global wifi_sleep_policy 2",
        "settings put global stay_on_while_plugged_in 7",
        "settings put system screen_off_timeout 2147483647",
        "svc power stayon true"
    )
    foreach ($c in $cmds) { $null = Invoke-Adb "-s $Target shell $c" 2 }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Hardening anti-suspension aplicado a $Target" -ForegroundColor DarkCyan
}

function Start-RescueScrcpy([string]$Target) {
    Stop-Scrcpy
    $args = @(
        "-s", $Target, "--video-codec=h264", "-b", "8M", "--max-size", "1080", "--max-fps", "60",
        "--render-driver=direct3d11", "--no-audio", "--stay-awake", "--always-on-top",
        "--window-title=AndroProject Rescate ($Target)"
    )
    if ($TurnScreenOff) { $args += "--turn-screen-off" }
    $psi = [System.Diagnostics.ProcessStartInfo]::new($script:ScrcpyPath, ($args -join ' '))
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    Start-Sleep -Milliseconds 350
    if ($proc -and -not $proc.HasExited) {
        $script:ScrcpyPid = $proc.Id
        $script:CurrentTarget = $Target
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Proyeccion activa -> $Target (PID=$($proc.Id))" -ForegroundColor Green
    }
}

Write-Host "=== AndroProject Rescate Permanente Universal (Ctrl+C para desactivar) ===" -ForegroundColor Cyan

try {
    while ($true) {
        $online = @(Get-OnlineDevices)
        $target = if ($Serial) { $online | Where-Object { $_ -eq $Serial } | Select-Object -First 1 } else { $online | Select-Object -First 1 }

        if (-not $target -and (Test-Path $StateFile)) {
            $cached = (Get-Content $StateFile -ErrorAction SilentlyContinue -TotalCount 1).Trim()
            if ($cached) {
                $null = Invoke-Adb "connect $cached" 3
                $online = @(Get-OnlineDevices)
                $target = $online | Where-Object { $_ -eq $cached } | Select-Object -First 1
            }
        }

        if ($target -and -not $UsbOnly -and $target -notmatch ':') {
            $ip = Get-WifiIp $target
            if ($ip) {
                $null = Invoke-Adb "-s $target tcpip 5555" 3
                Start-Sleep -Milliseconds 400
                $wifiTarget = "${ip}:5555"
                $null = Invoke-Adb "connect $wifiTarget" 3
                if ((Get-OnlineDevices) -contains $wifiTarget) {
                    Set-Content -Path $StateFile -Value $wifiTarget -Encoding ASCII -Force
                    $target = $wifiTarget
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Promovido USB -> Wi-Fi: $target" -ForegroundColor Yellow
                }
            }
        }

        if ($target) {
            Invoke-Hardening $target
            $alive = $script:ScrcpyPid -and ($null -ne (Get-Process -Id $script:ScrcpyPid -ErrorAction SilentlyContinue))
            if (-not $alive -or $script:CurrentTarget -ne $target) {
                Start-RescueScrcpy $target
            }
        } else {
            if ($script:CurrentTarget) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Movil desconectado. Esperando reconexion..." -ForegroundColor DarkYellow
                Stop-Scrcpy
            }
        }
        Start-Sleep -Seconds $CheckIntervalSec
    }
} finally {
    Stop-Scrcpy
}
