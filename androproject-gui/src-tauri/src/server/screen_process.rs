//! Administra una proyección externa por dispositivo y conserva su proceso real.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::OnceLock;
use serde_json::{json, Value};
use tokio::process::Child;
use tokio::sync::Mutex;
use super::extra_actions::build_screen_args;
use super::paths::{scrcpy_bin, silent_cmd};

static SCREENS: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();

fn screens() -> &'static Mutex<HashMap<String, Child>> {
    SCREENS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Comprueba el proceso y elimina su registro cuando ya terminó.
pub async fn check(serial: &str) -> Value {
    let mut processes = screens().lock().await;
    let alive = match processes.get_mut(serial) {
        Some(child) => matches!(child.try_wait(), Ok(None)),
        None => false,
    };
    if !alive { processes.remove(serial); }
    json!({"success": true, "alive": alive, "sessions": []})
}

/// Inicia un solo proceso por serial y devuelve el error de creación real.
pub async fn start(serial: &str, body: &Value) -> Value {
    if serial.is_empty() { return json!({"success": false, "error": "Serial requerido"}); }
    let mut processes = screens().lock().await;
    if let Some(child) = processes.get_mut(serial) {
        if matches!(child.try_wait(), Ok(None)) {
            return json!({"success": true, "alive": true, "pid": child.id(), "message": "Proyección ya iniciada"});
        }
    }
    processes.remove(serial);
    let mut cmd = silent_cmd(scrcpy_bin());
    cmd.kill_on_drop(true).args(build_screen_args(serial, body)).stdout(Stdio::null()).stderr(Stdio::null());
    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            processes.insert(serial.to_owned(), child);
            json!({"success": true, "alive": true, "pid": pid, "message": "Proceso de proyección iniciado"})
        }
        Err(error) => json!({"success": false, "error": format!("No se pudo iniciar la proyección: {}", error)}),
    }
}

/// Detiene y espera el proceso administrado, sin terminar procesos ajenos.
pub async fn stop(serial: &str) -> Value {
    let mut processes = screens().lock().await;
    if let Some(child) = processes.get_mut(serial) {
        if matches!(child.try_wait(), Ok(None)) {
            if let Err(error) = child.kill().await {
                return json!({"success": false, "error": format!("No se pudo detener la proyección: {}", error)});
            }
        }
        let _ = child.wait().await;
        processes.remove(serial);
    }
    json!({"success": true, "alive": false, "message": "Proyección detenida"})
}
