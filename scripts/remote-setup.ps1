# ── AndroProject Remote Access Setup ───────────────────────────────
# Configura: Tailscale + TURN server + Cloudflare Tunnel
# Ejecutar como Administrador

param(
    [switch]$Tailscale,
    [switch]$TURN,
    [switch]$Cloudflare,
    [switch]$All
)

if (-not $Tailscale -and -not $TURN -and -not $Cloudflare) { $All = $true }

$ErrorActionPreference = "Continue"

# ── 1. TAILSCALE ──────────────────────────────────────────────────
if ($Tailscale -or $All) {
    Write-Host "=== TAILSCALE ===" -ForegroundColor Cyan
    $tsPath = "$env:ProgramFiles\Tailscale\tailscale.exe"
    if (-not (Test-Path $tsPath)) {
        Write-Host "Descargando Tailscale..." -ForegroundColor Yellow
        $url = "https://pkgs.tailscale.com/stable/tailscale-ipn-setup-amd64.msi"
        $out = "$env:TEMP\tailscale.msi"
        Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
        Start-Process msiexec -ArgumentList "/i `"$out`" /quiet /norestart" -Wait
        Write-Host "Tailscale instalado. Inicia sesion con:" -ForegroundColor Green
        Write-Host "  tailscale login" -ForegroundColor White
    } else {
        Write-Host "Tailscale ya instalado en: $tsPath" -ForegroundColor Green
    }
    Write-Host ""
}

# ── 2. TURN SERVER (coturn) ───────────────────────────────────────
if ($TURN -or $All) {
    Write-Host "=== TURN SERVER ===" -ForegroundColor Cyan
    $turnDir = "C:\AndroProject\turn"
    New-Item -ItemType Directory -Path $turnDir -Force | Out-Null

    # Config para coturn (Docker)
    $turnConfig = @"
listening-port=3478
fingerprint
lt-cred-mech
user=andro:andro123
realm=androproject.local
total-quota=100
bps-capacity=0
stale-nonce
no-multicast-peers
"@
    Set-Content -Path "$turnDir\turnserver.conf" -Value $turnConfig -Encoding ASCII

    Write-Host "TURN config creada en: $turnDir\turnserver.conf" -ForegroundColor Green
    Write-Host "Para iniciar TURN server via Docker:" -ForegroundColor Yellow
    Write-Host "  docker run -d --name coturn --network host -v $turnDir\turnserver.conf:/etc/coturn/turnserver.conf coturn/coturn" -ForegroundColor White
    Write-Host ""

    # Configurar variables de entorno para el backend
    $envVars = @"
TURN_SERVER_URL=turn:127.0.0.1:3478
TURN_USERNAME=andro
TURN_CREDENTIAL=andro123
"@
    Set-Content -Path "$turnDir\.env" -Value $envVars -Encoding ASCII
    Write-Host "Variables de entorno para backend en: $turnDir\.env" -ForegroundColor Green
}

# ── 3. CLOUDFLARE TUNNEL ─────────────────────────────────────────
if ($Cloudflare -or $All) {
    Write-Host "=== CLOUDFLARE TUNNEL ===" -ForegroundColor Cyan
    $cfPath = "C:\AndroProject\temp\cloudflared.exe"
    
    if (Test-Path $cfPath) {
        # Instalar como servicio
        & $cfPath service install 2>$null
        
        Write-Host "cloudflared instalado como servicio." -ForegroundColor Green
        Write-Host "Para configurar el tunnel:" -ForegroundColor Yellow
        Write-Host "1. cloudflared tunnel login (abre navegador)" -ForegroundColor White
        Write-Host "2. cloudflared tunnel create androproject" -ForegroundColor White
        Write-Host "3. cloudflared tunnel route dns androproject androproject.tudominio.com" -ForegroundColor White
        Write-Host ""
        Write-Host "Servidores locales que expone:" -ForegroundColor Cyan
        Write-Host "  - FastAPI: localhost:8000" -ForegroundColor White
        Write-Host "  - Next.js: localhost:3001" -ForegroundColor White
        Write-Host "  - VNC:    localhost:5901" -ForegroundColor White
    } else {
        Write-Host "cloudflared no encontrado. Descargalo de:" -ForegroundColor Red
        Write-Host "  https://github.com/cloudflare/cloudflared/releases" -ForegroundColor White
    }
}

Write-Host "`n=== CONEXION REMOTA - RESUMEN ===" -ForegroundColor Magenta
Write-Host "1. Tailscale: Red privada WireGuard entre PC y celular" -ForegroundColor White
Write-Host "   - Instalar en celular: Play Store > Tailscale" -ForegroundColor White
Write-Host "   - Ambos dispositivos en la misma cuenta = IP estable" -ForegroundColor White
Write-Host ""
Write-Host "2. TURN Server: Relay para WebRTC cuando no hay P2P" -ForegroundColor White
Write-Host "   - Requiere Docker o VPS" -ForegroundColor White
Write-Host "   - Configurar TURN_SERVER_URL en .env del backend" -ForegroundColor White
Write-Host ""
Write-Host "3. Cloudflare Tunnel: Acceso web desde cualquier lugar" -ForegroundColor White
Write-Host "   - Sin abrir puertos en el router" -ForegroundColor White
Write-Host "   - Accedes via: https://androproject.tudominio.com" -ForegroundColor White
