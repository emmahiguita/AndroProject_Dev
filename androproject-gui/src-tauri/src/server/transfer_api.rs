//! Recibe archivos en un temporal exclusivo y los entrega al dispositivo por ADB.

use axum::{extract::Multipart, http::StatusCode, Json};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::io::AsyncWriteExt;
use super::paths::{run_adb, safe_serial};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// El temporal se elimina también si se cancela la petición durante la transferencia.
struct TemporaryFile(std::path::PathBuf);

impl Drop for TemporaryFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Guarda los fragmentos en un archivo exclusivo, evitando colisiones y rutas del cliente.
async fn receive(mut multipart: Multipart, install: bool) -> Result<(String, String, String, TemporaryFile), String> {
    let mut serial = String::new();
    let mut destination = "/sdcard/Download".to_string();
    let mut filename = String::new();
    let mut temp = None;
    let result: Result<(), String> = async {
        while let Some(mut field) = multipart.next_field().await.map_err(|e| e.to_string())? {
            match field.name().unwrap_or("") {
                "serial" => serial = field.text().await.map_err(|e| e.to_string())?,
                "dest" | "path" | "targetDir" => destination = field.text().await.map_err(|e| e.to_string())?,
                "file" | "apk" => {
                    if temp.is_some() { return Err("Envía un archivo por solicitud".into()); }
                    filename = field.file_name().unwrap_or("").to_owned();
                    if filename.is_empty() || filename == "." || filename == ".." || filename.contains(['/', '\\', '\0']) {
                        return Err("Nombre de archivo no válido".into());
                    }
                    if install && !filename.to_ascii_lowercase().ends_with(".apk") {
                        return Err("La instalación Android requiere un archivo APK".into());
                    }
                    let id = SEQUENCE.fetch_add(1, Ordering::Relaxed);
                    let extension = if install { "apk" } else { "tmp" };
                    let path = std::env::temp_dir().join(format!("andro-transfer-{}-{}.{}", std::process::id(), id, extension));
                    let mut file = tokio::fs::OpenOptions::new().write(true).create_new(true).open(&path).await.map_err(|e| e.to_string())?;
                    temp = Some(TemporaryFile(path));
                    let mut bytes = 0usize;
                    while let Some(chunk) = field.chunk().await.map_err(|e| e.to_string())? {
                        bytes += chunk.len();
                        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                    }
                    if bytes == 0 { return Err("El archivo está vacío".into()); }
                }
                _ => {}
            }
        }
        let clean_serial = safe_serial(&serial);
        if clean_serial.is_empty() || clean_serial != serial.trim() { return Err("Serial Android inválido".into()); }
        serial = clean_serial;
        if destination != "/sdcard" && !destination.starts_with("/sdcard/") { return Err("Destino fuera del almacenamiento compartido".into()); }
        if destination.split('/').any(|part| part == ".." || part == ".") || destination.contains(['\0', '\n', '\r']) {
            return Err("Destino no válido".into());
        }
        if temp.is_none() { return Err("Falta el archivo".into()); }
        Ok(())
    }.await;
    if let Err(error) = result {
        return Err(error);
    }
    Ok((serial, destination, filename, temp.expect("temporal validado")))
}

/// Instala el APK en el serial seleccionado y elimina el temporal al finalizar.
pub async fn install(multipart: Multipart) -> (StatusCode, Json<Value>) {
    let (serial, _, _, path) = match receive(multipart, true).await {
        Ok(data) => data, Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": error}))),
    };
    let temp = path.0.to_string_lossy().to_string();
    let (ok, out, err) = run_adb(&["-s", &serial, "install", "-r", &temp], 120000).await;
    let success = ok && out.contains("Success");
    (StatusCode::OK, Json(json!({"success": success, "message": if success { out.trim() } else { "" }, "error": if err.is_empty() && !success { out.trim() } else { err.trim() }})))
}

/// Sube el archivo al directorio elegido; informa el error de ADB al llamador.
pub async fn upload(multipart: Multipart) -> (StatusCode, Json<Value>) {
    let (serial, dest, name, path) = match receive(multipart, false).await {
        Ok(data) => data, Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": error}))),
    };
    let remote = format!("{}/{}", dest.trim_end_matches('/'), name);
    let temp = path.0.to_string_lossy().to_string();
    let (ok, out, err) = run_adb(&["-s", &serial, "push", &temp, &remote], 120000).await;
    (StatusCode::OK, Json(json!({"success": ok, "remotePath": remote, "message": out.trim(), "error": err.trim()})))
}
