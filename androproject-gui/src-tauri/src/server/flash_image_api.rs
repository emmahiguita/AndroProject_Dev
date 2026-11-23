//! Recibe imágenes en disco temporal y ejecuta operaciones Fastboot o ADB explícitas.

use axum::{extract::Multipart, Json};
use serde_json::{json, Value};
use std::{path::PathBuf, process::Stdio, sync::atomic::{AtomicU64, Ordering}, time::Duration};
use tokio::io::AsyncWriteExt;
use super::paths::{fastboot_bin, run_adb, safe_serial, silent_cmd};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// Solo se permiten particiones conocidas; las que borran datos requieren confirmación adicional.
fn valid_partition(partition: &str, critical: bool, verity: bool) -> bool {
    let allowed = ["boot", "init_boot", "vendor_boot", "recovery", "dtbo", "vbmeta", "super", "system", "vendor", "product", "userdata", "boot_a", "boot_b", "recovery_a", "recovery_b", "bootloader", "radio", "modem", "persist"];
    let critical_parts = ["userdata", "bootloader", "radio", "modem", "persist"];
    allowed.contains(&partition) && (!critical_parts.contains(&partition) || critical) && (!verity || partition == "vbmeta")
}

/// Limpia el archivo temporal tanto en éxito como al cancelar la solicitud.
struct TemporaryImage(PathBuf);
impl Drop for TemporaryImage { fn drop(&mut self) { let _ = std::fs::remove_file(&self.0); } }

/// Recibe un único archivo por fragmentos para no cargar la imagen completa en RAM.
pub async fn run(mut multipart: Multipart) -> Json<Value> {
    let (mut action, mut serial, mut partition, mut critical, mut verity) = (String::new(), String::new(), String::new(), false, false);
    let (mut name, mut temporary) = (String::new(), None);
    let receive: Result<(), String> = async {
        while let Some(mut field) = multipart.next_field().await.map_err(|e| e.to_string())? {
            match field.name().unwrap_or("") {
                "action" => action = field.text().await.map_err(|e| e.to_string())?,
                "serial" => serial = field.text().await.map_err(|e| e.to_string())?,
                "partition" => partition = field.text().await.map_err(|e| e.to_string())?,
                "confirmCritical" => critical = field.text().await.map_err(|e| e.to_string())? == "true",
                "disableVerity" => verity = field.text().await.map_err(|e| e.to_string())? == "true",
                "file" => {
                    if temporary.is_some() { return Err("Envía un solo archivo".into()); }
                    name = field.file_name().unwrap_or("").to_ascii_lowercase();
                    let id = SEQUENCE.fetch_add(1, Ordering::Relaxed);
                    let path = std::env::temp_dir().join(format!("andro-flash-{}-{}", std::process::id(), id));
                    let mut file = tokio::fs::OpenOptions::new().write(true).create_new(true).open(&path).await.map_err(|e| e.to_string())?;
                    temporary = Some(TemporaryImage(path));
                    let mut size = 0u64;
                    while let Some(chunk) = field.chunk().await.map_err(|e| e.to_string())? {
                        size += chunk.len() as u64;
                        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                    }
                    if size == 0 { return Err("El archivo está vacío".into()); }
                }
                _ => {}
            }
        }
        Ok(())
    }.await;
    if let Err(error) = receive { return Json(json!({"success": false, "error": error})); }
    if serial.is_empty() || serial != safe_serial(&serial) { return Json(json!({"success": false, "error": "Selecciona un serial Android válido"})); }
    let image = match temporary { Some(image) => image, None => return Json(json!({"success": false, "error": "Falta el archivo"})) };
    let is_image = [".img", ".bin", ".mbn"].iter().any(|ext| name.ends_with(ext));
    if (action == "sideload" && !name.ends_with(".zip")) || (action != "sideload" && !is_image) {
        return Json(json!({"success": false, "error": "Extensión de archivo no válida para la operación"}));
    }
    let image_path = image.0.to_string_lossy().to_string();
    if action == "sideload" {
        let (ready, state, err) = run_adb(&["-s", &serial, "get-state"], 5000).await;
        if !ready || state.trim() != "sideload" { return Json(json!({"success": false, "error": format!("El dispositivo no está en ADB sideload: {}", err.trim())})); }
        let (ok, out, err) = run_adb(&["-s", &serial, "sideload", &image_path], 1800000).await;
        return Json(json!({"success": ok, "message": if ok { out.trim() } else { "" }, "error": if ok { "" } else if err.is_empty() { out.trim() } else { err.trim() }}));
    }
    if action != "flash" && action != "fastboot_boot" { return Json(json!({"success": false, "error": "Operación de imagen desconocida"})); }
    if action == "flash" && !valid_partition(&partition, critical, verity) {
        return Json(json!({"success": false, "error": "Partición no válida o falta confirmación crítica"}));
    }
    // Si no puede confirmarse el desbloqueo no se envía la imagen al dispositivo.
    let (ok, info) = fastboot(&serial, &["getvar", "unlocked"], 10000).await;
    if !ok || !info.lines().any(|line| line.trim().strip_prefix("(bootloader)").unwrap_or(line).trim().eq_ignore_ascii_case("unlocked: yes")) {
        return Json(json!({"success": false, "error": format!("No se pudo confirmar el bootloader desbloqueado: {}", info.trim())}));
    }
    let mut args = Vec::new();
    if action == "flash" {
        if verity { args.extend(["--disable-verity", "--disable-verification"]); }
        args.extend(["flash", partition.as_str(), image_path.as_str()]);
    } else { args.extend(["boot", image_path.as_str()]); }
    let (ok, output) = fastboot(&serial, &args, 1800000).await;
    Json(json!({"success": ok, "message": if ok { output.trim() } else { "" }, "error": if ok { "" } else { output.trim() }}))
}

#[cfg(test)]
mod tests {
    use super::valid_partition;

    /// Asegura que userdata, las rutas arbitrarias y los flags AVB no eludan la validación.
    #[test]
    fn rejects_unconfirmed_or_invalid_targets() {
        assert!(!valid_partition("userdata", false, false));
        assert!(valid_partition("userdata", true, false));
        assert!(!valid_partition("boot; reboot", true, false));
        assert!(!valid_partition("boot", false, true));
        assert!(valid_partition("vbmeta", false, true));
    }
}

/// Devuelve la salida completa: Fastboot informa progreso y fallos por stderr.
async fn fastboot(serial: &str, args: &[&str], timeout_ms: u64) -> (bool, String) {
    let mut cmd = silent_cmd(fastboot_bin());
    cmd.kill_on_drop(true).args(["-s", serial]).args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    match tokio::time::timeout(Duration::from_millis(timeout_ms), cmd.output()).await {
        Ok(Ok(out)) => {
            let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
            (out.status.success() && !text.contains("FAILED"), text)
        }
        Ok(Err(error)) => (false, error.to_string()),
        Err(_) => (false, "Fastboot agotó el tiempo de espera".into()),
    }
}
