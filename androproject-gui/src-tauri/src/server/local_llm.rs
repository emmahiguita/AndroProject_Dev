// ============================================================================
// ARCHIVO: server/local_llm.rs
// QUÉ HACE: Conector 100% Rust para modelos locales (Ollama en 127.0.0.1:11434,
//           LM Studio en 127.0.0.1:1234) y Claude CLI sin dependencias externas.
// CÓMO FUNCIONA: Realiza peticiones HTTP/1.1 locales sobre `tokio::net::TcpStream`
//           con timeout determinista (`Connection: close` + decodificación chunked)
//           y ejecuta `claude -p` con `CREATE_NO_WINDOW`.
// POR QUÉ: Habilitar análisis IA defensivo real desde `/api/ai-cli` sin Node.js,
//          sin Python y sin aumentar el tamaño del binario (< 195 líneas).
// ============================================================================

use serde_json::{json, Value};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::paths::silent_cmd;

const SYSTEM_PROMPT: &str = "Eres el asistente técnico defensivo de ANDRO-IOS. Responde en español de forma directa, precisa y accionable para diagnóstico Android/iOS, programación y ciberseguridad defensiva autorizada.";

/// Decodifica cuerpo HTTP con `Transfer-Encoding: chunked` si aplica.
fn decode_chunked(raw: &str) -> String {
    let mut out = String::new();
    let mut rest = raw;
    loop {
        let Some((hex_len, after_len)) = rest.split_once("\r\n") else { break };
        let len_str = hex_len.split(';').next().unwrap_or("").trim();
        let Ok(size) = usize::from_str_radix(len_str, 16) else { break };
        if size == 0 || after_len.len() < size { break; }
        out.push_str(&after_len[..size]);
        rest = after_len[size..].strip_prefix("\r\n").unwrap_or(&after_len[size..]);
    }
    out
}

/// Petición HTTP/1.1 loopback a `127.0.0.1:<port>` con respuesta JSON.
async fn local_http_json(port: u16, method: &str, path: &str, body: Option<&Value>, timeout_ms: u64) -> Result<Value, String> {
    let dur = Duration::from_millis(timeout_ms);
    let mut stream = tokio::time::timeout(dur, TcpStream::connect(("127.0.0.1", port)))
        .await
        .map_err(|_| format!("Timeout conectando a 127.0.0.1:{port}"))?
        .map_err(|e| format!("Servicio local en puerto {port} no disponible: {e}"))?;

    let payload = body.map(|v| v.to_string()).unwrap_or_default();
    let req = if body.is_some() {
        format!(
            "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
            payload.len()
        )
    } else {
        format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n")
    };

    tokio::time::timeout(dur, stream.write_all(req.as_bytes()))
        .await
        .map_err(|_| "Timeout enviando solicitud local".to_string())?
        .map_err(|e| e.to_string())?;

    let mut buf = Vec::new();
    tokio::time::timeout(dur, stream.read_to_end(&mut buf))
        .await
        .map_err(|_| "Timeout esperando respuesta del modelo local".to_string())?
        .map_err(|e| e.to_string())?;

    let raw = String::from_utf8_lossy(&buf);
    let (headers, raw_body) = raw.split_once("\r\n\r\n").ok_or("Respuesta HTTP local incompleta")?;
    let is_chunked = headers.to_ascii_lowercase().contains("transfer-encoding: chunked");
    let body_text = if is_chunked { decode_chunked(raw_body) } else { raw_body.to_string() };

    serde_json::from_str::<Value>(body_text.trim())
        .map_err(|e| format!("JSON inválido del motor local ({e})"))
}

/// Resuelve `claude` en PATH o `%APPDATA%\npm\claude.cmd` en Windows.
fn resolve_claude_cmd() -> String {
    if cfg!(windows) {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let npm_cmd = std::path::PathBuf::from(appdata).join("npm").join("claude.cmd");
            if npm_cmd.exists() {
                return npm_cmd.to_string_lossy().to_string();
            }
        }
    }
    "claude".to_string()
}

