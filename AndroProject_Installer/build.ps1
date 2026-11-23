# =============================================================
#  build.ps1 - Constructor del Instalador de AndroProject
#  Uso: Doble clic en build.ps1 o ejecutar desde PowerShell
# =============================================================

param(
    [switch]$SkipTauriBuild,
    [string]$ScrcpyReleaseDir,
    [string]$LocalIdentityDirectory
)

$ErrorActionPreference = "Stop"
$InstallerDir = $PSScriptRoot
$GuiDir       = Join-Path $InstallerDir "..\androproject-gui"
$OutputDir    = Join-Path $InstallerDir "output"
$TempDir      = Join-Path $InstallerDir "temp_build"
. (Join-Path $InstallerDir 'InstallerSigning.ps1')
if ($LocalIdentityDirectory) { $LocalIdentityDirectory = (Resolve-Path -LiteralPath $LocalIdentityDirectory).Path }
else { $cert = Get-InstallerCertificate }
# La limpieza solo puede actuar sobre el subdirectorio temporal propio del constructor.
$TempDir = [IO.Path]::GetFullPath($TempDir)
if ([IO.Path]::GetDirectoryName($TempDir) -ne [IO.Path]::GetFullPath($InstallerDir) -or
    ((Test-Path -LiteralPath $TempDir) -and ((Get-Item -LiteralPath $TempDir).Attributes -band [IO.FileAttributes]::ReparsePoint))) {
    throw 'Directorio temporal inesperado.'
}

