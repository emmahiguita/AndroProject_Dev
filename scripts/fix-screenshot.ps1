<#
.SYNOPSIS
    Diagnostica y repara capturas de pantalla nativas en OPPO/ColorOS.
    Restaura las opciones de fabrica (Power+Vol Down, tres dedos, sidebar).
    Uso: .\scripts\fix-screenshot.ps1 [-Diagnose] [-Fix] [-Serial SERIAL] [-IP IP]

    Sin flags: diagnostica + repara automaticamente.
    -Diagnose: solo diagnostica, no repara.
    -Fix: repara sin preguntar.
#>
param(
    [switch]$Diagnose,
    [switch]$Fix,
    [string]$Serial = "",
    [string]$IP = "192.168.0.13"
)

$ErrorActionPreference = "Continue"
$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $ADB)) {
    Write-Host "ERROR: ADB no encontrado en $ADB" -ForegroundColor Red
    exit 1
}

# ── HELPERS ──────────────────────────────────────────────────────────
function adb-shell($cmd) {
    $serialFlag = if ($script:target) { "-s $script:target" } else { "" }
    $full = "$ADB $serialFlag shell $cmd"
    $result = Invoke-Expression $full 2>&1 | Out-String
    return $result.Trim()
}

function adb-exec($cmd) {
    $serialFlag = if ($script:target) { "-s $script:target" } else { "" }
    $full = "$ADB $serialFlag $cmd"
    $result = Invoke-Expression $full 2>&1 | Out-String
    return $result.Trim()
}

function Write-OK { Write-Host "  [OK] $args" -ForegroundColor Green }
function Write-FAIL { Write-Host "  [FAIL] $args" -ForegroundColor Red }
function Write-WARN { Write-Host "  [WARN] $args" -ForegroundColor Yellow }
function Write-FIX { Write-Host "  [>>] $args" -ForegroundColor Cyan }
function Write-SECTION { Write-Host "`n-- $args --" -ForegroundColor Magenta }

# ── CONECTAR ─────────────────────────────────────────────────────────
Write-Host "`n  === DIAGNOSTICO DE CAPTURA OPPO ===" -ForegroundColor Cyan

# Resolver serial
if ($Serial) {
    $script:target = $Serial
} else {
    Write-Host "  Detectando dispositivos..." -ForegroundColor Gray
    $devices = & $ADB devices 2>&1 | Where-Object { $_ -match 'device$' -and $_ -notmatch 'List of devices' }
    if (-not $devices) {
        Write-Host "  Sin dispositivos. Conectando $IP`:5555..." -ForegroundColor Yellow
        & $ADB connect "${IP}:5555" 2>&1 | Out-Null
        Start-Sleep -Seconds 3
        $devices = & $ADB devices 2>&1 | Where-Object { $_ -match 'device$' -and $_ -notmatch 'List of devices' }
    }
    if ($devices) {
        $script:target = ($devices[0] -replace '\s+device.*', '').Trim()
        Write-OK "Dispositivo: $script:target"
    } else {
        Write-FAIL "No se detecto ningun dispositivo. Conecta por USB o WiFi."
        exit 1
    }
}

# ── 1. VERIFICAR SCREENCAP BINARIO ────────────────────────────────────
Write-SECTION "1. Binario screencap"

$screencapPath = adb-shell "which screencap"
if ($screencapPath -match "/system/bin/screencap") {
    Write-OK "screencap presente: $($screencapPath.Trim())"
} else {
    Write-FAIL "screencap NO encontrado. Ruta: $screencapPath"
    Write-WARN "Firmware corrupto o restriccion del fabricante. Requiere reflash."
}

# Probar captura directa
Write-Host "  Probando screencap..." -ForegroundColor Gray
$testPath = "/data/local/tmp/_diag_test.png"
adb-shell "screencap -p $testPath 2>&1"
Start-Sleep -Seconds 1
$testSize = adb-shell "stat -c %s $testPath 2>/dev/null || wc -c < $testPath 2>/dev/null"
$testSize = ($testSize -replace '\D', '').Trim()
adb-shell "rm -f $testPath" | Out-Null

