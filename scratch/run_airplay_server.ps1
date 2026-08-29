$AirPlayDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev\androproject-gui\bin\airplay"
$AirPlayExe = Join-Path $AirPlayDir "AirPlayServer.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " INICIANDO AIRPLAYSERVER (MOTOR NATIVO AIRPLAY 2)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

taskkill /F /IM "AirPlayServer.exe" 2>$null
taskkill /F /IM "uxplay-windows.exe" 2>$null

Set-Location $AirPlayDir
$p = Start-Process -FilePath $AirPlayExe -WorkingDirectory $AirPlayDir -PassThru

Write-Host "AirPlayServer iniciado con PID: $($p.Id)" -ForegroundColor Green
Write-Host "Listo. Conecte su iPhone desde Centro de Control -> Duplicar Pantalla -> AndroProject [PC]" -ForegroundColor Yellow
