//! Gestiona únicamente el proceso AirPlay iniciado por esta aplicación.

use serde_json::{json, Value};
use std::{path::PathBuf, process::Stdio, sync::OnceLock};
use tokio::{process::Child, sync::Mutex};
use super::paths::{home_dir, silent_cmd};

static RECEIVER: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

/// Busca el ejecutable empaquetado y, en desarrollo, el que está en el proyecto.
fn receiver_path() -> Option<PathBuf> {
    let home = home_dir();
    let mut candidates = vec![home.join("airplay").join("AirPlayServer.exe"), home.join("Dashboard").join("bin").join("airplay").join("AirPlayServer.exe")];
    if cfg!(debug_assertions) {
        candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("bin").join("airplay").join("AirPlayServer.exe"));
    }
    candidates.into_iter().find(|path| path.is_file())
}

/// Devuelve estado del proceso propio; Bonjour y clientes no se infieren del PID.
pub async fn status() -> Value {
    let mut guard = RECEIVER.get_or_init(|| Mutex::new(None)).lock().await;
    let running = match guard.as_mut() {
        Some(child) => matches!(child.try_wait(), Ok(None)), None => false,
    };
    if !running { *guard = None; }
    let available = receiver_path().is_some();
    json!({"success": available, "error": if available { "" } else { "Receptor AirPlay no encontrado en la instalación" },
        "status": { "running": running, "port": 7001, "serverName": "ANDRO-IOS [PC]", "bonjourActive": false, "pinRequired": false, "connectedClients": [] }})
}

/// Inicia o detiene el receptor propio; no finaliza procesos externos del usuario.
pub async fn action(action: &str) -> Value {
    if action != "start" && action != "stop" { return json!({"success": false, "error": "Acción AirPlay aún no implementada"}); }
    let mut guard = RECEIVER.get_or_init(|| Mutex::new(None)).lock().await;
    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => *guard = None,
            Err(error) => return json!({"success": false, "error": error.to_string()}),
            Ok(None) => {}
        }
    }
    if action == "stop" {
        if let Some(mut child) = guard.take() {
            if let Err(error) = child.kill().await { *guard = Some(child); return json!({"success": false, "error": error.to_string()}); }
        }
        return json!({"success": true, "message": "Proceso receptor detenido"});
    }
    if guard.is_some() { return json!({"success": true, "message": "El receptor ya está iniciado"}); }
    let path = match receiver_path() { Some(path) => path, None => return json!({"success": false, "error": "No se encontró AirPlayServer.exe en la instalación"}) };
    let Some(dir) = path.parent() else { return json!({"success": false, "error": "Carpeta AirPlay no válida"}); };
    let mut cmd = silent_cmd(&path);
    cmd.current_dir(dir).kill_on_drop(true).stdout(Stdio::null()).stderr(Stdio::null());
    match cmd.spawn() {
        Ok(mut child) => {
            // Una creación de proceso no demuestra que el ejecutable siga funcionando.
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            match child.try_wait() {
                Ok(None) => { *guard = Some(child); json!({"success": true, "message": "Proceso receptor iniciado; comprueba la conexión desde el iPhone"}) }
                Ok(Some(exit)) => json!({"success": false, "error": format!("El receptor terminó al iniciar: {exit}")}),
                Err(error) => json!({"success": false, "error": error.to_string()}),
            }
        }
        Err(error) => json!({"success": false, "error": error.to_string()}),
    }
}
