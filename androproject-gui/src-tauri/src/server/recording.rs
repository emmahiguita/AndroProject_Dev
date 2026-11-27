//! Conserva el proceso que escribe cada MP4 y espera a que cierre el contenedor.
use super::paths::{captures_dir, scrcpy_bin, silent_cmd, safe_serial};
use serde_json::{json, Value};
use std::{collections::HashMap, io::{Read, Seek, SeekFrom}, path::{Path, PathBuf}, process::Stdio,
    sync::{OnceLock, atomic::{AtomicU64, Ordering}}, time::{Duration, SystemTime, UNIX_EPOCH}};
use tokio::{process::Child, sync::Mutex};

struct Recording { child: Child, path: PathBuf, started: u64 }
static RECORDS: OnceLock<Mutex<HashMap<String, Recording>>> = OnceLock::new();
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// MP4 contiene cajas con longitud declarada. Comprueba índice y contenido sin cargar el vídeo.
fn finalized(path: &Path) -> bool {
    let Ok(mut file) = std::fs::File::open(path) else { return false; };
    let Ok(metadata) = file.metadata() else { return false; };
    let mut offset = 0u64;
    let (mut media, mut index) = (false, false);
    while metadata.len().saturating_sub(offset) >= 8 {
        let mut header = [0u8; 8];
        if file.read_exact(&mut header).is_err() { return false; }
        let mut size = u32::from_be_bytes(header[..4].try_into().unwrap()) as u64;
        let mut header_len = 8;
        if size == 1 {
            let mut extended = [0; 8];
            if file.read_exact(&mut extended).is_err() { return false; }
            size = u64::from_be_bytes(extended); header_len = 16;
        } else if size == 0 { size = metadata.len() - offset; }
        if size < header_len || size > metadata.len() - offset { return false; }
        media |= &header[4..] == b"mdat" && size > header_len;
        index |= &header[4..] == b"moov" && size > header_len;
        offset += size;
        if file.seek(SeekFrom::Start(offset)).is_err() { return false; }
    }
    offset == metadata.len() && media && index
}

fn finished(record: &Recording, ok: bool) -> Value {
    if ok && finalized(&record.path) {
        json!({"success":true,"recording":false,"recordPath":record.path,"message":"Grabación MP4 guardada"})
    } else { json!({"success":false,"recording":false,"error":"scrcpy terminó sin confirmar un MP4 completo"}) }
}

/// Solicita el cierre normal de las ventanas que pertenecen al hijo. scrcpy puede escribir el índice MP4.
#[cfg(windows)]
fn request_close(pid: u32) {
    #[link(name="user32")]
    extern "system" {
        fn EnumWindows(callback: extern "system" fn(isize,isize)->i32, data:isize)->i32;
        fn GetWindowThreadProcessId(window:isize, pid:*mut u32)->u32;
        fn PostMessageW(window:isize, msg:u32, w:usize, l:isize)->i32;
    }
    extern "system" fn close_ours(window:isize, target:isize)->i32 {
        let mut owner = 0u32;
        // Windows llena owner antes de comparar y el callback no retiene referencias.
        unsafe {
            GetWindowThreadProcessId(window, &mut owner);
            if owner == target as u32 { PostMessageW(window, 0x0010, 0, 0); }
        }
        1
    }
    unsafe { EnumWindows(close_ours, pid as isize); }
}

async fn stop(record: &mut Recording) -> Value {
    for _ in 0..8 {
        match record.child.try_wait() {
            Ok(Some(status)) => return finished(record, status.success()),
            Err(error) => return json!({"success":false,"error":error.to_string()}),
            Ok(None) => {}
        }
        #[cfg(windows)]
        if let Some(pid) = record.child.id() { request_close(pid); }
        if let Ok(Ok(status)) = tokio::time::timeout(Duration::from_millis(500), record.child.wait()).await {
            return finished(record, status.success());
        }
    }
    json!({"success":false,"recording":true,"error":"La grabadora sigue abierta. Cierra su ventana para finalizar el MP4."})
}

/// Conserva un único hijo por dispositivo, incluso ante doble clic o peticiones simultáneas.
pub async fn action(serial:&str, action:&str) -> Value {
    if serial.is_empty() || serial != safe_serial(serial) { return json!({"success":false,"error":"Serial Android inválido"}); }
    let mut map = RECORDS.get_or_init(|| Mutex::new(HashMap::new())).lock().await;
    if let Some(record) = map.get_mut(serial) {
        if action == "stop_record" { return stop(record).await; }
        match record.child.try_wait() {
            Ok(None) => return json!({"success":true,"recording":true,"startedAt":record.started,"message":"Grabadora activa"}),
            Ok(Some(status)) if action == "check_record" => return finished(record,status.success()),
            Err(error) => return json!({"success":false,"error":error.to_string()}),
            _ => {}
        }
    }
    if action != "start_record" { return json!({"success":true,"recording":false}); }
    let started = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    let seq = SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let path = captures_dir().join(format!("record_{started}_{seq}.mp4"));
    let mut cmd = silent_cmd(scrcpy_bin());
    cmd.kill_on_drop(true).args(["-s", serial, "--no-control", "--no-audio", "--video-bit-rate=16M",
        "--max-fps=60", "--window-width=320", "--window-height=240", "--window-title", "Grabación ANDRO-IOS", "--record"])
        .arg(&path).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    match cmd.spawn() {
        Ok(child) => {
            map.insert(serial.into(), Recording { child, path, started });
            json!({"success":true,"recording":true,"startedAt":started,"message":"Grabadora iniciada con vista previa"})
        }
        Err(error) => json!({"success":false,"error":error.to_string()}),
    }
}

/// Al cerrar el estudio, da a las grabaciones activas la oportunidad de finalizar.
pub async fn shutdown() {
    if let Some(records) = RECORDS.get() {
        let records = std::mem::take(&mut *records.lock().await);
        futures_util::future::join_all(records.into_values().map(|mut record| async move {
            let _ = stop(&mut record).await;
        })).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Un archivo con datos de vídeo todavía puede carecer del índice final.
    #[test]
    fn only_reports_indexed_mp4() {
        let path = std::env::temp_dir().join(format!("andro-record-test-{}.mp4", std::process::id()));
        let media = [0, 0, 0, 9, b'm', b'd', b'a', b't', 1];
        std::fs::write(&path, media).unwrap();
        assert!(!finalized(&path));
        let index = [0, 0, 0, 9, b'm', b'o', b'o', b'v', 1];
        std::fs::write(&path, [media, index].concat()).unwrap();
        assert!(finalized(&path));
        std::fs::remove_file(path).unwrap();
    }
}
