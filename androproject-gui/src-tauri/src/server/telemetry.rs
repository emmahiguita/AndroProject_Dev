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
        "echo CPU1=$(head -n 1 /proc/stat 2>/dev/null);",
        "echo MODEL=$(getprop ro.product.model);",
        "echo MARKET=$(getprop ro.vendor.oplus.market.name || getprop ro.product.marketname || getprop ro.product.brand);",
        "echo VER=$(getprop ro.build.version.release);",
        "echo RES=$(wm size 2>/dev/null | tail -n 1 | awk '{print $NF}');",
        "echo MEM=$(awk '/MemTotal|MemAvailable/{print $1,$2}' /proc/meminfo 2>/dev/null | tr '\\n' ' ');",
        "echo DF=$(df -k /data 2>/dev/null | tail -n 1 | awk '{print $2,$3,$4,$5}');",
        "echo LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1,$4}');",
        "echo UP=$(awk '{print int($1/3600)}' /proc/uptime 2>/dev/null);",
        "echo BAT=$(dumpsys battery 2>/dev/null | awk '/level:|temperature:|status:|voltage:|technology:/{print $1,$2}' | tr '\\n' ' ');",
        "echo VBOOT=$(getprop ro.boot.verifiedbootstate);echo FLASH=$(getprop ro.boot.flash.locked); echo VBMETA=$(getprop ro.boot.vbmeta.device_state); echo CPU2=$(head -n 1 /proc/stat 2>/dev/null)"
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

    let mem = get_val("MEM=");
    let bat = get_val("BAT=");
    let field = |pairs: &str, label: &str| pairs.split_whitespace().collect::<Vec<_>>().chunks_exact(2)
        .find(|pair| pair[0] == label).map(|pair| pair[1].to_owned());
    let total = field(&mem, "MemTotal:").and_then(|s| s.parse::<u64>().ok()).filter(|v| *v > 0);
    let free = field(&mem, "MemAvailable:").and_then(|s| s.parse::<u64>().ok());
    let used = total.zip(free).and_then(|(t, f)| t.checked_sub(f));
    let gib = |kb: u64| kb as f64 / 1_048_576.0;
    let df = get_val("DF=");
    let disk: Vec<_> = df.split_whitespace().collect();
    let capacity = |i: usize| disk.get(i).and_then(|s| s.parse::<u64>().ok()).map(gib);
    let load = get_val("LOAD=");
    let mut load_fields = load.split_whitespace();
    let uptime = get_val("UP=").parse::<u64>().ok();
    let temperature = field(&bat, "temperature:").and_then(|s| s.parse::<i64>().ok());
    let mut sample = json!({
        "serial":serial, "model":model, "marketName":market,"connectionType":conn,
        "state":"device","connected":true,"platform":"android", "androidVersion":get_val("VER="),
        "resolution":get_val("RES=").replace('x', " × "),
        "ram":total.map(|n| format!("{:.1} GB", gib(n))), "ramUsed":used.map(|n| format!("{:.1} GB", gib(n))),
        "ramFreeMB":free.map(|n| n / 1024), "ramUsagePercent":used.zip(total).map(|(u,t)| (100.0*u as f64/t as f64).round()),
        "storage":capacity(0).map(|v| format!("{v:.1} GB")), "storageUsedGB":capacity(1).map(|v| (v*10.0).round()/10.0),
        "storageFreeGB":capacity(2).map(|v| (v*10.0).round()/10.0),
        "storageUsagePercent":disk.get(3).and_then(|v| v.trim_end_matches('%').parse::<u8>().ok()),
        "cpuUsagePercent":cpu_percent(&get_val("CPU1="), &get_val("CPU2=")),
        "cpuLoadAvg":load_fields.next(), "activeThreads":load_fields.next(), "uptimeHours":uptime.map(|h| format!("{h} h")),
        "battery":field(&bat,"level:").and_then(|s| s.parse::<u8>().ok()),
        "isCharging":field(&bat,"status:").map(|s| s == "2" || s == "5"),
        "temperature":temperature.map(|n| format!("{:.1}", n as f64/10.0)),
        "batteryVoltageMv":field(&bat,"voltage:").and_then(|s| s.parse::<u32>().ok()), "batteryTech":field(&bat,"technology:"),
        "verifiedBootState":get_val("VBOOT="), "vbmetaState":get_val("VBMETA="),
        "bootloaderLocked":match get_val("FLASH=").as_str() {"1"=>Some(true),"0"=>Some(false),_=>None},
    });
    // Las propiedades opcionales se omiten para los consumidores antiguos de DeviceInfo.
    if let Some(fields) = sample.as_object_mut() { fields.retain(|_, value| !value.is_null()); }
    sample
}

/// Compara dos lecturas agregadas del kernel. Excluye guest, ya contado en user y nice.
fn cpu_percent(first: &str, second: &str) -> Option<u64> {
    fn ticks(line: &str) -> Option<(u64,u64)> {
        let mut fields = line.split_whitespace();
        if fields.next()? != "cpu" { return None; }
        let values = fields.take(8).map(str::parse::<u64>).collect::<Result<Vec<_>,_>>().ok()?;
        let idle = values.get(3)?.checked_add(values.get(4).copied().unwrap_or(0))?;
        Some((values.iter().try_fold(0u64, |sum, n| sum.checked_add(*n))?, idle))
    }
    let (a,ia) = ticks(first)?;
    let (b,ib) = ticks(second)?;
    let total = b.checked_sub(a)?;
    let busy = total.checked_sub(ib.checked_sub(ia)?)?;
    (total > 0).then(|| (100.0 * busy as f64 / total as f64).round() as u64)
}

#[cfg(test)]
mod tests {
    use super::cpu_percent;
    #[test]
    fn cpu_uses_measured_ticks_and_preserves_missing_samples() {
        assert_eq!(cpu_percent("cpu 1 0 1 8", "cpu 3 0 2 15"), Some(30));
        assert_eq!(cpu_percent("cpu 1 0 1 8", "cpu 1 0 1 8"), None);
        assert_eq!(cpu_percent("", ""), None);
    }
}
