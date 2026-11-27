//! Rutas del sistema para controladores, AirPlay, logcat, seguridad y fastboot.

use axum::{extract::{Multipart, Query}, http::StatusCode, response::{sse::{Event, KeepAlive, Sse}, IntoResponse}, Json};
use futures_util::stream::Stream;
use serde_json::{json, Value};
use std::convert::Infallible;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio_stream::wrappers::ReceiverStream;

use super::device_api::SerialQuery;
use super::paths::{adb_bin, adb_shell, fastboot_bin, run_adb, safe_serial, silent_cmd};

/// `GET /api/drivers` — Lista estado de controladores USB móviles en Windows.
pub async fn get_drivers() -> Json<Value> {
    Json(super::driver_scan::scan().await)
}

/// `GET /api/airplay` — Estado del receptor AirPlay 2.
pub async fn get_airplay() -> Json<Value> {
    Json(super::airplay_process::status().await)
}

/// `POST /api/airplay` — Control básico del receptor AirPlay 2.
pub async fn post_airplay(Json(body): Json<Value>) -> Json<Value> {
    let action = body["action"].as_str().unwrap_or("status");
    Json(if action == "status" { super::airplay_process::status().await } else { super::airplay_process::action(action).await })
}

/// `GET /api/ios` — Estado de dispositivos iOS USB y AirPlay.
pub async fn get_ios() -> Json<Value> {
    let (usb, receiver) = tokio::join!(super::driver_scan::ios_usb(), super::airplay_process::status());
    Json(json!({
        "success":usb.is_ok(), "error":usb.as_ref().err(), "usbDevices":usb.as_ref().ok(),
        "wda":{"ready":false}, "airplay":receiver.get("status")
    }))
}

/// `GET /api/logcat?serial=...` — Stream SSE real de `adb logcat -v time`.
pub async fn get_logcat(Query(q): Query<SerialQuery>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let raw_serial = q.serial.unwrap_or_default();
    let serial = safe_serial(&raw_serial);
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(128);

    tokio::spawn(async move {
        if serial.is_empty() || serial != raw_serial {
            let _ = tx.send(Ok(Event::default().data(json!({"error": "Serial Android inválido"}).to_string()))).await;
            return;
        }
        let mut cmd = silent_cmd(adb_bin());
        cmd.args(["-s", &serial]);
        cmd.kill_on_drop(true).args(["logcat", "-v", "time", "-T", "80"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        if let Ok(mut child) = cmd.spawn() {
            if let Some(stdout) = child.stdout.take() {
                let mut lines = BufReader::new(stdout).lines();
                loop {
                    // Si la ventana se cierra, termina ADB aunque logcat no emita nuevas líneas.
                    tokio::select! {
                        _ = tx.closed() => break,
                        line = lines.next_line() => match line {
                            Ok(Some(line)) => {
                                let payload = json!({ "line": line }).to_string();
                                if tx.send(Ok(Event::default().data(payload))).await.is_err() { break; }
                            }
                            _ => break,
                        }
                    }
                }
            }
            let _ = child.kill().await;
        }
    });

    Sse::new(ReceiverStream::new(rx)).keep_alive(KeepAlive::default())
}

/// `GET /api/security-scan?serial=...` — Auditoría heurística real de virus, spyware y adware.
pub async fn get_security_scan(Query(q): Query<SerialQuery>) -> Json<Value> {
    let serial = q.serial.as_deref().map(safe_serial).unwrap_or_default();
    if serial.is_empty() {
        return Json(json!({ "success": false, "error": "Serial requerido", "findings": [], "scannedCount": 0 }));
    }
    Json(super::security_scan::scan(&serial).await)
}

/// `POST /api/flash` — Operaciones Fastboot/ADB vía `multipart/form-data`.
pub async fn post_flash(mut multipart: Multipart) -> impl IntoResponse {
    let (mut action, mut serial, mut slot) = ("check_state".to_string(), String::new(), String::new());
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "action" { if let Ok(v) = field.text().await { action = v; } }
        else if name == "serial" { if let Ok(v) = field.text().await { serial = v.trim().to_string(); } }
        else if name == "slot" { if let Ok(v) = field.text().await { slot = v; } }
    }
    // Fastboot nunca debe elegir automáticamente otro dispositivo conectado.
    if serial.is_empty() || safe_serial(&serial) != serial {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Selecciona un serial válido para el dispositivo" })));
    }
    if action == "check_state" || action == "devices" {
        // Sideload no responde a getprop, por eso se consulta primero el estado ADB.
        let (state_ok, adb_state, _) = run_adb(&["-s", &serial, "get-state"], 3000).await;
        if state_ok && matches!(adb_state.trim(), "sideload" | "recovery") {
            return (StatusCode::OK, Json(json!({ "success": true, "state": adb_state.trim(), "deviceInfo": { "serialno": serial } })));
        }
        let (ok, prod, _) = adb_shell(&serial, "getprop ro.product.model", 3000).await;
        if ok && !prod.trim().is_empty() {
            let (_, ver, _) = adb_shell(&serial, "getprop ro.build.version.release", 2500).await;
            let (_, lock, _) = adb_shell(&serial, "getprop ro.boot.flash.locked", 2500).await;
            return (StatusCode::OK, Json(json!({
                "success": true, "state": "adb",
                "deviceInfo": {
                    "product": prod.trim(), "serialno": serial,
                    "androidVersion": ver.trim(), "unlocked": match lock.trim() { "0" => "yes", "1" => "no", _ => "unknown" },
                }
            })));
        }
        let mut cmd = silent_cmd(fastboot_bin());
        cmd.kill_on_drop(true).arg("devices").stdout(Stdio::piped()).stderr(Stdio::piped());
        let out = tokio::time::timeout(Duration::from_secs(3), cmd.output()).await.ok().and_then(|r| r.ok());
        let txt = out.map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
        let found = txt.lines().any(|line| line.split_whitespace().next() == Some(serial.as_str()));
        let info = if found { super::flasher_actions::info(&serial).await } else { Value::Null };
        return (StatusCode::OK, Json(json!({
            "success": found,
            "state": if found { "fastboot" } else { "disconnected" },
            "output": txt.trim(),
            "deviceInfo": info,
        })));
    }
    (StatusCode::OK, Json(super::flasher_actions::run(&serial, &action, &slot).await))
}
