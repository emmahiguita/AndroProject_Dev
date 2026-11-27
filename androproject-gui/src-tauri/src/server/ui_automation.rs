// ============================================================================
// ARCHIVO: server/ui_automation.rs
// QUÉ HACE: Puente nativo Rust de inspección y automatización UI Android vía
//           `uiautomator dump` + acciones seguras (`tap`, `swipe`, `key`, `text`)
//           y planificación asistida por modelo local (estilo Observe-Think-Act).
// CÓMO FUNCIONA: Captura el árbol XML real de la pantalla actual del dispositivo,
//           extrae hasta 60 nodos interactivos con coordenadas centrales `(x, y)`
//           y ejecuta acciones únicamente cuando el usuario confirma (`confirmed`).
// POR QUÉ: Dotar a ANDRO-IOS de inspección y navegación UI real sin dependencias
//          externas, sin simulaciones y con control humano explícito (< 185L).
// ============================================================================

use axum::{extract::Query, http::StatusCode, Json};
use serde_json::{json, Value};

use super::device_api::SerialQuery;
use super::local_llm;
use super::paths::{adb_shell, safe_serial};

/// Extrae el valor de un atributo XML simple `key="value"`.
fn xml_attr<'a>(node: &'a str, key: &str) -> &'a str {
    let needle = format!("{key}=\"");
    let Some(start) = node.find(&needle) else { return "" };
    let rest = &node[start + needle.len()..];
    rest.split('"').next().unwrap_or("")
}

/// Parsea `bounds="[x1,y1][x2,y2]"` y calcula el punto central `(cx, cy)`.
fn parse_center(bounds: &str) -> Option<(i32, i32)> {
    let nums: Vec<i32> = bounds
        .split(|c: char| !c.is_ascii_digit())
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<i32>().ok())
        .collect();
    if nums.len() != 4 { return None; }
    let (x1, y1, x2, y2) = (nums[0], nums[1], nums[2], nums[3]);
    if x2 <= x1 || y2 <= y1 { return None; }
    Some(((x1 + x2) / 2, (y1 + y2) / 2))
}

/// Extrae nodos interactivos o con texto visible del XML de `uiautomator dump`.
fn parse_ui_nodes(xml: &str) -> Vec<Value> {
    let mut elements = Vec::new();
    for chunk in xml.split("<node ").skip(1) {
        let Some((attrs, _)) = chunk.split_once('>') else { continue };
        let text = xml_attr(attrs, "text").trim();
        let desc = xml_attr(attrs, "content-desc").trim();
        let res_id = xml_attr(attrs, "resource-id").trim();
        let clickable = xml_attr(attrs, "clickable") == "true";
        let bounds = xml_attr(attrs, "bounds");

        if text.is_empty() && desc.is_empty() && !clickable { continue; }
        let Some((x, y)) = parse_center(bounds) else { continue };

        let label = if !text.is_empty() {
            text.to_string()
        } else if !desc.is_empty() {
            desc.to_string()
        } else if let Some(short_id) = res_id.rsplit('/').next() {
            format!("#{short_id}")
        } else {
            "Elemento táctil".to_string()
        };

        elements.push(json!({
            "label": label,
            "resourceId": res_id,
            "clickable": clickable,
            "x": x,
            "y": y,
            "bounds": bounds,
        }));
        if elements.len() >= 60 { break; }
    }
    elements
}

