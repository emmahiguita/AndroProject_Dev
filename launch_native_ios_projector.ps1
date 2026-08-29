$ErrorActionPreference = "SilentlyContinue"

$ProjectDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev"
$AirPlayDir = Join-Path $ProjectDir "androproject-gui\bin\airplay"
$DaemonScript = Join-Path $AirPlayDir "daemon.js"
$env:PATH = "$AirPlayDir;$AirPlayDir\lib;$env:PATH"

# Cerrar instancias previas para liberar puertos 7000 y 7100
Stop-Process -Name "AirPlayServer" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "uxplay-windows" -Force -ErrorAction SilentlyContinue

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ANDROPROJECT - PROYECTOR NATIVO DE ESCRITORIO iOS" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$proc = Start-Process node -ArgumentList "`"$DaemonScript`"" -WorkingDirectory $AirPlayDir -WindowStyle Hidden -PassThru

Write-Host "[OK] Proyector nativo iOS (AirPlay 2) iniciado con PID: $($proc.Id)" -ForegroundColor Green
Write-Host "[INFO] En tu iPhone: Centro de Control -> Duplicar Pantalla -> 'AndroProject [PC]'" -ForegroundColor Yellow
Write-Host "[INFO] La ventana de duplicacion aparecera directamente en tu pantalla.`n" -ForegroundColor Cyan
