<#
.SYNOPSIS
    AndroProject Control Center v3
    .\andro.ps1              = Menu interactivo
    .\andro.ps1 connect      = Conectar telefono y forward VNC  
    .\andro.ps1 status       = Diagnostico completo
    .\andro.ps1 optimize     = Optimizar rendimiento
    .\andro.ps1 vnc          = Abrir escritorio Linux
    .\andro.ps1 shell        = Shell Ubuntu interactiva
    .\andro.ps1 msf          = Metasploit console
    .\andro.ps1 scan         = Nmap sweep red local
    .\andro.ps1 server       = Iniciar AndroProject server
    .\andro.ps1 tool <name>  = Ejecutar herramienta en Ubuntu
    .\andro.ps1 hash <file>  = Crackear hash con hashcat
#>
param(
    [string]$Action = "",
    [string]$Arg1 = "",
    [string]$Arg2 = ""
)

$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$PHONE_SN = "VGL7MVFMDYQG8T55"
$PHONE_IP = "192.168.0.13"
$PROOT_PREFIX = "run-as com.termux /data/data/com.termux/files/usr/bin/bash -c 'PATH=/data/data/com.termux/files/usr/bin proot-distro login ubuntu -- "

# ── HELPERS ──
function adb { & $ADB @args 2>&1 }
function adb-sh { param($c) & $ADB -s $PHONE_SN shell $c 2>&1 }
function ubuntu { param($c) adb-sh "$PROOT_PREFIX$c'" }

function Write-Banner {
    Write-Host ""
    Write-Host "  ============================================" -ForegroundColor Cyan
    Write-Host "    ANDROPROJECT CONTROL CENTER v3" -ForegroundColor Cyan
    Write-Host "  ============================================" -ForegroundColor Cyan
}

function Test-Phone {
    $d = adb devices | Where-Object { $_ -match "$PHONE_SN.*device" }
    return ($d -ne $null)
}

function Ensure-Connected {
    if (Test-Phone) { return $true }
    Write-Host "  Conectando $PHONE_IP`:5555..." -ForegroundColor Yellow
    adb connect "${PHONE_IP}:5555" | Out-Null
    Start-Sleep -Seconds 2
    if (-not (Test-Phone)) {
        Write-Host "  Conecta el USB e intenta de nuevo." -ForegroundColor Red
        return $false
    }
    return $true
}

# ── COMANDOS ──
function Connect-Phone {
    Write-Host "`n  Conectando OPPO CPH2557..." -ForegroundColor Yellow
    
    # USB
    if (Test-Phone) {
        Write-Host "  [USB] $PHONE_SN detectado" -ForegroundColor Green
        adb -s $PHONE_SN tcpip 5555 | Out-Null
        Start-Sleep -Seconds 2
        $i = adb -s $PHONE_SN shell 'ip addr show wlan0' | Select-String 'inet '
        if ($i -match '(\d+\.\d+\.\d+\.\d+)') { $script:PHONE_IP = $matches[1] }
        adb connect "${PHONE_IP}:5555" | Out-Null
        Start-Sleep -Seconds 2
        Write-Host "  [WiFi] ${PHONE_IP}:5555" -ForegroundColor Green
    }
    
    Ensure-Connected | Out-Null
    $dev = (adb devices | Select-String 'device$' | Select-Object -First 1) -replace '\s+device',''
    
    # Forward
    adb -s $dev forward tcp:5901 tcp:5901 | Out-Null
    adb -s $dev forward tcp:6080 tcp:6080 | Out-Null
    Write-Host "  VNC:5901  |  noVNC:6080" -ForegroundColor Green
    
    # VNC status
    $v = adb -s $dev shell 'ss -tlnp' | Select-String '5901|6080'
    if ($v) { Write-Host "  Escritorio Linux: ONLINE`n" -ForegroundColor Green }
    else { Write-Host "  Escritorio Linux: OFFLINE`n" -ForegroundColor Yellow }
}

function Show-Status {
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  ─── DIAGNOSTICO ───" -ForegroundColor Yellow
    
    $sdk = (adb-sh 'getprop ro.build.version.sdk').Trim()
    $rel = (adb-sh 'getprop ro.build.version.release').Trim()
    Write-Host "  Android $rel (API $sdk)" -ForegroundColor White
    
    Write-Host "`n  ─── RAM ───" -ForegroundColor Yellow
    adb-sh 'cat /proc/meminfo' | Select-String '^(MemTotal|MemFree|MemAvailable)' | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    Write-Host "`n  ─── BATERIA ───" -ForegroundColor Yellow
    $b = adb-sh 'dumpsys battery' | Select-String 'level|status|temperature|plugged'
    $b | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    Write-Host "`n  ─── RED ───" -ForegroundColor Yellow
    adb-sh 'ip addr show wlan0' | Select-String 'inet ' | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    Write-Host "`n  ─── HERRAMIENTAS UBUNTU ───" -ForegroundColor Yellow
    ubuntu 'echo nmap: $(which nmap); echo msfconsole: $(which msfconsole); echo hashcat: $(which hashcat); echo hydra: $(which hydra); echo sqlmap: $(which sqlmap); echo impacket: $(which impacket-secretsdump); echo responder: $(which responder)' | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host ""
}

