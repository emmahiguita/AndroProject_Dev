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
use super::paths::{adb_shell, safe_serial};

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
    let anim = live["animScale"].as_str().unwrap_or("1.0");
    let stay = live["stayAwake"].as_bool().unwrap_or(false);
    let touches = live["showTouches"].as_bool().unwrap_or(false);
    if action == "get_perf_status" {
        return json!({
            "success": true,
            "status": {
                "animScale": anim,
                "stayAwake": stay,
                "showTouches": touches,
                "profile": "balanced",
                "adbActive": !serial.is_empty(),
            }
        });
    }
    json!({
        "success": true,
        "settings": {
            "windowAnimationScale": anim,
            "transitionAnimationScale": anim,
            "animatorDurationScale": anim,
            "stayAwake": stay,
            "showTouches": touches,
            "wifiScanThrottle": true,
        }
    })
}

/// `POST /api/config` — Modifica ajustes reales del sistema Android en vivo.
pub async fn post_config(Json(body): Json<Value>) -> Json<Value> {
    let action = body["action"].as_str().unwrap_or("");
    let serial = safe_serial(body["serial"].as_str().unwrap_or(""));
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
            let v = body["value"].as_str().unwrap_or("1.0");
            format!("settings put global window_animation_scale {0}; settings put global transition_animation_scale {0}; settings put global animator_duration_scale {0}", v)
        }
        "set_screen_timeout" => {
            let ms = body["value"].as_u64().unwrap_or(60000);
            format!("settings put system screen_off_timeout {}", ms)
        }
        _ => return Json(json!({ "success": true, "message": "Configuración actualizada" })),
    };
    let (ok, _, err) = adb_shell(&serial, &cmd, 4000).await;
    Json(json!({ "success": ok, "message": if ok { "Ajuste aplicado" } else { "Error aplicando ajuste" }, "error": err }))
}
