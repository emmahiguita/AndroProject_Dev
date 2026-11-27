// ============================================================================
// ARCHIVO: server/actions_api.rs
// QUÉ HACE: Dispatcher nativo en Rust para `POST /api/actions` (proyección,
//           capturas PNG, teclado/gestos, ADB shell seguro, radar Wi-Fi y archivos).
// CÓMO FUNCIONA: Mapea cada `action` JSON a comandos ADB/scrcpy asíncronos con
//           `CREATE_NO_WINDOW`, lista negra de seguridad y gestión de PIDs.
// POR QUÉ: Eliminar Node.js y PowerShell del motor de acciones (< 200L, SRP).
// ============================================================================

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::{json, Value};
use std::process::Stdio;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use super::extra_actions::{handle_get_adb_status, handle_list_cameras, handle_optimizer_query};
use super::paths::{adb_bin, adb_shell, captures_dir, run_adb, safe_serial, silent_cmd};

fn is_dangerous_shell(cmd: &str) -> bool {
    let low = cmd.to_lowercase();
    // The generic shell endpoint must stay a single, bounded command. Shell
    // operators make deny-list checks easy to bypass by chaining commands.
    let shell_operators = [';', '|', '&', '`', '$', '\n', '\r'];
    let destructive = [
        "rm ", "mkfs", "dd ", "reboot", "shutdown", "poweroff", "format",
        "settings put", "pm uninstall", "pm disable", "pm clear",
    ];
    cmd.chars().any(|c| shell_operators.contains(&c))
        || cmd.contains("&&")
        || cmd.contains("||")
        || low.split_whitespace().any(|token| token == "su")
        || destructive.iter().any(|pat| low.contains(pat))
        || low.contains(" >")
        || low.contains(" <")
}

fn json_ok(val: Value) -> (StatusCode, Json<Value>) {
    (StatusCode::OK, Json(val))
}

