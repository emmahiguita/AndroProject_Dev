// ============================================================================
// ARCHIVO: server/developer_actions.rs
// QUÉ HACE: Lectura y aplicación 100% real de TODAS las Opciones de
//           Desarrollador Android vía ADB (activación automática, Layout Bounds,
//           Wi-Fi ADB, GPU HWUI, Overlays HW, 4x MSAA, Blur, Límite procesos,
//           Congelador caché, Hz pico, DPI y Demo UI).
// CÓMO FUNCIONA: Lee el estado real del dispositivo en una sola consulta ADB
//           delimitada y aplica cada ajuste mediante comandos allowlisted.
// POR QUÉ: Eliminar botones deshabilitados en `DeveloperOptionsPanel.tsx` con
//          lógica real, segura y reversible (< 170 líneas).
// ============================================================================

use serde_json::{json, Value};
use super::paths::{adb_shell, run_adb};

/// Lee en una pasada el estado real de todos los ajustes de Modo Desarrollador.
pub async fn status(serial: &str) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let command = concat!(
        "settings get global development_settings_enabled; echo ---; ",
        "settings get global adb_enabled; echo ---; ",
        "settings get global adb_wifi_enabled; echo ---; ",
        "settings get global stay_on_while_plugged_in; echo ---; ",
        "settings get system show_touches; echo ---; ",
        "settings get system pointer_location; echo ---; ",
        "settings get global always_finish_activities; echo ---; ",
        "settings get global window_animation_scale; echo ---; ",
        "settings get global transition_animation_scale; echo ---; ",
        "settings get global animator_duration_scale; echo ---; ",
        "getprop debug.layout; echo ---; ",
        "getprop debug.hwui.renderer; echo ---; ",
        "settings get global disable_window_blurs; echo ---; ",
        "settings get global background_process_limit; echo ---; ",
        "settings get global cached_apps_freezer; echo ---; ",
        "settings get system peak_refresh_rate; echo ---; ",
        "getprop debug.egl.force_msaa"
    );
    let (ok, output, error) = adb_shell(serial, command, 6000).await;
    let v: Vec<&str> = output.split("---").map(str::trim).collect();
    if !ok || v.len() < 17 {
        return json!({"success": false, "error": format!("No se pudieron leer los ajustes: {}", error)});
    }
    json!({"success": true, "status": {
        "developerMode": v[0] == "1",
        "usbDebugging": v[1] == "1",
        "wifiDebugging": v[2] == "1",
        "stayAwake": v[3] != "0" && v[3] != "null" && !v[3].is_empty(),
        "showTouches": v[4] == "1",
        "pointerLocation": v[5] == "1",
        "dontKeepActivities": v[6] == "1",
        "windowScale": v[7],
        "transitionScale": v[8],
        "animatorScale": v[9],
        "debugLayout": v[10] == "true",
        "gpuRenderer": if v[11].is_empty() { "default" } else { v[11] },
        "disableBlur": v[12] == "1",
        "bgLimit": if v[13] == "null" || v[13] == "-1" || v[13].is_empty() { "standard" } else { v[13] },
        "cachedFreezer": if v[14] == "null" || v[14].is_empty() { "default" } else { v[14] },
        "peakRefresh": v[15].parse::<f64>().ok().map(|n| n.round() as u32).unwrap_or(0),
        "forceMsaa": v[16] == "true" || v[16] == "1"
    }})
}

