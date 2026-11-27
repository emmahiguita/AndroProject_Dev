//! Inicia el transporte de vídeo y control con un puerto asignado por ADB.
use std::{process::Stdio, time::Duration, sync::atomic::{AtomicU32, Ordering}};
use tokio::{io::AsyncReadExt, net::TcpStream, process::Child};
use super::paths::{adb_bin, run_adb, scrcpy_server_path, silent_cmd};

const REMOTE_JAR: &str = "/data/local/tmp/scrcpy-web.jar";
static NEXT_SESSION: AtomicU32 = AtomicU32::new(1);

pub struct Transport {
    pub video: TcpStream, pub ctrl: Option<TcpStream>, pub child: Child,
    pub width: u32, pub height: u32, pub port: u16,
}

/// Reserva un puerto libre sin reemplazar túneles de otra aplicación.
pub async fn open(serial: &str) -> Result<Transport, String> {
    let scid = format!("{:08x}", NEXT_SESSION.fetch_add(1, Ordering::Relaxed) & 0x7fff_ffff);
    let jar = scrcpy_server_path();
    if !jar.is_file() { return Err("Falta el servidor scrcpy en la instalación".into()); }
    let (ok, _, err) = run_adb(&["-s", serial, "push", &jar.to_string_lossy(), REMOTE_JAR], 5000).await;
    if !ok { return Err(format!("No se pudo transferir scrcpy: {err}")); }
    let (ok, out, err) = run_adb(&["-s", serial, "forward", "tcp:0", &format!("localabstract:scrcpy_{scid}")], 3500).await;
    if !ok { return Err(format!("No se pudo abrir el túnel ADB: {err}")); }
    let port = out.trim().parse::<u16>().map_err(|_| "ADB no devolvió el puerto reservado")?;
    let result = connect(serial, &scid, port).await;
    if result.is_err() { let _ = run_adb(&["-s", serial, "forward", "--remove", &format!("tcp:{port}")],1500).await; }
    result
}

/// Si falla la cabecera, se termina el proceso propietario y open libera el túnel.
async fn connect(serial: &str, scid: &str, port: u16) -> Result<Transport, String> {
    let mut srv_cmd = silent_cmd(adb_bin());
    srv_cmd.kill_on_drop(true)
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
            if matches!(
                tokio::time::timeout(Duration::from_millis(450), s.read_exact(&mut dummy)).await,
                Ok(Ok(_))
            ) {
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
    let ctrl = tokio::time::timeout(Duration::from_secs(2), TcpStream::connect(("127.0.0.1", port))).await.ok().and_then(Result::ok);
    if let Some(ref c) = ctrl {
        let _ = c.set_nodelay(true);
    }

    // Leer cabecera de scrcpy v4.1: 64B nombre + 4B codec + 4B flags + 4B width + 4B height (80B)
    let mut hdr = [0u8; 80];
    if !matches!(tokio::time::timeout(Duration::from_secs(4), v_sock.read_exact(&mut hdr)).await, Ok(Ok(_))) {
        let _ = srv_child.kill().await;
        return Err("Cabecera de video scrcpy incompleta".to_string());
    }
    let width = u32::from_be_bytes([hdr[72], hdr[73], hdr[74], hdr[75]]).max(1);
    let height = u32::from_be_bytes([hdr[76], hdr[77], hdr[78], hdr[79]]).max(1);

    Ok(Transport { video:v_sock, ctrl, child:srv_child, width, height, port })
}
