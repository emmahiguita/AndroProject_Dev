// ============================================================================
// ARCHIVO: server/apps_api.rs
// QUÉ HACE: Endpoints nativos en Rust para gestión de aplicaciones Android
//           (`/api/apps`, `/api/apps/icon`, `/api/install-apk`, `/api/upload-file`).
// CÓMO FUNCIONA: Lista paquetes `pm list packages -3/-s` vía ADB en paralelo,
//           clasifica apps de usuario/sistema y recibe APK/archivos vía multipart.
// POR QUÉ: Gestionar cientos de apps sin procesos Node.js intermedios (< 200L).
// ============================================================================

use axum::{
    extract::Multipart,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::{json, Value};
use std::collections::HashSet;

use super::paths::{adb_shell, run_adb, safe_serial};

fn sanitize_pkg(raw: &str) -> String {
    raw.trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect()
}

fn friendly_name(pkg: &str) -> String {
    let last = pkg.rsplit('.').next().unwrap_or(pkg);
    let mut chars = last.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => pkg.to_string(),
    }
}

/// `POST /api/apps` — Lista, lanza, detiene, limpia o desinstala apps Android.
pub async fn post_apps(Json(body): Json<Value>) -> impl IntoResponse {
    let action = body["action"].as_str().unwrap_or("list");
    let serial = safe_serial(body["serial"].as_str().unwrap_or(""));
    let pkg = sanitize_pkg(body["packageName"].as_str().unwrap_or(""));

    match action {
        "list" => {
            let (ok_all, out_all, err) = adb_shell(&serial, "pm list packages", 8000).await;
            if !ok_all {
                return (StatusCode::OK, Json(json!({ "success": false, "apps": [], "error": err })));
            }
            let (_, out_3rd, _) = adb_shell(&serial, "pm list packages -3", 5000).await;
            let user_set: HashSet<String> = out_3rd
                .lines()
                .filter_map(|l| l.trim().strip_prefix("package:").map(|s| s.to_string()))
                .collect();

            let mut apps: Vec<Value> = out_all
                .lines()
                .filter_map(|l| l.trim().strip_prefix("package:"))
                .map(|p| {
                    let is_user = user_set.contains(p);
                    let is_bloat = p.contains("facebook") || p.contains("tiktok") || p.contains("heytap") || p.contains("coloros.gamespace");
                    json!({
                        "packageName": p,
                        "name": friendly_name(p),
                        "isSystem": !is_user,
                        "isBloatware": is_bloat,
                        "safeToRemove": is_user || is_bloat,
                    })
                })
                .collect();
            apps.sort_by(|a, b| a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")));
            (StatusCode::OK, Json(json!({ "success": true, "apps": apps, "total": apps.len() })))
        }
        "uninstall" => {
            let (ok, out, err) = run_adb(&["-s", &serial, "uninstall", &pkg], 15000).await;
            let ok2 = if !ok {
                let (o2, out2, _) = adb_shell(&serial, &format!("pm uninstall --user 0 {}", pkg), 10000).await;
                o2 && out2.contains("Success")
            } else { true };
            (StatusCode::OK, Json(json!({ "success": ok2, "message": out.trim(), "error": err })))
        }
        "launch" => {
            let (ok, out, err) = adb_shell(&serial, &format!("monkey -p {} -c android.intent.category.LAUNCHER 1", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": out.trim(), "error": err })))
        }
        "stop" | "force_stop" => {
            let (ok, _, err) = adb_shell(&serial, &format!("am force-stop {}", pkg), 4000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": format!("Detenida {}", pkg), "error": err })))
        }
        "clear" | "clear_data" => {
            let (ok, out, err) = adb_shell(&serial, &format!("pm clear {}", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": out.trim(), "error": err })))
        }
        "disable" => {
            let (ok, out, err) = adb_shell(&serial, &format!("pm disable-user --user 0 {}", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": out.trim(), "error": err })))
        }
        "enable" => {
            let (ok, out, err) = adb_shell(&serial, &format!("pm enable {}", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": out.trim(), "error": err })))
        }
        _ => (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Acción de apps no soportada" }))),
    }
}

/// `GET /api/apps/icon` — Respuesta ligera 404 para fallback de avatar en UI.
pub async fn get_app_icon() -> StatusCode {
    StatusCode::NOT_FOUND
}

/// `POST /api/install-apk` — Recibe APK multipart e instala vía `adb install -r`.
pub async fn post_install_apk(mut multipart: Multipart) -> impl IntoResponse {
    let mut serial = String::new();
    let mut apk_bytes: Vec<u8> = Vec::new();
    let mut filename = "upload.apk".to_string();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "serial" {
            if let Ok(t) = field.text().await { serial = safe_serial(&t); }
        } else if name == "file" || name == "apk" {
            if let Some(f) = field.file_name() { filename = f.to_string(); }
            if let Ok(b) = field.bytes().await { apk_bytes = b.to_vec(); }
        }
    }

    if apk_bytes.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Archivo APK vacío" })));
    }
    let tmp = std::env::temp_dir().join(format!("andro_ios_{}", filename));
    if let Err(e) = tokio::fs::write(&tmp, &apk_bytes).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": e.to_string() })));
    }
    let tmp_str = tmp.to_string_lossy().to_string();
    let (ok, out, err) = if serial.is_empty() {
        run_adb(&["install", "-r", &tmp_str], 45000).await
    } else {
        run_adb(&["-s", &serial, "install", "-r", &tmp_str], 45000).await
    };
    let _ = tokio::fs::remove_file(&tmp).await;
    (StatusCode::OK, Json(json!({ "success": ok && out.contains("Success"), "message": out.trim(), "error": err })))
}

/// `POST /api/upload-file` — Recibe archivo multipart y lo sube a `/sdcard/Download/`.
pub async fn post_upload_file(mut multipart: Multipart) -> impl IntoResponse {
    let mut serial = String::new();
    let mut dest_dir = "/sdcard/Download".to_string();
    let mut file_bytes: Vec<u8> = Vec::new();
    let mut filename = "archivo.bin".to_string();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "serial" {
            if let Ok(t) = field.text().await { serial = safe_serial(&t); }
        } else if name == "path" || name == "targetDir" {
            if let Ok(t) = field.text().await { if !t.trim().is_empty() { dest_dir = t.trim().to_string(); } }
        } else if name == "file" {
            if let Some(f) = field.file_name() { filename = f.to_string(); }
            if let Ok(b) = field.bytes().await { file_bytes = b.to_vec(); }
        }
    }

    if file_bytes.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Archivo vacío" })));
    }
    let tmp = std::env::temp_dir().join(format!("andro_push_{}", filename));
    let _ = tokio::fs::write(&tmp, &file_bytes).await;
    let remote = format!("{}/{}", dest_dir.trim_end_matches('/'), filename);
    let tmp_str = tmp.to_string_lossy().to_string();
    let (ok, out, err) = run_adb(&["-s", &serial, "push", &tmp_str, &remote], 45000).await;
    let _ = tokio::fs::remove_file(&tmp).await;
    (StatusCode::OK, Json(json!({ "success": ok, "remotePath": remote, "message": out.trim(), "error": err })))
}
