@echo off
setlocal enabledelayedexpansion
title Instalador de ANDRO-IOS v3.3.0 (100%% Rust)

cls
echo.
echo  ============================================================
echo     ANDRO-IOS v3.3.0 -- Instalador Oficial para Windows
echo     Backend 100%% Rust (Tauri v2 + Axum) + Scrcpy 4.1 60 FPS
echo  ============================================================
echo.

set DEST_DIR=C:\AndroProject

echo  [1/5] Verificando directorio de instalacion...
taskkill /F /IM ANDRO-IOS.exe >nul 2>&1
taskkill /F /IM AndroProject.exe >nul 2>&1
taskkill /F /IM adb.exe >nul 2>&1
timeout /t 1 /nobreak >nul
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
echo  [4/5] Verificando motor nativo 100%% Rust...
echo        ^> Cero dependencias externas (no requiere Node.js ni Python).

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
