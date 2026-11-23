//! Operaciones de desarrollador que se pueden leer y comprobar mediante ADB.

use serde_json::{json, Value};
use super::paths::adb_shell;

/// Lee ajustes separados para no confundir las tres escalas de animación.
pub async fn status(serial: &str) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let command = "settings get global development_settings_enabled; echo ---; settings get global adb_enabled; echo ---; settings get global adb_wifi_enabled; echo ---; settings get global stay_on_while_plugged_in; echo ---; settings get system show_touches; echo ---; settings get system pointer_location; echo ---; settings get global always_finish_activities; echo ---; settings get global window_animation_scale; echo ---; settings get global transition_animation_scale; echo ---; settings get global animator_duration_scale";
    let (ok, output, error) = adb_shell(serial, command, 5000).await;
    let values: Vec<&str> = output.split("---").map(str::trim).collect();
    if !ok || values.len() != 10 || values.iter().any(|v| v.contains('\n')) {
        return json!({"success": false, "error": format!("No se pudieron leer los ajustes: {}", error)});
    }
    json!({"success": true, "status": {
        "developerMode": values[0] == "1", "usbDebugging": values[1] == "1",
        "wifiDebugging": values[2] == "1", "stayAwake": values[3] != "0" && values[3] != "null",
        "showTouches": values[4] == "1", "pointerLocation": values[5] == "1",
        "dontKeepActivities": values[6] == "1", "windowScale": values[7],
        "transitionScale": values[8], "animatorScale": values[9]
    }})
}

/// Traduce únicamente opciones conocidas a comandos fijos y relee el resultado.
pub async fn apply(serial: &str, action: &str, body: &Value) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let flag = |field: &str| body[field].as_bool().map(|v| if v { "1" } else { "0" });
    let command = match action {
        "set_developer_mode" => flag("enabled").map(|v| format!("settings put global development_settings_enabled {}", v)),
        "open_developer_settings" => match body["screen"].as_str() {
            Some("dev") => Some("am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS".into()),
            Some("about") => Some("am start -a android.settings.DEVICE_INFO_SETTINGS".into()),
            _ => None,
        },
        "set_developer_option" => {
            let key = match body["option"].as_str() {
                Some("stay_awake") => Some(("global", "stay_on_while_plugged_in")),
                Some("show_touches") => Some(("system", "show_touches")),
                Some("pointer_location") => Some(("system", "pointer_location")),
                Some("dont_keep_activities") => Some(("global", "always_finish_activities")),
                _ => None,
            };
            key.zip(flag("value")).map(|((scope, name), v)| {
                let value = if name == "stay_on_while_plugged_in" && v == "1" { "3" } else { v };
                format!("settings put {} {} {}", scope, name, value)
            })
        }
        "set_animation_scale" => {
            let key = match body["type"].as_str() {
                Some("window") => Some("window_animation_scale"),
                Some("transition") => Some("transition_animation_scale"),
                Some("animator") => Some("animator_duration_scale"),
                _ => None,
            };
            let value = body["value"].as_str().filter(|v| matches!(*v, "0.0" | "0.5" | "1.0" | "1.5" | "2.0"));
            key.zip(value).map(|(name, v)| format!("settings put global {} {}", name, v))
        }
        "set_dpi" => body["dpi"].as_u64().filter(|v| (160..=640).contains(v)).map(|v| format!("wm density {}", v)),
        _ => None,
    };
    let Some(cmd) = command else {
        return json!({"success": false, "error": "Opción no implementada o valor no válido"});
    };
    let (ok, out, err) = adb_shell(serial, &cmd, 5000).await;
    if !ok || out.contains("Error:") || out.contains("Exception") {
        return json!({"success": false, "error": if err.is_empty() { out } else { err }});
    }
    let current = status(serial).await;
    json!({"success": true, "message": "Comando enviado al dispositivo", "status": current.get("status")})
}
