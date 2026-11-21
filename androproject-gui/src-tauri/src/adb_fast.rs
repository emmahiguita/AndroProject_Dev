// ============================================================================
// ARCHIVO: adb_fast.rs
// QUÉ HACE: Comandos ADB y proyección multipantalla paralela en Rust puro.
// CÓMO FUNCIONA: Ejecuta `adb` y `scrcpy` directamente desde hilos nativos
//           del sistema operativo con CREATE_NO_WINDOW y cero latencia HTTP.
// POR QUÉ: Hacer el escritorio Tauri 100% ligero, instantáneo y sin bloqueos.
// ============================================================================

use serde::Serialize;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct FastDevice {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub connection_type: String,
}

fn adb_bin() -> PathBuf {
    let custom = PathBuf::from(r"C:\AndroProject\adb.exe");
    if custom.exists() {
        return custom;
    }
    PathBuf::from(if cfg!(target_os = "windows") { "adb.exe" } else { "adb" })
}

/// Lista dispositivos ADB conectados en < 15ms directamente desde Rust.
#[tauri::command]
pub fn adb_list_devices_fast() -> Result<Vec<FastDevice>, String> {
    let mut cmd = Command::new(adb_bin());
    cmd.args(["devices", "-l"]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = cmd.output().map_err(|e| format!("Error ejecutando adb: {}", e))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut devices = Vec::new();

    for line in text.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        let model = parts
            .iter()
            .find_map(|p| p.strip_prefix("model:"))
            .map(|m| m.replace('_', " "))
            .unwrap_or_else(|| serial.clone());
        let connection_type = if serial.contains(':') { "Wi-Fi" } else { "USB" }.to_string();

        devices.push(FastDevice {
            serial,
            state,
            model,
            connection_type,
        });
    }
    Ok(devices)
}

/// Inyecta una tecla física Android sin pasar por Node.js.
#[tauri::command]
pub fn adb_key_fast(serial: String, keycode: String) -> Result<bool, String> {
    let mut cmd = Command::new(adb_bin());
    cmd.args(["-s", serial.trim(), "shell", "input", "keyevent", keycode.trim()])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(true)
}

/// Lanza múltiples ventanas nativas scrcpy H.264 a 60 FPS en paralelo desde Rust.
#[tauri::command]
pub fn launch_multi_scrcpy_native(serials: Vec<String>) -> Result<usize, String> {
    let mut launched = 0usize;
    for serial in serials {
        if crate::emulator::launch_scrcpy_native(serial, Some(60), Some(1080), Some("8M".to_string())).is_ok() {
            launched += 1;
        }
    }
    Ok(launched)
}
