# ── AndroProject / DexterAnd — Lanzador de Pantalla de Proyección iOS ──────────
# Abre la ventana de proyección dedicada del iPhone en el escritorio de Windows
# manteniendo el audio 100% en el celular (igual que --no-audio en AndroidProject).

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Launcher  = Join-Path $ScriptDir "launch_native_ios_projector.ps1"

& $Launcher
