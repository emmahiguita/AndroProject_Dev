@echo off
setlocal enabledelayedexpansion
title Instalador de AndroProject v2.1.0

cls
echo.
echo  ============================================================
echo     AndroProject v2.1.0 -- Instalador para Windows
echo     Backend Python + Frontend Next.js + Scrcpy Engine
echo  ============================================================
echo.

set DEST_DIR=C:\AndroProject

echo  [1/5] Verificando directorio de instalacion...
if exist "%DEST_DIR%\Dashboard\next-standalone\server.js" (
    powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $dashboard=Join-Path $env:DEST_DIR 'Dashboard'; $owned=@((Join-Path $env:DEST_DIR 'adb.exe'),(Join-Path $env:DEST_DIR 'AndroProject.exe'),(Join-Path $dashboard 'ANDRO-IOS.exe'),(Join-Path $dashboard 'AndroProject.exe')); $server=[regex]::Escape((Join-Path $dashboard 'next-standalone\server.js'))+'(?:\s|\x22|$)'; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -in $owned -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match $server) } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }"
    if errorlevel 1 (
        echo        ERROR: No se pudo preparar el cierre de la instalacion anterior.
        exit /b 1
    )
)
if exist "%DEST_DIR%" (
    echo        ^> Actualizando instalacion existente...
) else (
    echo        ^> Creando carpeta en %DEST_DIR%...
    mkdir "%DEST_DIR%"
)

echo.
echo  [2/5] Extrayendo archivos de la aplicacion...
powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '%~dp0AndroProject_data.zip' -DestinationPath $env:DEST_DIR -Force"
if errorlevel 1 (
    echo        ERROR: No se pudo extraer los archivos.
    exit /b 1
)
echo        ^> Archivos extraidos correctamente.

echo.
echo  [3/5] Copiando scripts de lanzamiento...
for %%F in (iniciar_scrcpy.bat iniciar_scrcpy_sin_cable.bat iniciar_wifi_magico.bat emparejar_inalambrico.bat) do (
    if exist "%~dp0%%F" (
        copy /Y "%~dp0%%F" "%DEST_DIR%\" >nul
    ) else if exist "%%F" (
        copy /Y "%%F" "%DEST_DIR%\" >nul
    )
)
echo        ^> Scripts copiados.

echo.
echo  [4/5] Instalando Node.js y Python dependencias para Dashboard...
:: Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo        ADVERTENCIA: Node.js no encontrado. El Dashboard requiere Node.js.
    echo        Descargalo de https://nodejs.org
) else (
    for /f "tokens=*" %%v in ('node --version') do echo        Node.js %%v detectado
)

:: Verificar Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo        ADVERTENCIA: Python no encontrado. El Backend requiere Python 3.10+.
    echo        Descargalo de https://python.org
) else (
    for /f "tokens=*" %%v in ('python --version') do echo        %%v detectado
)

echo.
echo  [5/5] Creando acceso directo en el Escritorio...
set PS_SCRIPT=%TEMP%\AndroProject_Shortcut.ps1

(
    echo $WshShell = New-Object -ComObject WScript.Shell
    echo $Desktop = [Environment]::GetFolderPath("Desktop"^)
    echo $Shortcut = $WshShell.CreateShortcut("$Desktop\ANDRO-IOS.lnk"^)
    echo $Shortcut.TargetPath = "C:\AndroProject\Dashboard\ANDRO-IOS.exe"
    echo $Shortcut.WorkingDirectory = "C:\AndroProject\Dashboard"
    echo $Shortcut.Description = "ANDRO-IOS v3.2.0 -- Panel de Control Android e iOS"
    echo if (Test-Path "C:\AndroProject\AndroProject.ico"^) { $Shortcut.IconLocation = "C:\AndroProject\AndroProject.ico" }
    echo $Shortcut.Save(^)
) > "%PS_SCRIPT%"

powershell -ExecutionPolicy Bypass -NoProfile -File "%PS_SCRIPT%"
del "%PS_SCRIPT%"
echo        ^> Acceso directo "ANDRO-IOS" creado en el Escritorio.

echo.
echo  ============================================================
echo    INSTALACION COMPLETADA -- AndroProject v2.1.0
echo.
echo    Ubicacion: C:\AndroProject
echo    Acceso directo: AndroProject Dashboard (Escritorio)
echo.
echo    El Dashboard incluye:
echo      - Panel de control de dispositivos Android
echo      - Transmision de pantalla (Scrcpy H.265 60FPS)
echo      - Transmision de camara (WebRTC 4K)
echo      - Audio pass-through con Opus 192k
echo      - Procesamiento de video con IA (OpenCV)
echo      - Gestion de apps, APKs, ROMs y Fastboot
echo  ============================================================
echo.