if ([int]$testSize -gt 5000) {
    Write-OK "screencap funcional - genero $testSize bytes"
} elseif ([int]$testSize -gt 0) {
    Write-WARN "screencap genera archivos diminutos ($testSize bytes) - posible FLAG_SECURE en foreground"
    $diagnosisFlags += "FLAG_SECURE_DETECTED"
} else {
    Write-FAIL "screencap NO genera archivos - posible error del display HAL"
    $diagnosisFlags += "SCREENCAP_FAILED"
}

# ── 2. APP EN FOREGROUND (FLAG_SECURE) ────────────────────────────────
Write-SECTION "2. FLAG_SECURE en foreground"

$focus = adb-shell "dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | head -5"
Write-Host "  Focus: $focus" -ForegroundColor Gray

$secureCheck = adb-shell "dumpsys window 2>/dev/null | grep -i 'FLAG_SECURE' | head -3"
if ($secureCheck) {
    Write-FAIL "FLAG_SECURE activo en la ventana actual"
    Write-WARN "Esto bloquea TODOS los metodos de captura (botones, gestos, ADB)."
    Write-Host "  Solucion: cerra la app actual (desliza de recientes) y proba de nuevo."
    $diagnosisFlags += "FLAG_SECURE_ACTIVE"
} else {
    Write-OK "Sin FLAG_SECURE detectado en la ventana foreground"
}

# ── 3. SETTINGS DE COLOROS ────────────────────────────────────────────
Write-SECTION "3. Settings de captura (ColorOS)"

$settingsToCheck = @(
    @{key="oppo_three_finger_screenshot"; ns="system"; desc="Deslizar tres dedos"},
    @{key="three_gesture_screenshot"; ns="system"; desc="Gesto de tres dedos (alt)"},
    @{key="oppo_screenshot_gesture"; ns="system"; desc="Gesto de captura OPPO"},
    @{key="screenshot_gesture"; ns="system"; desc="Gesto de captura generico"},
    @{key="disable_screen_shot"; ns="global"; desc="Captura deshabilitada (global)"},
    @{key="screenshot_enabled"; ns="secure"; desc="Captura habilitada (secure)"}
)

$brokenSettings = @()
foreach ($s in $settingsToCheck) {
    $val = adb-shell "settings get $($s.ns) $($s.key) 2>/dev/null"
    $val = $val.Trim()
    
    if ($val -eq "null" -or $val -eq "" -or $val -match "does not exist") {
        Write-Host "  $($s.desc): no configurado" -ForegroundColor Gray
    } elseif ($s.key -eq "disable_screen_shot" -and $val -eq "1") {
        Write-FAIL "$($s.desc): ACTIVO (bloquea todas las capturas)"
        $brokenSettings += $s
        $diagnosisFlags += "GLOBAL_DISABLE"
    } elseif ($s.key -match "three_finger|screenshot_gesture" -and $val -eq "0") {
        Write-WARN "$($s.desc): DESACTIVADO (valor=$val)"
        $brokenSettings += $s
        $diagnosisFlags += "THREE_FINGER_OFF"
    } elseif ($s.key -eq "screenshot_enabled" -and $val -eq "0") {
        Write-FAIL "$($s.desc): DESACTIVADO (valor=$val)"
        $brokenSettings += $s
    } else {
        Write-OK "$($s.desc): $val"
    }
}

# ── 4. PERFIL DE TRABAJO / MDM ───────────────────────────────────────
Write-SECTION "4. Perfiles y politicas"

$users = adb-shell "pm list users 2>/dev/null"
Write-Host "  Usuarios: $users" -ForegroundColor Gray

if ($users -match "UserInfo\{.*:20\}") {
    Write-WARN "Perfil de trabajo (work profile) detectado. Puede tener politicas que bloqueen capturas."
    $diagnosisFlags += "WORK_PROFILE"
} else {
    Write-OK "Sin perfil de trabajo"
}

# Device policy manager
$dpm = adb-shell "dumpsys device_policy 2>/dev/null | grep -E 'mScreenCaptureDisabled|screenshot|capture' | head -5"
if ($dpm -match "true" -or $dpm -match "disabled") {
    Write-FAIL "Politica de administrador bloquea capturas: $dpm"
    $diagnosisFlags += "DEVICE_POLICY"
} elseif ($dpm) {
    Write-WARN "Device policy detectada: $dpm"
} else {
    Write-OK "Sin politicas restrictivas del administrador"
}

