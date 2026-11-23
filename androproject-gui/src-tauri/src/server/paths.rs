// ============================================================================
// ARCHIVO: server/paths.rs
// QUÉ HACE: Resuelve rutas nativas del sistema (ANDROPROJECT_HOME, adb.exe,
//           fastboot.exe, AndroProject.exe, scrcpy-server, Capturas y www)
//           y ejecuta subprocesos silenciosos sin ventanas CMD.
// CÓMO FUNCIONA: Combina variables de entorno, C:\AndroProject y fallbacks del
//           repositorio dev; aplica CREATE_NO_WINDOW (0x08000000) en Windows.
// POR QUÉ: Centralizar rutas y ejecución segura de comandos nativos (< 200L).
// ============================================================================

use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

#[cfg(target_os = "windows")]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Resuelve el directorio raíz de ANDRO-IOS (env, C:\AndroProject o dev repo).
pub fn home_dir() -> PathBuf {
    if let Ok(env_home) = std::env::var("ANDROPROJECT_HOME") {
        let p = PathBuf::from(env_home);
        if p.exists() {
            return p;
        }
    }
    let installed = PathBuf::from(r"C:\AndroProject");
    if installed.exists() {
        return installed;
    }
    std::env::current_dir().unwrap_or(installed)
}

/// Resuelve el directorio de archivos estáticos del frontend (`www/` u `out/`).
pub fn web_root_dir() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let local_www = dir.join("www");
            if local_www.join("index.html").exists() {
                return local_www;
            }
            for anc in exe.ancestors() {
                let dev_out = anc.join("out");
                if dev_out.join("index.html").exists() {
                    return dev_out;
                }
                let gui_out = anc.join("androproject-gui").join("out");
                if gui_out.join("index.html").exists() {
                    return gui_out;
                }
            }
        }
    }
    let inst_www = home_dir().join("Dashboard").join("www");
    if inst_www.join("index.html").exists() {
        return inst_www;
    }
    PathBuf::from("out")
}

/// Resuelve la ruta a `adb.exe`.
pub fn adb_bin() -> PathBuf {
    let bundled = home_dir().join("adb.exe");
    if bundled.exists() {
        return bundled;
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let sdk = PathBuf::from(local).join(r"Android\Sdk\platform-tools\adb.exe");
        if sdk.exists() {
            return sdk;
        }
    }
    PathBuf::from(if cfg!(target_os = "windows") { "adb.exe" } else { "adb" })
}

/// Resuelve la ruta a `fastboot.exe`.
pub fn fastboot_bin() -> PathBuf {
    let bundled = home_dir().join("fastboot.exe");
    if bundled.exists() {
        return bundled;
    }
    PathBuf::from(if cfg!(target_os = "windows") { "fastboot.exe" } else { "fastboot" })
}

/// Resuelve la ruta al binario nativo `AndroProject.exe` / `scrcpy.exe`.
pub fn scrcpy_bin() -> PathBuf {
    let primary = home_dir().join("AndroProject.exe");
    if primary.exists() {
        return primary;
    }
    let alt = home_dir().join("scrcpy.exe");
    if alt.exists() {
        return alt;
    }
    PathBuf::from(if cfg!(target_os = "windows") { "scrcpy.exe" } else { "scrcpy" })
}

/// Resuelve la ruta a `scrcpy-server`.
pub fn scrcpy_server_path() -> PathBuf {
    let p1 = home_dir().join("scrcpy-server");
    if p1.exists() {
        return p1;
    }
    let p2 = home_dir().join("AndroProject-server");
    if p2.exists() {
        return p2;
    }
    scrcpy_bin().parent().map(|d| d.join("scrcpy-server")).unwrap_or(p1)
}

/// Resuelve la carpeta de capturas de pantalla (`Capturas/`).
pub fn captures_dir() -> PathBuf {
    let d = home_dir().join("Capturas");
    let _ = std::fs::create_dir_all(&d);
    d
}

/// Crea un `tokio::process::Command` ocultando consola en Windows.
pub fn silent_cmd(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Ejecuta `adb` con timeout y devuelve `(ok, stdout, stderr)`.
pub async fn run_adb(args: &[&str], timeout_ms: u64) -> (bool, String, String) {
    let mut cmd = silent_cmd(adb_bin());
    // Si vence el plazo, Tokio termina el proceso hijo al descartar la operación.
    cmd.kill_on_drop(true).args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    match tokio::time::timeout(Duration::from_millis(timeout_ms), cmd.output()).await {
        Ok(Ok(out)) => (
            out.status.success(),
            String::from_utf8_lossy(&out.stdout).to_string(),
            String::from_utf8_lossy(&out.stderr).to_string(),
        ),
        Ok(Err(e)) => (false, String::new(), e.to_string()),
        Err(_) => (false, String::new(), "Timeout ejecutando ADB".to_string()),
    }
}

/// Ejecuta `adb -s <serial> shell <shell_cmd>` de forma segura.
pub async fn adb_shell(serial: &str, shell_cmd: &str, timeout_ms: u64) -> (bool, String, String) {
    if serial.is_empty() {
        return run_adb(&["shell", shell_cmd], timeout_ms).await;
    }
    run_adb(&["-s", serial, "shell", shell_cmd], timeout_ms).await
}

/// Sanitiza un serial ADB evitando inyección de caracteres de control.
pub fn safe_serial(raw: &str) -> String {
    raw.trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | ':' | '-' | '_'))
        .collect()
}
