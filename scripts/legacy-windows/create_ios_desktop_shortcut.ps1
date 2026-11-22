$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "Proyectar iPhone iOS (Direct3D).lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

$ProjectDir = "c:\Users\emman\Desktop\Proyectos\AndroProject_Dev"
$LauncherScript = Join-Path $ProjectDir "launch_native_ios_projector.ps1"
$AirPlayExe = Join-Path $ProjectDir "androproject-gui\bin\airplay\AirPlayServer.exe"

$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -NoProfile -File `"$LauncherScript`""
$Shortcut.WorkingDirectory = $ProjectDir

if (Test-Path $AirPlayExe) {
    $Shortcut.IconLocation = "$AirPlayExe,0"
} else {
    $Shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,18"
}

$Shortcut.Description = "Proyector Nativo iOS Direct3D 11 / AirPlay 2 - AndroProject"
$Shortcut.Save()

Write-Host "[EXITO] Acceso directo para iPhone iOS creado en el escritorio:" -ForegroundColor Green
Write-Host "-> $ShortcutPath" -ForegroundColor Yellow
