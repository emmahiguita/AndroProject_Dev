//! Restringe las peticiones web al servidor local a los orígenes de la aplicación.

use axum::{extract::Request, http::{header, StatusCode}, middleware::Next, response::Response};

/// Los clientes nativos pueden no enviar Origin; los navegadores sí lo envían
/// en peticiones entre orígenes. Una página ajena no puede ejecutar acciones ADB.
pub async fn check_origin(request: Request, next: Next) -> Result<Response, StatusCode> {
    if let Some(origin) = request.headers().get(header::ORIGIN) {
        let allowed = [
            "http://127.0.0.1:3000", "http://localhost:3000",
            "http://tauri.localhost", "https://tauri.localhost", "tauri://localhost",
        ];
        if !origin.to_str().ok().is_some_and(|value| allowed.contains(&value)) {
            return Err(StatusCode::FORBIDDEN);
        }
    }
    Ok(next.run(request).await)
}
