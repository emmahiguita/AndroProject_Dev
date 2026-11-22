// ============================================================================
// ARCHIVO: server/device_api.rs
// QUÉ HACE: Endpoints nativos en Rust para `/api/config`, `/api/device`
//           (telemetría real del kernel Android) y `/api/device-image` (PNG).
// CÓMO FUNCIONA: Consulta `adb devices -l` y un bloque consolidado de `adb shell`
//           en un solo round-trip TCP para leer CPU, RAM, Disco, Batería y props.
// POR QUÉ: Reemplazar Node.js por telemetría nativa < 150ms y cero overhead (< 200L).
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

use super::paths::{adb_bin, adb_shell, captures_dir, fastboot_bin, home_dir, run_adb, safe_serial, scrcpy_bin, silent_cmd};

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

/// `GET /api/config` — Rutas del host y estado de herramientas nativas.
pub async fn get_config() -> Json<Value> {
    Json(json!({
        "success": true,
        "runtime": "rust-native-axum",
        "home": home_dir().to_string_lossy(),
        "adb": adb_bin().to_string_lossy(),
        "fastboot": fastboot_bin().to_string_lossy(),
        "streamingEngine": scrcpy_bin().to_string_lossy(),
        "screenshotsDir": captures_dir().to_string_lossy(),
        "nodeRequired": false,
        "pythonRequired": false,
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

/// Recolecta telemetría real del kernel Android en una sola llamada `adb shell`.
async fn fetch_telemetry(serial: &str, base_model: &str, conn: &str) -> Value {
    let script = concat!(
        "echo MODEL=$(getprop ro.product.model);",
        "echo MARKET=$(getprop ro.vendor.oplus.market.name || getprop ro.product.marketname || getprop ro.product.brand);",
        "echo VER=$(getprop ro.build.version.release);",
        "echo RES=$(wm size 2>/dev/null | tail -n 1 | awk '{print $NF}');",
        "echo MEM=$(awk '/MemTotal|MemAvailable/{print $1,$2}' /proc/meminfo 2>/dev/null | tr '\\n' ' ');",
        "echo DF=$(df -k /data 2>/dev/null | tail -n 1 | awk '{print $2,$3,$4,$5}');",
        "echo LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1,$4}');",
        "echo UP=$(awk '{print int($1/3600)}' /proc/uptime 2>/dev/null);",
        "echo BAT=$(dumpsys battery 2>/dev/null | awk '/level:|temperature:|status:|voltage:/{print $1,$2}' | tr '\\n' ' ');",
        "echo VBOOT=$(getprop ro.boot.verifiedbootstate);echo FLASH=$(getprop ro.boot.flash.locked)"
    );
    let (_, out, _) = adb_shell(serial, script, 4500).await;
    let get_val = |prefix: &str| -> String {
        out.lines()
            .find_map(|l| l.trim().strip_prefix(prefix))
            .unwrap_or("")
            .trim()
            .to_string()
    };

    let model_raw = get_val("MODEL=");
    let market = get_val("MARKET=");
    let model = if !market.is_empty() && !model_raw.is_empty() && market != model_raw {
        format!("{} ({})", market, model_raw)
    } else if !model_raw.is_empty() {
        model_raw
    } else {
        base_model.to_string()
    };

    let mem_str = get_val("MEM=");
    let (mut mem_tot_kb, mut mem_avail_kb) = (0f64, 0f64);
    let toks: Vec<&str> = mem_str.split_whitespace().collect();
    for pair in toks.chunks(2) {
        if pair.len() == 2 {
            if pair[0].starts_with("MemTotal") { mem_tot_kb = pair[1].parse().unwrap_or(0.0); }
            if pair[0].starts_with("MemAvailable") { mem_avail_kb = pair[1].parse().unwrap_or(0.0); }
        }
    }
    let ram_tot_gb = mem_tot_kb / 1_048_576.0;
    let ram_used_gb = (mem_tot_kb - mem_avail_kb).max(0.0) / 1_048_576.0;
    let ram_pct = if mem_tot_kb > 0.0 { ((ram_used_gb / ram_tot_gb) * 100.0).round() as u64 } else { 0 };

    let df_str = get_val("DF=");
    let df_toks: Vec<&str> = df_str.split_whitespace().collect();
    let df_tot_gb = df_toks.first().and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_048_576.0;
    let df_used_gb = df_toks.get(1).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_048_576.0;
    let df_free_gb = df_toks.get(2).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_048_576.0;
    let df_pct: u64 = df_toks.get(3).map(|s| s.trim_end_matches('%')).and_then(|v| v.parse().ok()).unwrap_or(0);

    let bat_str = get_val("BAT=");
    let (mut bat_lvl, mut temp_c, mut charging, mut volt_mv) = (0u64, 0.0f64, false, 0u64);
    let btoks: Vec<&str> = bat_str.split_whitespace().collect();
    for pair in btoks.chunks(2) {
        if pair.len() == 2 {
            if pair[0].starts_with("level:") { bat_lvl = pair[1].parse().unwrap_or(0); }
            if pair[0].starts_with("temperature:") { temp_c = pair[1].parse::<f64>().unwrap_or(0.0) / 10.0; }
            if pair[0].starts_with("status:") { charging = pair[1] == "2" || pair[1] == "5"; }
            if pair[0].starts_with("voltage:") { volt_mv = pair[1].parse().unwrap_or(0); }
        }
    }

    let load_str = get_val("LOAD=");
    let load_toks: Vec<&str> = load_str.split_whitespace().collect();
    let load1 = load_toks.first().copied().unwrap_or("0.0").to_string();
    let cpu_pct = ((load1.parse::<f64>().unwrap_or(0.0) / 8.0) * 100.0).clamp(1.0, 100.0).round() as u64;
    let res = get_val("RES=").replace('x', " × ");
    let vboot = get_val("VBOOT=");
    let flash_locked = get_val("FLASH=") == "1";

    json!({
        "serial": serial, "model": model, "marketName": market,
        "androidVersion": get_val("VER="), "resolution": if res.is_empty() { "1080 × 2400".to_string() } else { res },
        "connectionType": conn, "state": "device", "connected": true, "platform": "android",
        "ram": format!("{:.1} GB", ram_tot_gb), "ramUsed": format!("{:.1} GB", ram_used_gb),
        "ramFreeMB": (mem_avail_kb / 1024.0).round() as u64, "ramUsagePercent": ram_pct,
        "storage": format!("{:.1} GB", df_tot_gb),
        "storageUsedGB": (df_used_gb * 10.0).round() / 10.0,
        "storageFreeGB": (df_free_gb * 10.0).round() / 10.0, "storageUsagePercent": df_pct,
        "cpuUsagePercent": cpu_pct, "cpuLoadAvg": load1,
        "activeThreads": load_toks.get(1).copied().unwrap_or("0/0"),
        "uptimeHours": format!("{} h", get_val("UP=")),
        "battery": bat_lvl, "isCharging": charging, "temperature": format!("{:.1}", temp_c),
        "batteryVoltageMv": volt_mv, "batteryTech": "Li-ion",
        "verifiedBootState": vboot, "bootloaderLocked": flash_locked,
    })
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
