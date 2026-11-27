// ============================================================================
// ARCHIVO: server/security_scan.rs
// QUÉ HACE: Motor heurístico nativo 100% Rust de auditoría de virus, spyware,
//           adware y troyanos Android vía ADB (`GET /api/security-scan`).
// CÓMO FUNCIONA: Ejecuta en paralelo consultas ADB reales (paquetes de terceros
//           + instalador, Overlay, Instalador de APKs, Accesibilidad, Listener
//           de notificaciones, Device Admin y actividades Launcher) y calcula
//           puntaje de riesgo, severidad, categoría y evidencias por paquete.
// POR QUÉ: Sustituir el filtro trivial por nombre de paquete con una auditoría
//          heurística real, rápida y sin simulaciones (< 200L).
// ============================================================================

use serde_json::{json, Value};
use std::collections::HashSet;

use super::paths::adb_shell;

const TRUSTED_INSTALLERS: &[&str] = &[
    "com.android.vending",
    "com.sec.android.app.samsungapps",
    "com.amazon.venezia",
    "com.huawei.appmarket",
    "org.fdroid.fdroid",
    "com.xiaomi.market",
    "com.heytap.market",
];

const SUSPICIOUS_TERMS: &[&str] = &[
    "spy", "stalker", "keylog", "rat.", "adware", "cleaner.booster",
    "ram.booster", "supercleaner", "flash.light.free", "trojan", "flexispy",
    "mspy", "cerberus", "hiddenapp", "stealth", "trackphone",
];

/// Parsea líneas `package:com.foo installer=com.android.vending`.
fn parse_third_party_packages(raw: &str) -> Vec<(String, String)> {
    raw.lines()
        .filter_map(|line| {
            let trimmed = line.trim().strip_prefix("package:")?;
            let mut parts = trimmed.split_whitespace();
            let pkg = parts.next()?.trim().to_string();
            let installer = parts
                .find_map(|p| p.strip_prefix("installer="))
                .unwrap_or("null")
                .trim()
                .to_string();
            if pkg.is_empty() { None } else { Some((pkg, installer)) }
        })
        .collect()
}

/// Extrae nombres de paquete desde salidas tipo `com.pkg/com.pkg.Svc:com.other/.Svc`.
fn parse_colon_components(raw: &str) -> HashSet<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" { return HashSet::new(); }
    trimmed
        .split(':')
        .filter_map(|entry| entry.split('/').next().map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty() && s.contains('.'))
        .collect()
}

/// Extrae nombres de paquete desde `cmd appops query-op` (un paquete por línea).
fn parse_pkg_lines(raw: &str) -> HashSet<String> {
    raw.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && l.contains('.') && !l.contains(' '))
        .map(|l| l.to_string())
        .collect()
}

/// Extrae paquetes con icono en el Launcher desde `cmd package query-activities --brief`.
fn parse_launcher_packages(raw: &str) -> HashSet<String> {
    raw.lines()
        .filter_map(|l| {
            let t = l.trim();
            if !t.contains('/') { return None; }
            let pkg = t.split('/').next()?.trim();
            if pkg.contains('.') && !pkg.contains(' ') { Some(pkg.to_string()) } else { None }
        })
        .collect()
}

/// Extrae paquetes con privilegios de Administrador de Dispositivo en `dumpsys device_policy`.
fn parse_device_admins(raw: &str) -> HashSet<String> {
    let mut admins = HashSet::new();
    for line in raw.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("admin=ComponentInfo{") {
            if let Some(pkg) = rest.split('/').next() {
                if pkg.contains('.') { admins.insert(pkg.trim().to_string()); }
            }
        }
    }
    admins
}

