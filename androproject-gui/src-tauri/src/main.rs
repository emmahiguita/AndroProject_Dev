// ============================================================================
// ARCHIVO: main.rs
// QUÉ HACE: Punto de entrada 100% Rust de ANDRO-IOS Desktop (Tauri v2 + Axum).
//           Inicia el servidor HTTP/API embebido en Rust (`127.0.0.1:3000`) y
//           monta la ventana nativa WebView2 sin Node.js ni Python en runtime.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adb_fast;
mod apps_policy;
mod apps_native;
mod emulator;
mod logcat_native;
mod server;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Comando IPC para abrir un dispositivo en su propia ventana flotante nativa.
#[tauri::command]
fn open_device_popout(app: tauri::AppHandle, serial: String) -> Result<(), String> {
    if serial.is_empty() || server::paths::safe_serial(&serial) != serial { return Err("Serial no válido".into()); }
    let label = format!("popout_{}", serial.replace([':', '.'], "_"));
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let port = if cfg!(debug_assertions) { 3001 } else { 3000 };
    let url_str = format!("http://127.0.0.1:{port}/popout?serial={}", serial);
    let url = WebviewUrl::External(url_str.parse().map_err(|e| format!("{:?}", e))?);

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
    // La ventana solo se abre después de reservar el puerto de nuestra API.
    if let Err(error) = server::start_embedded_server() {
        let message = format!("No se pudo iniciar la API local (127.0.0.1:3000). {error}");
        eprintln!("{message}");
        #[cfg(windows)]
        report_startup_error(&message);
        std::process::exit(1);
    }

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
                tauri::async_runtime::block_on(async {
                    tokio::join!(server::recording::shutdown(), server::screen_process::shutdown(), server::airplay_process::action("stop"), server::scrcpy_hub::shutdown());
                });
            }
        });
}

/// El ejecutable gráfico carece de consola visible en Windows.
#[cfg(windows)]
fn report_startup_error(message: &str) {
    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(hwnd: isize, text: *const u16, title: *const u16, flags: u32) -> i32;
    }
    let text: Vec<u16> = message.encode_utf16().chain(Some(0)).collect();
    let title: Vec<u16> = "ANDRO-IOS".encode_utf16().chain(Some(0)).collect();
    // Ambas cadenas UTF-16 viven hasta que se cierra el cuadro de error.
    unsafe { MessageBoxW(0, text.as_ptr(), title.as_ptr(), 0x10); }
}
