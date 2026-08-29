$ErrorActionPreference = "SilentlyContinue"

$AirPlayDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev\androproject-gui\bin\airplay"
$AirPlayExe = Join-Path $AirPlayDir "AirPlayServer.exe"
$env:PATH = "$AirPlayDir;$AirPlayDir\lib;$env:PATH"

# Cerrar instancias previas para liberar puertos 7000 y 7100
Stop-Process -Name "AirPlayServer" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "uxplay-windows" -Force -ErrorAction SilentlyContinue

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ANDROPROJECT - PROYECTOR NATIVO DE ESCRITORIO iOS" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

if (Test-Path $AirPlayExe) {
    $proc = Start-Process -FilePath $AirPlayExe -WorkingDirectory $AirPlayDir -PassThru
    Write-Host "[OK] Proyector nativo iOS (AirPlay 2) iniciado con PID: $($proc.Id)" -ForegroundColor Green
    Write-Host "[INFO] En tu iPhone: Centro de Control -> Duplicar Pantalla -> 'AndroProject [PC]'" -ForegroundColor Yellow
    Write-Host "[INFO] La ventana de duplicacion aparecera directamente en tu pantalla.`n" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] No se encontro AirPlayServer.exe en $AirPlayExe" -ForegroundColor Red
}
