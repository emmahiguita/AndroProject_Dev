// ============================================================================
// ARCHIVO: server/mod.rs
// QUÉ HACE: Servidor HTTP embebido 100% Rust (Axum + Tokio) en 127.0.0.1:3000
//           que sirve el frontend estático (`www/`) y todas las rutas `/api/*`.
// CÓMO FUNCIONA: Registra cada endpoint nativo en un `Router` con CORS y
//           `ServeDir` + fallback HTML para rutas Next.js exportadas.
// POR QUÉ: Eliminar Node.js (`next-standalone`) y Python del runtime (< 200L).
// ============================================================================

pub mod actions_api;
pub mod navigation;
pub mod recording;
pub mod adb_service;
pub mod diagnostics;
pub mod airplay_process;
pub mod apps_api;
pub mod apps_catalog;
pub mod apk_extract;
pub mod cli_api;
pub mod capture_diagnostics;
pub mod device_api;
pub mod developer_actions;
pub mod driver_actions;
pub mod driver_scan;
pub mod extra_actions;
pub mod file_operations_api;
pub mod local_llm;
pub mod flasher_actions;
pub mod flash_image_api;
pub mod gpu_driver;
pub mod optimizer_actions;
pub mod origin_guard;
pub mod paths;
pub mod scrcpy_api;
pub mod scrcpy_hub;
mod scrcpy_transport;
pub mod screen_process;
pub mod security_scan;
pub mod skills_loader;
pub mod system_api;
pub mod telemetry;
pub mod threat_forensics;
pub mod transfer_api;
pub mod ui_automation;

use axum::{
    routing::{any, get, post},
    Router,
};

use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

/// Construye el router Axum completo con API nativa Rust y archivos estáticos.
pub fn build_router() -> Router {
    let www = paths::web_root_dir();
    let index_html = www.join("index.html");
    let popout_html = www.join("popout.html");
    let ios_html = www.join("ios-mirror.html");
    let camera_html = www.join("camera.html");

    let cors = CorsLayer::new()
        // CORS restringe la lectura; check_origin también bloquea peticiones simples.
        .allow_origin(origin_guard::allowed_origins().iter().map(|s| s.parse().unwrap()).collect::<Vec<_>>())
        .allow_methods(Any)
        .allow_headers(Any);

    let mut router = Router::new()
        .route("/api/config", get(device_api::get_config).post(extra_actions::post_config))
        .route("/api/device", get(device_api::get_device))
        .route("/api/device-image", get(device_api::get_device_image))
        .route("/api/device-stream", get(device_api::get_device_image))
        .route("/api/scrcpy-video", get(scrcpy_api::stream_video))
        .route("/api/scrcpy-control", post(scrcpy_api::post_control))
        .route("/api/actions", post(actions_api::post_actions))
        .route("/api/apps", post(apps_api::post_apps))
        .route("/api/apps/icon", get(apps_api::get_app_icon))
        .route("/api/install-apk", post(transfer_api::install).layer(axum::extract::DefaultBodyLimit::max(512 * 1024 * 1024)))
        .route("/api/upload-file", get(apps_api::get_upload_file).post(transfer_api::upload).layer(axum::extract::DefaultBodyLimit::max(512 * 1024 * 1024)))
        .route("/api/device-file/download", post(file_operations_api::download))
        .route("/api/device-file/delete", post(file_operations_api::delete))
        .route("/api/drivers", get(system_api::get_drivers).post(driver_actions::run))
        .route("/api/airplay", get(system_api::get_airplay).post(system_api::post_airplay))
        .route("/api/ios", get(system_api::get_ios))
        .route("/api/logcat", get(system_api::get_logcat))
        .route("/api/security-scan", get(system_api::get_security_scan))
        .route("/api/security-forensics", get(threat_forensics::get_forensics).post(threat_forensics::explain_forensics_ai))
        .route("/api/flash", post(system_api::post_flash))
        .route("/api/flash-image", post(flash_image_api::run).layer(axum::extract::DefaultBodyLimit::max(8_usize * 1024 * 1024 * 1024)))
        .route("/api/ai-cli", get(cli_api::discover).post(cli_api::execute))
        .route("/api/ui-automation", get(ui_automation::inspect_ui).post(ui_automation::run_ui_action))
        .route("/api/gpu-driver", get(gpu_driver::get_gpu_info).post(gpu_driver::post_gpu_action));

    // Una API inexistente debe responder 404, no la página HTML de inicio.
    router = router.route("/api/*path", any(|| async {
        (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({ "success": false, "error": "Ruta API no implementada" })))
    }));

    if popout_html.exists() {
        router = router.route_service("/popout", ServeFile::new(popout_html));
    }
    if ios_html.exists() {
        router = router.route_service("/ios-mirror", ServeFile::new(ios_html));
    }
    if camera_html.exists() {
        router = router.route_service("/camera", ServeFile::new(camera_html));
    }

    let static_service = ServeDir::new(&www).not_found_service(ServeFile::new(index_html));
    router.fallback_service(static_service).layer(cors).layer(axum::middleware::from_fn(origin_guard::check_origin))
}

#[cfg(test)]
mod route_tests;

/// Reserva el puerto antes de crear la ventana y entrega el mismo socket a Axum.
pub fn start_embedded_server() -> std::io::Result<()> {
    let socket = std::net::TcpListener::bind(("127.0.0.1", 3000))?;
    socket.set_nonblocking(true)?;
    let rt = tokio::runtime::Builder::new_multi_thread().enable_all().build()?;
    let listener = {
        let _guard = rt.enter();
        tokio::net::TcpListener::from_std(socket)?
    };
    std::thread::Builder::new().name("andro-api".into()).spawn(move || {
        rt.block_on(async move {
            if let Err(error) = axum::serve(listener, build_router()).await {
                eprintln!("Error al servir la API: {error}");
            }
        });
    })?;
    Ok(())
}
