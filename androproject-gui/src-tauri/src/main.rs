// ============================================================================
// ARCHIVO: main.rs
// QUÉ HACE: Punto de entrada 100% Rust de ANDRO-IOS Desktop (Tauri v2 + Axum).
//           Inicia el servidor HTTP/API embebido en Rust (`127.0.0.1:3000`) y
//           monta la ventana nativa WebView2 sin Node.js ni Python en runtime.
// CÓMO FUNCIONA:
//   1. Verifica si el puerto 3000 está libre; si no escucha, levanta el
//      servidor Axum embebido (`server::start_embedded_server`) en < 15 ms.
//   2. Registra los comandos IPC nativos (`adb_fast`, `apps_native`,
//      `emulator`, `logcat_native`) y el comando `open_device_popout`.
// POR QUÉ: Lograr 100% backend Rust nativo, cero Node.js, cero Python y cero
//          ventanas CMD al abrir ANDRO-IOS (< 200L).
// ============================================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adb_fast;
mod apps_native;
mod emulator;
mod logcat_native;
mod server;

use std::net::{SocketAddr, TcpStream};
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Comprueba en 80ms si el puerto local TCP ya está escuchando.
fn is_port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(80)).is_ok()
}

/// Inicia el servidor HTTP + API 100% Rust embebido y espera hasta que acepte TCP.
fn ensure_rust_server() {
    if !is_port_open(3000) {
        server::start_embedded_server();
        for _ in 0..40 {
            if is_port_open(3000) {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
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
        .title(format!("ANDRO-IOS — {}", serial))
        .inner_size(440.0, 880.0)
        .min_inner_size(320.0, 500.0)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    ensure_rust_server();

    tauri::Builder::default()
        .setup(|app| {
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
        .build(tauri::generate_context!())
        .expect("No se pudo iniciar la aplicación")
        .run(|_app, event| {
            // El receptor iniciado por esta aplicación no debe quedar abierto al salir.
            if matches!(event, tauri::RunEvent::Exit) {
                tauri::async_runtime::block_on(server::airplay_process::action("stop"));
            }
        });
}
