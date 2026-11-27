//! Consultas de solo lectura para los botones de Herramientas.
use super::paths::adb_shell;
use serde_json::{json, Value};

/// Recoge en una sesión los campos que consume ToolsView, conservando las unidades originales.
pub async fn read(serial: &str) -> Value {
    if serial.is_empty() { return json!({"success":false,"error":"Selecciona un dispositivo Android"}); }
    let script = concat!(
        "echo hardware=$(getprop ro.hardware); echo arch=$(getprop ro.product.cpu.abi); ",
        "echo cores=$(getconf _NPROCESSORS_ONLN); echo sdk=$(getprop ro.build.version.sdk); ",
        "echo kernel=$(uname -r); echo uptime=$(uptime -p); ",
        r#"awk '/^MemTotal:/{print "memtotal="$2,"kB"} /^MemAvailable:/{print "memavailable="$2,"kB"}' /proc/meminfo; "#,
        r#"df -k /data | awk 'END {print "size="$2,"KiB";print "used="$3,"KiB";print "free="$4,"KiB";print "usage="$5}'; "#,
        r#"dumpsys battery | awk '/^ *(level|temperature|voltage|technology):/ {sub(/:/,"=",$1);print $1$2}'; "#,
        "echo resolution=$(wm size | tail -n 1 | awk '{print $NF}'); echo dpi=$(wm density | tail -n 1 | awk '{print $NF}')"
    );
    let (ok, out, err) = adb_shell(serial, script, 6000).await;
    if !ok { return json!({"success":false,"error":err}); }
    let fields: std::collections::HashMap<_, _> = out.lines().filter_map(|l| l.trim().split_once('=')).collect();
    let val = |name: &str| fields.get(name).copied().filter(|v| !v.is_empty());
    if val("kernel").is_none() { return json!({"success":false,"error":"No se pudo leer el diagnóstico del sistema"}); }
    json!({"success":true, "diagnostics":{
        "cpu":{"hardware":val("hardware"),"cores":val("cores")}, "arch":val("arch"),
        "sdk":val("sdk"), "kernel":val("kernel"), "uptime":val("uptime"),
        "ram":{"memtotal":val("memtotal"),"memavailable":val("memavailable")},
        "storage":{"size":val("size"),"used":val("used"),"free":val("free"),"usage":val("usage")},
        "battery_level":val("level"),"battery_technology":val("technology"),"battery_temperature":val("temperature"),
        "battery_voltage":val("voltage"),"display_resolution":val("resolution"),"display_dpi":val("dpi")
    }})
}

/// La ventana con foco incluye un componente paquete/actividad en dumpsys window.
pub async fn foreground(serial: &str) -> Value {
    if serial.is_empty() { return json!({"success":false,"error":"Selecciona un dispositivo Android"}); }
    let (ok, out, err) = adb_shell(serial, "dumpsys window windows | grep -m 1 mCurrentFocus", 4000).await;
    if !ok { return json!({"success":false,"error":if err.is_empty() {"No hay ventana con foco"} else {err.trim()}}); }
    let pkg = out.split_whitespace().filter_map(|w| w.split_once('/')).map(|(pkg,_)| pkg)
        .find(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_'));
    match pkg { Some(pkg) => json!({"success":true,"package":pkg}), None => json!({"success":false,"error":"Android no informó la aplicación con foco"}) }
}
