//! Descarga y elimina archivos concretos del almacenamiento compartido mediante ADB.

use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};
use super::paths::{adb_shell, captures_dir, run_adb, safe_serial};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Deserialize)]
pub struct FileRequest { serial: String, path: String }

/// Comprueba que se eligió el teléfono exacto y que la ruta no escape de /sdcard.
fn validate(request: &FileRequest) -> Result<&str, &'static str> {
    if request.serial.is_empty() || safe_serial(&request.serial) != request.serial {
        return Err("Selecciona un dispositivo Android válido");
    }
    let path = request.path.as_str();
    if !path.starts_with("/sdcard/") || path.ends_with('/') || path.contains(['\0', '\r', '\n'])
        || path.split('/').any(|part| part == "." || part == "..") {
        return Err("Ruta de archivo no válida");
    }
    Ok(path)
}

/// Las comillas simples protegen la ruta frente a caracteres especiales del shell Android.
fn quote(path: &str) -> String { format!("'{}'", path.replace('\'', "'\\''")) }

/// Resuelve enlaces intermedios y exige que el archivo real siga dentro de /sdcard.
async fn canonical_file(serial: &str, path: &str) -> Result<String, String> {
    let file = quote(path);
    let cmd = format!("root=$(readlink -f /sdcard) && [ -n \"$root\" ] && file=$(readlink -f {file}) && [ -f {file} ] && [ ! -L {file} ] && case \"$file\" in \"$root\"/*) printf '%s' \"$file\";; *) exit 1;; esac");
    let (ok, out, err) = adb_shell(serial, &cmd, 10000).await;
    if !ok || out.is_empty() || out.contains(['\0', '\r', '\n']) {
        return Err(if err.trim().is_empty() { "Archivo inaccesible o fuera del almacenamiento compartido".into() } else { err.trim().into() });
    }
    Ok(out)
}

/// Borra un archivo regular confirmado por el usuario, sin seguir enlaces simbólicos finales.
pub async fn delete(Json(request): Json<FileRequest>) -> Json<Value> {
    let path = match validate(&request) { Ok(path) => path, Err(error) => return Json(json!({"success": false, "error": error})) };
    let resolved = match canonical_file(&request.serial, path).await { Ok(path) => path, Err(error) => return Json(json!({"success": false, "error": error})) };
    let file = quote(&resolved);
    let cmd = format!("if [ -f {file} ] && [ ! -L {file} ]; then rm -- {file}; else echo 'Archivo inexistente o no permitido' >&2; exit 1; fi");
    let (ok, out, err) = adb_shell(&request.serial, &cmd, 15000).await;
    Json(json!({"success": ok, "message": if ok { "Archivo eliminado del dispositivo" } else { "" }, "error": if err.is_empty() { out.trim() } else { err.trim() }}))
}

/// El archivo incompleto se elimina si ADB falla o la petición se cancela.
struct PartialFile { path: PathBuf, complete: bool }
impl Drop for PartialFile { fn drop(&mut self) { if !self.complete { let _ = std::fs::remove_file(&self.path); } } }

/// Guarda una copia en Capturas/Descargas sin sobrescribir archivos existentes.
pub async fn download(Json(request): Json<FileRequest>) -> Json<Value> {
    let path = match validate(&request) { Ok(path) => path, Err(error) => return Json(json!({"success": false, "error": error})) };
    let resolved = match canonical_file(&request.serial, path).await { Ok(path) => path, Err(error) => return Json(json!({"success": false, "error": error})) };
    let dir = captures_dir().join("Descargas");
    if let Err(error) = tokio::fs::create_dir_all(&dir).await { return Json(json!({"success": false, "error": error.to_string()})); }
    // Windows prohíbe ciertos caracteres: el prefijo también evita nombres reservados.
    let name: String = path.rsplit('/').next().unwrap_or("archivo").chars().map(|c| {
        if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') { '_' } else { c }
    }).collect();
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let output = dir.join(format!("{}_{}_{}", stamp, SEQUENCE.fetch_add(1, Ordering::Relaxed), name.trim_end_matches([' ', '.'])));
    match tokio::fs::OpenOptions::new().write(true).create_new(true).open(&output).await {
        Ok(file) => drop(file), Err(error) => return Json(json!({"success": false, "error": error.to_string()})),
    }
    let mut partial = PartialFile { path: output, complete: false };
    let local = partial.path.to_string_lossy().to_string();
    let (ok, out, err) = run_adb(&["-s", &request.serial, "pull", &resolved, &local], 600000).await;
    if !ok { return Json(json!({"success": false, "error": if err.is_empty() { out.trim() } else { err.trim() }})); }
    // Solo una transferencia confirmada conserva el archivo en el PC.
    partial.complete = true;
    Json(json!({"success": true, "path": local, "message": format!("Archivo guardado en {}", local)}))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Las rutas y seriales inválidos no deben llegar a una operación destructiva.
    #[test]
    fn rejects_invalid_device_and_paths() {
        for (serial, path) in [("", "/sdcard/a"), ("a b", "/sdcard/a"), ("abc", "/sdcard/../x"), ("abc", "/sdcard2/a"), ("abc", "/sdcard/a\nb")] {
            assert!(validate(&FileRequest { serial: serial.into(), path: path.into() }).is_err());
        }
        assert!(validate(&FileRequest { serial: "abc:5555".into(), path: "/sdcard/Download/a b.txt".into() }).is_ok());
    }

    /// Los nombres con comillas se mantienen como un único argumento del shell.
    #[test]
    fn quotes_apostrophes() { assert_eq!(quote("/sdcard/a'b"), "'/sdcard/a'\\''b'"); }
}
