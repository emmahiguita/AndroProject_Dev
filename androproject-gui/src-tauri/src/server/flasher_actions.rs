//! Acciones puntuales de ADB y Fastboot sobre el serial seleccionado.

use serde_json::{json, Value};
use std::{process::Stdio, time::Duration};
use super::paths::{adb_shell, fastboot_bin, run_adb, silent_cmd};

/// Lee variables que el propio bootloader publique; las ausentes quedan sin inventar.
pub async fn info(serial: &str) -> Value {
    let mut cmd = silent_cmd(fastboot_bin());
    cmd.kill_on_drop(true).args(["-s", serial, "getvar", "all"]).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut values = serde_json::Map::new();
    values.insert("serialno".into(), json!(serial));
    if let Ok(Ok(out)) = tokio::time::timeout(Duration::from_secs(8), cmd.output()).await {
        let text = format!("{}\n{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
        for line in text.lines() {
            let line = line.trim().strip_prefix("(bootloader)").unwrap_or(line).trim();
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim();
                if ["product", "current-slot", "unlocked", "secure", "max-download-size"].contains(&key) {
                    values.insert(key.into(), json!(value.trim()));
                }
            }
        }
    }
    Value::Object(values)
}

/// Ejecuta una acción conocida; los argumentos siempre se pasan por separado.
pub async fn run(serial: &str, action: &str, slot: &str) -> Value {
    let adb_args: Option<Vec<&str>> = match action {
        "reboot_system" => Some(vec!["reboot"]),
        "reboot_recovery" => Some(vec!["reboot", "recovery"]),
        "reboot_fastbootd" => Some(vec!["reboot", "fastboot"]),
        _ => None,
    };
    if let Some(args) = adb_args {
        let mut full = vec!["-s", serial];
        full.extend(args);
        let (ok, out, err) = run_adb(&full, 10000).await;
        return json!({"success": ok, "message": if ok { "Comando ADB enviado" } else { "" }, "error": if err.is_empty() { out.trim() } else { err.trim() }});
    }
    if action == "open_oem_settings" || action == "oem_unlock_check" {
        let command = if action == "open_oem_settings" { "am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS" } else { "settings get global oem_unlock_allowed" };
        let (ok, out, err) = adb_shell(serial, command, 6000).await;
        let success = ok && !out.contains("Error") && !out.contains("Exception");
        return json!({"success": success, "message": out.trim(), "error": err.trim()});
    }
    // Para ir al bootloader, primero se comprueba si el teléfono está en ADB.
    if action == "reboot_bootloader" {
        let (ok, state, _) = run_adb(&["-s", serial, "get-state"], 4000).await;
        if ok && matches!(state.trim(), "device" | "recovery") {
            let (sent, out, err) = run_adb(&["-s", serial, "reboot", "bootloader"], 10000).await;
            return json!({"success": sent, "message": if sent { "Reinicio a bootloader solicitado" } else { "" }, "error": if err.is_empty() { out.trim() } else { err.trim() }});
        }
    }
    let args: Vec<&str> = match action {
        "reboot" | "fastboot_reboot" => vec!["reboot"],
        "reboot_bootloader" => vec!["reboot-bootloader"],
        "fastboot_oem_device_info" => vec!["oem", "device-info"],
        "fastboot_unlock" => vec!["flashing", "unlock"],
        "fastboot_lock" => vec!["flashing", "lock"],
        "fastboot_erase_partition" => vec!["erase", "cache"],
        "fastboot_set_slot" if slot == "a" || slot == "b" => vec!["set_active", slot],
        _ => return json!({"success": false, "error": format!("Operación no implementada: {action}")}),
    };
    let mut cmd = silent_cmd(fastboot_bin());
    cmd.kill_on_drop(true).args(["-s", serial]).args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    match tokio::time::timeout(Duration::from_secs(30), cmd.output()).await {
        Ok(Ok(out)) => {
            // Fastboot suele escribir sus resultados en stderr incluso cuando tiene éxito.
            let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
            let success = out.status.success() && !text.contains("FAILED");
            json!({"success": success, "message": if success { text.trim() } else { "" }, "error": if success { "" } else { text.trim() }})
        }
        Ok(Err(error)) => json!({"success": false, "error": error.to_string()}),
        Err(_) => json!({"success": false, "error": "Fastboot agotó el tiempo de espera"}),
    }
}
