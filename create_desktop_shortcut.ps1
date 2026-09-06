$WshShell = New-Object -ComObject WScript.Shell
$Root = $PSScriptRoot
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "Proyectar Movil.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$Root\launch_a30.ps1`""
$Shortcut.WorkingDirectory = $Root

# Resolución dinámica del ícono de scrcpy/AndroProject
$iconCandidates = @(
    'C:\AndroProject\AndroProject.exe',
    'C:\AndroProject\scrcpy.exe'
)
$scrcpyIcon = $iconCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $scrcpyIcon) {
    $wingetPkgs = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    $found = Get-ChildItem -Path $wingetPkgs -Filter 'scrcpy.exe' -Recurse -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $scrcpyIcon = if ($found) { $found.FullName } else { $null }
}
if ($scrcpyIcon) {
    $Shortcut.IconLocation = "$scrcpyIcon,0"
} else {
    $Shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,26"
}

$Shortcut.Description = "Lanzador automatico de proyeccion en vivo scrcpy"
$Shortcut.Save()

Write-Host "[EXITO] Acceso directo creado en: $ShortcutPath" -ForegroundColor Green
