@echo off
:: ============================================================================
:: AndroProject v2.1.0 -- Instalador silencioso (no-interactivo)
:: ============================================================================
title Instalador AndroProject v2.1.0
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo  ============================================================
echo    AndroProject v2.1.0 -- Instalador
echo  ============================================================
echo.

:: --- 1. Node.js ---
echo  [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: Node.js no encontrado. Instala desde https://nodejs.org
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo    Node.js %%v - OK

:: --- 2. Python ---
echo.
echo  [2/5] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: Python no encontrado. Instala desde https://python.org
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo    %%v - OK

:: --- 3. Frontend dependencias ---
echo.
echo  [3/5] Instalando dependencias del Frontend...
cd /d "%ROOT%\androproject-gui"
if not exist "node_modules" (
    echo    Ejecutando npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo    ADVERTENCIA: npm install tuvo errores.
    ) else (
        echo    node_modules instalado correctamente.
    )
) else (
    echo    node_modules ya existe. Verificando...
    call npm install --silent 2>nul
    echo    Dependencias OK.
)

:: --- 4. Backend venv ---
echo.
echo  [4/5] Configurando Backend Python...
cd /d "%ROOT%\vision-backend"
if not exist ".venv\Scripts\python.exe" (
    echo    Creando entorno virtual Python...
    python -m venv .venv
    echo    Instalando dependencias...
    .venv\Scripts\pip install -r requirements.txt --quiet
    echo    Backend configurado.
) else (
    echo    .venv ya existe. Actualizando dependencias...
    .venv\Scripts\pip install -r requirements.txt --quiet 2>nul
    echo    Backend listo.
)

:: --- 5. Acceso directo ---
echo.
echo  [5/5] Creando acceso directo en el Escritorio...
cd /d "%ROOT%"
powershell -ExecutionPolicy Bypass -NoProfile -File "%ROOT%\create_shortcut.ps1"

:: --- Verificar paths ---
echo.
echo  ============================================================
echo    VERIFICANDO CONFIGURACION
echo  ============================================================
echo.
if not exist "C:\AndroProject\adb.exe" (
    echo    NOTA: No se encontro C:\AndroProject\adb.exe
    echo    Si usas scrcpy, instala AndroProject en C:\AndroProject\
    echo    o configura ANDROPROJECT_HOME en .env.local
    echo.
)

echo  ============================================================
echo    INSTALACION COMPLETADA -- AndroProject v2.1.0
echo.
echo    Acceso directo: AndroProject Dashboard (Escritorio)
echo    O ejecuta:      start.bat
echo.
echo    Desktop App:    http://localhost:3001 (Electron)
echo    Backend:        http://localhost:8000/health
echo  ============================================================
echo.
