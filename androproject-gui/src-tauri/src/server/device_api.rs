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
use super::paths::{adb_bin, captures_dir, fastboot_bin, home_dir, safe_serial, scrcpy_bin, scrcpy_server_path, silent_cmd};
use super::telemetry::fetch_telemetry;

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
    let (device_settings, receiver) = tokio::join!(read_live_android_settings(&serial), super::airplay_process::status());
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
            "vision": Value::Null,
            "airplay": receiver["status"]["running"],
        },
        "deviceSettings": device_settings,
    }))
}

/// Parsea `adb devices -l` en objetos JSON compatibles con el frontend.
pub async fn list_adb_devices() -> Result<Vec<Value>, String> {
    let (ok, out, err) = super::adb_service::enumerate().await;
    if !ok {
        return Err(if err.trim().is_empty() { "ADB no pudo enumerar los dispositivos".into() } else { err.trim().into() });
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
    Ok(list)
}

/// `GET /api/device` — Lista dispositivos conectados y telemetría del activo.
pub async fn get_device(Query(q): Query<SerialQuery>) -> Json<Value> {
    let devices = match list_adb_devices().await {
        Ok(devices) => devices,
        Err(error) => return Json(json!({"success": false, "error": error, "devices": [], "activeDevice": null, "connected": false})),
    };
    let req_serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    // Si se pidió un serial, no se muestran los datos de otro teléfono al desconectarse.
    let chosen = if req_serial.is_empty() {
        devices.iter().find(|d| d["state"].as_str() == Some("device")).or_else(|| devices.first())
    } else {
        devices.iter().find(|d| d["serial"].as_str() == Some(req_serial.as_str()))
    };

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
        "success": true,
        "connected": devices.iter().any(|d| d["state"].as_str() == Some("device")),
        "devices": devices,
        "serialChanged": Value::Null,
        "activeDevice": active,
    }))
}

/// `GET /api/device-image` — Captura PNG instantánea vía `adb exec-out screencap -p`.
pub async fn get_device_image(Query(q): Query<SerialQuery>) -> Response {
    let serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    if serial.is_empty() || serial.starts_with("airplay-") {
        return (StatusCode::BAD_REQUEST, "Selecciona un dispositivo Android").into_response();
    }
    let mut cmd = silent_cmd(adb_bin());
    // Al vencer el tiempo de captura se termina ADB para no dejar procesos huérfanos.
    cmd.kill_on_drop(true).args(["-s", &serial, "exec-out", "screencap", "-p"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_millis(3500), cmd.output()).await {
        if out.status.success() && out.stdout.starts_with(b"\x89PNG\r\n\x1a\n") {
            return (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/png"), (header::CACHE_CONTROL, "no-store")],
                out.stdout,
            )
                .into_response();
        }
    }
    (StatusCode::BAD_GATEWAY, "ADB no entregó una captura PNG").into_response()
}
