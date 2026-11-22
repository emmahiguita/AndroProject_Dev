// ============================================================================
// ARCHIVO: server/scrcpy_hub.rs
// QUÉ HACE: Hub nativo en Rust/Tokio que administra sesiones H.264 60 FPS de
//           scrcpy-server v4.1 por serial e inyección táctil binaria < 1ms.
// CÓMO FUNCIONA: Empuja scrcpy-server, abre túnel ADB TCP, lee cabecera 64+12B
//           y retransmite paquetes [8B pts + 4B size + H.264] vía broadcast.
// POR QUÉ: Reemplazar scrcpy-session-hub.ts de Node.js por 100% Rust (< 200L).
// ============================================================================

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{broadcast, Mutex};

use super::paths::{adb_bin, run_adb, scrcpy_server_path, silent_cmd};

const REMOTE_JAR: &str = "/data/local/tmp/scrcpy-web.jar";
static NEXT_PORT: AtomicU16 = AtomicU16::new(27310);

pub struct ScrcpySession {
    pub width: u32,
    pub height: u32,
    pub tx: broadcast::Sender<Arc<Vec<u8>>>,
    pub config_pkt: Mutex<Option<Arc<Vec<u8>>>>,
    pub key_pkt: Mutex<Option<Arc<Vec<u8>>>>,
    pub ctrl_sock: Mutex<Option<TcpStream>>,
    pub alive: std::sync::atomic::AtomicBool,
}

static HUB: OnceLock<Mutex<HashMap<String, Arc<ScrcpySession>>>> = OnceLock::new();

fn hub() -> &'static Mutex<HashMap<String, Arc<ScrcpySession>>> {
    HUB.get_or_init(|| Mutex::new(HashMap::new()))
}

fn alloc_port() -> u16 {
    let p = NEXT_PORT.fetch_add(1, Ordering::Relaxed);
    if p > 27900 {
        NEXT_PORT.store(27310, Ordering::Relaxed);
    }
    p
}

