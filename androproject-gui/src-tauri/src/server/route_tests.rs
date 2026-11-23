//! Comprueba respuestas del router de producción, con sus validaciones y middleware.
use axum::{
    body::{to_bytes, Body},
    http::{header, Request, StatusCode},
};
use serde_json::{json, Value};
use tower::ServiceExt;

/// Despacha cada petición por las mismas rutas que usa la ventana del dashboard.
async fn send(request: Request<Body>) -> (StatusCode, Vec<u8>) {
    let response = super::build_router().oneshot(request).await.unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), 4 * 1024 * 1024).await.unwrap();
    (status, body.to_vec())
}

/// Un endpoint desconocido debe devolver un error JSON reconocible por el cliente.
#[tokio::test]
async fn missing_api_returns_json() {
    let (status, body) = send(Request::get("/api/missing").body(Body::empty()).unwrap()).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(serde_json::from_slice::<Value>(&body).unwrap()["success"], false);
}

/// El selector del dashboard comprueba la disponibilidad del ejecutable ADB instalado.
#[tokio::test]
async fn discovery_reports_adb_executable_status() {
    let (status, body) = send(Request::get("/api/ai-cli").body(Body::empty()).unwrap()).await;
    let result: Value = serde_json::from_slice(&body).unwrap();
    let (available, _, _) = super::paths::run_adb(&["version"], 3000).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["clis"]["adb"], available);
}

/// Ambos rechazos se comprueban antes de que se ejecute un comando en el teléfono.
#[tokio::test]
async fn cli_validates_origin_and_device_selection() {
    let payload = json!({"mode":"adb","prompt":"getprop ro.product.model","serial":""});
    for (origin, expected) in [
        ("http://localhost:3000", StatusCode::BAD_REQUEST),
        ("https://example.invalid", StatusCode::FORBIDDEN),
    ] {
        let request = Request::post("/api/ai-cli")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::ORIGIN, origin)
            .body(Body::from(payload.to_string())).unwrap();
        assert_eq!(send(request).await.0, expected);
    }
}
