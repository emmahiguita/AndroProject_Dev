// ============================================================================
// ARCHIVO: server/telemetry.rs
// QUÉ HACE: Recolecta y parsea la telemetría real del kernel Android (modelo,
//           Android OS, resolución, CPU, RAM, Disco, Batería, Temperatura y
//           estado de bootloader/vbmeta) en un solo round-trip `adb shell`.
// CÓMO FUNCIONA: Ejecuta un comando compuesto sobre ADB y extrae métricas
//           deterministas devolviendo el JSON esperado por el Dashboard.
// POR QUÉ: Mantener `device_api.rs` y `telemetry.rs` estrictamente < 200L (SRP).
// ============================================================================

use serde_json::{json, Value};
use super::paths::adb_shell;

/// Recolecta telemetría real del kernel Android en una sola llamada `adb shell`.
pub async fn fetch_telemetry(serial: &str, base_model: &str, conn: &str) -> Value {
    let script = concat!(
        "echo MODEL=$(getprop ro.product.model);",
        "echo MARKET=$(getprop ro.vendor.oplus.market.name || getprop ro.product.marketname || getprop ro.product.brand);",
        "echo VER=$(getprop ro.build.version.release);",
        "echo RES=$(wm size 2>/dev/null | tail -n 1 | awk '{print $NF}');",
        "echo MEM=$(awk '/MemTotal|MemAvailable/{print $1,$2}' /proc/meminfo 2>/dev/null | tr '\\n' ' ');",
        "echo DF=$(df -k /data 2>/dev/null | tail -n 1 | awk '{print $2,$3,$4,$5}');",
        "echo LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1,$4}');",
        "echo UP=$(awk '{print int($1/3600)}' /proc/uptime 2>/dev/null);",
        "echo BAT=$(dumpsys battery 2>/dev/null | awk '/level:|temperature:|status:|voltage:/{print $1,$2}' | tr '\\n' ' ');",
        "echo VBOOT=$(getprop ro.boot.verifiedbootstate);echo FLASH=$(getprop ro.boot.flash.locked)"
    );
    let (_, out, _) = adb_shell(serial, script, 4500).await;
    let get_val = |prefix: &str| -> String {
        out.lines()
            .find_map(|l| l.trim().strip_prefix(prefix))
            .unwrap_or("")
            .trim()
            .to_string()
    };

    let model_raw = get_val("MODEL=");
    let market = get_val("MARKET=");
    let model = if !market.is_empty() && !model_raw.is_empty() && market != model_raw {
        format!("{} ({})", market, model_raw)
    } else if !model_raw.is_empty() {
        model_raw
    } else {
        base_model.to_string()
    };

    let mem_str = get_val("MEM=");
    let (mut mem_tot_kb, mut mem_avail_kb) = (0f64, 0f64);
    let toks: Vec<&str> = mem_str.split_whitespace().collect();
    for pair in toks.chunks(2) {
        if pair.len() == 2 {
            if pair[0].starts_with("MemTotal") { mem_tot_kb = pair[1].parse().unwrap_or(0.0); }
            if pair[0].starts_with("MemAvailable") { mem_avail_kb = pair[1].parse().unwrap_or(0.0); }
        }
    }
    let ram_tot_gb = mem_tot_kb / 1_048_576.0;
    let ram_used_gb = (mem_tot_kb - mem_avail_kb).max(0.0) / 1_048_576.0;
    let ram_pct = if mem_tot_kb > 0.0 { ((ram_used_gb / ram_tot_gb) * 100.0).round() as u64 } else { 0 };

    let df_str = get_val("DF=");
    let df_toks: Vec<&str> = df_str.split_whitespace().collect();
    let df_tot_gb = df_toks.first().and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_048_576.0;
    let df_used_gb = df_toks.get(1).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_048_576.0;
    let df_free_gb = df_toks.get(2).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_048_576.0;
    let df_pct: u64 = df_toks.get(3).map(|s| s.trim_end_matches('%')).and_then(|v| v.parse().ok()).unwrap_or(0);

    let bat_str = get_val("BAT=");
    let (mut bat_lvl, mut temp_c, mut charging, mut volt_mv) = (0u64, 0.0f64, false, 0u64);
    let btoks: Vec<&str> = bat_str.split_whitespace().collect();
    for pair in btoks.chunks(2) {
        if pair.len() == 2 {
            if pair[0].starts_with("level:") { bat_lvl = pair[1].parse().unwrap_or(0); }
            if pair[0].starts_with("temperature:") { temp_c = pair[1].parse::<f64>().unwrap_or(0.0) / 10.0; }
            if pair[0].starts_with("status:") { charging = pair[1] == "2" || pair[1] == "5"; }
            if pair[0].starts_with("voltage:") { volt_mv = pair[1].parse().unwrap_or(0); }
        }
    }

    let load_str = get_val("LOAD=");
    let load_toks: Vec<&str> = load_str.split_whitespace().collect();
    let load1 = load_toks.first().copied().unwrap_or("0.0").to_string();
    let cpu_pct = ((load1.parse::<f64>().unwrap_or(0.0) / 8.0) * 100.0).clamp(1.0, 100.0).round() as u64;
    let res = get_val("RES=").replace('x', " × ");

    json!({
        "serial": serial, "model": model, "marketName": market,
        "androidVersion": get_val("VER="), "resolution": if res.is_empty() { "1080 × 2400".to_string() } else { res },
        "connectionType": conn, "state": "device", "connected": true, "platform": "android",
        "ram": format!("{:.1} GB", ram_tot_gb), "ramUsed": format!("{:.1} GB", ram_used_gb),
        "ramFreeMB": (mem_avail_kb / 1024.0).round() as u64, "ramUsagePercent": ram_pct,
        "storage": format!("{:.1} GB", df_tot_gb),
        "storageUsedGB": (df_used_gb * 10.0).round() / 10.0,
        "storageFreeGB": (df_free_gb * 10.0).round() / 10.0, "storageUsagePercent": df_pct,
        "cpuUsagePercent": cpu_pct, "cpuLoadAvg": load1,
        "activeThreads": load_toks.get(1).copied().unwrap_or("0/0"),
        "uptimeHours": format!("{} h", get_val("UP=")),
        "battery": bat_lvl, "isCharging": charging, "temperature": format!("{:.1}", temp_c),
        "batteryVoltageMv": volt_mv, "batteryTech": "Li-ion",
        "verifiedBootState": get_val("VBOOT="), "bootloaderLocked": get_val("FLASH=") == "1",
    })
}
