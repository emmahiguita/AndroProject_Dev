//! Coordina las consultas periódicas con el encendido y apagado solicitados.
use super::paths::run_adb;
use serde_json::{json, Value};
use tokio::sync::RwLock;

static PAUSED: RwLock<bool> = RwLock::const_new(false);

/// ADB inicia su daemon al enumerar. La pausa evita reactivarlo desde el sondeo.
pub async fn enumerate() -> (bool, String, String) {
    let paused = PAUSED.read().await;
    if *paused { return (false, String::new(), "Servidor ADB detenido desde el estudio".into()); }
    run_adb(&["devices", "-l"], 4000).await
}

/// Serializa el cambio de estado con la enumeración en curso.
pub async fn control(action: &str) -> Value {
    let mut paused = PAUSED.write().await;
    if action != "start_adb_server" {
        let (ok, _, err) = run_adb(&["kill-server"], 4000).await;
        if !ok { return json!({"success":false,"error":err}); }
        *paused = true;
    }
    if action != "stop_adb_server" {
        let (ok, _, err) = run_adb(&["start-server"], 6000).await;
        if !ok { return json!({"success":false,"error":err}); }
        *paused = false;
    }
    json!({"success":true,"serverRunning":!*paused,"message":if *paused {"Servidor ADB detenido"} else {"Servidor ADB iniciado"}})
}

/// Lee únicamente servicios publicados por mDNS. Conectar requiere elegir un destino.
pub async fn discover() -> Value {
    let paused = PAUSED.read().await;
    if *paused { return json!({"success":false,"error":"Inicia el servidor ADB para buscar dispositivos"}); }
    let (ok, out, err) = run_adb(&["mdns", "services"], 5000).await;
    if !ok { return json!({"success":false,"error":err}); }
    let services: Vec<_> = out.lines().filter(|line| line.split_whitespace().any(|w| w.starts_with("_adb"))).collect();
    json!({"success":true,"services":services})
}

/// Desconecta un transporte TCP seleccionado, o todos solo bajo petición explícita.
pub async fn disconnect(serial: &str, all: bool) -> Value {
    let args = if all { vec!["disconnect"] }
        else if !serial.is_empty() && super::paths::safe_serial(serial) == serial { vec!["disconnect", serial] }
        else { return json!({"success":false,"error":"Selecciona una conexión ADB"}); };
    let (ok, out, err) = run_adb(&args, 4000).await;
    json!({"success":ok,"message":out.trim(),"error":err.trim()})
}
