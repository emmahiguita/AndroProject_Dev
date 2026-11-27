// ============================================================================
// ARCHIVO: server/skills_loader.rs
// QUÉ HACE: Descubre y lee archivos `SKILL.md` reales instalados en el sistema
//           del usuario (`~/.gemini/config/skills`) o en el proyecto (`skills/`).
// CÓMO FUNCIONA: Recorre subcarpetas con límite seguro, extrae `name` y
//           `description` del frontmatter YAML y lee el contenido truncado
//           para inyectarlo como instrucciones del sistema en Ollama / Claude.
// POR QUÉ: Permitir que los modelos locales en ANDRO-IOS reutilicen Skills
//          reales del usuario sin simulaciones ni dependencias externas (< 115L).
// ============================================================================

use serde_json::{json, Value};
use std::path::{Path, PathBuf};

const MAX_SKILL_CHARS: usize = 6_000;
const MAX_SKILLS_LIST: usize = 200;

/// Directorios donde se buscan Skills instaladas (`SKILL.md`).
fn skill_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        roots.push(PathBuf::from(&home).join(".gemini").join("config").join("skills"));
        roots.push(PathBuf::from(&home).join(".agents").join("skills"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.join("skills"));
    }
    roots
}

/// Extrae `name` y `description` del frontmatter YAML `--- ... ---`.
fn parse_frontmatter(raw: &str, fallback_name: &str) -> (String, String) {
    let mut name = fallback_name.to_string();
    let mut desc = String::new();
    let trimmed = raw.trim_start();
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some((fm, _)) = rest.split_once("\n---") {
            for line in fm.lines() {
                let l = line.trim();
                if let Some(v) = l.strip_prefix("name:") {
                    let clean = v.trim().trim_matches(['"', '\'']);
                    if !clean.is_empty() { name = clean.to_string(); }
                } else if let Some(v) = l.strip_prefix("description:") {
                    desc = v.trim().trim_matches(['"', '\'']).to_string();
                }
            }
        }
    }
    (name, desc)
}

fn is_safe_skill_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        && !id.contains("..")
}

/// Lista las Skills disponibles (priorizando las no-automation y ordenadas por nombre).
pub fn list_skills() -> Vec<Value> {
    let mut items: Vec<(String, String)> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for root in skill_roots() {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }
            let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) else { continue };
            if !is_safe_skill_id(dir_name) || seen.contains(dir_name) { continue; }
            let skill_md = path.join("SKILL.md");
            if !skill_md.is_file() { continue; }
            if let Ok(raw) = std::fs::read_to_string(&skill_md) {
                let (name, desc) = parse_frontmatter(&raw, dir_name);
                seen.insert(dir_name.to_string());
                items.push((dir_name.to_string(), if desc.is_empty() { name } else { desc }));
            }
        }
    }

    // Prioriza skills técnicas/móviles/seguridad antes de conectores externos genéricos.
    items.sort_by(|a, b| {
        let a_auto = a.0.ends_with("-automation");
        let b_auto = b.0.ends_with("-automation");
        a_auto.cmp(&b_auto).then_with(|| a.0.cmp(&b.0))
    });

    items
        .into_iter()
        .take(MAX_SKILLS_LIST)
        .map(|(id, description)| json!({ "id": id, "description": description }))
        .collect()
}

/// Lee el contenido de una Skill específica por su `id` validado para inyectarlo al prompt.
pub fn load_skill_body(skill_id: &str) -> Option<String> {
    let id = skill_id.trim();
    if !is_safe_skill_id(id) { return None; }
    for root in skill_roots() {
        let file = Path::new(&root).join(id).join("SKILL.md");
        if file.is_file() {
            if let Ok(raw) = std::fs::read_to_string(&file) {
                let text: String = raw.chars().take(MAX_SKILL_CHARS).collect();
                return Some(format!("[Skill activa: {id}]\n{text}"));
            }
        }
    }
    None
}