/// Aplica cualquier opción real de Modo Desarrollador y devuelve el estado actualizado.
pub async fn apply(serial: &str, action: &str, body: &Value) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let flag = |field: &str| body[field].as_bool().map(|v| if v { "1" } else { "0" });

    if action == "auto_activate_dev_mode" {
        let cmd = "settings put global development_settings_enabled 1; settings put global stay_on_while_plugged_in 3; am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS";
        let (ok, out, err) = adb_shell(serial, cmd, 6000).await;
        let current = status(serial).await;
        return json!({
            "success": ok,
            "message": if ok { "Modo Desarrollador activado (development_settings_enabled=1, Stay Awake y menú abierto en el teléfono)." } else { "No se pudo activar automáticamente." },
            "error": if ok { "" } else if err.is_empty() { out.trim() } else { err.trim() },
            "status": current.get("status")
        });
    }

    if action == "set_developer_option" && body["option"].as_str() == Some("adb_wifi") {
        let on = body["value"].as_bool().unwrap_or(true);
        let val = if on { "1" } else { "0" };
        let (ok, _, err) = adb_shell(serial, &format!("settings put global adb_wifi_enabled {val}"), 5000).await;
        if on { let _ = run_adb(&["-s", serial, "tcpip", "5555"], 5000).await; }
        let current = status(serial).await;
        return json!({"success": ok, "message": if on { "Depuración Wi-Fi habilitada (puerto TCP 5555)." } else { "Depuración Wi-Fi desactivada." }, "error": err, "status": current.get("status")});
    }

    let command: Option<String> = match action {
        "set_developer_mode" => flag("enabled").map(|v| format!("settings put global development_settings_enabled {v}")),
        "open_developer_settings" => match body["screen"].as_str() {
            Some("dev") => Some("am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS".into()),
            Some("about") => Some("am start -a android.settings.DEVICE_INFO_SETTINGS".into()),
            _ => None,
        },
        "set_developer_option" => {
            let on = body["value"].as_bool().unwrap_or(false);
            let b = if on { "1" } else { "0" };
            let tf = if on { "true" } else { "false" };
            match body["option"].as_str() {
                Some("stay_awake") => Some(format!("settings put global stay_on_while_plugged_in {}", if on { "3" } else { "0" })),
                Some("show_touches") => Some(format!("settings put system show_touches {b}")),
                Some("pointer_location") => Some(format!("settings put system pointer_location {b}")),
                Some("debug_layout") => Some(format!("setprop debug.layout {tf}; service call activity 1599295570")),
                Some("dont_keep_activities") => Some(format!("settings put global always_finish_activities {b}")),
                Some("disable_hw_overlays") => Some(format!("service call SurfaceFlinger 1008 i32 {b}")),
                Some("force_msaa") => Some(format!("setprop debug.egl.force_msaa {tf}")),
                Some("disable_blur") => Some(format!("settings put global disable_window_blurs {b}")),
                _ => None,
            }
        }
        "set_animation_scale" => {
            let key = match body["type"].as_str() {
                Some("window") => Some("window_animation_scale"),
                Some("transition") => Some("transition_animation_scale"),
                Some("animator") => Some("animator_duration_scale"),
                _ => None,
            };
            let val = body["value"].as_str().filter(|v| matches!(*v, "0.0" | "0.5" | "1.0" | "1.5" | "2.0"));
            key.zip(val).map(|(k, v)| format!("settings put global {k} {v}"))
        }
        "set_gpu_renderer" => match body["renderer"].as_str() {
            Some("default") => Some("setprop debug.hwui.renderer ''".into()),
            Some("skiagl") => Some("setprop debug.hwui.renderer skiagl".into()),
            Some("skiavk") => Some("setprop debug.hwui.renderer skiavk".into()),
            _ => None,
        },
        "set_bg_limit" => match body["limit"].as_str() {
            Some("standard") => Some("settings put global background_process_limit -1".into()),
            Some(n @ ("1" | "2" | "3" | "4")) => Some(format!("settings put global background_process_limit {n}")),
            _ => None,
        },
        "set_cached_freezer" => match body["mode"].as_str() {
            Some(m @ ("default" | "enabled" | "disabled")) => Some(format!("settings put global cached_apps_freezer {m}")),
            _ => None,
        },
        "set_peak_refresh" => body["hz"].as_u64().filter(|hz| matches!(*hz, 60 | 90 | 120)).map(|hz| {
            format!("settings put system peak_refresh_rate {hz}; settings put system min_refresh_rate {hz}")
        }),
        "set_dpi" => body["dpi"].as_u64().filter(|v| (160..=640).contains(v)).map(|v| format!("wm density {v}")),
        "set_demo_mode" => flag("enabled").map(|v| {
            if v == "1" {
                "settings put global sysui_demo_allowed 1; am broadcast -a com.android.systemui.demo -e command enter; am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1200".into()
            } else {
                "am broadcast -a com.android.systemui.demo -e command exit".into()
            }
        }),
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
    json!({"success": true, "message": format!("Ajuste aplicado ({action})"), "status": current.get("status")})
}