/// Ejecuta la auditoría heurística completa sobre el dispositivo Android indicado.
pub async fn scan(serial: &str) -> Value {
    let (
        (ok_pkgs, pkgs_out, pkgs_err),
        (_, overlay_out, _),
        (_, install_out, _),
        (_, acc_out, _),
        (_, notif_out, _),
        (_, admin_out, _),
        (_, launcher_out, _),
    ) = tokio::join!(
        adb_shell(serial, "pm list packages -3 -i", 8000),
        adb_shell(serial, "cmd appops query-op --user 0 SYSTEM_ALERT_WINDOW allow", 5000),
        adb_shell(serial, "cmd appops query-op --user 0 REQUEST_INSTALL_PACKAGES allow", 5000),
        adb_shell(serial, "settings get secure enabled_accessibility_services", 4000),
        adb_shell(serial, "settings get secure enabled_notification_listeners", 4000),
        adb_shell(serial, "dumpsys device_policy", 5000),
        adb_shell(serial, "cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER", 6000),
    );

    if !ok_pkgs {
        return json!({ "success": false, "error": pkgs_err, "findings": [], "scannedCount": 0 });
    }

    let pkgs = parse_third_party_packages(&pkgs_out);
    let overlays = parse_pkg_lines(&overlay_out);
    let installers = parse_pkg_lines(&install_out);
    let accessibilities = parse_colon_components(&acc_out);
    let notif_listeners = parse_colon_components(&notif_out);
    let device_admins = parse_device_admins(&admin_out);
    let launcher_pkgs = parse_launcher_packages(&launcher_out);
    let has_launcher_data = !launcher_pkgs.is_empty();

    let mut findings: Vec<(u32, Value)> = Vec::new();
    for (pkg, installer) in &pkgs {
        let lower = pkg.to_lowercase();
        let sideloaded = installer == "null" || !TRUSTED_INSTALLERS.contains(&installer.as_str());
        let has_overlay = overlays.contains(pkg);
        let has_install = installers.contains(pkg);
        let has_acc = accessibilities.contains(pkg);
        let has_notif = notif_listeners.contains(pkg);
        let is_admin = device_admins.contains(pkg);
        let is_hidden = has_launcher_data && !launcher_pkgs.contains(pkg);
        let name_hit = SUSPICIOUS_TERMS.iter().any(|k| lower.contains(k));

        let mut score: u32 = 0;
        let mut reasons: Vec<&'static str> = Vec::new();

        if is_admin { score += 45; reasons.push("Tiene privilegios activos de Administrador del Dispositivo (dificulta desinstalación)"); }
        if has_acc { score += 40; reasons.push("Servicio de Accesibilidad activo (puede leer pantalla y simular toques)"); }
        if has_notif { score += 25; reasons.push("Acceso activo a todas las notificaciones (riesgo de lectura de códigos OTP/2FA)"); }
        if has_overlay { score += 25; reasons.push("Permiso Overlay activo (puede mostrar anuncios o ventanas falsas sobre otras apps)"); }
        if has_install { score += 20; reasons.push("Autorizada para instalar APKs externos (vector común de droppers)"); }
        if is_hidden { score += 20; reasons.push("Aplicación de terceros oculta sin icono visible en el menú principal"); }
        if name_hit { score += 35; reasons.push("Nombre de paquete coincide con firma heurística de spyware/adware"); }
        if sideloaded && score > 0 { score += 15; reasons.push("Instalada fuera de tiendas oficiales (sideload / origen desconocido)"); }

        // Solo reportar si supera umbral real de riesgo (evita falsos positivos de sideload inocuo).
        if score < 20 { continue; }

        let severity = if score >= 60 { "critical" } else if score >= 35 { "high" } else { "medium" };
        let category = if is_admin || (has_install && (has_acc || sideloaded)) {
            "trojan"
        } else if has_acc || has_notif || name_hit {
            "spyware"
        } else {
            "adware"
        };

        findings.push((score, json!({
            "packageName": pkg,
            "severity": severity,
            "category": category,
            "score": score,
            "installer": if installer == "null" { "Sideload (sin tienda)" } else { installer.as_str() },
            "hasOverlay": has_overlay,
            "hasAccessibility": has_acc,
            "hasNotificationAccess": has_notif,
            "hasInstallPackages": has_install,
            "isDeviceAdmin": is_admin,
            "isHidden": is_hidden,
            "reasons": reasons,
        })));
    }

    findings.sort_by(|a, b| b.0.cmp(&a.0));
    let sorted: Vec<Value> = findings.into_iter().map(|(_, v)| v).collect();

    json!({
        "success": true,
        "findings": sorted,
        "scannedCount": pkgs.len(),
        "signals": {
            "overlayCount": overlays.len(),
            "accessibilityCount": accessibilities.len(),
            "notificationListenersCount": notif_listeners.len(),
            "deviceAdminsCount": device_admins.len(),
        }
    })
}
