// ============================================================================
// ARCHIVO: server/scrcpy_hub.rs
// QUÉ HACE: Hub nativo en Rust/Tokio que administra sesiones H.264 60 FPS de
//           scrcpy-server v4.1 por serial e inyección táctil binaria < 1ms.
// CÓMO FUNCIONA: Empuja scrcpy-server, abre túnel ADB TCP, lee cabecera 64+12B
//           y retransmite paquetes [8B pts + 4B size + H.264] vía broadcast.
// POR QUÉ: Reemplazar scrcpy-session-hub.ts de Node.js por 100% Rust (< 200L).
// ============================================================================

use std::collections::HashMap;
use std::sync::Weak;
use std::sync::atomic::Ordering;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{broadcast, Mutex};

use super::paths::run_adb;

pub struct ScrcpySession {
    pub width: u32,
    pub height: u32,
    pub tx: broadcast::Sender<Arc<Vec<u8>>>,
    pub config_pkt: Mutex<Option<Arc<Vec<u8>>>>,
    pub key_pkt: Mutex<Option<Arc<Vec<u8>>>>,
    pub ctrl_sock: Mutex<Option<TcpStream>>,
    stop: tokio::sync::watch::Sender<bool>,
    pub alive: std::sync::atomic::AtomicBool,
}

static HUB: OnceLock<Mutex<HashMap<String, Arc<ScrcpySession>>>> = OnceLock::new();

fn hub() -> &'static Mutex<HashMap<String, Arc<ScrcpySession>>> {
    HUB.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Obtiene una sesión H.264 activa para `serial` o inicia una nueva en Rust.
pub async fn get_or_start_session(serial: &str) -> Result<Arc<ScrcpySession>, String> {
    // Una petición cancelada no interrumpe el registro y la limpieza del túnel.
    let serial = serial.to_owned();
    tokio::spawn(async move { start_session(&serial).await }).await.map_err(|error| error.to_string())?
}

async fn start_session(serial: &str) -> Result<Arc<ScrcpySession>, String> {
    // Serializa únicamente los arranques del mismo móvil.
    type Gates = HashMap<String, Weak<Mutex<()>>>;
    static GATES: OnceLock<Mutex<Gates>> = OnceLock::new();
    let gate = {
        let mut gates = GATES.get_or_init(|| Mutex::new(HashMap::new())).lock().await;
        gates.retain(|_, gate| gate.strong_count() > 0);
        let gate = gates.get(serial).and_then(Weak::upgrade).unwrap_or_default();
        gates.insert(serial.to_owned(), Arc::downgrade(&gate));
        gate
    };
    let _guard = gate.lock().await;
    {
        let map = hub().lock().await;
        if let Some(s) = map.get(serial) {
            if s.alive.load(Ordering::Relaxed) {
                return Ok(s.clone());
            }
        }
    }

    let link = super::scrcpy_transport::open(serial).await?;
    let super::scrcpy_transport::Transport { mut video, ctrl, mut child, width, height, port } = link;
    let (tx, _) = broadcast::channel::<Arc<Vec<u8>>>(64);
    let (stop, mut stopping) = tokio::sync::watch::channel(false);
    let session = Arc::new(ScrcpySession {
        stop, width,
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
            // Mantiene una breve pausa para reconexión incluso con una pantalla inmóvil.
        tokio::select! {
            _ = stopping.changed() => {},
            _ = read_frames(&mut video, &sess_bg) => {},
            _ = async {
                loop {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    if sess_bg.tx.receiver_count() == 0 { break; }
                }
            } => {},
        }
        sess_bg.alive.store(false, Ordering::Relaxed);
        let _ = child.kill().await;
        let _ = run_adb(&["-s", &serial_owned, "forward", "--remove", &format!("tcp:{}", port)], 1500).await;
        let mut map = hub().lock().await;
        if map.get(&serial_owned).is_some_and(|current| Arc::ptr_eq(current, &sess_bg)) { map.remove(&serial_owned); }
    });

    Ok(session)
}

/// Extrae paquetes completos para que una lectura parcial nunca desplace la cabecera siguiente.
async fn read_frames(video: &mut TcpStream, session: &ScrcpySession) {
    let mut frame_hdr = [0u8; 12];
        loop {
            if video.read_exact(&mut frame_hdr).await.is_err() {
                break;
            }
            let pts_flags = u64::from_be_bytes(frame_hdr[0..8].try_into().unwrap());
            let size = u32::from_be_bytes(frame_hdr[8..12].try_into().unwrap()) as usize;
            if size == 0 || size > 16 * 1024 * 1024 {
                break;
            }
            let mut packet = vec![0u8; 12 + size];
            packet[0..12].copy_from_slice(&frame_hdr);
            if video.read_exact(&mut packet[12..]).await.is_err() {
                break;
            }
            let arc_pkt = Arc::new(packet);
            let nal_type = if arc_pkt.len() >= 17 { arc_pkt[16] & 0x1f } else { 0 };
            let is_config = (pts_flags & (1u64 << 63)) != 0 || nal_type == 7;
            let is_key = (pts_flags & (1u64 << 62)) != 0 || nal_type == 5;
            if is_config {
                *session.config_pkt.lock().await = Some(arc_pkt.clone());
            } else if is_key {
                *session.key_pkt.lock().await = Some(arc_pkt.clone());
            }
            let _ = session.tx.send(arc_pkt);
        }
}

/// Inyecta evento táctil binario (32 bytes) directo al socket de control scrcpy.
/// Si `normalized` es `true`, interpreta `(x, y)` como coordenadas `[0.0..1.0]` del stream.
pub async fn send_touch(serial: &str, action: u8, x: f64, y: f64, normalized: bool) -> bool {
    let sess = { hub().lock().await.get(serial).cloned() };
    let Some(s) = sess else { return false };
    let mut guard = s.ctrl_sock.lock().await;
    let Some(ref mut sock) = *guard else { return false };

    let px = if normalized { (x.clamp(0.0, 1.0) * s.width as f64).round() as i32 } else { x.round() as i32 };
    let py = if normalized { (y.clamp(0.0, 1.0) * s.height as f64).round() as i32 } else { y.round() as i32 };

    let mut pkt = [0u8; 32];
    pkt[0] = 2; // TYPE_INJECT_TOUCH_EVENT
    pkt[1] = action;
    pkt[2..10].copy_from_slice(&(-1i64).to_be_bytes());
    pkt[10..14].copy_from_slice(&px.clamp(0, s.width as i32).to_be_bytes());
    pkt[14..18].copy_from_slice(&py.clamp(0, s.height as i32).to_be_bytes());
    pkt[18..20].copy_from_slice(&(s.width as u16).to_be_bytes());
    pkt[20..22].copy_from_slice(&(s.height as u16).to_be_bytes());
    let pressure: u16 = if action == 1 { 0 } else { 0xFFFF };
    pkt[22..24].copy_from_slice(&pressure.to_be_bytes());
    pkt[24..28].copy_from_slice(&1u32.to_be_bytes());
    let btns: u32 = if action == 1 { 0 } else { 1 };
    pkt[28..32].copy_from_slice(&btns.to_be_bytes());
    sock.write_all(&pkt).await.is_ok()
}

/// Pide el cierre de los lectores y espera a que ADB retire sus reenvíos.
pub async fn shutdown() {
    for session in hub().lock().await.values() { let _ = session.stop.send(true); }
    let _ = tokio::time::timeout(Duration::from_secs(3), async {
        while !hub().lock().await.is_empty() { tokio::time::sleep(Duration::from_millis(50)).await; }
    }).await;
}
