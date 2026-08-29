$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ESTADO COMPLETO DEL STACK ANDROPROJECT / DEXTERAND" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Next.js / Electron UI
try {
    $resGui = Invoke-RestMethod -Uri "http://localhost:3001/api/device" -TimeoutSec 3
    Write-Host "[OK] Dashboard Next.js / Electron (Puerto 3001): Activo" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Dashboard Next.js / Electron: Reiniciando..." -ForegroundColor Yellow
}

# 2. AirPlay 2 Receiver
try {
    $resAir = Invoke-RestMethod -Uri "http://localhost:3001/api/airplay" -TimeoutSec 3
    Write-Host "[OK] Servidor AirPlay 2: Activo como $($resAir.status.serverName) (Puerto $($resAir.status.port))" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Servidor AirPlay 2: En espera" -ForegroundColor Yellow
}

# 3. Python Backend
try {
    $resPy = Invoke-WebRequest -Uri "http://localhost:8000/" -TimeoutSec 3
    Write-Host "[OK] Backend Python Vision/Rescue (Puerto 8000): Activo" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Backend Python: En espera" -ForegroundColor Yellow
}

# 4. Procesos del Sistema
Write-Host "`nProcesos Activos en Memoria:" -ForegroundColor Cyan
Get-Process AirPlayServer, scrcpy, adb, node, electron -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, SessionId, WorkingSet64 | Format-Table -AutoSize
