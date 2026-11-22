// ============================================================================
// ARCHIVO: main.rs
// QUÉ HACE: Punto de entrada de la aplicación nativa de escritorio Tauri (Rust)
//           con auto-arranque de servicios (Vision Backend :8000 + Next.js :3000),
//           multipantalla, control ADB ultrarrápido y emuladores AVD.
// CÓMO FUNCIONA:
//   1. Verifica si los puertos locales 8000 (Python Vision) y 3000 (Next.js GUI)
//      están aceptando conexiones TCP.
//   2. Si alguno no está activo, lo inicia automáticamente en segundo plano sin
//      abrir consolas negras (`CREATE_NO_WINDOW = 0x08000000`).
//   3. Registra todos los comandos IPC nativos (`adb_fast`, `apps_native`,
//      `emulator`, `logcat_native`) y enfoca la ventana nativa WebView2.
// POR QUÉ: Permitir abrir la versión de escritorio instalada con un solo clic
//          sin depender de terminales manuales ni Electron (0ms overhead).
// ============================================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adb_fast;
mod apps_native;
mod emulator;
mod logcat_native;

use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Flag de Windows para ejecutar subprocesos sin abrir ventana de consola.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Comprueba en 120ms si un puerto TCP local (`127.0.0.1:port`) ya está escuchando.
fn is_port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok()
}

/// Localiza la raíz de instalación o repositorio (`C:\AndroProject`, exe_dir o dev) sin rutas fijas de usuario.
fn resolve_project_root() -> PathBuf {
    if let Ok(env_home) = std::env::var("ANDROPROJECT_HOME") {
        let p = PathBuf::from(env_home);
        if p.exists() {
            return p;
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            if exe_dir.join(r"next-standalone\server.js").exists() {
                return exe_dir.parent().unwrap_or(exe_dir).to_path_buf();
            }
            if exe_dir.join(r"Dashboard\next-standalone\server.js").exists() {
                return exe_dir.to_path_buf();
            }
        }
    }
    let installed = PathBuf::from(r"C:\AndroProject");
    if installed.join(r"Dashboard\next-standalone\server.js").exists() {
        return installed;
    }
    std::env::current_dir().unwrap_or_else(|_| installed)
}

/// Inicia automáticamente Vision Backend (:8000) y Next.js (:3000) si no están activos.
fn ensure_platform_services() {
    let root = resolve_project_root();

    // 1. Auto-arranque del Vision Backend Python en puerto 8000
    if !is_port_open(8000) {
        let backend_dir = root.join("vision-backend");
        let py_exe = backend_dir.join(r".venv\Scripts\python.exe");
        if py_exe.exists() {
            let mut cmd = Command::new(py_exe);
            cmd.arg("main.py").current_dir(&backend_dir);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = cmd.spawn();
        }
    }

    // 2. Auto-arranque del servidor GUI Next.js en puerto 3000 (instalado o repo dev)
    if !is_port_open(3000) {
        let installed_js = root.join(r"Dashboard\next-standalone\server.js");
        let dev_gui_dir = root.join("androproject-gui");
        let dev_js = dev_gui_dir.join(r".next\standalone\server.js");
        let (standalone_js, work_dir) = if installed_js.exists() {
            (installed_js, root.join(r"Dashboard\next-standalone"))
        } else {
            (dev_js, dev_gui_dir.clone())
        };
        let node_bin = if root.join("node.exe").exists() {
            root.join("node.exe")
        } else {
            PathBuf::from("node")
        };

        if standalone_js.exists() {
            let mut cmd = Command::new(node_bin);
            cmd.arg(&standalone_js)
                .current_dir(&work_dir)
                .env("PORT", "3000")
                .env("HOSTNAME", "127.0.0.1")
                .env("ANDROPROJECT_HOME", &root);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = cmd.spawn();
        } else if dev_gui_dir.exists() {
            let mut cmd = Command::new("cmd.exe");
            cmd.args(["/c", "npm", "run", "dev"]).current_dir(&dev_gui_dir);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = cmd.spawn();
        }

        // Esperar hasta ~4 segundos a que el puerto 3000 responda antes de abrir WebView2
        for _ in 0..20 {
            if is_port_open(3000) {
                break;
            }
            std::thread::sleep(Duration::from_millis(200));
        }
    }
}

/// Comando IPC para abrir un dispositivo en su propia ventana flotante nativa.
#[tauri::command]
fn open_device_popout(app: tauri::AppHandle, serial: String) -> Result<(), String> {
    let label = format!("popout_{}", serial.replace([':', '.'], "_"));
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url_str = format!("http://127.0.0.1:3000/popout?serial={}", serial);
    let url = WebviewUrl::App(url_str.parse().map_err(|e| format!("{:?}", e))?);

    WebviewWindowBuilder::new(&app, &label, url)
        .title(format!("AndroProject — {}", serial))
        .inner_size(440.0, 880.0)
        .min_inner_size(320.0, 500.0)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    // Garantiza que Backend (:8000) y GUI (:3000) estén activos antes de montar la ventana
    ensure_platform_services();

    tauri::Builder::default()
        .setup(|app| {
            // Enfocar y mostrar explícitamente la ventana principal de escritorio
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_device_popout,
            emulator::list_avds,
            emulator::launch_avd,
            emulator::launch_scrcpy_native,
            emulator::install_apk_native,
            adb_fast::adb_list_devices_fast,
            adb_fast::adb_key_fast,
            adb_fast::launch_multi_scrcpy_native,
            apps_native::rust_list_packages_fast,
            apps_native::rust_app_action_fast,
            logcat_native::rust_logcat_snapshot,
            logcat_native::rust_logcat_clear,
            logcat_native::rust_device_metrics_fast,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AndroProject desktop application");
}
