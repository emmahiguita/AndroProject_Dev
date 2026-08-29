$AirPlayDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev\androproject-gui\bin\airplay"
Set-Location $AirPlayDir

# Cerrar instancias previas para liberar puertos 7000 y 7100
taskkill /F /IM "AirPlayServer.exe" 2>$null
taskkill /F /IM "uxplay-windows.exe" 2>$null

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ANDROPROJECT — PROYECTOR NATIVO DE ESCRITORIO iOS" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# Iniciar proceso nativo de proyección Direct3D / SDL2 en el escritorio interactivo
$proc = Start-Process -FilePath ".\AirPlayServer.exe" -WorkingDirectory $AirPlayDir -PassThru

Write-Host "`n✅ Proyector nativo iOS (AirPlay 2) iniciado con PID: $($proc.Id)" -ForegroundColor Green
Write-Host "📱 En tu iPhone: Centro de Control -> Duplicar Pantalla -> 'AndroProject [PC]'" -ForegroundColor Yellow
Write-Host "La ventana nativa de duplicación aparecerá directamente en tu pantalla.`n" -ForegroundColor Cyan