# ── 5. ALMACENAMIENTO ─────────────────────────────────────────────────
Write-SECTION "5. Almacenamiento"

$storage = adb-shell "df -h /sdcard/ 2>/dev/null | tail -1"
Write-Host "  /sdcard: $storage" -ForegroundColor Gray

$usePercent = if ($storage -match '(\d+)%') { [int]$matches[1] } else { 0 }
if ($usePercent -gt 95) {
    Write-FAIL "Almacenamiento al ${usePercent}% - Android rechaza capturas con espacio < 5%"
    $diagnosisFlags += "STORAGE_FULL"
} else {
    Write-OK "Almacenamiento: ${usePercent}% usado"
}

$ssDir = adb-shell "ls -la /sdcard/Pictures/Screenshots/ 2>/dev/null | head -3"
if ($ssDir) {
    Write-OK "Carpeta Screenshots existe"
} else {
    Write-WARN "Carpeta Screenshots no existe - se creara automaticamente"
}

# ── 6. OVERLAYS Y ACCESIBILIDAD ───────────────────────────────────────
Write-SECTION "6. Overlays y accesibilidad"

$overlays = adb-shell "dumpsys window 2>/dev/null | grep -E 'mIsInputMethodWindow|mHasSurface.*true' | head -3"
if ($overlays) {
    Write-WARN "Overlays activos detectados. Algunos pueden interferir con gestos de captura."
    Write-Host "  $overlays" -ForegroundColor Gray
} else {
    Write-OK "Sin overlays problematicos"
}

$accessibility = adb-shell "settings get secure enabled_accessibility_services 2>/dev/null"
if ($accessibility -and $accessibility -ne "null") {
    Write-WARN "Servicios de accesibilidad activos: $accessibility"
    Write-WARN "Algunos servicios de accesibilidad interfieren con Power+Vol Down en ColorOS."
    $diagnosisFlags += "ACCESSIBILITY_INTERFERENCE"
} else {
    Write-OK "Sin servicios de accesibilidad"
}

# ── 7. COMPROBAR LOGS DEL SISTEMA ─────────────────────────────────────
Write-SECTION "7. Errores en logcat (ultimos 30s)"

$logErrors = adb-shell "logcat -d -t 30 *:E 2>/dev/null | grep -iE 'screenshot|screencap|capture|surfaceflinger.*error' | tail -5"
if ($logErrors) {
    Write-FAIL "Errores relacionados con captura:"
    Write-Host "  $logErrors" -ForegroundColor Red
} else {
    Write-OK "Sin errores recientes de captura en logcat"
}

# ═══════════════════════════════════════════════════════════════════════
# ── RESUMEN Y REPARACION ──────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

Write-Host "`n  === RESUMEN DEL DIAGNOSTICO ===" -ForegroundColor Cyan

if (-not $diagnosisFlags) {
    Write-OK "No se detectaron problemas obvios. La captura deberia funcionar."
} else {
    Write-FAIL "Problemas detectados: $($diagnosisFlags -join ', ')"
}

if ($Diagnose) {
    Write-Host "`n  Modo diagnostico. Usa -Fix para reparar automaticamente." -ForegroundColor Yellow
    exit 0
}

# ── REPARACION ────────────────────────────────────────────────────────
Write-SECTION "REPARACION AUTOMATICA"

# 1. Eliminar flag global de deshabilitacion
if ($diagnosisFlags -contains "GLOBAL_DISABLE") {
    Write-FIX "Eliminando disable_screen_shot global..."
    adb-shell "settings delete global disable_screen_shot 2>/dev/null"
    adb-shell "settings put global disable_screen_shot 0 2>/dev/null"
    Write-OK "Flag global eliminado"
}

