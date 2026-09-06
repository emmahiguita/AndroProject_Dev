# ============================================================================
# AndroProject -- Arranque Automatizado
# Abre Backend + Frontend en ventanas independientes y el navegador.
# Uso:  .\start.ps1   o   doble clic en start.bat
# ============================================================================

$ROOT = $PSScriptRoot
$BACKEND_BAT = Join-Path $ROOT "run_backend.bat"
$FRONTEND_BAT = Join-Path $ROOT "run_desktop.bat"

# Puertos configurables (centralizar para evitar inconsistencias)
$BACKEND_PORT = 8000
$FRONTEND_PORT = 3001

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "    AndroProject -- Arranque Automatizado" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# -- Limpiar puertos ocupados y procesos electron/node --
Write-Host "  Limpiando puertos y procesos previos..." -ForegroundColor DarkGray
foreach ($port in @($BACKEND_PORT, $FRONTEND_PORT)) {
    $line = netstat -ano 2>$null | Select-String ":$port .*LISTENING"
    if ($line) {
        $pidStr = ($line -split '\s+')[-1]
        try { Stop-Process -Id ([int]$pidStr) -Force -ErrorAction SilentlyContinue } catch {}
    }
}
try { Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 1

# -- Iniciar Backend (ventana cmd independiente) --
Write-Host "  Backend  :$BACKEND_PORT " -NoNewline
Start-Process "cmd.exe" -ArgumentList "/c", "`"$BACKEND_BAT`"" -WorkingDirectory $ROOT -WindowStyle Hidden

# -- Iniciar Frontend Desktop App (ventana cmd independiente) --
Write-Host "  Desktop  :$FRONTEND_PORT " -NoNewline
Start-Process "cmd.exe" -ArgumentList "/c", "`"$FRONTEND_BAT`"" -WorkingDirectory $ROOT -WindowStyle Hidden

# -- Health checks --
Write-Host ""
Write-Host "  Esperando servicios..." -ForegroundColor Yellow

$beUp = $false; $feUp = $false; $max = 90; $t = 0
while ((-not $beUp -or -not $feUp) -and $t -lt $max) {
    Start-Sleep -Seconds 3; $t += 3
    if (-not $beUp) {
        try { $r = Invoke-RestMethod "http://127.0.0.1:$BACKEND_PORT/health" -ErrorAction Stop -TimeoutSec 2
              if ($r.status -eq "healthy") { Write-Host "    Backend  listo (v$($r.version)) en ${t}s" -ForegroundColor Green; $beUp = $true } } catch {}
    }
    if (-not $feUp) {
        try { $r = Invoke-WebRequest "http://127.0.0.1:$FRONTEND_PORT" -ErrorAction Stop -TimeoutSec 2 -UseBasicParsing
              if ($r.StatusCode -eq 200) { Write-Host "    Desktop  listo en ${t}s" -ForegroundColor Green; $feUp = $true } } catch {}
    }
}

# -- Resultado --
Write-Host ""
if ($beUp -and $feUp) {
    Write-Host "  === SISTEMA INICIADO EN http://127.0.0.1:$FRONTEND_PORT ===" -ForegroundColor Green
    try {
        explorer.exe "http://127.0.0.1:$FRONTEND_PORT"
    } catch {}
} else {
    if (-not $beUp) { Write-Host "  Backend NO respondio - revisa la ventana de comandos" -ForegroundColor Red }
    if (-not $feUp) { Write-Host "  Desktop App (Electron) NO respondio - revisa la ventana de comandos" -ForegroundColor Red }
    # Abrir navegador de todas formas como fallback si al menos uno respondio
    if ($beUp -or $feUp) {
        try { explorer.exe "http://127.0.0.1:$FRONTEND_PORT" } catch {}
    }
}
Write-Host "  App Port  : http://127.0.0.1:$FRONTEND_PORT" -ForegroundColor DarkGray
Write-Host "  Health    : http://127.0.0.1:$BACKEND_PORT/health" -ForegroundColor DarkGray
Write-Host "  Detener   : stop.bat" -ForegroundColor DarkGray
Write-Host ""
