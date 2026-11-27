//! Restringe las peticiones web al servidor local a los orígenes de la aplicación.

use axum::{extract::Request, http::{header, StatusCode}, middleware::Next, response::Response};

/// Next usa otro puerto en desarrollo para que Axum conserve el suyo.
pub fn allowed_origins() -> &'static [&'static str] {
    &[
        "http://127.0.0.1:3000", "http://localhost:3000",
        "http://tauri.localhost", "https://tauri.localhost", "tauri://localhost",
        #[cfg(debug_assertions)]
        "http://127.0.0.1:3001",
    ]
}

/// Los clientes nativos pueden no enviar Origin; los navegadores sí lo envían
/// en peticiones entre orígenes. Una página ajena no puede ejecutar acciones ADB.
pub async fn check_origin(request: Request, next: Next) -> Result<Response, StatusCode> {
    if let Some(origin) = request.headers().get(header::ORIGIN) {
        if !origin.to_str().ok().is_some_and(|value| allowed_origins().contains(&value)) {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    Ok(next.run(request).await)
}
