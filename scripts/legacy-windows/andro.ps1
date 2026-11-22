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
    .\andro.ps1 fixshot      = Reparar capturas de pantalla
#>
param(
    [string]$Action = "",
    [string]$Arg1 = "",
    [string]$Arg2 = ""
)

function Resolve-AdbBinary {
    $candidates = @(
        "C:\AndroProject\adb.exe",
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "C:\Program Files\Android\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $cmd = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return "adb.exe"
}
$ADB = Resolve-AdbBinary
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

# ── REPARAR CAPTURAS (OPPO/ColorOS) ──
function Repair-Screenshot {
    Write-Host "`n  === REPARANDO CAPTURAS DE PANTALLA ===" -ForegroundColor Cyan
    
    if (-not (Ensure-Connected)) { return }

    # ── DIAGNÓSTICO PREVIO ──────────────────────────────────────────
    Write-Host "`n  -- Diagnostico --" -ForegroundColor Magenta

    $globalDisable = adb-sh "settings get global disable_screen_shot 2>/dev/null"
    if (($globalDisable -replace '\s','') -eq '1') {
        Write-Host "  [FAIL] disable_screen_shot = 1 (BLOQUEA TODO)" -ForegroundColor Red
        $needsFix = $true
    } else {
        Write-Host "  [OK] disable_screen_shot = $($globalDisable.Trim())" -ForegroundColor Green
    }

    $threeFinger = adb-sh "settings get system oppo_three_finger_screenshot 2>/dev/null"
    if (($threeFinger -replace '\s','') -eq '0' -or ($threeFinger -replace '\s','') -eq 'null') {
        Write-Host "  [FAIL] Gesto tres dedos: $($threeFinger.Trim())" -ForegroundColor Red
        $needsFix = $true
    } else {
        Write-Host "  [OK] Gesto tres dedos: $($threeFinger.Trim())" -ForegroundColor Green
    }

    # Test screencap directo
    adb-sh "screencap -p /data/local/tmp/_test_cap.png 2>/dev/null" | Out-Null
    Start-Sleep -Seconds 1
    $testSize = adb-sh "stat -c %s /data/local/tmp/_test_cap.png 2>/dev/null"
    adb-sh "rm -f /data/local/tmp/_test_cap.png" | Out-Null
    $testSize = ($testSize -replace '\D','').Trim()

    if ([int]$testSize -gt 5000) {
        Write-Host "  [OK] screencap funcional ($testSize bytes)" -ForegroundColor Green
    } elseif ([int]$testSize -gt 0) {
        Write-Host "  [FAIL] screencap genera archivo diminuto ($testSize bytes) - FLAG_SECURE activo!" -ForegroundColor Red
        Write-Host "         Cerra la app actual (banco, Netflix, etc.) y ejecuta de nuevo." -ForegroundColor Yellow
        return
    } else {
        Write-Host "  [FAIL] screencap NO funciona ($testSize bytes) - error del display HAL" -ForegroundColor Red
    }

    # ── REPARACIÓN ───────────────────────────────────────────────────
    if ($needsFix) {
        Write-Host "`n  -- Aplicando reparaciones --" -ForegroundColor Magenta

        if (($globalDisable -replace '\s','') -eq '1') {
            Write-Host "  [>>] Eliminando bloqueo global..." -ForegroundColor Cyan
            adb-sh "settings delete global disable_screen_shot 2>/dev/null"
            adb-sh "settings put global disable_screen_shot 0 2>/dev/null"
            Write-Host "  [OK] Bloqueo global eliminado" -ForegroundColor Green
        }

        if (($threeFinger -replace '\s','') -eq '0' -or ($threeFinger -replace '\s','') -eq 'null') {
            Write-Host "  [>>] Activando gestos de captura ColorOS..." -ForegroundColor Cyan
            adb-sh "settings put system oppo_three_finger_screenshot 1 2>/dev/null"
            adb-sh "settings put system three_gesture_screenshot 1 2>/dev/null"
            adb-sh "settings put system oppo_screenshot_gesture 1 2>/dev/null"
            adb-sh "settings put secure screenshot_enabled 1 2>/dev/null"
            Write-Host "  [OK] Gestos activados" -ForegroundColor Green
        }

        Write-Host "  [>>] Liberando cache..." -ForegroundColor Cyan
        adb-sh "pm trim-caches 999G 2>/dev/null"
        Write-Host "  [OK] Cache liberada" -ForegroundColor Green

        Write-Host "  [>>] Reiniciando SystemUI..." -ForegroundColor Cyan
        adb-sh "pkill -f com.android.systemui 2>/dev/null"
        Start-Sleep -Seconds 4
        Write-Host "  [OK] SystemUI reiniciado" -ForegroundColor Green
    } else {
        Write-Host "`n  [OK] No se detectaron settings rotos. Verificando funcionalidad..." -ForegroundColor Green
    }

    # ── VERIFICACIÓN REAL ────────────────────────────────────────────
    Write-Host "`n  -- Verificando captura --" -ForegroundColor Magenta
    
    $ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $deviceFile = "/data/local/tmp/_verify_${ts}.png"
    $capturasDir = "C:\AndroProject\Capturas"
    if (-not (Test-Path $capturasDir)) { New-Item -ItemType Directory -Path $capturasDir -Force | Out-Null }
    $localFile = "$capturasDir\verificacion_${ts}.png"

    Write-Host "  [>>] Tomando captura de prueba..." -ForegroundColor Cyan
    & $ADB -s $script:target shell "screencap -p $deviceFile" 2>&1 | Out-Null
    Start-Sleep -Seconds 1

    Write-Host "  [>>] Transfiriendo a PC..." -ForegroundColor Cyan
    & $ADB -s $script:target pull "$deviceFile" "$localFile" 2>&1 | Out-Null
    & $ADB -s $script:target shell "rm -f $deviceFile" 2>&1 | Out-Null

    if (Test-Path $localFile) {
        $size = (Get-Item $localFile).Length
        if ($size -gt 10240) {
            Write-Host ""
            Write-Host "  ============================================" -ForegroundColor Green
            Write-Host "  |   CAPTURA FUNCIONANDO CORRECTAMENTE      |" -ForegroundColor Green
            Write-Host "  |   Archivo: $localFile" -ForegroundColor Green
            Write-Host "  |   Tamano:  $([math]::Round($size/1024,1)) KB"  -ForegroundColor Green
            Write-Host "  ============================================" -ForegroundColor Green
            
            Write-Host "`n  Abriendo imagen para verificacion visual..." -ForegroundColor Yellow
            Start-Process $localFile
            Write-Host "  Proba Power+Vol Down o tres dedos en el movil. Deberia funcionar." -ForegroundColor Gray
        } elseif ($size -gt 100) {
            Write-Host "`n  [WARN] Captura demasiado pequena (${size} bytes)" -ForegroundColor Yellow
            Write-Host "          Posible FLAG_SECURE. Cerra apps bancarias/de streaming y reintenta." -ForegroundColor Yellow
            Remove-Item $localFile -Force
        } else {
            Write-Host "`n  [FAIL] Archivo vacio o corrupto (${size} bytes)" -ForegroundColor Red
            Remove-Item $localFile -Force
        }
    } else {
        Write-Host "`n  [FAIL] No se pudo obtener la captura de prueba" -ForegroundColor Red
        Write-Host "         Diagnostico completo: .\scripts\fix-screenshot.ps1" -ForegroundColor Gray
    }
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
  [9] Reparar capturas de pantalla (OPPO)
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
        '9' { Repair-Screenshot }
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
    'fixshot'  { Repair-Screenshot }
    ''         { Show-Menu }
    default    { Invoke-Tool "$Action $Arg1 $Arg2" }
}
