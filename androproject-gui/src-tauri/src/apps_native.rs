// ============================================================================
// ARCHIVO: apps_native.rs
// QUÉ HACE: Gestión nativa ultrarrápida de paquetes Android desde Rust (listar,
//           desinstalar, deshabilitar, habilitar, forzar cierre, limpiar, abrir).
// CÓMO FUNCIONA: Valida serial y nombre de paquete con allowlist estricta y
//           ejecuta `adb` directamente sin pasar por shell ni por Node.js.
// POR QUÉ: Eliminar latencia HTTP y riesgos de inyección de comandos en el
//           escritorio Tauri manteniendo < 200 líneas y responsabilidad única.
// ============================================================================

use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct NativeAppInfo {
    pub package_name: String,
    pub is_system: bool,
    pub is_disabled: bool,
}

/// Resuelve el binario `adb` local o desde PATH del sistema.
fn adb_bin() -> PathBuf {
    let custom = PathBuf::from(r"C:\AndroProject\adb.exe");
    if custom.exists() {
        return custom;
    }
    PathBuf::from(if cfg!(target_os = "windows") { "adb.exe" } else { "adb" })
}

/// Valida que el serial ADB contenga únicamente caracteres seguros (USB/Wi-Fi).
pub fn is_valid_serial(serial: &str) -> bool {
    let s = serial.trim();
    !s.is_empty()
        && s.len() <= 64
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | ':' | '-' | '_'))
}

/// Valida que el identificador de paquete Android siga el formato seguro `a.b.c`.
pub fn is_valid_package(pkg: &str) -> bool {
    let p = pkg.trim();
    !p.is_empty()
        && p.len() <= 160
        && p.contains('.')
        && p.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Ejecuta un subcomando `adb -s <serial> ...` sin ventana de consola y retorna stdout.
fn run_adb_args(serial: &str, args: &[&str]) -> Result<String, String> {
    if !is_valid_serial(serial) {
        return Err("Serial de dispositivo inválido".into());
    }
    let mut cmd = Command::new(adb_bin());
    cmd.arg("-s").arg(serial.trim()).args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let out = cmd.output().map_err(|e| format!("Error ejecutando adb: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let msg = if err.is_empty() {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        } else {
            err
        };
        return Err(if msg.is_empty() { "Comando ADB falló".into() } else { msg });
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

/// Parsea líneas `package:com.ejemplo.app` hacia un conjunto limpio de nombres.
fn parse_pkg_set(raw: &str) -> HashSet<String> {
    raw.lines()
        .filter_map(|l| l.trim().strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Lista todos los paquetes instalados indicando si son de sistema o deshabilitados.
#[tauri::command]
pub fn rust_list_packages_fast(serial: String) -> Result<Vec<NativeAppInfo>, String> {
    let all_raw = run_adb_args(&serial, &["shell", "pm", "list", "packages"])?;
    let sys_raw = run_adb_args(&serial, &["shell", "pm", "list", "packages", "-s"]).unwrap_or_default();
    let dis_raw = run_adb_args(&serial, &["shell", "pm", "list", "packages", "-d"]).unwrap_or_default();

    let system_set = parse_pkg_set(&sys_raw);
    let disabled_set = parse_pkg_set(&dis_raw);

    let mut apps: Vec<NativeAppInfo> = parse_pkg_set(&all_raw)
        .into_iter()
        .map(|pkg| NativeAppInfo {
            is_system: system_set.contains(&pkg),
            is_disabled: disabled_set.contains(&pkg),
            package_name: pkg,
        })
        .collect();

    apps.sort_by(|a, b| a.package_name.cmp(&b.package_name));
    Ok(apps)
}

/// Ejecuta una acción administrativa segura sobre un paquete Android desde Rust.
#[tauri::command]
pub fn rust_app_action_fast(
    serial: String,
    package_name: String,
    action: String,
) -> Result<String, String> {
    if !is_valid_package(&package_name) {
        return Err("Nombre de paquete inválido".into());
    }
    let pkg = package_name.trim();
    let args: Vec<&str> = match action.trim() {
        "uninstall" => vec!["shell", "pm", "uninstall", "--user", "0", pkg],
        "disable" => vec!["shell", "pm", "disable-user", "--user", "0", pkg],
        "enable" => vec!["shell", "pm", "enable", pkg],
        "force_stop" => vec!["shell", "am", "force-stop", pkg],
        "clear_data" => vec!["shell", "pm", "clear", pkg],
        "launch" => vec!["shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"],
        _ => return Err("Acción no soportada".into()),
    };
    run_adb_args(&serial, &args)
}