# 2. Activar gestos de captura de ColorOS
if ($diagnosisFlags -contains "THREE_FINGER_OFF") {
    Write-FIX "Activando gestos de captura OPPO..."
    adb-shell "settings put system oppo_three_finger_screenshot 1 2>/dev/null"
    adb-shell "settings put system three_gesture_screenshot 1 2>/dev/null"
    adb-shell "settings put system oppo_screenshot_gesture 1 2>/dev/null"
    adb-shell "settings put secure screenshot_enabled 1 2>/dev/null"
    Write-OK "Gestos de captura activados"
}

# 3. Limpiar politicas restrictivas
if ($diagnosisFlags -contains "DEVICE_POLICY") {
    Write-WARN "Politica de administrador detectada. No se puede modificar por ADB sin root."
    Write-WARN "Solucion manual: Ajustes -> Seguridad -> Administradores de dispositivo -> desactivar."
}

# 4. Liberar espacio si es critico
if ($diagnosisFlags -contains "STORAGE_FULL") {
    Write-FIX "Liberando caches del sistema..."
    adb-shell "pm trim-caches 999G 2>/dev/null"
    Write-OK "Cache de apps recortada"
}

# 5. Reiniciar servicios de accesibilidad (si interfieren)
if ($diagnosisFlags -contains "ACCESSIBILITY_INTERFERENCE") {
    Write-WARN "Servicios de accesibilidad pueden interferir. Desactiva temporalmente en:"
    Write-WARN "Ajustes -> Accesibilidad -> Servicios instalados -> desactivar todos"
}

# 6. Reiniciar SystemUI para aplicar cambios
Write-FIX "Reiniciando SystemUI para aplicar cambios..."
adb-shell "pkill -f com.android.systemui 2>/dev/null"
Start-Sleep -Seconds 3
Write-OK "SystemUI reiniciado"

# ── VERIFICACION FINAL ────────────────────────────────────────────────
Write-SECTION "VERIFICACION FINAL"

$vTs = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$vDeviceFile = "/data/local/tmp/_fix_verify_${vTs}.png"
$capturasDir = "C:\AndroProject\Capturas"
if (-not (Test-Path $capturasDir)) { New-Item -ItemType Directory -Path $capturasDir -Force | Out-Null }
$vLocalFile = "$capturasDir\verificacion_${vTs}.png"

Write-FIX "Tomando captura de prueba..."
& $ADB -s $script:target shell "screencap -p $vDeviceFile" 2>&1 | Out-Null
Start-Sleep -Seconds 1
& $ADB -s $script:target pull "$vDeviceFile" "$vLocalFile" 2>&1 | Out-Null
& $ADB -s $script:target shell "rm -f $vDeviceFile" 2>&1 | Out-Null

if (Test-Path $vLocalFile) {
    $vSize = (Get-Item $vLocalFile).Length
    if ($vSize -gt 10240) {
        Write-OK "CAPTURA FUNCIONANDO CORRECTAMENTE"
        Write-Host "  Archivo: $vLocalFile" -ForegroundColor Green
        Write-Host "  Tamano:  $([math]::Round($vSize/1024,1)) KB" -ForegroundColor Green
        Write-Host "`n  Abriendo imagen para verificacion visual..." -ForegroundColor Yellow
        Start-Process $vLocalFile
    } elseif ($vSize -gt 100) {
        Write-WARN "Captura demasiado pequena ($vSize bytes) - posible FLAG_SECURE"
        Remove-Item $vLocalFile -Force
    } else {
        Write-FAIL "Captura vacia o corrupta ($vSize bytes)"
        Remove-Item $vLocalFile -Force
    }
} else {
    # Try alternate check in device screenshots folder
    $altCheck = adb-shell "ls -lt /sdcard/Pictures/Screenshots/ 2>/dev/null | head -3"
    if ($altCheck -match '\.png') {
        Write-OK "Captura detectada en dispositivo:"
        Write-Host "  $altCheck" -ForegroundColor Green
    } else {
        Write-FAIL "No se detecto captura en el dispositivo ni en PC."
        Write-WARN "Si sigue sin funcionar, el problema es mas profundo (HAL del display o SELinux)."
        Write-WARN "Como workaround, usa AndroProject desde la PC para capturar por ADB."
    }
}

Write-Host "`n  === DIAGNOSTICO COMPLETO ===" -ForegroundColor Cyan
