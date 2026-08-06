# ============================================================================
# Crea los accesos directos de AndroProject en el Escritorio
# ============================================================================

$ROOT = $PSScriptRoot
$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath("Desktop")

# Ruta al icono
$iconPath = Join-Path $ROOT "androproject-gui\public\icon.ico"
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $ROOT "androproject-gui\public\icon.png"
}
$androIcon = "C:\AndroProject\AndroProject.ico"
if (Test-Path $androIcon) {
    $iconPath = $androIcon
}

# Eliminar acceso directo viejo no especifico si existe
$oldShortcut = Join-Path $Desktop "AndroProject.lnk"
if (Test-Path $oldShortcut) {
    Remove-Item $oldShortcut -Force -ErrorAction SilentlyContinue
}

# 1. Acceso directo principal: Dashboard (Backend + App)
$s1Path = Join-Path $Desktop "AndroProject Dashboard.lnk"
$s1 = $WshShell.CreateShortcut($s1Path)
$s1.TargetPath = Join-Path $ROOT "start.bat"
$s1.WorkingDirectory = $ROOT
$s1.Description = "AndroProject v2.1.0 - Panel de Control (Backend + Desktop App)"
if (Test-Path $iconPath) { $s1.IconLocation = $iconPath }
$s1.Save()

# 2. Acceso directo: Scrcpy USB (Cable)
$s2Path = Join-Path $Desktop "AndroProject Scrcpy (Cable).lnk"
$s2 = $WshShell.CreateShortcut($s2Path)
if (Test-Path "C:\AndroProject\iniciar_scrcpy.bat") {
    $s2.TargetPath = "C:\AndroProject\iniciar_scrcpy.bat"
    $s2.WorkingDirectory = "C:\AndroProject"
} else {
    $s2.TargetPath = Join-Path $ROOT "AndroProject_Installer\src\iniciar_scrcpy.bat"
    $s2.WorkingDirectory = Join-Path $ROOT "AndroProject_Installer\src"
}
$s2.Description = "Transmision de Pantalla por Cable USB (Multi-Dispositivo)"
if (Test-Path $iconPath) { $s2.IconLocation = $iconPath }
$s2.Save()

# 3. Acceso directo: Wi-Fi Magico
$s3Path = Join-Path $Desktop "AndroProject Wi-Fi Magico.lnk"
$s3 = $WshShell.CreateShortcut($s3Path)
if (Test-Path "C:\AndroProject\iniciar_wifi_magico.bat") {
    $s3.TargetPath = "C:\AndroProject\iniciar_wifi_magico.bat"
    $s3.WorkingDirectory = "C:\AndroProject"
} else {
    $s3.TargetPath = Join-Path $ROOT "AndroProject_Installer\src\iniciar_wifi_magico.bat"
    $s3.WorkingDirectory = Join-Path $ROOT "AndroProject_Installer\src"
}
$s3.Description = "Conexion Inalambrica Automatizada por Wi-Fi"
if (Test-Path $iconPath) { $s3.IconLocation = $iconPath }
$s3.Save()

# 4. Acceso directo: Wi-Fi Sin Cable
$s4Path = Join-Path $Desktop "AndroProject Wi-Fi Sin Cable.lnk"
$s4 = $WshShell.CreateShortcut($s4Path)
if (Test-Path "C:\AndroProject\iniciar_scrcpy_sin_cable.bat") {
    $s4.TargetPath = "C:\AndroProject\iniciar_scrcpy_sin_cable.bat"
    $s4.WorkingDirectory = "C:\AndroProject"
} else {
    $s4.TargetPath = Join-Path $ROOT "AndroProject_Installer\src\iniciar_scrcpy_sin_cable.bat"
    $s4.WorkingDirectory = Join-Path $ROOT "AndroProject_Installer\src"
}
$s4.Description = "Transmision Inalambrica Directa (Sin Cable)"
if (Test-Path $iconPath) { $s4.IconLocation = $iconPath }
$s4.Save()

Write-Host ""
Write-Host "  Accesos directos actualizados en el Escritorio:" -ForegroundColor Green
Write-Host "   1. AndroProject Dashboard.lnk" -ForegroundColor White
Write-Host "   2. AndroProject Scrcpy (Cable).lnk" -ForegroundColor White
Write-Host "   3. AndroProject Wi-Fi Magico.lnk" -ForegroundColor White
Write-Host "   4. AndroProject Wi-Fi Sin Cable.lnk" -ForegroundColor White
Write-Host ""
