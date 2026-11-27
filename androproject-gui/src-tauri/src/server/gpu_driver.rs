// ============================================================================
// ARCHIVO: server/gpu_driver.rs
// QUÉ HACE: Diagnóstico real, prueba de rendimiento (`gfxinfo`) y control de
//           drivers gráficos Android (ARM Mali, Qualcomm Adreno, PowerVR,
//           Vulkan HWUI `skiavk`/`skiagl` y Updatable Graphics Driver).
// CÓMO FUNCIONA: Lee `SurfaceFlinger` (GLES/GPU), `pm list features` (Vulkan),
//           ajustes `updatable_driver_*` y paquetes de driver instalados; permite
//           alternar driver gráfico/Vulkan y medir frames/jank reales por ADB.
// POR QUÉ: Dar herramientas reales y seguras para probar y optimizar drivers
//          Vulkan/Mali/Adreno sin root ni riesgo de brick (< 185 líneas).
// ============================================================================

use axum::{extract::Query, http::StatusCode, Json};
use serde_json::{json, Value};

use super::device_api::SerialQuery;
use super::paths::{adb_shell, safe_serial};

/// Detecta familia de GPU (Mali / Adreno / PowerVR / Xclipse) desde la línea GLES.
fn detect_gpu_family(gles_line: &str) -> &'static str {
    let l = gles_line.to_ascii_lowercase();
    if l.contains("mali") { "ARM Mali" }
    else if l.contains("adreno") { "Qualcomm Adreno" }
    else if l.contains("powervr") { "Imagination PowerVR" }
    else if l.contains("xclipse") || l.contains("amd") { "Samsung Xclipse (RDNA)" }
    else { "GPU Android" }
}

/// `GET /api/gpu-driver?serial=...` — Inspecciona GPU, Vulkan, driver activo y paquetes driver.
pub async fn get_gpu_info(Query(q): Query<SerialQuery>) -> (StatusCode, Json<Value>) {
    let raw_serial = q.serial.as_deref().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    if serial.is_empty() || serial != raw_serial {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial Android inválido" })));
    }

    let (
        (_, gles_out, _),
        (_, vk_out, _),
        (_, settings_out, _),
        (_, drv_pkgs_out, _),
    ) = tokio::join!(
        adb_shell(&serial, "dumpsys SurfaceFlinger | grep -i -m 2 'GLES:'", 5000),
        adb_shell(&serial, "pm list features | grep -i vulkan", 4000),
        adb_shell(&serial, "getprop debug.hwui.renderer; echo ---; settings get global updatable_driver_all_apps; echo ---; settings get global game_driver_all_apps; echo ---; getprop ro.hardware.vulkan; echo ---; getprop ro.board.platform", 5000),
        adb_shell(&serial, "pm list packages | grep -i -E 'driver|vulkan|angle|gles|mali|adreno'", 5000),
    );

    let gles_line = gles_out.lines().next().unwrap_or("").trim().to_string();
    let gpu_family = detect_gpu_family(&gles_line);
    let vulkan_features: Vec<String> = vk_out.lines().map(|l| l.trim().replace("feature:", "")).filter(|l| !l.is_empty()).collect();
    let s: Vec<&str> = settings_out.split("---").map(str::trim).collect();
    let hwui_renderer = s.first().copied().filter(|v| !v.is_empty()).unwrap_or("default");
    let updatable_mode = s.get(1).copied().filter(|v| !v.is_empty() && *v != "null").unwrap_or("0");
    let game_driver_mode = s.get(2).copied().filter(|v| !v.is_empty() && *v != "null").unwrap_or("0");
    let vulkan_hal = s.get(3).copied().unwrap_or("");
    let soc_platform = s.get(4).copied().unwrap_or("");
    let driver_packages: Vec<String> = drv_pkgs_out.lines().filter_map(|l| l.trim().strip_prefix("package:").map(str::to_string)).collect();

    (StatusCode::OK, Json(json!({
        "success": true,
        "gpuFamily": gpu_family,
        "glesInfo": if gles_line.is_empty() { "No reportado por SurfaceFlinger" } else { &gles_line },
        "socPlatform": soc_platform,
        "vulkanHal": vulkan_hal,
        "vulkanSupported": !vulkan_features.is_empty(),
        "vulkanFeatures": vulkan_features,
        "hwuiRenderer": hwui_renderer,
        "updatableDriverMode": updatable_mode,
        "gameDriverMode": game_driver_mode,
        "driverPackages": driver_packages,
    })))
}

/// `POST /api/gpu-driver` — Cambia driver gráfico / Vulkan o ejecuta prueba real de frames (`gfxinfo`).
pub async fn post_gpu_action(Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let raw_serial = body["serial"].as_str().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    if serial.is_empty() || serial != raw_serial {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial Android inválido" })));
    }
    let action = body["action"].as_str().unwrap_or("");

    match action {
        "set_renderer" => {
            let cmd = match body["renderer"].as_str() {
                Some("skiavk") => "setprop debug.hwui.renderer skiavk; settings put global angle_gl_driver_all_angle 0",
                Some("skiagl") => "setprop debug.hwui.renderer skiagl",
                Some("angle") => "settings put global angle_gl_driver_all_angle 1; setprop debug.hwui.renderer skiavk",
                Some("default") => "setprop debug.hwui.renderer ''; settings put global angle_gl_driver_all_angle 0",
                _ => return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Renderer no válido" }))),
            };
            let (ok, _, err) = adb_shell(&serial, cmd, 5000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": format!("Motor gráfico aplicado ({})", body["renderer"].as_str().unwrap_or("")), "error": err })))
        }
        "set_updatable_driver" => {
            // 0=Por defecto, 1=Game/Producción, 2=Prerelease, 3=Sistema base
            let mode = body["mode"].as_str().filter(|m| matches!(*m, "0" | "1" | "2" | "3")).unwrap_or("0");
            let cmd = format!("settings put global updatable_driver_all_apps {mode}; settings put global game_driver_all_apps {mode}");
            let (ok, _, err) = adb_shell(&serial, &cmd, 5000).await;
            (StatusCode::OK, Json(json!({ "success": ok, "message": format!("Perfil Updatable/Game Driver configurado en modo {mode}"), "error": err })))
        }
        "benchmark_gpu" => {
            // Reinicia métricas, genera un desplazamiento real ligero y lee framestats de SurfaceFlinger/gfxinfo.
            let _ = adb_shell(&serial, "dumpsys gfxinfo --reset", 4000).await;
            let _ = adb_shell(&serial, "input swipe 500 1200 500 600 220; sleep 0.4; input swipe 500 600 500 1200 220", 5000).await;
            let (ok, out, err) = adb_shell(&serial, "dumpsys gfxinfo | grep -E 'Total frames rendered|Janky frames|50th percentile|90th percentile|95th percentile|99th percentile' | head -n 12", 6000).await;
            (StatusCode::OK, Json(json!({
                "success": ok,
                "metrics": out.lines().map(str::trim).filter(|l| !l.is_empty()).collect::<Vec<_>>(),
                "error": err,
                "message": "Prueba real de renderizado GPU (gfxinfo) completada."
            })))
        }
        _ => (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Acción GPU no soportada" }))),
    }
}
