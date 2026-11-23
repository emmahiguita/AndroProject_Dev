//! Operaciones explícitas de controladores Windows con rutas validadas.

use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::Path, process::Stdio, time::Duration};
use super::paths::silent_cmd;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverRequest { action: String, file_path: String }

/// Verifica el catálogo o solicita a Windows instalar un INF; nunca eleva privilegios.
pub async fn run(Json(request): Json<DriverRequest>) -> Json<Value> {
    let extension = match request.action.as_str() {
        "verify_cat" => "cat", "install_inf" => "inf",
        _ => return Json(json!({"success": false, "error": "Acción de controlador no admitida"})),
    };
    let path = Path::new(&request.file_path);
    if path.extension().and_then(|v| v.to_str()).map(|v| v.to_ascii_lowercase()).as_deref() != Some(extension) || !path.is_file() {
        return Json(json!({"success": false, "error": format!("Selecciona un archivo .{extension} existente") }));
    }
    let path = match std::fs::canonicalize(path) {
        Ok(path) => path, Err(error) => return Json(json!({"success": false, "error": error.to_string()})),
    };
    // Las herramientas clásicas de Windows no siempre aceptan el prefijo extendido de Rust.
    let native_path = path.to_string_lossy();
    let native_path = if let Some(unc) = native_path.strip_prefix(r"\\?\UNC\") { format!(r"\\{unc}") }
        else { native_path.strip_prefix(r"\\?\").unwrap_or(&native_path).to_owned() };
    let mut cmd = if request.action == "verify_cat" {
        let mut cmd = silent_cmd("powershell.exe");
        // La ruta viaja en una variable de entorno, no se interpreta como código PowerShell.
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", "$s=Get-AuthenticodeSignature -LiteralPath $env:ANDRO_DRIVER_FILE; $s | Select-Object Status,StatusMessage | ConvertTo-Json -Compress"])
            .env("ANDRO_DRIVER_FILE", &native_path);
        cmd
    } else {
        let mut cmd = silent_cmd("pnputil.exe");
        cmd.args(["/add-driver"]).arg(&native_path).arg("/install");
        cmd
    };
    cmd.kill_on_drop(true).stdout(Stdio::piped()).stderr(Stdio::piped());
    let result = tokio::time::timeout(Duration::from_secs(120), cmd.output()).await;
    let output = match result {
        Ok(Ok(out)) => out,
        Ok(Err(error)) => return Json(json!({"success": false, "error": error.to_string()})),
        Err(_) => return Json(json!({"success": false, "error": "La operación de controladores agotó el tiempo de espera"})),
    };
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    if !output.status.success() {
        return Json(json!({"success": false, "error": if stderr.is_empty() { stdout } else { stderr }}));
    }
    if request.action == "verify_cat" {
        let value: Value = match serde_json::from_str(&stdout) {
            Ok(value) => value, Err(error) => return Json(json!({"success": false, "error": format!("Respuesta de firma no válida: {error}")})),
        };
        // PowerShell serializa SignatureStatus.Valid como el valor numérico cero.
        let valid = value["Status"].as_i64() == Some(0) || value["Status"].as_str() == Some("Valid");
        return Json(json!({"success": valid, "message": if valid { "Firma del catálogo válida" } else { "" }, "error": if valid { "" } else { value["StatusMessage"].as_str().unwrap_or("Firma no válida o no verificada") }}));
    }
    Json(json!({"success": true, "message": stdout}))
}
