// ============================================================================
// ARCHIVO: server/mod.rs
// QUÉ HACE: Servidor HTTP embebido 100% Rust (Axum + Tokio) en 127.0.0.1:3000
//           que sirve el frontend estático (`www/`) y todas las rutas `/api/*`.
// CÓMO FUNCIONA: Registra cada endpoint nativo en un `Router` con CORS y
//           `ServeDir` + fallback HTML para rutas Next.js exportadas.
// POR QUÉ: Eliminar Node.js (`next-standalone`) y Python del runtime (< 200L).
// ============================================================================

pub mod actions_api;
pub mod apps_api;
pub mod device_api;
pub mod paths;
pub mod scrcpy_api;
pub mod scrcpy_hub;
pub mod system_api;
pub mod telemetry;

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
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
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut router = Router::new()
        .route("/api/config", get(device_api::get_config))
        .route("/api/device", get(device_api::get_device))
        .route("/api/device-image", get(device_api::get_device_image))
        .route("/api/device-stream", get(device_api::get_device_image))
        .route("/api/scrcpy-video", get(scrcpy_api::stream_video))
        .route("/api/scrcpy-control", post(scrcpy_api::post_control))
        .route("/api/actions", post(actions_api::post_actions))
        .route("/api/apps", post(apps_api::post_apps))
        .route("/api/apps/icon", get(apps_api::get_app_icon))
        .route("/api/install-apk", post(apps_api::post_install_apk))
        .route("/api/upload-file", post(apps_api::post_upload_file))
        .route("/api/drivers", get(system_api::get_drivers))
        .route("/api/airplay", get(system_api::get_airplay).post(system_api::post_airplay))
        .route("/api/ios", get(system_api::get_ios))
        .route("/api/logcat", get(system_api::get_logcat))
        .route("/api/security-scan", get(system_api::get_security_scan))
        .route("/api/flash", post(system_api::post_flash))
        .route("/api/ai-cli", get(system_api::handle_ai_cli).post(system_api::handle_ai_cli));

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
    router.fallback_service(static_service).layer(cors)
}

/// Inicia el servidor HTTP 100% Rust en un hilo dedicado Tokio sobre 127.0.0.1:3000.
pub fn start_embedded_server() {
    std::thread::spawn(|| {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
        {
            Ok(r) => r,
            Err(_) => return,
        };

        rt.block_on(async move {
            let addr: SocketAddr = ([127, 0, 0, 1], 3000).into();
            if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
                let app = build_router();
                let _ = axum::serve(listener, app).await;
            }
        });
    });
}
