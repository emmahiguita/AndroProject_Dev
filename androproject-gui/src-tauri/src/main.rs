// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn open_device_popout(app: tauri::AppHandle, serial: String) -> Result<(), String> {
    let label = format!("popout_{}", serial.replace([':', '.'], "_"));
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url_str = format!("http://127.0.0.1:3001/popout?serial={}", serial);
    let url = WebviewUrl::App(url_str.parse().unwrap());

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
        .invoke_handler(tauri::generate_handler![open_device_popout])
        .run(tauri::generate_context!())
        .expect("error while running AndroProject desktop application");
}
