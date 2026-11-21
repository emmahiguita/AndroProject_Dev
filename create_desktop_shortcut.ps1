$WshShell = New-Object -ComObject WScript.Shell
$Root = $PSScriptRoot
$Desktop = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "Proyectar Movil.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$Root\launch_a30.ps1`""
$Shortcut.WorkingDirectory = $Root

# Resolucion rapida del icono
$iconCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1\scrcpy.exe'),
    (Join-Path $Root 'androproject-gui\public\icon.ico'),
    'C:\AndroProject\AndroProject.exe',
    'C:\AndroProject\scrcpy.exe',
    'C:\AndroProject\AndroProject.ico'
)
$scrcpyIcon = $iconCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $scrcpyIcon) {
    $wingetPkgs = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetPkgs) {
        $found = Get-ChildItem -Path $wingetPkgs -Filter 'scrcpy.exe' -Recurse -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($found) { $scrcpyIcon = $found.FullName }
    }
}
if ($scrcpyIcon) {
    $Shortcut.IconLocation = "$scrcpyIcon,0"
} else {
    $Shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,26"
}

$Shortcut.Description = "Proyeccion en vivo de pantalla Android (Direct3D11 - AndroProject)"
$Shortcut.Save()
Write-Host "[EXITO] Acceso directo 'Proyectar Movil.lnk' actualizado en el Escritorio: $ShortcutPath" -ForegroundColor Green

# 2. Acceso directo: Proyectar Multiples Moviles simultaneamente
$MultiShortcutPath = Join-Path $Desktop "Proyectar Multi-Moviles.lnk"
$MultiShortcut = $WshShell.CreateShortcut($MultiShortcutPath)
$MultiShortcut.TargetPath = "powershell.exe"
$MultiShortcut.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$Root\launch_a30.ps1`" -Multi"
$MultiShortcut.WorkingDirectory = $Root
if ($scrcpyIcon) {
    $MultiShortcut.IconLocation = "$scrcpyIcon,0"
} else {
    $MultiShortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,26"
}
$MultiShortcut.Description = "Proyeccion simultanea de multiples telefonos lado a lado"
$MultiShortcut.Save()
Write-Host "[EXITO] Acceso directo 'Proyectar Multi-Moviles.lnk' creado en el Escritorio: $MultiShortcutPath" -ForegroundColor Green


