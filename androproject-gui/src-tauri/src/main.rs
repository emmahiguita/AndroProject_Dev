// ============================================================================
// ARCHIVO: main.rs
// QUÉ HACE: Punto de entrada de la aplicación nativa de escritorio Tauri (Rust)
//           con multipantalla, control ADB ultrarrápido y emuladores AVD.
// CÓMO FUNCIONA: Registra los comandos IPC nativos (emulator + adb_fast).
// POR QUÉ: Proveer ejecución nativa ligera de latencia cero en Windows/Linux.
// ============================================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adb_fast;
mod apps_native;
mod emulator;
mod logcat_native;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

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
    tauri::Builder::default()
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
