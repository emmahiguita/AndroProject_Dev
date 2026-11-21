$ErrorActionPreference = "SilentlyContinue"

$ProjectDir  = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev"
$GuiDir      = Join-Path $ProjectDir "androproject-gui"
$AirPlayDir  = Join-Path $GuiDir "bin\airplay"
$AirPlayExe  = Join-Path $AirPlayDir "AirPlayServer.exe"
$LauncherPs1 = Join-Path $ProjectDir "launch_native_ios_projector.ps1"
$DesktopDir  = [Environment]::GetFolderPath("Desktop")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR OFICIAL - ANDROPROJECT iOS PROYECTOR NATIVO" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Crear accesos directos en el Escritorio de Windows
$WshShell = New-Object -ComObject WScript.Shell

$ShortcutMobile = $WshShell.CreateShortcut((Join-Path $DesktopDir "AndroProject iOS Proyector (Audio Celular).lnk"))
$ShortcutMobile.TargetPath = "powershell.exe"
$ShortcutMobile.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPs1`""
$ShortcutMobile.WorkingDirectory = $ProjectDir
$ShortcutMobile.IconLocation = "$AirPlayExe,0"
$ShortcutMobile.Description = "Proyector Nativo iOS AirPlay 2 (Audio en el Celular por defecto)"
$ShortcutMobile.Save()

$ShortcutPc = $WshShell.CreateShortcut((Join-Path $DesktopDir "AndroProject iOS Proyector (Audio en PC).lnk"))
$ShortcutPc.TargetPath = "powershell.exe"
$ShortcutPc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPs1`" -EnablePcAudio"
$ShortcutPc.WorkingDirectory = $ProjectDir
$ShortcutPc.IconLocation = "$AirPlayExe,0"
$ShortcutPc.Description = "Proyector Nativo iOS AirPlay 2 (Audio Opcional en el PC)"
$ShortcutPc.Save()

Write-Host "[OK] Accesos directos creados en el Escritorio:" -ForegroundColor Green
Write-Host "     - AndroProject iOS Proyector (Audio Celular).lnk" -ForegroundColor Gray
Write-Host "     - AndroProject iOS Proyector (Audio en PC).lnk" -ForegroundColor Gray

# 2. Registrar en Inicio Automatico de Windows (HKCU Run) para que siempre este activo
$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RunCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPs1`""
Set-ItemProperty -Path $RunKey -Name "AndroProject_iOS_Projector" -Value $RunCmd -Force
Write-Host "[OK] Servicio registrado en el Inicio Automático de Windows (HKCU\...\Run)." -ForegroundColor Green

# 3. Iniciar ahora mismo el Proyector Nativo iOS + Broadcaster Multi-Red (Wi-Fi + Red de Datos + Ethernet)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $LauncherPs1

# 4. Asegurar que el panel web de AndroProject (Puerto 3001) tambien este activo
$port3001 = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if (-not $port3001) {
  $startup = New-CimInstance -ClassName Win32_ProcessStartup -Property @{ ShowWindow = [uint16]0 } -ClientOnly
  $guiCmd = "cmd.exe /c `"cd /d `"$GuiDir`" && `"C:\Program Files\nodejs\npm.cmd`" run dev -- -p 3001`""
  $null = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
      CommandLine = $guiCmd
      CurrentDirectory = $GuiDir
      ProcessStartupInformation = $startup
  }
  Write-Host "[OK] Servidor Web AndroProject GUI iniciando en http://localhost:3001" -ForegroundColor Green
} else {
  Write-Host "[OK] Servidor Web AndroProject GUI activo en http://localhost:3001" -ForegroundColor Green
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETADA Y SERVICIO EN EJECUCION" -ForegroundColor Green
Write-Host "==========================================================`n" -ForegroundColor Cyan
