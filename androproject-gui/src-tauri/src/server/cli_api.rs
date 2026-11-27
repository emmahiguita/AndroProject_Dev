// ============================================================================
// ARCHIVO: server/cli_api.rs
// QUÉ HACE: Expone `/api/ai-cli` (GET descubrimiento y POST ejecución) para
//           ADB Shell seguro, modelos locales (Ollama / LM Studio) y Claude CLI.
// CÓMO FUNCIONA: Descubre motores reales en paralelo vía `local_llm.rs` y ADB,
//           valida límites de entrada y enruta cada modo sin abrir ventanas CMD.
// POR QUÉ: Conectar el panel CLI de ANDRO-IOS con modelos locales reales para
//          análisis defensivo y diagnóstico Android/iOS (< 110 líneas).
// ============================================================================

use axum::{http::StatusCode, Json};
use serde_json::{json, Value};

use super::local_llm;
use super::paths::{adb_shell, run_adb, safe_serial};
use super::skills_loader;

const QUERIES: [&str; 16] = [
    "getprop ro.product.model",
    "getprop ro.build.version.release",
    "dumpsys battery",
    "dumpsys thermalservice",
    "dumpsys cpuinfo",
    "cat /proc/meminfo",
    "df -h /data",
    "pm list packages -3",
    "getprop ro.build.version.security_patch",
    "getenforce",
    "getprop ro.boot.verifiedbootstate",
    "getprop ro.boot.flash.locked",
    "settings get global private_dns_mode",
    "settings get global private_dns_specifier",
    "cmd appops query-op --user 0 SYSTEM_ALERT_WINDOW allow",
    "settings get secure enabled_accessibility_services",
];
const MAX_OUTPUT_CHARS: usize = 16_384;
const MAX_AI_PROMPT_CHARS: usize = 8_000;

fn clamp_output(mut output: String) -> (String, bool) {
    let truncated = output.chars().count() > MAX_OUTPUT_CHARS;
    if truncated {
        output = output.chars().take(MAX_OUTPUT_CHARS).collect();
        output.push_str("\n… salida recortada por límite de tamaño …");
    }
    (output, truncated)
}

/// `GET /api/ai-cli` — Detecta ADB, Ollama (11434), LM Studio (1234), Claude CLI y Skills.
pub async fn discover() -> Json<Value> {
    let ((adb, _, _), (ollama_online, models, claude_ok)) = tokio::join!(
        run_adb(&["version"], 3000),
        local_llm::discover_engines(),
    );
    let skills = skills_loader::list_skills();
    Json(json!({
        "success": true,
        "ollama": { "online": ollama_online, "models": models },
        "clis": { "adb": adb, "claude": claude_ok, "ollama": ollama_online },
        "queries": QUERIES,
        "skills": skills
    }))
}

/// `POST /api/ai-cli` — Ejecuta consultas en ADB, Ollama/LM Studio o Claude CLI.
pub async fn execute(Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let mode = body["mode"].as_str().unwrap_or("adb");
    let prompt = body["prompt"].as_str().unwrap_or("").trim();
    let skill_id = body["skillId"].as_str().unwrap_or("").trim();
    let skill_text = if skill_id.is_empty() { None } else { skills_loader::load_skill_body(skill_id) };
    let combined_ctx: Option<String> = match (body["deviceContext"].as_str(), skill_text.as_deref()) {
        (Some(d), Some(s)) => Some(format!("{d}\n\n{s}")),
        (Some(d), None) => Some(d.to_string()),
        (None, Some(s)) => Some(s.to_string()),
        (None, None) => None,
    };
    let device_ctx = combined_ctx.as_deref();

    if prompt.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "La consulta no puede estar vacía" })));
    }

    match mode {
        "adb" => {
            if prompt.len() > 128 {
                return (StatusCode::PAYLOAD_TOO_LARGE, Json(json!({ "success": false, "error": "La consulta ADB excede el límite permitido" })));
            }
            let raw_serial = body["serial"].as_str().unwrap_or("");
            let serial = safe_serial(raw_serial);
            if serial.is_empty() || serial != raw_serial.trim() {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Selecciona un dispositivo Android válido" })));
            }
            if !QUERIES.contains(&prompt) {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Consulta ADB no disponible en este módulo" })));
            }
            let (ok, raw_out, error) = adb_shell(&serial, prompt, 10000).await;
            if !ok { return (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": error }))); }
            let (output, truncated) = clamp_output(raw_out);
            let suggestions: Vec<_> = QUERIES.iter().copied().filter(|q| *q != prompt).collect();
            (StatusCode::OK, Json(json!({ "success": true, "output": output, "meta": { "provider": "ADB", "truncated": truncated }, "suggestions": suggestions })))
        }
        "ollama" => {
            if prompt.chars().count() > MAX_AI_PROMPT_CHARS {
                return (StatusCode::PAYLOAD_TOO_LARGE, Json(json!({ "success": false, "error": "El prompt excede el máximo de 8,000 caracteres" })));
            }
            let model = body["model"].as_str().unwrap_or("").trim();
            if model.is_empty() {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Selecciona un modelo local disponible" })));
            }
            match local_llm::run_local_model(model, prompt, device_ctx).await {
                Ok((raw_out, provider)) => {
                    let (output, truncated) = clamp_output(raw_out);
                    (StatusCode::OK, Json(json!({ "success": true, "output": output, "meta": { "provider": provider, "truncated": truncated }, "suggestions": [] })))
                }
                Err(err) => (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": err }))),
            }
        }
        "claude" => {
            if prompt.chars().count() > MAX_AI_PROMPT_CHARS {
                return (StatusCode::PAYLOAD_TOO_LARGE, Json(json!({ "success": false, "error": "El prompt excede el máximo de 8,000 caracteres" })));
            }
            match local_llm::run_claude(prompt, device_ctx).await {
                Ok(raw_out) => {
                    let (output, truncated) = clamp_output(raw_out);
                    (StatusCode::OK, Json(json!({ "success": true, "output": output, "meta": { "provider": "Claude CLI", "truncated": truncated }, "suggestions": [] })))
                }
                Err(err) => (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": err }))),
            }
        }
        _ => (StatusCode::NOT_IMPLEMENTED, Json(json!({ "success": false, "error": "Modo no soportado en este módulo" }))),
    }
}
