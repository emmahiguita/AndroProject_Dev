//! Rutas para consultar paquetes, instalar APK y transferir archivos por ADB.
use axum::{extract::Query, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct FileListQuery { pub serial: Option<String>, pub path: Option<String> }

use super::paths::{adb_shell, run_adb, safe_serial};

fn sanitize_pkg(raw: &str) -> String {
    raw.trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect()
}

/// `POST /api/apps` — Lista, lanza, detiene, limpia o desinstala apps Android.
pub async fn post_apps(Json(body): Json<Value>) -> impl IntoResponse {
    let action = body["action"].as_str().unwrap_or("list");
    let raw_serial = body["serial"].as_str().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    let raw_pkg = body["packageName"].as_str().unwrap_or("").trim();
    let pkg = sanitize_pkg(raw_pkg);

    // Evita ejecutar acciones sobre otro dispositivo o paquete al recibir datos incompletos.
    if serial.is_empty() || serial != raw_serial {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial Android inválido" })));
    }
    if action != "list" && (pkg.is_empty() || pkg != raw_pkg || !pkg.contains('.')) {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Nombre de paquete inválido" })));
    }
    if matches!(action, "uninstall" | "disable" | "clear" | "clear_data")
        && body["confirmed"] != true
    {
        return (StatusCode::BAD_REQUEST, Json(json!({
            "success": false,
            "error": "Esta operación requiere confirmación explícita"
        })));
    }

    match action {
        // El paquete puede contener un APK base y varias divisiones necesarias.
        _ if crate::apps_policy::is_critical_system_package(&pkg)
            && matches!(action, "uninstall" | "disable" | "clear" | "clear_data") =>
        {
            (StatusCode::FORBIDDEN, Json(json!({
                "success": false,
                "error": format!("Paquete crítico del sistema protegido: {}", pkg)
            })))
        }
        "extract_apk" => (StatusCode::OK, Json(super::apk_extract::extract(&serial, &pkg).await)),
        "list" => (StatusCode::OK, Json(super::apps_catalog::list_apps(&serial).await)),
        "uninstall" => {
            let (ok, out, err) = run_adb(&["-s", &serial, "uninstall", &pkg], 15000).await;
            if ok && out.contains("Success") {
                return (StatusCode::OK, Json(json!({ "success": true, "message": format!("Desinstalado correctamente: {pkg}"), "error": "" })));
            }
            let (o2, out2, err2) = adb_shell(&serial, &format!("pm uninstall --user 0 {}", pkg), 10000).await;
            let ok2 = o2 && out2.contains("Success");
            let detail = if !out2.trim().is_empty() { out2.trim() } else if !err2.trim().is_empty() { err2.trim() } else if !err.trim().is_empty() { err.trim() } else { out.trim() };
            (StatusCode::OK, Json(json!({ "success": ok2, "message": if ok2 { format!("Desinstalado para usuario 0: {pkg}") } else { detail.to_string() }, "error": if ok2 { "" } else { detail } })))
        }
        "launch" => {
            let (ok, out, err) = adb_shell(&serial, &format!("monkey -p {} -c android.intent.category.LAUNCHER 1", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok && !out.contains("Error") && !out.contains("No activities found"), "message": out.trim(), "error": err })))
        }
        "stop" | "force_stop" => {
            let (ok, _, err) = adb_shell(&serial, &format!("am force-stop {}", pkg), 4000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": format!("Detenida {}", pkg), "error": err })))
        }
        "clear" | "clear_data" => {
            let (ok, out, err) = adb_shell(&serial, &format!("pm clear {}", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok && out.trim() == "Success", "message": out.trim(), "error": err })))
        }
        "disable" => {
            let (ok, out, err) = adb_shell(&serial, &format!("pm disable-user --user 0 {}", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok && !out.contains("Error") && !out.contains("Exception"), "message": out.trim(), "error": err })))
        }
        "enable" => {
            let (ok, out, err) = adb_shell(&serial, &format!("pm enable {}", pkg), 6000).await;
            (StatusCode::OK, Json(json!({ "success": ok && !out.contains("Error") && !out.contains("Exception"), "message": out.trim(), "error": err })))
        }
        _ => (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Acción de apps no soportada" }))),
    }
}

/// `GET /api/apps/icon` — Respuesta ligera 404 para fallback de avatar en UI.
pub async fn get_app_icon() -> StatusCode {
    StatusCode::NOT_FOUND
}

/// `GET /api/upload-file?path=...&serial=...` — Lista archivos reales en `/sdcard/...`.
pub async fn get_upload_file(Query(q): Query<FileListQuery>) -> Json<Value> {
    let raw_serial = q.serial.as_deref().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    let dir = q.path.as_deref().unwrap_or("/sdcard/Download").trim();
    // Nunca se selecciona otro dispositivo ni se permite salir del almacenamiento compartido.
    if serial.is_empty() || serial != raw_serial || (dir != "/sdcard" && !dir.starts_with("/sdcard/"))
        || dir.split('/').any(|part| part == ".." || part == ".") || dir.contains(['\0', '\n', '\r']) {
        return Json(json!({ "success": false, "error": "Dispositivo o carpeta no válidos" }));
    }
    // Escapa comillas para que el nombre se interprete como ruta, no como órdenes shell.
    let quoted = dir.replace('\'', "'\\''");
    let (ok, out, err) = adb_shell(&serial, &format!("ls -la '{}'", quoted), 6000).await;
    let mut entries: Vec<Value> = out
        .lines()
        .skip(1)
        .filter_map(|l| {
            let p: Vec<&str> = l.split_whitespace().collect();
            if p.len() < 8 { return None; }
            let name = p[7..].join(" ");
            if name == "." || name == ".." || name.is_empty() { return None; }
            Some(json!({ "name": name, "isDir": p[0].starts_with('d'), "size": p[4].parse::<u64>().unwrap_or(0) }))
        })
        .collect();
    entries.sort_by(|a, b| {
        b["isDir"].as_bool().unwrap_or(false).cmp(&a["isDir"].as_bool().unwrap_or(false))
            .then_with(|| a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or("")))
    });
    Json(json!({ "success": ok, "path": dir, "entries": entries, "error": err }))
}