/// `POST /api/actions` — Punto único de acciones sobre dispositivos Android/iOS.
pub async fn post_actions(Json(body): Json<Value>) -> impl IntoResponse {
    let action = body["action"].as_str().unwrap_or("").trim();
    let serial = safe_serial(body["serial"].as_str().unwrap_or(""));

    match action {
        "get_adb_status" => json_ok(handle_get_adb_status().await),
        "get_optimizer_settings" => json_ok(handle_optimizer_query(&serial).await),
        "get_perf_status" => json_ok(super::developer_actions::status(&serial).await),
        "apply_perf_profile" => json_ok(super::optimizer_actions::apply_perf_profile(&serial, body["profile"].as_str().unwrap_or("" )).await),
        "auto_activate_dev_mode" | "set_developer_mode" | "open_developer_settings" | "set_developer_option"
        | "set_animation_scale" | "set_gpu_renderer" | "set_bg_limit" | "set_cached_freezer"
        | "set_peak_refresh" | "set_dpi" | "set_demo_mode" => json_ok(super::developer_actions::apply(&serial, action, &body).await),
        "set_adguard_dns" | "set_private_dns" | "set_night_mode" | "set_auto_brightness" => json_ok(super::optimizer_actions::apply(&serial, action, &body).await),
        "optimize_ram" | "run_trim" => json_ok(super::optimizer_actions::run_maintenance(&serial, action).await),
        "check_screen" => json_ok(super::screen_process::check(&serial).await),
        "diagnose_screenshot" => json_ok(super::capture_diagnostics::diagnose(&serial).await),
        "list_cameras" => json_ok(handle_list_cameras(&serial).await),
        "open_screen" => json_ok(super::screen_process::start(&serial, &body).await),
        "stop_screen" => json_ok(super::screen_process::stop(&serial).await),
        "check_record" | "start_record" | "stop_record" => json_ok(super::recording::action(body["serial"].as_str().unwrap_or(""), action).await),
        "screenshot" => {
            let mut cmd = silent_cmd(adb_bin());
            cmd.kill_on_drop(true).args(["-s", &serial, "exec-out", "screencap", "-p"]).stdout(Stdio::piped()).stderr(Stdio::null());
            match tokio::time::timeout(Duration::from_secs(5), cmd.output()).await {
                Ok(Ok(out)) if out.status.success() && out.stdout.starts_with(b"\x89PNG\r\n\x1a\n") => {
                    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
                    let file = captures_dir().join(format!("screenshot_{}.png", ts));
                    // Comunicar error real si Windows no puede guardar la captura.
                    if let Err(e) = tokio::fs::write(&file, &out.stdout).await {
                        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": format!("No se pudo guardar la captura: {}", e) })));
                    }
                    json_ok(json!({ "success": true, "size": out.stdout.len(), "path": file.to_string_lossy(), "message": format!("Captura guardada en {}", file.to_string_lossy()) }))
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": "No se pudo capturar pantalla PNG" }))),
            }
        }
        "keyevent" => {
            let target = body["serial"].as_str().unwrap_or("");
            let key = body["keycode"].as_str().unwrap_or("");
            let code = match super::navigation::validate(target, key) {
                Ok(code) => code,
                Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({"success": false, "error": error}))),
            };
            match super::navigation::send(target, code).await {
                Ok(()) => json_ok(json!({"success": true})),
                Err(error) => json_ok(json!({"success": false, "error": error})),
            }
        }
        "input_text" => {
            let Some(text) = body["text"].as_str().filter(|v| !v.is_empty() && !v.chars().any(char::is_control)) else {
                return (StatusCode::BAD_REQUEST, Json(json!({"success":false,"error":"Texto vacío o no admitido"})));
            };
            if serial.is_empty() || body["serial"] != serial { return (StatusCode::BAD_REQUEST, Json(json!({"success":false,"error":"Serial inválido"}))); }
            // Android input interpreta %s como espacio. Las comillas protegen el argumento remoto.
            let txt = text.replace(' ', "%s").replace('\'', "'\\''");
            let (ok, _, err) = adb_shell(&serial, &format!("input text '{txt}'"), 4000).await;
            json_ok(json!({ "success": ok, "error": err }))
        }
        "tap" | "input_tap" => {
            if serial.is_empty() { return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial inválido" }))); }
            let x = body["x"].as_f64().unwrap_or(0.0).round() as i32;
            let y = body["y"].as_f64().unwrap_or(0.0).round() as i32;
            let (ok, _, err) = adb_shell(&serial, &format!("input tap {} {}", x.max(0), y.max(0)), 2500).await;
            json_ok(json!({ "success": ok, "error": err }))
        }
        "swipe" | "input_swipe" => {
            if serial.is_empty() { return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial inválido" }))); }
            let (x1, y1) = (body["x1"].as_f64().unwrap_or(0.0).round() as i32, body["y1"].as_f64().unwrap_or(0.0).round() as i32);
            let (x2, y2) = (body["x2"].as_f64().unwrap_or(0.0).round() as i32, body["y2"].as_f64().unwrap_or(0.0).round() as i32);
            let dur = body["duration"].as_u64().unwrap_or(250).clamp(50, 3000);
            let (ok, _, err) = adb_shell(&serial, &format!("input swipe {} {} {} {} {}", x1.max(0), y1.max(0), x2.max(0), y2.max(0), dur), 4000).await;
            json_ok(json!({ "success": ok, "error": err }))
        }
        "adb_shell" => {
            let cmd = body["cmd"].as_str().unwrap_or("").trim();
            if cmd.is_empty() {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Comando vacío" })));
            }
            if is_dangerous_shell(cmd) {
                return (StatusCode::FORBIDDEN, Json(json!({ "success": false, "error": format!("Comando bloqueado por seguridad: {}", cmd) })));
            }
            let (ok, out, err) = adb_shell(&serial, cmd, 12000).await;
            json_ok(json!({ "success": ok, "output": out, "error": err }))
        }
        "connect_adb" => {
            let target = safe_serial(body["target"].as_str().unwrap_or(""));
            let (ok, out, err) = run_adb(&["connect", &target], 5000).await;
            json_ok(json!({ "success": ok && !out.contains("unable to connect") && (out.starts_with("connected to ") || out.starts_with("already connected to ")), "message": out.trim(), "error": err }))
        }
        "start_adb_server" | "stop_adb_server" | "restart_adb" => json_ok(super::adb_service::control(action).await),
        "disconnect_device" => json_ok(super::adb_service::disconnect(body["serial"].as_str().unwrap_or(""), body["all"] == true).await),
        "scan_radar" => json_ok(super::adb_service::discover().await),
        "get_diagnostics" => json_ok(super::diagnostics::read(&serial).await),
        "get_foreground_app" => json_ok(super::diagnostics::foreground(&serial).await),
        "reboot" | "reboot_bootloader" | "reboot_recovery" => {
            let arg = match action { "reboot_bootloader" => "bootloader", "reboot_recovery" => "recovery", _ => "" };
            let (ok, _, err) = if arg.is_empty() { run_adb(&["-s", &serial, "reboot"], 5000).await } else { run_adb(&["-s", &serial, "reboot", arg], 5000).await };
            json_ok(json!({ "success": ok, "message": format!("Ejecutado {}", action), "error": err }))
        }
        "files_list" => {
            let dir = body["path"].as_str().unwrap_or("/sdcard/Download");
            let (ok, out, err) = adb_shell(&serial, &format!("ls -la '{}'", dir.replace('\'', "")), 5000).await;
            let files: Vec<Value> = out.lines().skip(1).filter_map(|l| {
                let p: Vec<&str> = l.split_whitespace().collect();
                if p.len() < 8 { return None; }
                let name = p[7..].join(" ");
                if name == "." || name == ".." || name.is_empty() { return None; }
                Some(json!({ "name": name, "isDir": p[0].starts_with('d'), "size": p[4].parse::<u64>().unwrap_or(0), "permissions": p[0] }))
            }).collect();
            json_ok(json!({ "success": ok, "path": dir, "files": files, "error": err }))
        }
        "open_captures" => {
            // Solo se informa éxito si Windows acepta iniciar el explorador.
            match silent_cmd("explorer.exe").arg(captures_dir()).spawn() {
                Ok(_) => json_ok(json!({ "success": true, "message": "Carpeta de capturas abierta" })),
                Err(e) => json_ok(json!({ "success": false, "error": e.to_string() })),
            }
        }
        "toggle_wifi_adb" => {
            let (ok, out, err) = run_adb(&["-s", &serial, "tcpip", "5555"], 4000).await;
            json_ok(json!({ "success": ok, "message": out.trim(), "error": err }))
        }
        _ => (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": format!("Acción no reconocida: {}", action) }))),
    }
}
