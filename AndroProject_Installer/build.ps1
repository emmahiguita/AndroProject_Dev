# =============================================================
#  build.ps1 - Constructor del Instalador de AndroProject
#  Uso: Doble clic en build.ps1 o ejecutar desde PowerShell
# =============================================================

$ErrorActionPreference = "Stop"
$InstallerDir = $PSScriptRoot
$GuiDir       = Join-Path $InstallerDir "..\androproject-gui"
$OutputDir    = Join-Path $InstallerDir "output"
$TempDir      = Join-Path $InstallerDir "temp_build"

# Detectar carpeta de scrcpy (WinGet v4.1, C:\AndroProject o Downloads v4.0)
$Candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1",
    "C:\AndroProject",
    "C:\Users\emman\Downloads\scrcpy-win64-v4.0"
)
$SourceReleaseDir = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

Set-Location $InstallerDir

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Constructor del Instalador AndroProject v1.0" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- PASO 1: Limpiar output anterior ---
Write-Host "[1/5] Limpiando archivos anteriores..." -ForegroundColor Yellow
if (Test-Path "AndroProject_data.zip") { Remove-Item "AndroProject_data.zip" -Force }
if (Test-Path "$OutputDir\Instalador_AndroProject.exe") { Remove-Item "$OutputDir\Instalador_AndroProject.exe" -Force }
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
Write-Host "      > Limpieza completada." -ForegroundColor Green

# --- PASO 2: Preparar archivos con nombre AndroProject ---
Write-Host ""
Write-Host "[2/5] Preparando archivos sin redundancia y renombrando..." -ForegroundColor Yellow
if (-not (Test-Path $SourceReleaseDir)) {
    Write-Host "      ERROR: No se encontro la carpeta de release: $SourceReleaseDir" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
Copy-Item "$SourceReleaseDir\*" "$TempDir\" -Recurse -Force

# Renombrar los ejecutables y archivos para que digan AndroProject en vez de scrcpy
$RenameMap = @{
    "scrcpy.exe" = "AndroProject.exe"
    "scrcpy-noconsole.vbs" = "AndroProject-noconsole.vbs"
    "scrcpy-noconsole.exe" = "AndroProject-noconsole.exe"
    "scrcpy-server" = "AndroProject-server"
}

foreach ($key in $RenameMap.Keys) {
    if (Test-Path "$TempDir\$key") {
        Rename-Item "$TempDir\$key" $RenameMap[$key] -Force
    }
}

if (Test-Path "$GuiDir\public\icon.ico") {
    Copy-Item "$GuiDir\public\icon.ico" "$TempDir\AndroProject.ico" -Force
}
if (Test-Path "$GuiDir\public\logo.png") {
    Copy-Item "$GuiDir\public\logo.png" "$TempDir\AndroProject.png" -Force
} elseif (Test-Path "$TempDir\scrcpy.png") {
    Copy-Item "$TempDir\scrcpy.png" "$TempDir\AndroProject.png" -Force
}
Write-Host "      > Archivos, logo e icono oficial copiados correctamente." -ForegroundColor Green


# --- PASO 3: Compilar y empaquetar GUI (Dashboard Tauri / Next.js) ---
Write-Host ""
Write-Host "[3/5] Compilando Dashboard (Tauri + Next.js)..." -ForegroundColor Yellow
if (Test-Path "$GuiDir") {
    Push-Location $GuiDir
    Write-Host "      > Ejecutando npm run tauri:build en $GuiDir..." -ForegroundColor Cyan
    npm run tauri:build
    Pop-Location
    $TauriExe = Get-ChildItem -Path "$GuiDir\src-tauri\target\release" -Filter "*.exe" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch 'uninstall|setup' } | Select-Object -First 1
    if ($TauriExe) {
        Write-Host "      > Copiando GUI compilada ($($TauriExe.Name)) al instalador..." -ForegroundColor Green
        New-Item -ItemType Directory -Force -Path "$TempDir\Dashboard" | Out-Null
        Copy-Item $TauriExe.FullName "$TempDir\Dashboard\AndroProject.exe" -Force
    } else {
        Write-Host "      ERROR: No se encontro el binario Tauri compilado en src-tauri\target\release." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "      ERROR: No se encontro la carpeta androproject-gui" -ForegroundColor Red
    exit 1
}

# --- PASO 4: Comprimir los binarios de la app ---
Write-Host ""
Write-Host "[4/5] Empaquetando binarios de la aplicacion..." -ForegroundColor Yellow
# Comprimimos todos los archivos dentro de temp_build (para que quede plano sin redundancia)
Compress-Archive -Path "$TempDir\*" -DestinationPath "AndroProject_data.zip" -Force
$ZipSize = [math]::Round((Get-Item "AndroProject_data.zip").Length / 1MB, 2)
Write-Host "      > AndroProject_data.zip creado ($ZipSize MB)" -ForegroundColor Green


# --- PASO 4: Compilar el .exe con IExpress ---
Write-Host ""
Write-Host "[4/5] Compilando Instalador_AndroProject.exe con IExpress..." -ForegroundColor Yellow
Start-Process -FilePath "iexpress.exe" -ArgumentList "/N /Q installer.sed" -Wait -NoNewWindow
if (Test-Path "$OutputDir\Instalador_AndroProject.exe") {
    $ExeSize = [math]::Round((Get-Item "$OutputDir\Instalador_AndroProject.exe").Length / 1MB, 2)
    Write-Host "      > Instalador_AndroProject.exe creado ($ExeSize MB)" -ForegroundColor Green
} else {
    Write-Host "      ERROR: No se genero el .exe. Revisa installer.sed" -ForegroundColor Red
    exit 1
}

# --- PASO 5: Limpiar temporales ---
Write-Host ""
Write-Host "[5/5] Limpiando archivos temporales..." -ForegroundColor Yellow
if (Test-Path "AndroProject_data.zip") { Remove-Item "AndroProject_data.zip" -Force }
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
Write-Host "      > Listo." -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   EXITO: El instalador esta listo en:" -ForegroundColor Green
Write-Host "   $OutputDir\Instalador_AndroProject.exe" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
# Read-Host "Presiona Enter para cerrar"
