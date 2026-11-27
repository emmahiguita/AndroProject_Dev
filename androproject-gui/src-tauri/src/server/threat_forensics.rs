// ============================================================================
// ARCHIVO: server/threat_forensics.rs
// QUÉ HACE: Motor forense defensivo 100% Rust (`/api/security-forensics`) que
//           inspecciona un paquete Android real vía ADB (proveedor/instalador,
//           SHA-256 del APK, targetSdk, permisos concedidos, persistencia,
//           proceso activo) y explica defensivamente cómo opera y se conecta.
// CÓMO FUNCIONA: Ejecuta `dumpsys package`, `pm path` + `sha256sum` y `pidof`
//           en paralelo, construye el mapa técnico de vectores/conexiones y
//           opcionalmente delega una explicación pedagógica a Ollama (`local_llm`).
// POR QUÉ: Pasar de una alerta genérica a un análisis forense verificable que
//          muestra evidencias reales del sistema y cómo mitigarlas (< 195L).
// ============================================================================

use axum::{extract::Query, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use super::local_llm;
use super::paths::{adb_shell, safe_serial};

#[derive(Deserialize)]
pub struct ForensicsQuery {
    pub serial: Option<String>,
    #[serde(rename = "packageName")]
    pub package_name: Option<String>,
}

const SENSITIVE_PERMS: &[(&str, &str)] = &[
    ("android.permission.SYSTEM_ALERT_WINDOW", "Overlay sobre otras apps (vector de adware/clickjacking)"),
    ("android.permission.REQUEST_INSTALL_PACKAGES", "Instalación de APKs externos (vector de droppers)"),
    ("android.permission.BIND_ACCESSIBILITY_SERVICE", "Servicio de Accesibilidad (lectura de UI / automatización)"),
    ("android.permission.RECEIVE_BOOT_COMPLETED", "Persistencia automática al encender el dispositivo"),
    ("android.permission.READ_SMS", "Lectura de mensajes SMS (códigos OTP/2FA)"),
    ("android.permission.RECEIVE_SMS", "Interceptación de SMS entrantes"),
    ("android.permission.RECORD_AUDIO", "Grabación de micrófono"),
    ("android.permission.CAMERA", "Acceso a cámara"),
    ("android.permission.ACCESS_FINE_LOCATION", "Ubicación GPS precisa"),
    ("android.permission.ACCESS_BACKGROUND_LOCATION", "Ubicación continua en segundo plano"),
    ("android.permission.READ_CONTACTS", "Lectura de libreta de contactos"),
    ("android.permission.READ_CALL_LOG", "Lectura del historial de llamadas"),
    ("android.permission.INTERNET", "Comunicación de red saliente"),
    ("android.permission.FOREGROUND_SERVICE", "Ejecución persistente en primer/segundo plano"),
];

fn sanitize_pkg(raw: &str) -> String {
    raw.trim().chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-')).collect()
}

fn extract_field(dump: &str, key: &str) -> String {
    for line in dump.lines() {
        if let Some(pos) = line.find(key) {
            let rest = &line[pos + key.len()..];
            let val = rest.trim().split_whitespace().next().unwrap_or("").trim();
            if !val.is_empty() { return val.to_string(); }
        }
    }
    String::new()
}

fn extract_line_val(dump: &str, key: &str) -> String {
    for line in dump.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix(key) {
            return rest.trim().to_string();
        }
    }
    String::new()
}

