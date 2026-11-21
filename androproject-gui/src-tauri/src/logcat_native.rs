// ============================================================================
// ARCHIVO: logcat_native.rs
// QUÉ HACE: Lectura/limpieza nativa de Logcat y telemetría instantánea del
//           dispositivo Android directamente desde Rust (sin overhead HTTP).
// CÓMO FUNCIONA: Reutiliza la validación estricta de serial de `apps_native` y
//           ejecuta `adb -s <serial>` con argumentos directos sin shell.
// POR QUÉ: Acelerar diagnóstico en tiempo real y reducir consumo de RAM/CPU.
// ============================================================================

use crate::apps_native::is_valid_serial;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct NativeDeviceMetrics {
    pub serial: String,
    pub android_version: String,
    pub battery_level: i32,
    pub screen_size: String,
}

fn adb_bin() -> PathBuf {
    let custom = PathBuf::from(r"C:\AndroProject\adb.exe");
    if custom.exists() {
        return custom;
    }
    PathBuf::from(if cfg!(target_os = "windows") { "adb.exe" } else { "adb" })
}

fn exec_adb(serial: &str, args: &[&str]) -> Result<String, String> {
    if !is_valid_serial(serial) {
        return Err("Serial de dispositivo inválido".into());
    }
    let mut cmd = Command::new(adb_bin());
    cmd.arg("-s").arg(serial.trim()).args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = cmd.output().map_err(|e| format!("Error ejecutando adb: {}", e))?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

/// Obtiene las últimas N líneas del buffer de Logcat con filtro opcional de texto.
#[tauri::command]
pub fn rust_logcat_snapshot(
    serial: String,
    lines: Option<u32>,
    filter: Option<String>,
) -> Result<Vec<String>, String> {
    let count = lines.unwrap_or(150).clamp(10, 1000).to_string();
    let raw = exec_adb(&serial, &["logcat", "-d", "-v", "time", "-t", &count])?;
    let needle = filter.unwrap_or_default().trim().to_lowercase();

    let result: Vec<String> = raw
        .lines()
        .map(|l| l.trim_end().to_string())
        .filter(|l| !l.is_empty() && (needle.is_empty() || l.to_lowercase().contains(&needle)))
        .collect();
    Ok(result)
}

/// Limpia el buffer circular de Logcat en el dispositivo.
#[tauri::command]
pub fn rust_logcat_clear(serial: String) -> Result<bool, String> {
    exec_adb(&serial, &["logcat", "-c"])?;
    Ok(true)
}

/// Lee versión Android, porcentaje de batería y resolución física en una llamada nativa.
#[tauri::command]
pub fn rust_device_metrics_fast(serial: String) -> Result<NativeDeviceMetrics, String> {
    let android_version = exec_adb(&serial, &["shell", "getprop", "ro.build.version.release"])
        .unwrap_or_default()
        .trim()
        .to_string();

    let battery_raw = exec_adb(&serial, &["shell", "dumpsys", "battery"]).unwrap_or_default();
    let battery_level = battery_raw
        .lines()
        .find_map(|l| l.trim().strip_prefix("level:"))
        .and_then(|v| v.trim().parse::<i32>().ok())
        .unwrap_or(-1);

    let size_raw = exec_adb(&serial, &["shell", "wm", "size"]).unwrap_or_default();
    let screen_size = size_raw
        .lines()
        .find_map(|l| l.split("Physical size:").nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into());

    Ok(NativeDeviceMetrics {
        serial,
        android_version,
        battery_level,
        screen_size,
    })
}
