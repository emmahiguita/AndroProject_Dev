# ============================================================================
# AndroProject -- Detener todos los servicios
# ============================================================================

Write-Host "=== Deteniendo AndroProject... ===" -ForegroundColor Yellow

$stopped = 0
# Puertos (deben coincidir con los usados por start.ps1)
$BACKEND_PORT = 8000
$FRONTEND_PORT = 3001
$ports = @($BACKEND_PORT, $FRONTEND_PORT)

foreach ($port in $ports) {
    $conn = netstat -ano 2>$null | Select-String ":$port .*LISTENING"
    if ($conn) {
        $pidStr = ($conn -split '\s+')[-1]
        try {
            $proc = Get-Process -Id ([int]$pidStr) -ErrorAction SilentlyContinue
            if ($proc) {
                $procName = $proc.ProcessName
                Stop-Process -Id ([int]$pidStr) -Force -ErrorAction SilentlyContinue
                Write-Host "  Detenido $procName (PID $pidStr, puerto $port)" -ForegroundColor Green
                $stopped++
            }
        } catch {
            # proceso ya muerto
        }
    }
}

# Limpiar procesos electron y AndroProject adicionales si los hay
try {
    $electronProcs = Get-Process -Name "electron" -ErrorAction SilentlyContinue
    if ($electronProcs) {
        Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
        Write-Host "  Detenidos procesos de Electron." -ForegroundColor Green
        $stopped++
    }
} catch {}

try {
    $scrcpyProcs = Get-Process -Name "AndroProject" -ErrorAction SilentlyContinue
    if ($scrcpyProcs) {
        Stop-Process -Name "AndroProject" -Force -ErrorAction SilentlyContinue
        Write-Host "  Detenidos procesos de AndroProject/Scrcpy." -ForegroundColor Green
        $stopped++
    }
} catch {}

if ($stopped -eq 0) {
    Write-Host "  No se encontraron servicios corriendo." -ForegroundColor DarkGray
}

Write-Host "Listo." -ForegroundColor Gray