function Optimize-Phone {
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  ─── OPTIMIZANDO ───" -ForegroundColor Yellow
    
    $cmds = @(
        'settings put global window_animation_scale 0.5',
        'settings put global transition_animation_scale 0.5',
        'settings put global animator_duration_scale 0.5',
        'settings put global force_gpu_rendering 1',
        'settings put global force_4x_msaa 1',
        'settings put global high_performance_mode 1',
        'settings put global disable_window_blurs 1',
        'settings put global wifi_sleep_policy 2',
        'settings put global wifi_scan_always_enabled 0',
        'settings put system screen_off_timeout 1800000'
    )
    foreach ($c in $cmds) { adb-sh $c | Out-Null }
    
    adb-sh 'dumpsys deviceidle whitelist +com.termux' | Out-Null
    adb-sh 'dumpsys deviceidle whitelist +com.termux.x11' | Out-Null
    adb-sh 'am kill-all' | Out-Null
    
    $m = adb-sh 'cat /proc/meminfo' | Select-String 'MemFree'
    Write-Host "  Optimizado. $m" -ForegroundColor Green
    Write-Host ""
}

function Open-VNC {
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  Abriendo escritorio Linux..." -ForegroundColor Cyan
    
    $dev = (adb devices | Select-String 'device$' | Select-Object -First 1) -replace '\s+device',''
    adb -s $dev forward tcp:5901 tcp:5901 | Out-Null
    adb -s $dev forward tcp:6080 tcp:6080 | Out-Null
    
    $v = adb -s $dev shell 'ss -tlnp' | Select-String '5901'
    if (-not $v) {
        Write-Host "  VNC no esta corriendo. Iniciando..." -ForegroundColor Yellow
        adb -s $dev shell 'am start -n com.termux/.app.TermuxActivity' | Out-Null
        Start-Sleep -Seconds 2
        adb -s $dev shell 'input text /usr/local/bin/start-andro; input keyevent 66' | Out-Null
        Start-Sleep -Seconds 4
    }
    
    Start-Process 'http://localhost:6080/vnc.html'
    Write-Host "  noVNC: http://localhost:6080/vnc.html" -ForegroundColor Green
    Write-Host "  VNC: localhost:5901 (andro123)`n" -ForegroundColor Gray
}

function Enter-Shell {
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  Shell Ubuntu interactiva (exit para salir)`n" -ForegroundColor Cyan
    adb-sh "$PROOT_PREFIX bash'"
}

function Enter-MSF {
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  Metasploit (Ctrl+C 2 veces para salir)`n" -ForegroundColor Red
    adb-sh "$PROOT_PREFIX msfconsole -q'"
}

function Start-Scan {
    param($Target = "192.168.0.0/24")
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  Escaneando $Target..." -ForegroundColor Cyan
    ubuntu "nmap -sT -F --host-timeout 5s $Target"
    Write-Host ""
}

function Start-Hashcat {
    param($HashFile, $Wordlist = "/opt/arsenal/SecLists/Passwords/rockyou.txt")
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  Hashcat crackeando $HashFile..." -ForegroundColor Red
    ubuntu "hashcat -m 0 -a 0 $HashFile $Wordlist --force"
    Write-Host ""
}

function Start-Server {
    Write-Host "`n  Iniciando AndroProject Server..." -ForegroundColor Cyan
    & "$PSScriptRoot\start.ps1"
}

function Invoke-Tool {
    param($Name)
    if (-not (Ensure-Connected)) { return }
    Write-Host "`n  Ejecutando $Name en Ubuntu...`n" -ForegroundColor Cyan
    ubuntu "$Name"
    Write-Host ""
}

# ── MENU ──
function Show-Menu {
    Write-Banner
    $ok = Test-Phone
    Write-Host "  Estado: " -NoNewline
    if ($ok) { Write-Host "CONECTADO" -ForegroundColor Green }
    else     { Write-Host "DESCONECTADO" -ForegroundColor Red }
    
    Write-Host @"

  [1] Conectar + forward VNC
  [2] Diagnostico completo
  [3] Optimizar rendimiento
  [4] Escritorio Linux (noVNC)
  [5] Escanear red local (nmap)
  [6] Shell Ubuntu interactiva
  [7] Metasploit console
  [8] AndroProject Server
  [0] Salir
"@
    
    $c = Read-Host "  Opcion"
    switch ($c) {
        '1' { Connect-Phone }
        '2' { Show-Status }
        '3' { Optimize-Phone }
        '4' { Open-VNC }
        '5' { Start-Scan }
        '6' { Enter-Shell }
        '7' { Enter-MSF }
        '8' { Start-Server }
        '0' { return }
        default { Write-Host "  Invalido" -ForegroundColor Red }
    }
    Read-Host "`n  Enter para continuar"
    Show-Menu
}

# ── ENTRY ──
switch ($Action) {
    'connect'  { Connect-Phone }
    'status'   { Show-Status }
    'optimize' { Optimize-Phone }
    'vnc'      { Open-VNC }
    'shell'    { Enter-Shell }
    'msf'      { Enter-MSF }
    'scan'     { Start-Scan $Arg1 }
    'server'   { Start-Server }
    'hash'     { Start-Hashcat $Arg1 $Arg2 }
    'tool'     { Invoke-Tool $Arg1 }
    ''         { Show-Menu }
    default    { Invoke-Tool "$Action $Arg1 $Arg2" }
}
