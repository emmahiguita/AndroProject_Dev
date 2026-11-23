//! Copia al PC todos los APK que Android asocia a un paquete instalado.

use serde_json::{json, Value};
use std::{path::PathBuf, sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};
use super::paths::{adb_shell, captures_dir, run_adb};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// Si falla o se cancela una extracción, elimina únicamente sus archivos parciales.
struct Extraction { directory: PathBuf, files: Vec<PathBuf>, complete: bool }
impl Drop for Extraction {
    fn drop(&mut self) {
        if !self.complete {
            for path in &self.files { let _ = std::fs::remove_file(path); }
            let _ = std::fs::remove_dir(&self.directory);
        }
    }
}

/// Usa el serial y paquete previamente validados; conserva base y divisiones APK.
pub async fn extract(serial: &str, package: &str) -> Value {
    let (ok, out, err) = adb_shell(serial, &format!("pm path {package}"), 10000).await;
    if !ok { return json!({"success": false, "error": if err.trim().is_empty() { "No se pudo consultar el paquete" } else { err.trim() }}); }
    let paths: Vec<&str> = out.lines().filter_map(|line| line.trim().strip_prefix("package:")).collect();
    if paths.is_empty() { return json!({"success": false, "error": "Android no devolvió rutas APK accesibles"}); }
    // Nunca se informa una extracción completa si Android devolvió una ruta inesperada.
    if paths.iter().any(|path| !path.starts_with('/') || !path.ends_with(".apk") || path.contains(['\0', '\r', '\n'])) {
        return json!({"success": false, "error": "Android devolvió una ruta APK no válida"});
    }
    let parent = captures_dir().join("APK");
    if let Err(error) = tokio::fs::create_dir_all(&parent).await { return json!({"success": false, "error": error.to_string()}); }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let dir = parent.join(format!("{}_{}_{}", package, stamp, SEQUENCE.fetch_add(1, Ordering::Relaxed)));
    if let Err(error) = tokio::fs::create_dir(&dir).await { return json!({"success": false, "error": error.to_string()}); }
    let mut extraction = Extraction { directory: dir, files: Vec::new(), complete: false };
    for (index, remote) in paths.iter().enumerate() {
        // Los nombres locales independientes evitan colisiones y rutas suministradas por Android.
        let path = extraction.directory.join(format!("parte-{}.apk", index + 1));
        extraction.files.push(path.clone());
        let local = path.to_string_lossy().to_string();
        let (ok, output, error) = run_adb(&["-s", serial, "pull", remote, &local], 120000).await;
        if !ok { return json!({"success": false, "error": if error.trim().is_empty() { output.trim() } else { error.trim() }}); }
    }
    extraction.complete = true;
    let directory = extraction.directory.to_string_lossy().to_string();
    json!({"success": true, "path": directory, "count": paths.len(), "message": format!("Se guardaron {} archivo(s) APK en {}", paths.len(), directory)})
}
