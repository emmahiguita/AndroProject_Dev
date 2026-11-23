// ============================================================================
// ARCHIVO: server/device_api.rs
// QUÉ HACE: Endpoints nativos en Rust para `/api/config`, `/api/device`
//           y `/api/device-image` (PNG).
// CÓMO FUNCIONA: Consulta `adb devices -l`, delega la telemetría del kernel a
//           `telemetry::fetch_telemetry` y captura PNGs vía `adb exec-out`.
// POR QUÉ: Reemplazar Node.js por endpoints nativos < 150ms (< 200L, SRP).
// ============================================================================

use axum::{
    extract::Query,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::process::Stdio;
use std::time::Duration;

use super::extra_actions::read_live_android_settings;
use super::paths::{adb_bin, captures_dir, fastboot_bin, home_dir, run_adb, safe_serial, scrcpy_bin, scrcpy_server_path, silent_cmd};
use super::telemetry::fetch_telemetry;

const TRANSPARENT_PNG_1X1: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];

#[derive(Deserialize)]
pub struct SerialQuery {
    pub serial: Option<String>,
}

/// `GET /api/config` — Rutas verificadas del host y ajustes en vivo de Android.
pub async fn get_config(Query(q): Query<SerialQuery>) -> Json<Value> {
    let adb = adb_bin();
    let fb = fastboot_bin();
    let sc = scrcpy_bin();
    let srv = scrcpy_server_path();
    let serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    let device_settings = read_live_android_settings(&serial).await;
    Json(json!({
        "success": true,
        "runtime": "rust-native-axum",
        "version": "v3.3.0-rust",
        "home": home_dir().to_string_lossy(),
        "adb": adb.to_string_lossy(),
        "fastboot": fb.to_string_lossy(),
        "streamingEngine": sc.to_string_lossy(),
        "scrcpyServer": srv.to_string_lossy(),
        "capturesDir": captures_dir().to_string_lossy(),
        "screenshotsDir": captures_dir().to_string_lossy(),
        "wifiPort": 5555, "apiPort": 3000, "streamingWsPort": 7001, "visionPort": 8000,
        "nodeRequired": false, "pythonRequired": false,
        "verified": {
            "adb": adb.exists(),
            "fastboot": fb.exists(),
            "scrcpy": sc.exists(),
            "scrcpyServer": srv.exists(),
            "vision": false,
            "airplay": false,
        },
        "deviceSettings": device_settings,
    }))
}

/// Parsea `adb devices -l` en objetos JSON compatibles con el frontend.
pub async fn list_adb_devices() -> Vec<Value> {
    let (ok, out, _) = run_adb(&["devices", "-l"], 4000).await;
    if !ok {
        return Vec::new();
    }
    let mut list = Vec::new();
    for line in out.lines().skip(1) {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('*') {
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
        let conn = if serial.contains(':') { "Wi-Fi" } else { "USB" };
        list.push(json!({
            "serial": serial,
            "state": state,
            "model": model,
            "connectionType": conn,
            "platform": "android",
            "connected": state == "device",
        }));
    }
    list
}

/// `GET /api/device` — Lista dispositivos conectados y telemetría del activo.
pub async fn get_device(Query(q): Query<SerialQuery>) -> Json<Value> {
    let devices = list_adb_devices().await;
    let req_serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    let chosen = devices
        .iter()
        .find(|d| !req_serial.is_empty() && d["serial"].as_str() == Some(req_serial.as_str()))
        .or_else(|| devices.iter().find(|d| d["state"].as_str() == Some("device")))
        .or_else(|| devices.first());

    let active = if let Some(dev) = chosen {
        let ser = dev["serial"].as_str().unwrap_or("");
        let st = dev["state"].as_str().unwrap_or("");
        if st == "device" && !ser.is_empty() {
            Some(fetch_telemetry(ser, dev["model"].as_str().unwrap_or(ser), dev["connectionType"].as_str().unwrap_or("USB")).await)
        } else {
            Some(dev.clone())
        }
    } else {
        None
    };

    Json(json!({
        "connected": !devices.is_empty(),
        "devices": devices,
        "serialChanged": Value::Null,
        "activeDevice": active,
    }))
}

/// `GET /api/device-image` — Captura PNG instantánea vía `adb exec-out screencap -p`.
pub async fn get_device_image(Query(q): Query<SerialQuery>) -> Response {
    let serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    if serial.is_empty() || serial.starts_with("airplay-") {
        return ([(header::CONTENT_TYPE, "image/png")], TRANSPARENT_PNG_1X1).into_response();
    }
    let mut cmd = silent_cmd(adb_bin());
    cmd.args(["-s", &serial, "exec-out", "screencap", "-p"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_millis(3500), cmd.output()).await {
        if out.stdout.len() > 100 && out.stdout.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            return (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/png"), (header::CACHE_CONTROL, "no-store")],
                out.stdout,
            )
                .into_response();
        }
    }
    ([(header::CONTENT_TYPE, "image/png")], TRANSPARENT_PNG_1X1).into_response()
}
