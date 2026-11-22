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
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use super::paths::{adb_bin, adb_shell, captures_dir, run_adb, safe_serial, scrcpy_bin, silent_cmd};

static SCREEN_PIDS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
static RECORD_PIDS: OnceLock<Mutex<HashMap<String, (u32, String)>>> = OnceLock::new();

fn screen_pids() -> &'static Mutex<HashMap<String, u32>> {
    SCREEN_PIDS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn record_pids() -> &'static Mutex<HashMap<String, (u32, String)>> {
    RECORD_PIDS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_dangerous_shell(cmd: &str) -> bool {
    let low = cmd.to_lowercase();
    ["rm -rf /", "mkfs", "dd if=", ":(){", "reboot -p", "format /"]
        .iter()
        .any(|pat| low.contains(pat))
}

fn json_ok(val: Value) -> (StatusCode, Json<Value>) {
    (StatusCode::OK, Json(val))
}

/// `POST /api/actions` — Punto único de acciones sobre dispositivos Android/iOS.
pub async fn post_actions(Json(body): Json<Value>) -> impl IntoResponse {
    let action = body["action"].as_str().unwrap_or("").trim();
    let serial = safe_serial(body["serial"].as_str().unwrap_or(""));

    match action {
        "check_screen" => {
            let alive = screen_pids().lock().unwrap().contains_key(&serial);
            json_ok(json!({ "success": true, "alive": alive, "sessions": [] }))
        }
        "open_screen" => {
            if serial.is_empty() {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial requerido" })));
            }
            let fps = body["maxFps"].as_u64().unwrap_or(60).to_string();
            let size = body["maxSize"].as_u64().unwrap_or(960).to_string();
            let rate = body["bitRate"].as_str().unwrap_or("16M").to_string();
            let mut cmd = silent_cmd(scrcpy_bin());
            cmd.args(["-s", &serial, "--video-codec=h264", "-b", &rate, "--max-size", &size, &format!("--max-fps={}", fps), "--video-buffer=0", "--no-audio", "--stay-awake", "--render-driver=direct3d11"])
                .stdout(Stdio::null()).stderr(Stdio::null());
            match cmd.spawn() {
                Ok(child) => {
                    let pid = child.id().unwrap_or(0);
                    screen_pids().lock().unwrap().insert(serial.clone(), pid);
                    json_ok(json!({ "success": true, "alive": true, "pid": pid, "message": "VisionNano nativo activo a 60 FPS" }))
                }
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": e.to_string() }))),
            }
        }
        "stop_screen" => {
            let pid_opt = { screen_pids().lock().unwrap().remove(&serial) };
            if let Some(pid) = pid_opt {
                let _ = silent_cmd("taskkill").args(["/PID", &pid.to_string(), "/F", "/T"]).output().await;
            }
            json_ok(json!({ "success": true, "alive": false, "message": "Proyección detenida" }))
        }
        "check_record" => {
            let rec = record_pids().lock().unwrap().contains_key(&serial);
            json_ok(json!({ "success": true, "recording": rec }))
        }
        "start_record" => {
            if serial.is_empty() {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial requerido" })));
            }
            let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            let out_path = captures_dir().join(format!("record_{}.mp4", ts));
            let out_str = out_path.to_string_lossy().to_string();
            let mut cmd = silent_cmd(scrcpy_bin());
            cmd.args(["-s", &serial, "--no-playback", "--no-audio", "--video-bit-rate=16M", "--max-fps=60", "--record", &out_str])
                .stdout(Stdio::null()).stderr(Stdio::null());
            match cmd.spawn() {
                Ok(child) => {
                    let pid = child.id().unwrap_or(0);
                    record_pids().lock().unwrap().insert(serial, (pid, out_str.clone()));
                    json_ok(json!({ "success": true, "recording": true, "recordPath": out_str, "message": "Grabación MP4 iniciada" }))
                }
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": e.to_string() }))),
            }
        }
        "stop_record" => {
            let saved = record_pids().lock().unwrap().remove(&serial);
            if let Some((pid, path)) = saved {
                let _ = silent_cmd("taskkill").args(["/PID", &pid.to_string(), "/T"]).output().await;
                json_ok(json!({ "success": true, "recording": false, "recordPath": path, "message": format!("Grabación guardada en {}", path) }))
            } else {
                json_ok(json!({ "success": true, "recording": false, "message": "Sin grabación activa" }))
            }
        }
        "screenshot" => {
            let mut cmd = silent_cmd(adb_bin());
            cmd.args(["-s", &serial, "exec-out", "screencap", "-p"]).stdout(Stdio::piped()).stderr(Stdio::null());
            match tokio::time::timeout(Duration::from_secs(5), cmd.output()).await {
                Ok(Ok(out)) if out.stdout.len() > 200 => {
                    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
                    let file = captures_dir().join(format!("screenshot_{}.png", ts));
                    let _ = tokio::fs::write(&file, &out.stdout).await;
                    json_ok(json!({ "success": true, "path": file.to_string_lossy(), "message": format!("Captura guardada en {}", file.to_string_lossy()) }))
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "success": false, "error": "No se pudo capturar pantalla PNG" }))),
            }
        }
        "keyevent" => {
            let code = body["keycode"].as_str().unwrap_or("KEYCODE_HOME");
            let (ok, _, err) = adb_shell(&serial, &format!("input keyevent {}", code), 3000).await;
            json_ok(json!({ "success": ok, "error": err }))
        }
        "input_text" => {
            let txt = body["text"].as_str().unwrap_or("").replace(' ', "%s").replace('\'', "");
            let (ok, _, err) = adb_shell(&serial, &format!("input text '{}'", txt), 4000).await;
            json_ok(json!({ "success": ok, "error": err }))
        }
        "tap" => {
            let x = body["x"].as_f64().unwrap_or(0.0).round() as i32;
            let y = body["y"].as_f64().unwrap_or(0.0).round() as i32;
            let (ok, _, err) = adb_shell(&serial, &format!("input tap {} {}", x, y), 2500).await;
            json_ok(json!({ "success": ok, "error": err }))
        }
        "swipe" => {
            let (x1, y1) = (body["x1"].as_f64().unwrap_or(0.0) as i32, body["y1"].as_f64().unwrap_or(0.0) as i32);
            let (x2, y2) = (body["x2"].as_f64().unwrap_or(0.0) as i32, body["y2"].as_f64().unwrap_or(0.0) as i32);
            let dur = body["duration"].as_u64().unwrap_or(250);
            let (ok, _, err) = adb_shell(&serial, &format!("input swipe {} {} {} {} {}", x1, y1, x2, y2, dur), 3000).await;
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
            json_ok(json!({ "success": ok && out.contains("connected"), "message": out.trim(), "error": err }))
        }
        "restart_adb" => {
            let _ = run_adb(&["kill-server"], 3000).await;
            let (ok, out, err) = run_adb(&["start-server"], 5000).await;
            json_ok(json!({ "success": ok, "message": "Servidor ADB reiniciado", "output": out, "error": err }))
        }
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
                if p.len() < 7 { return None; }
                let name = p[7..].join(" ");
                if name == "." || name == ".." || name.is_empty() { return None; }
                Some(json!({ "name": name, "isDir": p[0].starts_with('d'), "size": p[4].parse::<u64>().unwrap_or(0), "permissions": p[0] }))
            }).collect();
            json_ok(json!({ "success": ok, "path": dir, "files": files, "error": err }))
        }
        "open_captures" => {
            let _ = silent_cmd("explorer.exe").arg(captures_dir()).spawn();
            json_ok(json!({ "success": true, "message": "Carpeta de capturas abierta" }))
        }
        "toggle_wifi_adb" => {
            let (ok, out, err) = run_adb(&["-s", &serial, "tcpip", "5555"], 4000).await;
            json_ok(json!({ "success": ok, "message": out.trim(), "error": err }))
        }
        _ => (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": format!("Acción no reconocida: {}", action) }))),
    }
}
