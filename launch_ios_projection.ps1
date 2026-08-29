# ── AndroProject / DexterAnd — Lanzador de Pantalla de Proyección iOS ──────────
# Abre la ventana de proyección dedicada del iPhone en el escritorio de Windows.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AirPlayDir = Join-Path $ScriptDir "androproject-gui\bin\airplay"
$AirPlayExe = Join-Path $AirPlayDir "AirPlayServer.exe"
$UxPlayExe = Join-Path $AirPlayDir "uxplay-windows.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🍏 ANDROPROJECT — VISOR DE PROYECCIÓN iOS / AIRPLAY 60 FPS" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Iniciar servidor AirPlay Bonjour en segundo plano
Write-Host "`n[1/2] Verificando servicio de recepción AirPlay..." -ForegroundColor Yellow
$AirPlayRunning = Get-Process -Name AirPlayServer, uxplay-windows -ErrorAction SilentlyContinue

if (-not $AirPlayRunning) {
    if (Test-Path $AirPlayExe) {
        Write-Host " -> Iniciando AirPlayServer nativo en puerto 7000..." -ForegroundColor Gray
        Start-Process -FilePath $AirPlayExe -WorkingDirectory $AirPlayDir
    }
} else {
    Write-Host " -> Servidor AirPlay nativo ya activo." -ForegroundColor Green
}

# 2. Desplegar ventana interactiva en el escritorio
Write-Host "[2/2] Desplegando ventana de proyección en el escritorio..." -ForegroundColor Yellow
$AppUrl = "http://localhost:3001/popout?device=ios"

$ChromePath = (Get-Command chrome.exe -ErrorAction SilentlyContinue).Source
if ($ChromePath) {
    Start-Process chrome.exe -ArgumentList "--app=$AppUrl", "--window-size=480,980", "--window-position=1150,40"
    Write-Host " -> Ventana flotante de proyección iOS desplegada con éxito." -ForegroundColor Green
} else {
    Start-Process $AppUrl
    Write-Host " -> Abierto en navegador predeterminado." -ForegroundColor Green
}

Write-Host "`n✅ ¡Listo! Conecta tu iPhone desde el Centro de Control -> Duplicar Pantalla -> AndroProject [PC]`n" -ForegroundColor Cyan
