//! Consulta ADB, Fastboot y dispositivos Plug and Play sin modificar Windows.

use serde_json::{json, Value};
use std::{process::Stdio, time::Duration};
use super::paths::{adb_bin, fastboot_bin, silent_cmd};

/// Ejecuta una consulta de diagnóstico con límite y elimina el proceso si se cancela.
async fn query(program: impl AsRef<std::ffi::OsStr>, args: &[&str]) -> Result<String, String> {
    let mut cmd = silent_cmd(program);
    cmd.kill_on_drop(true).args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    match tokio::time::timeout(Duration::from_secs(15), cmd.output()).await {
        Ok(Ok(out)) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout).to_string()),
        Ok(Ok(out)) => Err(String::from_utf8_lossy(&out.stderr).trim().to_owned()),
        Ok(Err(err)) => Err(err.to_string()),
        Err(_) => Err("La consulta agotó el tiempo de espera".into()),
    }
}

/// Consulta los iPhone/iPad visibles como dispositivos portátiles en Windows.
pub async fn ios_usb() -> Result<Vec<Value>, String> {
    let script = r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $d=@(Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq 'WPD' -and $_.FriendlyName -match 'iPhone|iPad' -and $_.InstanceId -match 'USB' } | Select-Object FriendlyName,InstanceId,Status); ConvertTo-Json -InputObject $d -Compress"#;
    let result = query("powershell.exe", &["-NoProfile", "-NonInteractive", "-Command", script]).await?;
    serde_json::from_str(&result).map_err(|error| error.to_string())
}

/// Devuelve solo información realmente consultada; informa cualquier fuente no disponible.
pub async fn scan() -> Value {
    let script = "$ErrorActionPreference='Stop'; $d=@(Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq 'AndroidUsbDeviceClass' -or $_.Class -eq 'AndroidDevice' -or $_.FriendlyName -match 'Android|\\bMTP\\b|iPhone' } | Select-Object InstanceId,FriendlyName,Class,Status,Problem); ConvertTo-Json -InputObject $d -Compress";
    let pnp_args = ["-NoProfile", "-NonInteractive", "-Command", script];
    let (adb, fastboot, pnp) = tokio::join!(
        query(adb_bin(), &["devices", "-l"]),
        query(fastboot_bin(), &["devices"]),
        query("powershell.exe", &pnp_args),
    );
    let adb_devices: Vec<String> = adb.as_ref().map(|s| s.lines().skip(1).map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('*')).map(str::to_owned).collect()).unwrap_or_default();
    let fastboot_devices: Vec<String> = fastboot.as_ref().map(|s| s.lines().map(str::trim)
        .filter(|line| !line.is_empty()).map(str::to_owned).collect()).unwrap_or_default();
    let pnp_data: Result<Vec<Value>, String> = pnp.and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()));
    let entries: Vec<Value> = pnp_data.as_ref().map(|items| items.iter().map(|item| json!({
        "instanceId": item["InstanceId"], "description": item["FriendlyName"], "className": item["Class"],
        "status": item["Status"], "problemCode": item["Problem"].as_str().unwrap_or(""), "driverInf": "", "hardwareId": ""
    })).collect()).unwrap_or_default();
    let problems: Vec<Value> = entries.iter().filter(|d| matches!(d["status"].as_str(), Some("Error" | "Degraded"))).cloned().collect();
    json!({ "success": adb.is_ok(), "error": adb.err().unwrap_or_default(), "adbDevices": adb_devices,
        "fastbootDevices": fastboot_devices, "fastbootAvailable": fastboot.is_ok(), "fastbootError": fastboot.err().unwrap_or_default(),
        "mobileUsb": entries, "mobileProblems": problems, "otherProblemsCount": 0,
        "pnpAvailable": pnp_data.is_ok(), "pnpError": pnp_data.err().unwrap_or_default() })
}