/// Construye el expediente forense real de un paquete Android vía ADB.
async fn collect_forensics(serial: &str, pkg: &str) -> Result<Value, String> {
    let cmd_dump = format!("dumpsys package {pkg}");
    let cmd_path = format!("pm path {pkg}");
    let cmd_pid = format!("pidof {pkg}");
    let ((ok_dump, dump, err_dump), (_, path_out, _), (_, pid_out, _)) = tokio::join!(
        adb_shell(serial, &cmd_dump, 8000),
        adb_shell(serial, &cmd_path, 4000),
        adb_shell(serial, &cmd_pid, 3000),
    );
    if !ok_dump || dump.trim().is_empty() || dump.contains("Unable to find package:") {
        return Err(if err_dump.is_empty() { format!("Paquete no encontrado: {pkg}") } else { err_dump });
    }

    let apk_path = path_out.lines().find_map(|l| l.trim().strip_prefix("package:")).unwrap_or("").trim().to_string();
    let apk_sha256 = if !apk_path.is_empty() && !apk_path.contains(['\'', '\n', '\r', ';']) {
        let (ok_h, h_out, _) = adb_shell(serial, &format!("sha256sum '{apk_path}'"), 8000).await;
        if ok_h { h_out.split_whitespace().next().unwrap_or("").to_string() } else { String::new() }
    } else { String::new() };

    let installer = extract_field(&dump, "installerPackageName=");
    let version = extract_field(&dump, "versionName=");
    let target_sdk = extract_field(&dump, "targetSdk=").parse::<u32>().unwrap_or(0);
    let first_install = extract_line_val(&dump, "firstInstallTime=");
    let last_update = extract_line_val(&dump, "lastUpdateTime=");
    let is_debuggable = dump.contains("DEBUGGABLE");
    let uses_cleartext = dump.contains("USES_CLEARTEXT_TRAFFIC");
    let is_running = !pid_out.trim().is_empty();

    let mut granted: Vec<Value> = Vec::new();
    for (perm, desc) in SENSITIVE_PERMS {
        if dump.contains(&format!("{perm}: granted=true")) || dump.contains(&format!("      {perm}")) {
            granted.push(json!({ "permission": perm, "impact": desc }));
        }
    }

    let has_boot = granted.iter().any(|p| p["permission"] == "android.permission.RECEIVE_BOOT_COMPLETED");
    let has_net = granted.iter().any(|p| p["permission"] == "android.permission.INTERNET");
    let has_overlay = granted.iter().any(|p| p["permission"] == "android.permission.SYSTEM_ALERT_WINDOW");
    let has_install = granted.iter().any(|p| p["permission"] == "android.permission.REQUEST_INSTALL_PACKAGES");

    let mut how_it_works: Vec<String> = Vec::new();
    if has_boot && has_net { how_it_works.push("Persistencia + Red: combina BOOT_COMPLETED con INTERNET; puede iniciarse tras reiniciar el equipo y comunicarse en segundo plano.".into()); }
    if has_overlay { how_it_works.push("Superposición visual: SYSTEM_ALERT_WINDOW permite dibujar ventanas encima de otras apps (común en adware invasivo o superposiciones falsas).".into()); }
    if has_install { how_it_works.push("Cadena de instalación: REQUEST_INSTALL_PACKAGES permite solicitar la instalación de otros APKs externos.".into()); }
    if target_sdk > 0 && target_sdk < 29 { how_it_works.push(format!("API antigua (targetSdk={target_sdk}): evita restricciones modernas de Android sobre almacenamiento y permisos en segundo plano.")); }
    if is_debuggable { how_it_works.push("Compilada con DEBUGGABLE activo: expone superficie de inspección/depuración inusual en apps de producción.".into()); }
    if uses_cleartext { how_it_works.push("Tráfico sin cifrar (USES_CLEARTEXT_TRAFFIC): permite conexiones HTTP planas vulnerables a interceptación en redes locales.".into()); }
    if how_it_works.is_empty() { how_it_works.push("Sin combinaciones críticas de persistencia/overlay/API obsoleta en los metadatos inspeccionados.".into()); }

    let mitigations = vec![
        "Verifica el hash SHA-256 del APK en VirusTotal antes de confiar en orígenes sideload.",
        "Si no reconoces el proveedor/instalador, detén el proceso (am force-stop) y revoca permisos sensibles en Ajustes.",
        "Deshabilita o desinstala paquetes no esenciales con persistencia + red que muestren actividad no solicitada.",
    ];

    Ok(json!({
        "success": true,
        "packageName": pkg,
        "provider": if installer.is_empty() || installer == "null" { "Sideload / Sin tienda oficial" } else { &installer },
        "versionName": if version.is_empty() { "--" } else { &version },
        "targetSdk": target_sdk,
        "firstInstallTime": first_install,
        "lastUpdateTime": last_update,
        "apkPath": apk_path,
        "apkSha256": apk_sha256,
        "isRunningNow": is_running,
        "runningPids": pid_out.trim(),
        "isDebuggable": is_debuggable,
        "usesCleartextTraffic": uses_cleartext,
        "grantedSensitivePermissions": granted,
        "howItWorks": how_it_works,
        "mitigationSteps": mitigations,
    }))
}

/// `GET /api/security-forensics?serial=...&packageName=...`
pub async fn get_forensics(Query(q): Query<ForensicsQuery>) -> (StatusCode, Json<Value>) {
    let raw_serial = q.serial.as_deref().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    let raw_pkg = q.package_name.as_deref().unwrap_or("").trim();
    let pkg = sanitize_pkg(raw_pkg);
    if serial.is_empty() || serial != raw_serial || pkg.is_empty() || pkg != raw_pkg || !pkg.contains('.') {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial o nombre de paquete inválido" })));
    }
    match collect_forensics(&serial, &pkg).await {
        Ok(report) => (StatusCode::OK, Json(report)),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": e }))),
    }
}

/// `POST /api/security-forensics` — Explica el expediente forense real usando un modelo local.
pub async fn explain_forensics_ai(Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let raw_serial = body["serial"].as_str().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    let raw_pkg = body["packageName"].as_str().unwrap_or("").trim();
    let pkg = sanitize_pkg(raw_pkg);
    let model = body["model"].as_str().unwrap_or("").trim();
    if serial.is_empty() || serial != raw_serial || pkg.is_empty() || pkg != raw_pkg || model.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Indica serial, packageName y modelo local" })));
    }
    let report = match collect_forensics(&serial, &pkg).await {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": e }))),
    };
    let prompt = format!(
        "Realiza un análisis forense defensivo en español de este expediente real extraído por ADB:\n{}\n\nExplica en 4 puntos claros: (1) qué es y qué implica el proveedor/instalador, (2) cómo se conectan sus permisos y persistencia, (3) nivel de riesgo real sin exagerar, y (4) pasos defensivos concretos.",
        report
    );
    match local_llm::run_local_model(model, &prompt, None).await {
        Ok((analysis, provider)) => (StatusCode::OK, Json(json!({ "success": true, "report": report, "aiAnalysis": analysis, "aiProvider": provider }))),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": e, "report": report }))),
    }
}
