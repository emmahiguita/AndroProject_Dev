// ============================================================================
// ARCHIVO: emulator.rs
// QUÉ HACE: Controlador nativo en Rust para listar/arrancar emuladores Android
//           (AVD con aceleración WHPX/GPU), instalar APKs y lanzar scrcpy H.264
//           a 60 FPS con latencia cero desde Tauri.
// CÓMO FUNCIONA: Resuelve binarios nativos (emulator, adb, scrcpy) del sistema
//           o SDK de Android y ejecuta procesos sin ventana de consola extra.
// POR QUÉ: Eliminar sobrecarga de Node/HTTP para lograr arranque y proyección
//           100% rápidos y fluidos en escritorio Windows/Linux.
// ============================================================================

use std::path::PathBuf;
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Resuelve la ruta del ejecutable `emulator` en el SDK de Android o en PATH.
fn resolve_emulator_bin() -> PathBuf {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let sdk_emu = PathBuf::from(local_app_data)
            .join("Android")
            .join("Sdk")
            .join("emulator")
            .join("emulator.exe");
        if sdk_emu.exists() {
            return sdk_emu;
        }
    }
    if let Ok(sdk_root) = std::env::var("ANDROID_SDK_ROOT").or_else(|_| std::env::var("ANDROID_HOME")) {
        let bin = if cfg!(target_os = "windows") { "emulator.exe" } else { "emulator" };
        let candidate = PathBuf::from(sdk_root).join("emulator").join(bin);
        if candidate.exists() {
            return candidate;
        }
    }
    PathBuf::from(if cfg!(target_os = "windows") { "emulator.exe" } else { "emulator" })
}

/// Resuelve la ruta de `adb` (prioriza C:\AndroProject\adb.exe o SDK/PATH).
fn resolve_adb_bin() -> PathBuf {
    let custom = PathBuf::from(r"C:\AndroProject\adb.exe");
    if custom.exists() {
        return custom;
    }
    PathBuf::from(if cfg!(target_os = "windows") { "adb.exe" } else { "adb" })
}

/// Resuelve la ruta de `scrcpy` en PATH o instalación WinGet.
fn resolve_scrcpy_bin() -> PathBuf {
    if let Ok(home) = std::env::var("SCRCPY_BIN") {
        let p = PathBuf::from(home);
        if p.exists() {
            return p;
        }
    }
    PathBuf::from(if cfg!(target_os = "windows") { "scrcpy.exe" } else { "scrcpy" })
}

/// Lista los AVDs (Android Virtual Devices) instalados en el equipo.
#[tauri::command]
pub fn list_avds() -> Result<Vec<String>, String> {
    let bin = resolve_emulator_bin();
    let mut cmd = Command::new(&bin);
    cmd.arg("-list-avds");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| format!("No se pudo ejecutar emulator: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let avds: Vec<String> = stdout
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with("INFO"))
        .map(String::from)
        .collect();
    Ok(avds)
}

/// Arranca un AVD con aceleración GPU host y sin animación de arranque (máxima fluidez).
#[tauri::command]
pub fn launch_avd(avd: String, port: Option<u16>) -> Result<String, String> {
    let avd_name = avd.trim();
    if avd_name.is_empty() {
        return Err("Nombre de AVD requerido".to_string());
    }
    let emu_port = port.unwrap_or(5554);
    let bin = resolve_emulator_bin();

    let mut cmd = Command::new(&bin);
    cmd.args([
        "-avd",
        avd_name,
        "-port",
        &emu_port.to_string(),
        "-gpu",
        "host",
        "-no-window",
        "-no-boot-anim",
        "-no-audio",
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let child = cmd
        .spawn()
        .map_err(|e| format!("Error iniciando AVD '{}': {}", avd_name, e))?;

    Ok(format!(
        "AVD '{}' iniciado en emulator-{} (PID {})",
        avd_name,
        emu_port,
        child.id()
    ))
}

/// Lanza scrcpy nativo H.264 a 60 FPS con buffer cero para cualquier serial (físico o emulator-5554).
#[tauri::command]
pub fn launch_scrcpy_native(
    serial: String,
    max_fps: Option<u16>,
    max_size: Option<u16>,
    bitrate: Option<String>,
) -> Result<String, String> {
    let target = serial.trim();
    if target.is_empty() {
        return Err("Serial de dispositivo requerido".to_string());
    }
    let fps = max_fps.unwrap_or(60);
    let size = max_size.unwrap_or(1280);
    let rate = bitrate.unwrap_or_else(|| "8M".to_string());

    let bin = resolve_scrcpy_bin();
    let mut cmd = Command::new(&bin);
    cmd.args([
        "-s",
        target,
        "--video-codec=h264",
        &format!("--max-fps={}", fps),
        &format!("--max-size={}", size),
        &format!("--video-bit-rate={}", rate),
        "--video-buffer=0",
        "--no-audio",
        "--stay-awake",
    ])
    .stdout(Stdio::null())
    .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let child = cmd
        .spawn()
        .map_err(|e| format!("Error lanzando scrcpy para '{}': {}", target, e))?;

    Ok(format!("scrcpy 60 FPS activo para {} (PID {})", target, child.id()))
}

/// Instala una APK directamente en el dispositivo o emulador seleccionado vía ADB.
#[tauri::command]
pub fn install_apk_native(serial: String, apk_path: String) -> Result<String, String> {
    let bin = resolve_adb_bin();
    let mut cmd = Command::new(&bin);
    cmd.args(["-s", serial.trim(), "install", "-r", apk_path.trim()]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Error ejecutando adb install: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