/// Obtiene una sesión H.264 activa para `serial` o inicia una nueva en Rust.
pub async fn get_or_start_session(serial: &str) -> Result<Arc<ScrcpySession>, String> {
    {
        let map = hub().lock().await;
        if let Some(s) = map.get(serial) {
            if s.alive.load(Ordering::Relaxed) {
                return Ok(s.clone());
            }
        }
    }

    let port = alloc_port();
    let scid = format!("{:08x}", (port as u32 * 2654435761) & 0x7fffffff);
    let srv_jar = scrcpy_server_path();
    if srv_jar.exists() {
        let jar_str = srv_jar.to_string_lossy().to_string();
        let _ = run_adb(&["-s", serial, "push", &jar_str, REMOTE_JAR], 5000).await;
    }
    let tcp_arg = format!("tcp:{}", port);
    let abs_arg = format!("localabstract:scrcpy_{}", scid);
    let (ok_fwd, _, err_fwd) = run_adb(&["-s", serial, "forward", &tcp_arg, &abs_arg], 3500).await;
    if !ok_fwd {
        return Err(format!("ADB forward falló: {}", err_fwd));
    }

    let mut srv_cmd = silent_cmd(adb_bin());
    srv_cmd
        .args([
            "-s", serial, "shell", &format!("CLASSPATH={}", REMOTE_JAR),
            "app_process", "/", "com.genymobile.scrcpy.Server", "4.1",
            &format!("scid={}", scid), "log_level=info", "tunnel_forward=true",
            "audio=false", "control=true", "cleanup=false", "max_size=1080",
            "max_fps=60", "video_bit_rate=6000000", "stay_awake=true",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let mut srv_child = srv_cmd.spawn().map_err(|e| format!("Error iniciando scrcpy-server: {}", e))?;

    // Conectar socket de video con reintentos hasta recibir byte dummy
    let mut v_sock = None;
    for _ in 0..35 {
        tokio::time::sleep(Duration::from_millis(120)).await;
        if let Ok(mut s) = TcpStream::connect(("127.0.0.1", port)).await {
            let _ = s.set_nodelay(true);
            let mut dummy = [0u8; 1];
            if tokio::time::timeout(Duration::from_millis(450), s.read_exact(&mut dummy)).await.is_ok() {
                v_sock = Some(s);
                break;
            }
        }
    }
    let mut v_sock = match v_sock {
        Some(s) => s,
        None => {
            let _ = srv_child.kill().await;
            return Err("Timeout conectando al socket de video scrcpy".to_string());
        }
    };

    // Conectar socket de control (segundo cliente sobre el mismo túnel)
    let ctrl = TcpStream::connect(("127.0.0.1", port)).await.ok();
    if let Some(ref c) = ctrl {
        let _ = c.set_nodelay(true);
    }

    // Leer cabecera de scrcpy v4: 64B nombre + 4B codec + 4B width + 4B height
    let mut hdr = [0u8; 76];
    if v_sock.read_exact(&mut hdr).await.is_err() {
        let _ = srv_child.kill().await;
        return Err("Cabecera de video scrcpy incompleta".to_string());
    }
    let width = u32::from_be_bytes([hdr[68], hdr[69], hdr[70], hdr[71]]).max(1);
    let height = u32::from_be_bytes([hdr[72], hdr[73], hdr[74], hdr[75]]).max(1);

    let (tx, _) = broadcast::channel::<Arc<Vec<u8>>>(64);
    let session = Arc::new(ScrcpySession {
        width,
        height,
        tx,
        config_pkt: Mutex::new(None),
        key_pkt: Mutex::new(None),
        ctrl_sock: Mutex::new(ctrl),
        alive: std::sync::atomic::AtomicBool::new(true),
    });

    hub().lock().await.insert(serial.to_string(), session.clone());

    let serial_owned = serial.to_string();
    let sess_bg = session.clone();
    tokio::spawn(async move {
        let mut frame_hdr = [0u8; 12];
        loop {
            if v_sock.read_exact(&mut frame_hdr).await.is_err() {
                break;
            }
            let pts_flags = u64::from_be_bytes(frame_hdr[0..8].try_into().unwrap());
            let size = u32::from_be_bytes(frame_hdr[8..12].try_into().unwrap()) as usize;
            if size == 0 || size > 16 * 1024 * 1024 {
                break;
            }
            let mut packet = vec![0u8; 12 + size];
            packet[0..12].copy_from_slice(&frame_hdr);
            if v_sock.read_exact(&mut packet[12..]).await.is_err() {
                break;
            }
            let arc_pkt = Arc::new(packet);
            let is_config = (pts_flags & (1u64 << 63)) != 0;
            let is_key = (pts_flags & (1u64 << 62)) != 0;
            if is_config {
                *sess_bg.config_pkt.lock().await = Some(arc_pkt.clone());
            } else if is_key {
                *sess_bg.key_pkt.lock().await = Some(arc_pkt.clone());
            }
            let _ = sess_bg.tx.send(arc_pkt);
        }
        sess_bg.alive.store(false, Ordering::Relaxed);
        let _ = srv_child.kill().await;
        let _ = run_adb(&["-s", &serial_owned, "forward", "--remove", &format!("tcp:{}", port)], 1500).await;
        hub().lock().await.remove(&serial_owned);
    });

    Ok(session)
}

/// Inyecta evento táctil binario (32 bytes) directo al socket de control scrcpy.
pub async fn send_touch(serial: &str, action: u8, x: i32, y: i32) -> bool {
    let sess = { hub().lock().await.get(serial).cloned() };
    let Some(s) = sess else { return false };
    let mut guard = s.ctrl_sock.lock().await;
    let Some(ref mut sock) = *guard else { return false };

    let mut pkt = [0u8; 32];
    pkt[0] = 2; // TYPE_INJECT_TOUCH_EVENT
    pkt[1] = action;
    pkt[2..10].copy_from_slice(&(-1i64).to_be_bytes());
    pkt[10..14].copy_from_slice(&x.max(0).to_be_bytes());
    pkt[14..18].copy_from_slice(&y.max(0).to_be_bytes());
    pkt[18..20].copy_from_slice(&(s.width as u16).to_be_bytes());
    pkt[20..22].copy_from_slice(&(s.height as u16).to_be_bytes());
    let pressure: u16 = if action == 1 { 0 } else { 0xFFFF };
    pkt[22..24].copy_from_slice(&pressure.to_be_bytes());
    pkt[24..28].copy_from_slice(&1u32.to_be_bytes());
    let btns: u32 = if action == 1 { 0 } else { 1 };
    pkt[28..32].copy_from_slice(&btns.to_be_bytes());
    sock.write_all(&pkt).await.is_ok()
}
