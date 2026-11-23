// ============================================================================
// ARCHIVO: server/extra_actions.rs
// QUÉ HACE: Handlers nativos en Rust para estado ADB (`get_adb_status`),
//           lectura de ajustes del Optimizador (`get_optimizer_settings`,
//           `get_perf_status`) y escritura de ajustes en vivo (`POST /api/config`).
// CÓMO FUNCIONA: Consulta `adb devices -l` y `adb shell settings get/put` en
//           lote con `CREATE_NO_WINDOW`, devolviendo el contrato JSON exacto.
// POR QUÉ: Mantener `actions_api.rs` y `device_api.rs` < 200 líneas (SRP).
// ============================================================================

use axum::Json;
use serde_json::{json, Value};

use super::device_api::list_adb_devices;
use super::paths::{adb_shell, safe_serial, scrcpy_bin, silent_cmd};
use std::process::Stdio;
use std::time::Duration;

/// Responde `action: "get_adb_status"` para el indicador superior de ADB.
pub async fn handle_get_adb_status() -> Value {
    let devices = list_adb_devices().await;
    json!({
        "success": true,
        "serverRunning": true,
        "devices": devices,
    })
}

/// Lee ajustes reales del sistema Android para `ConfigView` (`/api/config`).
pub async fn read_live_android_settings(serial: &str) -> Value {
    if serial.is_empty() {
        return Value::Null;
    }
    let cmd = "settings get global stay_on_while_plugged_in; echo ---; settings get system show_touches; echo ---; settings get global window_animation_scale; echo ---; settings get system screen_off_timeout; echo ---; wm density";
    let (ok, out, _) = adb_shell(serial, cmd, 3500).await;
    if !ok || out.trim().is_empty() {
        return Value::Null;
    }
    let parts: Vec<&str> = out.split("---").map(|s| s.trim()).collect();
    let stay_val: i32 = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let show_touches = parts.get(1).copied().unwrap_or("0") == "1";
    let anim_num: f64 = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(1.0);
    let timeout_ms: u64 = parts.get(3).and_then(|s| s.parse().ok()).unwrap_or(60000);
    let dpi = parts
        .get(4)
        .and_then(|s| s.split_whitespace().last())
        .filter(|s| s.chars().all(|c| c.is_ascii_digit()))
        .map(|d| format!("{} dpi", d))
        .unwrap_or_else(|| "--".to_string());

    json!({
        "stayAwake": stay_val > 0,
        "showTouches": show_touches,
        "animScale": format!("{:.1}", anim_num),
        "screenTimeoutMs": timeout_ms,
        "densityDpi": dpi,
    })
}

/// Responde `get_optimizer_settings` y `get_perf_status` para la vista Optimizador.
pub async fn handle_optimizer_query(serial: &str, action: &str) -> Value {
    let live = read_live_android_settings(serial).await;
    // Un teléfono inaccesible no debe aparecer como una lectura satisfactoria.
    if live.is_null() {
        return json!({ "success": false, "error": "No se pudieron leer los ajustes del dispositivo" });
    }
    let state = super::developer_actions::status(serial).await;
    if state["success"] != true { return state; }
    let status = &state["status"];
    let display = super::optimizer_actions::read(serial).await;
    let stay = live["stayAwake"].as_bool().unwrap_or(false);
    let touches = live["showTouches"].as_bool().unwrap_or(false);
    if action == "get_perf_status" {
        return state;
    }
    json!({
        "success": true,
        "settings": {
            "animScales": {
                "window_animation_scale": status["windowScale"],
                "transition_animation_scale": status["transitionScale"],
                "animator_duration_scale": status["animatorScale"],
            },
            "stayAwake": stay,
            "showTouches": touches,
            "privateDnsMode": display.get("privateDnsMode"),
            "privateDnsSpecifier": display.get("privateDnsSpecifier"),
            "adguardProfile": display.get("adguardProfile"),
            "autoBrightness": display.get("autoBrightness"),
            "nightMode": display.get("nightMode"),
        }
    })
}