# Detectar carpeta de scrcpy (WinGet v4.1, C:\AndroProject o Downloads v4.0)
$Candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy_Microsoft.Winget.Source_8wekyb3d8bbwe\scrcpy-win64-v4.1",
    "C:\AndroProject",
    "$env:USERPROFILE\Downloads\scrcpy-win64-v4.0"
)
$SourceReleaseDir = $ScrcpyReleaseDir
if (-not $SourceReleaseDir) {
    $SourceReleaseDir = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

Set-Location $InstallerDir

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- PASO 1: Limpiar output anterior ---
Write-Host "[1/5] Limpiando archivos anteriores..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path "AndroProject_data.zip") { Remove-Item "AndroProject_data.zip" -Force }
if (Test-Path "$OutputDir\Instalador_AndroProject.exe") { Remove-Item "$OutputDir\Instalador_AndroProject.exe" -Force }
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
Write-Host "      > Limpieza completada." -ForegroundColor Green

# --- PASO 2: Preparar archivos con nombre AndroProject ---
Write-Host ""
Write-Host "[2/5] Preparando archivos sin redundancia y renombrando..." -ForegroundColor Yellow
if (-not $SourceReleaseDir -or -not (Test-Path -LiteralPath $SourceReleaseDir -PathType Container)) {
    Write-Host "      ERROR: No se encontro la carpeta de release: $SourceReleaseDir" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
# Solo recoge archivos del runtime. Una instalacion existente puede contener capturas personales.
$runtimeFiles = @('adb.exe','AdbWinApi.dll','AdbWinUsbApi.dll','scrcpy.exe','AndroProject.exe',
    'scrcpy-server','AndroProject-server','scrcpy-noconsole.vbs','scrcpy-noconsole.exe',
    'AndroProject-noconsole.vbs','AndroProject-noconsole.exe','scrcpy.png','LICENSE.txt',
    'libusb-1.0.dll','SDL3.dll','avcodec-*.dll','avformat-*.dll','avutil-*.dll','swresample-*.dll')
if ([IO.Path]::GetFullPath($SourceReleaseDir).TrimEnd('\') -eq 'C:\AndroProject') {
    Get-ChildItem -Path "$SourceReleaseDir\*" -Include $runtimeFiles -File | Copy-Item -Destination $TempDir
} else {
    # Conserva los recursos suministrados por la distribucion de scrcpy.
    Copy-Item "$SourceReleaseDir\*" -Destination $TempDir -Recurse -Exclude '-', '*.log', '*.tmp', '*.bak'
}

# Renombrar los ejecutables y archivos para que digan AndroProject en vez de scrcpy
$RenameMap = @{
    "scrcpy.exe" = "AndroProject.exe"
    "scrcpy-noconsole.vbs" = "AndroProject-noconsole.vbs"
    "scrcpy-noconsole.exe" = "AndroProject-noconsole.exe"
    "scrcpy-server" = "AndroProject-server"
}

foreach ($key in $RenameMap.Keys) {
    if (Test-Path "$TempDir\$key") {
        # La instalacion puede traer ambos nombres. La copia oficial es la fuente del alias.
        Move-Item -LiteralPath "$TempDir\$key" -Destination (Join-Path $TempDir $RenameMap[$key]) -Force
    }
}
if (Test-Path "$TempDir\AndroProject-server") {
    Copy-Item "$TempDir\AndroProject-server" "$TempDir\scrcpy-server" -Force
}

# Parchear el PE Header de AndroProject.exe a Subsystem 2 (Windows GUI) para eliminar consolas CMD
$TargetBin = "$TempDir\AndroProject.exe"
foreach ($name in 'adb.exe','AndroProject.exe','scrcpy-server') {
    if (-not (Test-Path -LiteralPath (Join-Path $TempDir $name) -PathType Leaf)) { throw "Falta $name en el runtime." }
}
if (Test-Path $TargetBin) {
    $bytes = [System.IO.File]::ReadAllBytes($TargetBin)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
    $bytes[$peOffset + 0x5C] = 2 # IMAGE_SUBSYSTEM_WINDOWS_GUI
    [System.IO.File]::WriteAllBytes($TargetBin, $bytes)
    Write-Host "      > AndroProject.exe configurado con Subsystem 2 (GUI puro sin ventana CMD)." -ForegroundColor Green
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
    if (-not $SkipTauriBuild) {
        Push-Location $GuiDir
        Write-Host "      > Ejecutando npm run tauri:build en $GuiDir..." -ForegroundColor Cyan
        try {
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) { throw 'Fallo la exportacion de la interfaz.' }
            & npm.cmd run tauri:build
            if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion del dashboard.' }
        } finally { Pop-Location }
    }
    $TauriExe = Get-Item -LiteralPath "$GuiDir\src-tauri\target\release\androproject-desktop.exe" -ErrorAction SilentlyContinue
    if ($TauriExe) {
        Write-Host "      > Copiando binario 100% Rust ($($TauriExe.Name)) y frontend estatico (www)..." -ForegroundColor Green
        New-Item -ItemType Directory -Force -Path "$TempDir\Dashboard\www" | Out-Null
        Copy-Item $TauriExe.FullName "$TempDir\Dashboard\ANDRO-IOS.exe" -Force
        if (Test-Path "$GuiDir\out\index.html") {
            Copy-Item "$GuiDir\out\*" "$TempDir\Dashboard\www\" -Recurse -Force
        } else {
            Write-Host "      ERROR: No se encontro la exportacion estatica en androproject-gui\out." -ForegroundColor Red
            exit 1
        }
        if ($cert -or $LocalIdentityDirectory) {
            foreach ($binary in @("$TempDir\Dashboard\ANDRO-IOS.exe", "$TempDir\AndroProject.exe")) {
                if ($LocalIdentityDirectory) { & "$InstallerDir\Sign-LocalArtifact.ps1" $binary $LocalIdentityDirectory }
                else { Set-VerifiedInstallerSignature $binary $cert }
            }
            Write-Host "      > Binarios internos (ANDRO-IOS.exe y AndroProject.exe) firmados con Authenticode." -ForegroundColor Green
        }
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
    $TargetExe = "$OutputDir\Instalador_AndroProject.exe"
    & (Join-Path $InstallerDir 'Set-InstallerIcon.ps1') -InstallerPath $TargetExe -IconPath (Join-Path $GuiDir 'public/icon.ico')
    # Firma Authenticode oficial cuando existe certificado CA en variables de entorno
    if ($LocalIdentityDirectory) { & "$InstallerDir\Sign-LocalArtifact.ps1" $TargetExe $LocalIdentityDirectory }
    elseif ($cert) {
        Set-VerifiedInstallerSignature $TargetExe $cert
    }
    # Publica el paquete solo cuando el icono y la firma solicitada ya se verificaron.
    Move-Item -LiteralPath $TargetExe -Destination "$OutputDir\Instalador_ANDRO-IOS.exe" -Force
    $TargetExe = "$OutputDir\Instalador_ANDRO-IOS.exe"
    $hash = (Get-FileHash $TargetExe -Algorithm SHA256).Hash.ToLower()
    "$hash  Instalador_ANDRO-IOS.exe" | Set-Content -Encoding ASCII "$OutputDir\SHA256SUMS.txt"
    $ExeSize = [math]::Round((Get-Item $TargetExe).Length / 1MB, 2)
    Write-Host "      > Instalador_ANDRO-IOS.exe creado ($ExeSize MB) | SHA256: $hash" -ForegroundColor Green
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

Write-Host "   EXITO: El instalador esta listo en:" -ForegroundColor Green
Write-Host "   $TargetExe" -ForegroundColor White
