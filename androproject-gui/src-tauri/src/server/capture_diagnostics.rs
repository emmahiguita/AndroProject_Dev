//! Consulta la disponibilidad de una captura ADB sin modificar el dispositivo.

use std::process::Stdio;
use std::time::Duration;
use serde_json::{json, Value};
use super::paths::{adb_bin, silent_cmd};

/// Comprueba si ADB devuelve un PNG, sin inferir la causa de un bloqueo visual.
pub async fn diagnose(serial: &str) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let mut cmd = silent_cmd(adb_bin());
    cmd.kill_on_drop(true).args(["-s", serial, "exec-out", "screencap", "-p"])
        .stdout(Stdio::piped()).stderr(Stdio::piped());
    match tokio::time::timeout(Duration::from_secs(8), cmd.output()).await {
        Ok(Ok(output)) if output.status.success() && output.stdout.starts_with(b"\x89PNG\r\n\x1a\n") => json!({
            "success": true, "captureTestOk": true, "repaired": false, "fixes": [],
            "findings": ["El dispositivo devolvió una imagen PNG por ADB"],
            "message": "Captura ADB disponible"
        }),
        Ok(Ok(output)) => json!({"success": false, "error": format!("La captura ADB no devolvió un PNG válido: {}", String::from_utf8_lossy(&output.stderr).trim())}),
        Ok(Err(error)) => json!({"success": false, "error": format!("No se pudo iniciar ADB: {}", error)}),
        Err(_) => json!({"success": false, "error": "La captura ADB no respondió a tiempo"}),
    }
}
