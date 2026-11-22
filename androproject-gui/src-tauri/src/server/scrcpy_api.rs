// ============================================================================
// ARCHIVO: server/scrcpy_api.rs
// QUÉ HACE: Endpoints HTTP `/api/scrcpy-video` (stream binario H.264 SC41) y
//           `/api/scrcpy-control` (inyección táctil directa < 1ms) en Rust.
// CÓMO FUNCIONA: Conecta consumidores HTTP al canal broadcast de `scrcpy_hub`
//           enviando cabecera SC41 + config SPS/PPS + keyframe inicial.
// POR QUÉ: Alimentar WebCodecsCanvas a 60 FPS sin Node.js ni FFmpeg (< 200L).
// ============================================================================

use axum::{
    body::Body,
    extract::Query,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio_stream::wrappers::ReceiverStream;

use super::device_api::SerialQuery;
use super::paths::safe_serial;
use super::scrcpy_hub::{get_or_start_session, send_touch};

#[derive(Deserialize)]
pub struct ControlPayload {
    pub serial: Option<String>,
    pub action: Option<Value>,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

/// `GET /api/scrcpy-video?serial=...` — Stream continuo H.264 formato SC41.
pub async fn stream_video(Query(q): Query<SerialQuery>) -> Response {
    let serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    if serial.is_empty() || serial.starts_with("airplay-") || serial.starts_with("apple-") {
        return (StatusCode::BAD_REQUEST, "Android serial requerido").into_response();
    }

    let session = match get_or_start_session(&serial).await {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error H.264: {}", e)).into_response(),
    };

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Vec<u8>, std::io::Error>>(48);
    let mut bcast = session.tx.subscribe();

    let mut hdr = Vec::with_capacity(12);
    hdr.extend_from_slice(b"SC41");
    hdr.extend_from_slice(&session.width.to_be_bytes());
    hdr.extend_from_slice(&session.height.to_be_bytes());
    let _ = tx.send(Ok(hdr)).await;

    if let Some(cfg) = session.config_pkt.lock().await.clone() {
        let _ = tx.send(Ok((*cfg).clone())).await;
    }
    if let Some(key) = session.key_pkt.lock().await.clone() {
        let _ = tx.send(Ok((*key).clone())).await;
    }

    tokio::spawn(async move {
        loop {
            match bcast.recv().await {
                Ok(pkt) => {
                    if tx.try_send(Ok((*pkt).clone())).is_err() && tx.is_closed() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    });

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CACHE_CONTROL, "no-store, no-cache, must-revalidate")
        .body(Body::from_stream(ReceiverStream::new(rx)))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// `POST /api/scrcpy-control` — Inyecta down/up/move directo al socket de control.
pub async fn post_control(Json(body): Json<ControlPayload>) -> Json<Value> {
    let serial = body.serial.as_deref().map(safe_serial).unwrap_or_default();
    if serial.is_empty() {
        return Json(json!({ "success": false, "error": "Serial requerido" }));
    }
    let act_code: u8 = match &body.action {
        Some(Value::Number(n)) => n.as_u64().unwrap_or(0) as u8,
        Some(Value::String(s)) => match s.as_str() {
            "down" => 0,
            "up" => 1,
            "move" => 2,
            _ => 0,
        },
        _ => 0,
    };
    let x = body.x.unwrap_or(0.0).round() as i32;
    let y = body.y.unwrap_or(0.0).round() as i32;
    let ok = send_touch(&serial, act_code, x, y).await;
    Json(json!({ "success": ok }))
}