/// `GET /api/ui-automation?serial=...` — Inspecciona los elementos reales en pantalla.
pub async fn inspect_ui(Query(q): Query<SerialQuery>) -> (StatusCode, Json<Value>) {
    let raw_serial = q.serial.as_deref().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    if serial.is_empty() || serial != raw_serial {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial Android inválido" })));
    }
    let (ok, dump_out, err) = adb_shell(&serial, "uiautomator dump /sdcard/andro_ui_dump.xml && cat /sdcard/andro_ui_dump.xml && rm -f /sdcard/andro_ui_dump.xml", 10000).await;
    if !ok || !dump_out.contains("<hierarchy") {
        return (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": if err.is_empty() { "No se pudo leer el árbol UI (desbloquea la pantalla)" } else { &err } })));
    }
    let elements = parse_ui_nodes(&dump_out);
    (StatusCode::OK, Json(json!({ "success": true, "count": elements.len(), "elements": elements })))
}

/// `POST /api/ui-automation` — Ejecuta acción UI confirmada o genera plan con modelo local.
pub async fn run_ui_action(Json(body): Json<Value>) -> (StatusCode, Json<Value>) {
    let raw_serial = body["serial"].as_str().unwrap_or("").trim();
    let serial = safe_serial(raw_serial);
    if serial.is_empty() || serial != raw_serial {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Serial Android inválido" })));
    }
    let action = body["action"].as_str().unwrap_or("");

    if action == "plan" {
        let goal = body["goal"].as_str().unwrap_or("").trim();
        let model = body["model"].as_str().unwrap_or("").trim();
        if goal.is_empty() || model.is_empty() {
            return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Indica objetivo y modelo local" })));
        }
        let (_, dump_out, _) = adb_shell(&serial, "uiautomator dump /sdcard/andro_ui_dump.xml && cat /sdcard/andro_ui_dump.xml && rm -f /sdcard/andro_ui_dump.xml", 10000).await;
        let nodes = parse_ui_nodes(&dump_out);
        let summary: Vec<String> = nodes.iter().take(35).map(|n| {
            format!("- \"{}\" en ({}, {}) [clickable={}]", n["label"].as_str().unwrap_or(""), n["x"], n["y"], n["clickable"])
        }).collect();
        let prompt = format!(
            "Objetivo del usuario en la pantalla Android actual: {goal}\n\nElementos UI detectados:\n{}\n\nPropón los pasos exactos (en español, conciso) indicando qué elemento tocar (etiqueta y coordenadas x,y) o qué tecla presionar.",
            summary.join("\n")
        );
        return match local_llm::run_local_model(model, &prompt, None).await {
            Ok((plan, provider)) => (StatusCode::OK, Json(json!({ "success": true, "plan": plan, "provider": provider, "elements": nodes }))),
            Err(e) => (StatusCode::BAD_GATEWAY, Json(json!({ "success": false, "error": e }))),
        };
    }

    if body["confirmed"] != true {
        return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Toda acción UI requiere confirmación explícita" })));
    }

    let cmd = match action {
        "tap" => {
            let (Some(x), Some(y)) = (body["x"].as_i64(), body["y"].as_i64()) else {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Coordenadas x, y requeridas" })));
            };
            if !(0..=4000).contains(&x) || !(0..=4000).contains(&y) {
                return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Coordenadas fuera de rango" })));
            }
            format!("input tap {x} {y}")
        }
        "key" => match body["key"].as_str().unwrap_or("") {
            "HOME" => "input keyevent 3".to_string(),
            "BACK" => "input keyevent 4".to_string(),
            "APP_SWITCH" => "input keyevent 187".to_string(),
            "ENTER" => "input keyevent 66".to_string(),
            _ => return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Tecla no soportada" }))),
        },
        "text" => {
            let raw = body["text"].as_str().unwrap_or("").trim();
            let clean: String = raw.chars().filter(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '.' | '-' | '_' | '@' | '/')).take(80).collect();
            if clean.is_empty() { return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Texto inválido" }))); }
            format!("input text '{}'", clean.replace(' ', "%s"))
        }
        _ => return (StatusCode::BAD_REQUEST, Json(json!({ "success": false, "error": "Acción UI no soportada" }))),
    };

    let (ok, _, err) = adb_shell(&serial, &cmd, 5000).await;
    (StatusCode::OK, Json(json!({ "success": ok, "command": cmd, "error": if ok { Value::Null } else { json!(err) } })))
}