/// `POST /api/config` — Modifica ajustes reales del sistema Android en vivo.
pub async fn post_config(Json(body): Json<Value>) -> Json<Value> {
    let action = body["action"].as_str().unwrap_or("");
    let raw_serial = body["serial"].as_str().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    // Exigir serial evita modificar otro móvil cuando hay varias conexiones.
    if serial.is_empty() || serial != raw_serial {
        return Json(json!({ "success": false, "error": "Serial requerido" }));
    }
    let cmd = match action {
        "set_stay_awake" => {
            let v = if body["value"].as_bool().unwrap_or(false) { "3" } else { "0" };
            format!("settings put global stay_on_while_plugged_in {}", v)
        }
        "set_show_touches" => {
            let v = if body["value"].as_bool().unwrap_or(false) { "1" } else { "0" };
            format!("settings put system show_touches {}", v)
        }
        "set_anim_scale" => {
            // Solo se permiten valores ofrecidos por la interfaz, sin texto shell.
            let Some(v @ ("0.0" | "0.5" | "1.0")) = body["value"].as_str() else {
                return Json(json!({ "success": false, "error": "Escala de animación no válida" }));
            };
            format!("settings put global window_animation_scale {0}; settings put global transition_animation_scale {0}; settings put global animator_duration_scale {0}", v)
        }
        "set_screen_timeout" => {
            let ms = body["value"].as_u64().unwrap_or(60000);
            format!("settings put system screen_off_timeout {}", ms)
        }
        _ => return Json(json!({ "success": false, "error": format!("Ajuste no implementado: {}", action) })),
    };
    let (ok, _, err) = adb_shell(&serial, &cmd, 4000).await;
    let settings = if ok { read_live_android_settings(&serial).await } else { Value::Null };
    Json(json!({ "success": ok, "message": if ok { "Ajuste aplicado" } else { "Error aplicando ajuste" }, "error": err, "deviceSettings": settings }))
}

/// Construye argumentos reales de VisionNano / Cámara (Android 12+) para `open_screen`.
pub fn build_screen_args(serial: &str, body: &Value) -> Vec<String> {
    let fps = body["maxFps"].as_str().map(|s| s.to_string()).unwrap_or_else(|| body["maxFps"].as_u64().unwrap_or(60).to_string());
    let size = body["maxSize"].as_str().map(|s| s.to_string()).unwrap_or_else(|| body["maxSize"].as_u64().unwrap_or(1080).to_string());
    let rate = body["bitRate"].as_str().unwrap_or("16M").to_string();
    let is_cam = body["videoSource"].as_str() == Some("camera");

    let mut args = vec!["-s".into(), serial.into(), "--video-codec=h264".into(), "-b".into(), rate, "--video-buffer=0".into(), "--no-audio".into(), "--render-driver=direct3d11".into()];
    if is_cam {
        args.push("--video-source=camera".into());
        let facing = body["cameraFacing"].as_str().unwrap_or("back");
        args.push(format!("--camera-facing={}", facing));
        if let Some(cs) = body["cameraSize"].as_str().filter(|s| !s.is_empty() && *s != "auto") {
            args.push(format!("--camera-size={}", cs));
        }
        args.push(format!("--camera-fps={}", fps));
        if body["cameraTorch"].as_bool().unwrap_or(false) { args.push("--camera-torch".into()); }
    } else {
        args.push("--max-size".into()); args.push(size);
        args.push(format!("--max-fps={}", fps));
    }
    if body["stayAwake"].as_bool().unwrap_or(true) { args.push("--stay-awake".into()); }
    if body["turnScreenOff"].as_bool().unwrap_or(false) && !is_cam { args.push("--turn-screen-off".into()); }
    if body["alwaysOnTop"].as_bool().unwrap_or(false) { args.push("--always-on-top".into()); }
    if body["borderless"].as_bool().unwrap_or(false) { args.push("--window-borderless".into()); }
    args
}

/// Lista dinámicamente las cámaras físicas (trasera, frontal, gran angular) de cualquier Android 12+.
pub async fn handle_list_cameras(serial: &str) -> Value {
    if serial.is_empty() { return json!({ "success": false, "cameras": [], "error": "Serial requerido" }); }
    let mut cmd = silent_cmd(scrcpy_bin());
    cmd.args(["-s", serial, "--list-cameras"]).stdout(Stdio::piped()).stderr(Stdio::piped());
    let out = tokio::time::timeout(Duration::from_secs(6), cmd.output()).await.ok().and_then(|r| r.ok());
    let raw = out.map(|o| format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr))).unwrap_or_default();
    let cameras: Vec<String> = raw.lines().filter(|l| l.contains("--camera-id=")).map(|l| l.trim().to_string()).collect();
    json!({ "success": !cameras.is_empty(), "cameras": cameras, "raw": raw.trim() })
}
