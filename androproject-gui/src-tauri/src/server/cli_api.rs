//! Detección de ADB y ejecución de consultas de diagnóstico desde CLI.

use axum::{http::StatusCode, Json};
use serde_json::{json, Value};
use super::paths::{adb_shell, run_adb, safe_serial};

/// Comprueba ADB en el equipo y declara los motores que tiene esta integración.
pub async fn discover() -> Json<Value> {
    let (adb, _, _) = run_adb(&["version"], 3000).await;
    Json(json!({"success": true, "ollama": {"online": false, "models": []},
        "clis": {"adb": adb, "claude": false, "ollama": false}}))
}

/// Ejecuta las consultas ADB ofrecidas por la interfaz para un serial explícito.
/// La lista fija impide que una página externa use esta ruta como consola arbitraria.
pub async fn execute(Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    if body["mode"].as_str() != Some("adb") {
        return (StatusCode::NOT_IMPLEMENTED, Json(json!({"success": false, "error": "Este motor todavía no está conectado al servidor Rust"})));
    }
    let raw_serial = body["serial"].as_str().unwrap_or("");
    let serial = safe_serial(raw_serial);
    let command = body["prompt"].as_str().unwrap_or("").trim();
    if serial.is_empty() || serial != raw_serial.trim() {
        return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Selecciona un dispositivo Android válido"})));
    }
    if !matches!(command, "getprop ro.product.model" | "dumpsys battery" | "cat /proc/meminfo" | "pm list packages -3") {
        return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": "Consulta ADB no disponible en este módulo"})));
    }
    let (ok, output, error) = adb_shell(&serial, command, 10000).await;
    if !ok {
        return (StatusCode::BAD_GATEWAY, Json(json!({"success": false, "error": error})));
    }
    (StatusCode::OK, Json(json!({"success": true, "output": output, "meta": {"provider": "ADB"}, "suggestions": []})))
}