/// Comprueba si un binario CLI existe en PATH o ruta npm sin abrir consola.
async fn cli_exists(name: &str) -> bool {
    if name == "claude" && std::path::Path::new(&resolve_claude_cmd()).exists() {
        return true;
    }
    let mut cmd = if cfg!(windows) {
        let mut c = silent_cmd("where");
        c.arg(name);
        c
    } else {
        let mut c = silent_cmd("which");
        c.arg(name);
        c
    };
    cmd.kill_on_drop(true).stdout(Stdio::null()).stderr(Stdio::null());
    tokio::time::timeout(Duration::from_secs(2), cmd.status())
        .await
        .ok()
        .and_then(|r| r.ok())
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Descubre modelos locales en Ollama (11434), LM Studio (1234) y disponibilidad de Claude CLI.
pub async fn discover_engines() -> (bool, Vec<String>, bool) {
    let (ollama_res, lms_res, claude_ok) = tokio::join!(
        local_http_json(11434, "GET", "/api/tags", None, 1800),
        local_http_json(1234, "GET", "/v1/models", None, 1500),
        cli_exists("claude"),
    );

    let mut models: Vec<String> = Vec::new();
    let mut online = false;

    if let Ok(v) = ollama_res {
        online = true;
        if let Some(arr) = v["models"].as_array() {
            for item in arr {
                if let Some(name) = item["name"].as_str() {
                    models.push(name.to_string());
                }
            }
        }
    }

    if let Ok(v) = lms_res {
        online = true;
        if let Some(arr) = v["data"].as_array() {
            for item in arr {
                if let Some(id) = item["id"].as_str() {
                    models.push(format!("lmstudio:{id}"));
                }
            }
        }
    }

    (online, models, claude_ok)
}

/// Ejecuta inferencia real contra Ollama (`11434`) o LM Studio (`1234`).
pub async fn run_local_model(model: &str, prompt: &str, device_context: Option<&str>) -> Result<(String, String), String> {
    let full_prompt = match device_context {
        Some(ctx) if !ctx.trim().is_empty() => format!("[Contexto dispositivo conectado]\n{ctx}\n\n[Consulta]\n{prompt}"),
        _ => prompt.to_string(),
    };

    if let Some(lms_id) = model.strip_prefix("lmstudio:") {
        let body = json!({
            "model": lms_id,
            "messages": [
                { "role": "system", "content": SYSTEM_PROMPT },
                { "role": "user", "content": full_prompt }
            ],
            "temperature": 0.3
        });
        let resp = local_http_json(1234, "POST", "/v1/chat/completions", Some(&body), 120_000).await?;
        let text = resp["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| resp["error"]["message"].as_str().unwrap_or("LM Studio no devolvió contenido").to_string())?;
        return Ok((text.trim().to_string(), format!("LM Studio · {lms_id}")));
    }

    let body = json!({
        "model": model,
        "system": SYSTEM_PROMPT,
        "prompt": full_prompt,
        "stream": false
    });
    let resp = local_http_json(11434, "POST", "/api/generate", Some(&body), 120_000).await?;
    if let Some(err) = resp["error"].as_str() {
        return Err(format!("Ollama: {err}"));
    }
    let text = resp["response"].as_str().ok_or("Ollama no devolvió respuesta")?;
    Ok((text.trim().to_string(), format!("Ollama · {model}")))
}

/// Ejecuta `claude -p` localmente pasando el prompt por stdin (evita límites y cortes de `cmd /C` en Windows).
pub async fn run_claude(prompt: &str, device_context: Option<&str>) -> Result<String, String> {
    let full = match device_context {
        Some(ctx) if !ctx.trim().is_empty() => format!("[Contexto dispositivo]\n{ctx}\n\n{prompt}"),
        _ => prompt.to_string(),
    };
    let claude_bin = resolve_claude_cmd();
    let mut cmd = if cfg!(windows) {
        let mut c = silent_cmd("cmd");
        c.args(["/C", &claude_bin, "-p"]);
        c
    } else {
        let mut c = silent_cmd(&claude_bin);
        c.args(["-p"]);
        c
    };
    cmd.kill_on_drop(true).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("No se pudo ejecutar claude: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(full.as_bytes()).await;
        let _ = stdin.shutdown().await;
    }
    let out = tokio::time::timeout(Duration::from_secs(90), child.wait_with_output())
        .await
        .map_err(|_| "Timeout esperando respuesta de Claude CLI (90s)".to_string())?
        .map_err(|e| format!("Error ejecutando claude: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() && !stdout.is_empty() {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if stderr.is_empty() { "Claude CLI devolvió error sin detalle".into() } else { stderr })
    }
}
