//! Ajustes Android que pueden comprobarse después de escribirlos por ADB.

use serde_json::{json, Value};
use super::paths::adb_shell;

/// Lee los ajustes de red y pantalla que pueden mostrarse sin inventar valores.
pub async fn read(serial: &str) -> Value {
    if serial.is_empty() { return json!({ "success": false, "error": "Serial requerido" }); }
    let cmd = "settings get global private_dns_mode; echo ---; settings get global private_dns_specifier; echo ---; settings get system screen_brightness_mode; echo ---; settings get secure ui_night_mode";
    let (ok, output, error) = adb_shell(serial, cmd, 5000).await;
    let values: Vec<&str> = output.split("---").map(str::trim).collect();
    if !ok || values.len() != 4 {
        return json!({ "success": false, "error": format!("No se pudieron leer ajustes de red y pantalla: {}", error) });
    }
    let mode = match values[0] { "hostname" => "hostname", "off" => "off", _ => "automatic" };
    let hostname = if values[1] == "null" { "" } else { values[1] };
    let profile = match (mode, hostname) {
        ("off", _) => Some("off"), ("hostname", "dns.adguard-dns.com") => Some("default"),
        ("hostname", "family.adguard-dns.com") => Some("family"),
        ("hostname", "unfiltered.adguard-dns.com") => Some("nonfiltering"), _ => None,
    };
    json!({ "success": true, "privateDnsMode": mode, "privateDnsSpecifier": hostname,
        "adguardProfile": profile, "autoBrightness": values[2] == "1", "nightMode": values[3] })
}

/// Ejecuta la acción elegida desde la interfaz y comunica el resultado de ADB.
pub async fn run_maintenance(serial: &str, action: &str) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let command = match action {
        "optimize_ram" => "am kill-all",
        "run_trim" => "pm trim-caches 1G",
        _ => return json!({"success": false, "error": "Acción no reconocida"}),
    };
    let (ok, output, error) = adb_shell(serial, command, 15000).await;
    if !ok || output.contains("Error") || output.contains("Exception") || output.contains("Failure") {
        return json!({"success": false, "error": if error.is_empty() { output } else { error }});
    }
    let message = if action == "optimize_ram" {
        "Android recibió la solicitud de detener procesos en segundo plano"
    } else {
        "Android recibió la solicitud de limpieza de caché"
    };
    json!({"success": true, "message": message})
}

/// Applies only known, reversible performance settings and confirms each one.
pub async fn apply_perf_profile(serial: &str, profile: &str) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let settings: &[(&str, &str, &str)] = match profile {
        "balanced" | "fluid" => &[
            ("global", "development_settings_enabled", "1"),
            ("global", "window_animation_scale", "0.5"),
            ("global", "transition_animation_scale", "0.5"),
            ("global", "animator_duration_scale", "0.5"),
        ],
        "gaming" => &[
            ("global", "development_settings_enabled", "1"),
            ("global", "window_animation_scale", "0.0"),
            ("global", "transition_animation_scale", "0.0"),
            ("global", "animator_duration_scale", "0.0"),
        ],
        "restore" => &[
            ("global", "window_animation_scale", "1.0"),
            ("global", "transition_animation_scale", "1.0"),
            ("global", "animator_duration_scale", "1.0"),
        ],
        _ => return json!({"success": false, "error": "Perfil Turbo no válido"}),
    };

    let mut applied = Vec::with_capacity(settings.len());
    for (scope, key, value) in settings {
        let command = format!("settings put {} {} {}", scope, key, value);
        let (ok, output, error) = adb_shell(serial, &command, 5000).await;
        if !ok || output.contains("Error") || output.contains("Exception") {
            return json!({"success": false, "applied": applied, "error": if error.is_empty() { output } else { error }});
        }
        let (verified, actual, read_error) = adb_shell(serial, &format!("settings get {} {}", scope, key), 5000).await;
        if !verified || actual.trim() != *value {
            return json!({"success": false, "applied": applied, "error": if read_error.is_empty() { format!("No se confirmó {}", key) } else { read_error }});
        }
        applied.push(key.to_string());
    }
    let status = super::developer_actions::status(serial).await;
    json!({"success": true, "applied": applied, "status": status.get("status"), "message": format!("Perfil {} aplicado y verificado", profile)})
}

/// Valida el destino, aplica un ajuste y confirma el valor leído del teléfono.
pub async fn apply(serial: &str, action: &str, body: &Value) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let choice: Option<(&str, &str, String)> = match action {
        "set_auto_brightness" => body["enabled"].as_bool().map(|v| ("system", "screen_brightness_mode", if v {"1"} else {"0"}.into())),
        "set_night_mode" => body["mode"].as_str().and_then(|v| match v {
            "0" => Some(("secure", "ui_night_mode", "0".into())),
            "1" => Some(("secure", "ui_night_mode", "1".into())),
            "2" => Some(("secure", "ui_night_mode", "2".into())),
            _ => None,
        }),
        "set_adguard_dns" => match body["profile"].as_str() {
            Some("off") => Some(("global", "private_dns_mode", "off".into())),
            Some("default") => Some(("global", "private_dns_specifier", "dns.adguard-dns.com".into())),
            Some("family") => Some(("global", "private_dns_specifier", "family.adguard-dns.com".into())),
            Some("nonfiltering") => Some(("global", "private_dns_specifier", "unfiltered.adguard-dns.com".into())),
            _ => None,
        },
        "set_private_dns" => match body["mode"].as_str() {
            Some("automatic") => Some(("global", "private_dns_mode", "opportunistic".into())),
            Some("hostname") => body["hostname"].as_str().filter(|h| h.len() <= 253 && h.contains('.') && h.split('.').all(|label| !label.is_empty() && label.len() <= 63 && !label.starts_with('-') && !label.ends_with('-') && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'))).map(|h| ("global", "private_dns_specifier", h.to_owned())),
            _ => None,
        },
        _ => None,
    };
    let Some((scope, key, value)) = choice else {
        return json!({"success": false, "error": "Valor no válido para este ajuste"});
    };
    let cmd = format!("settings put {} {} {}", scope, key, value);
    let (ok, output, error) = adb_shell(serial, &cmd, 5000).await;
    if !ok { return json!({"success": false, "error": if error.is_empty() { output } else { error }}); }
    if key == "private_dns_specifier" {
        let (ok, _, error) = adb_shell(serial, "settings put global private_dns_mode hostname", 5000).await;
        if !ok { return json!({"success": false, "error": format!("No se pudo activar el DNS configurado: {}", error)}); }
        let (verified, mode, _) = adb_shell(serial, "settings get global private_dns_mode", 5000).await;
        if !verified || mode.trim() != "hostname" {
            return json!({"success": false, "error": "El dispositivo no confirmó el modo de DNS privado"});
        }
    }
    let (ok, actual, error) = adb_shell(serial, &format!("settings get {} {}", scope, key), 5000).await;
    if !ok || actual.trim() != value {
        return json!({"success": false, "error": format!("No se pudo confirmar el ajuste: {}", error)});
    }
    json!({"success": true, "message": "Ajuste confirmado en el dispositivo"})
}
