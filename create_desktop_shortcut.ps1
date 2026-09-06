$WshShell = New-Object -ComObject WScript.Shell
$Root = $PSScriptRoot
$Root = $PSScriptRoot
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "Proyectar Movil.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$Root\launch_a30.ps1`""
$Shortcut.WorkingDirectory = $Root

$scrcpyPath = "C:\Users\emman\AppData\Local\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe"
if (Test-Path $scrcpyPath) {
    $Shortcut.IconLocation = "$scrcpyPath,0"
} else {
    $Shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,26"
}

$Shortcut.Description = "Lanzador automatico de proyeccion en vivo scrcpy"
$Shortcut.Save()

Write-Host "[EXITO] Acceso directo creado en: $ShortcutPath" -ForegroundColor Green
