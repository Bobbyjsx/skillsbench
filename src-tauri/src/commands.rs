//! Tauri command surface: thin serialization over domain services.
//!
//! Every command validates input, resolves paths defensively, and maps errors
//! to user-facing messages. No raw Rust errors ever reach the UI.

use crate::agents;
use crate::database::repos;
use crate::error::{Error, Result};
use crate::models::*;
use crate::paths;
use crate::security;
use crate::state::AppState;
use tauri::Manager;
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Arc;

type Cmd<T> = std::result::Result<T, crate::error::Error>;

fn db(state: &AppState) -> std::sync::MutexGuard<'_, Connection> {
    state.db.lock().unwrap_or_else(|p| p.into_inner())
}

/// Debug bridge: frontend errors surface here so they show up in the dev log.
#[tauri::command]
pub fn log_line(msg: String) {
    eprintln!("[web] {msg}");
}

// ---------------------------------------------------------------- snapshot

#[tauri::command]
pub fn snapshot(state: tauri::State<'_, Arc<AppState>>) -> Cmd<Snapshot> {
    let conn = db(&state);
    let agents = agents::agents_info(&conn);
    let projects = repos::list_projects(&conn)?;
    let counts = repos::counts(&conn)?;
    let settings = repos::app_settings(&conn);
    let ui = repos::ui_state(&conn);
    let cli = CliInfo {
        available: which::which("skills").is_ok(),
        version: agents::binary_version("skills"),
    };
    let home = dirs::home_dir()
        .map(|h| h.display().to_string())
        .unwrap_or_default();
    Ok(Snapshot { agents, projects, counts, settings, ui, cli, home })
}

// ---------------------------------------------------------------- skills

#[tauri::command]
pub fn list_skills(state: tauri::State<'_, Arc<AppState>>, req: ListSkillsReq) -> Cmd<Vec<SkillSummary>> {
    let conn = db(&state);
    Ok(repos::list_skills(&conn, &req)?)
}

#[tauri::command]
pub fn counts(state: tauri::State<'_, Arc<AppState>>) -> Cmd<Counts> {
    let conn = db(&state);
    Ok(repos::counts(&conn)?)
}

#[tauri::command]
pub async fn get_skill_detail(state: tauri::State<'_, Arc<AppState>>, path: String) -> Cmd<SkillDetail> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = db(&state);
        detail_for(&conn, &path)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

fn detail_for(conn: &Connection, path: &str) -> Result<SkillDetail> {
    let row = repos::skill_by_path(conn, path)?;
    let dir = Path::new(&row.path);
    if !dir.is_dir() {
        return Err(Error::NotFound(row.path.clone()));
    }
    let summary = summarize(conn, path, &row)?;
    let locations = {
        let mut locations = repos::get_installations(conn, &row.content_hash);
        locations.sort_by(|a, b| a.agent_id.cmp(&b.agent_id));
        locations
    };
    let files = walk_files(dir, 4);
    let security = match repos::security_for_path(conn, path) {
        Some(r) => r,
        None => {
            // First view: run a scan synchronously (small dirs only).
            let r = security::scan_dir(dir);
            let findings = r.findings.clone();
            repos::save_security_scan(conn, path, &r).ok();
            SecurityReport { findings, ..r }
        }
    };
    Ok(SkillDetail { summary, locations, files, security })
}

fn summarize(conn: &Connection, path: &str, row: &repos::SkillRow) -> Result<SkillSummary> {
    Ok(SkillSummary {
        id: row.content_hash.clone(),
        path: row.path.clone(),
        name: row.name.clone(),
        slug: row.slug.clone(),
        description: row.description.clone(),
        author: row.author.clone(),
        version: row.version.clone(),
        status: row.status.clone(),
        scope: row.scope.clone(),
        project_path: row.project_path.clone(),
        agent_ids: Vec::new(),
        duplicate_count: 0,
        file_count: row.file_count,
        mtime_ms: row.mtime_ms,
        groups: repos::groups_for_path(conn, path),
    })
}

fn walk_files(dir: &Path, max_depth: u8) -> Vec<FileEntry> {
    let mut out = Vec::new();
    fn walk(dir: &Path, base: &Path, depth: u8, max: u8, out: &mut Vec<FileEntry>) {
        if depth > max || out.len() > 400 {
            return;
        }
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        let mut entries: Vec<_> = rd.flatten().collect();
        entries.sort_by_key(|e| (e.file_type().map(|t| t.is_file()).unwrap_or(false), e.file_name()));
        for e in entries {
            let Ok(ft) = e.file_type() else { continue };
            let name = e.file_name().to_string_lossy().into_owned();
            if name == ".DS_Store" {
                continue;
            }
            let rel = e
                .path()
                .strip_prefix(base)
                .map(|p| p.display().to_string())
                .unwrap_or_default();
            if ft.is_dir() {
                out.push(FileEntry {
                    name,
                    path: rel,
                    kind: "dir".into(),
                    size: 0,
                    depth,
                });
                walk(&e.path(), base, depth + 1, max, out);
            } else {
                out.push(FileEntry {
                    name,
                    path: rel,
                    kind: "file".into(),
                    size: e.metadata().map(|m| m.len() as i64).unwrap_or(0),
                    depth,
                });
            }
        }
    }
    walk(dir, dir, 0, max_depth, &mut out);
    out
}

#[tauri::command]
pub fn acknowledge_skill(state: tauri::State<'_, Arc<AppState>>, path: String) -> Cmd<()> {
    let conn = db(&state);
    repos::acknowledge_skill(&conn, &path)?;
    Ok(())
}

#[tauri::command]
pub fn forget_skill(state: tauri::State<'_, Arc<AppState>>, path: String) -> Cmd<()> {
    let conn = db(&state);
    repos::forget_skill(&conn, &path)?;
    Ok(())
}

// ---------------------------------------------------------------- create / edit

pub fn slugify(name: &str) -> Result<String> {
    let slug: String = name
        .to_lowercase()
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if slug.is_empty() || slug.len() < 2 {
        return Err(Error::InvalidInput("Use a name with at least 2 letters.".into()));
    }
    Ok(slug)
}

fn target_root_for(conn: &Connection, scope: &str, project_path: &Option<String>) -> Result<Option<PathBuf>> {
    match scope {
        "global" => Ok(None),
        "project" => {
            let Some(p) = project_path else {
                return Err(Error::InvalidInput("Pick a project for project-scoped installation.".into()));
            };
            let norm = paths::normalize_path(p);
            if !norm.is_dir() {
                return Err(Error::InvalidInput("That project folder no longer exists.".into()));
            }
            // The project must be a known root (added in Settings).
            let known = repos::list_projects(conn)?
                .iter()
                .any(|proj| paths::normalize_path(&proj.path) == norm);
            if !known {
                return Err(Error::InvalidInput("Add this folder as a project root in Settings first.".into()));
            }
            Ok(Some(norm))
        }
        _ => Err(Error::InvalidInput("Choose Global or Project scope.".into())),
    }
}

#[tauri::command]
pub async fn create_skill(
    state: tauri::State<'_, Arc<AppState>>,
    req: CreateSkillReq,
    app: tauri::AppHandle,
) -> Cmd<SkillDetail> {
    let state = state.inner().clone();
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if req.name.trim().is_empty() || req.agents.is_empty() {
            return Err(Error::InvalidInput("Give the skill a name and pick at least one agent.".into()));
        }
        let conn = db(&state);
        let slug = slugify(&req.name)?;
        let project = target_root_for(&conn, &req.scope, &req.project_path)?;
        let mut created: Vec<(std::path::PathBuf, String, Option<String>)> = Vec::new();
        let mut created_plain: Vec<String> = Vec::new();

        for agent_id in &req.agents {
            let Some(agent) = agents::find(agent_id) else { continue };
            let target = match (&project, req.scope.as_str()) {
                (Some(proj), _) => proj.join(agent.project_skill_dirs[0]).join(&slug),
                (None, _) => {
                    if !agent.supports_global {
                        continue;
                    }
                    agents::home_dir(agent.global_skill_dirs[0]).join(&slug)
                }
            };
            if !target.starts_with(agents::home_dir("~")) {
                return Err(Error::UnsafePath);
            }
            if target.exists() {
                return Err(Error::InvalidInput(format!("`{}` already exists — use a different name.", paths::display_path(&target))));
            }
            std::fs::create_dir_all(&target)?;
            let md = format!(
                "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}",
                slug,
                req.description.trim(),
                slug,
                skill_hint(&req.description)
            );
            std::fs::write(target.join("SKILL.md"), md)?;
            let proj_str = project.clone().map(|p| p.to_string_lossy().into_owned());
            created.push((target.clone(), agent_id.clone(), proj_str.clone()));
            created_plain.push(target.to_string_lossy().into_owned());
        }

        drop(conn); // Drop DB lock before index_dirs to prevent deadlock
        crate::scan_service::index_dirs(&state, &app, created).ok();
        
        let Some(first) = created_plain.first() else {
            return Err(Error::InvalidInput("No valid agent targets were available.".into()));
        };
        let conn2 = db(&state);
        detail_for(&conn2, first)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

fn skill_hint(description: &str) -> String {
    if description.trim().is_empty() {
        "Describe what this skill does.".into()
    } else {
        "Start instructing your agent here.".into()
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileData {
    pub is_text: bool,
    pub content: String,
}

#[tauri::command]
pub fn read_skill_file(state: tauri::State<'_, Arc<AppState>>, skill_path: String, file: String) -> Cmd<String> {
    let conn = db(&state);
    let abs = resolve_skill_file(&conn, &skill_path, &file)?;
    std::fs::read_to_string(&abs).map_err(Error::from)
}

#[tauri::command]
pub fn read_skill_file_data(state: tauri::State<'_, Arc<AppState>>, skill_path: String, file: String) -> Cmd<FileData> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let conn = db(&state);
    let abs = resolve_skill_file(&conn, &skill_path, &file)?;
    let bytes = std::fs::read(&abs)?;
    match String::from_utf8(bytes.clone()) {
        Ok(text) => Ok(FileData {
            is_text: true,
            content: text,
        }),
        Err(_) => Ok(FileData {
            is_text: false,
            content: STANDARD.encode(&bytes),
        }),
    }
}

#[tauri::command]
pub fn write_skill_file(
    state: tauri::State<'_, Arc<AppState>>,
    skill_path: String,
    file: String,
    content: String,
) -> Cmd<bool> {
    let conn = db(&state);
    if content.len() > 2_000_000 {
        return Err(Error::InvalidInput("That file is too large to save here.".into()));
    }
    let abs = resolve_skill_file(&conn, &skill_path, &file)?;
    let existing = std::fs::read_to_string(&abs).ok();
    if existing.as_deref() == Some(content.as_str()) {
        return Ok(false);
    }
    std::fs::write(&abs, content.as_bytes())?;
    Ok(true)
}

/// Resolve a file inside a skill dir, refusing any path traversal.
fn resolve_skill_file(conn: &Connection, skill_path: &str, file: &str) -> Result<PathBuf> {
    let row = repos::skill_by_path(conn, skill_path)?;
    let dir = PathBuf::from(&row.path)
        .canonicalize()
        .map_err(|_| Error::InvalidPath(skill_path.to_string()))?;
    let rel = Path::new(file);
    if rel.is_absolute() || rel.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(Error::UnsafePath);
    }
    let full = dir.join(rel);
    let canon = full.canonicalize().map_err(|_| Error::InvalidPath(file.to_string()))?;
    if !canon.starts_with(&dir) {
        return Err(Error::UnsafePath);
    }
    let is_md = matches!(
        canon.extension().and_then(|e| e.to_str()),
        Some("md" | "txt" | "json" | "yaml" | "yml" | "toml" | "sh" | "py" | "js" | "ts")
    );
    if !is_md {
        return Err(Error::InvalidInput("Only text files can be opened here.".into()));
    }
    Ok(canon)
}

// ---------------------------------------------------------------- install / uninstall

fn copy_tree(src: &Path, dst: &Path) -> Result<()> {
    if !src.join("SKILL.md").is_file() {
        return Err(Error::InvalidInput("That folder doesn't look like a skill (no SKILL.md).".into()));
    }
    std::fs::create_dir_all(dst)?;
    for entry in walkdir2(src)? {
        let rel = entry.strip_prefix(src).map_err(|_| Error::UnsafePath)?;
        if rel
            .components()
            .any(|c| matches!(c.as_os_str().to_str(), Some(".git" | "node_modules")))
        {
            continue;
        }
        let target = dst.join(rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&target)?;
        } else {
            std::fs::copy(entry, &target)?;
        }
    }
    Ok(())
}

fn walkdir2(src: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for e in walkdir::WalkDir::new(src).follow_links(false) {
        let e = e.map_err(|e| Error::Io(std::io::Error::other(e.to_string())))?;
        out.push(e.path().to_path_buf());
    }
    Ok(out)
}

#[tauri::command]
pub async fn install_skill(
    state: tauri::State<'_, Arc<AppState>>,
    req: InstallReq,
    app: tauri::AppHandle,
) -> Cmd<Vec<String>> {
    let state = state.inner().clone();
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = db(&state);
        let source = paths::normalize_path(&req.source_path);
        if !source.is_dir() {
            return Err(Error::NotFound(req.source_path));
        }
        let slug = source
            .file_name()
            .map(|f| f.to_string_lossy().into_owned())
            .ok_or_else(|| Error::InvalidInput("The source folder has no name.".into()))?;
        let project = target_root_for(&conn, &req.scope, &req.project_path)?;
        let mut installed = Vec::new();
        let mut indexed: Vec<(std::path::PathBuf, String, Option<String>)> = Vec::new();

        for agent_id in &req.agents {
            let Some(agent) = agents::find(agent_id) else { continue };
            let target = match (&project, req.scope.as_str()) {
                (Some(proj), _) => {
                    if !agent.supports_project {
                        continue;
                    }
                    proj.join(agent.project_skill_dirs[0]).join(&slug)
                }
                (None, _) => {
                    if !agent.supports_global {
                        continue;
                    }
                    agents::home_dir(agent.global_skill_dirs[0]).join(&slug)
                }
            };
            if target.exists() {
                return Err(Error::InvalidInput(format!(
                    "`{}` already has this skill. Uninstall it first if you want to reinstall.",
                    paths::display_path(&target)
                )));
            }
            if !target.starts_with(agents::home_dir("~")) {
                return Err(Error::UnsafePath);
            }
            copy_tree(&source, &target)?;
            installed.push(target.to_string_lossy().into_owned());
            let proj_str = project.clone().map(|p| p.to_string_lossy().into_owned());
            indexed.push((target.clone(), agent_id.clone(), proj_str));
        }

        drop(conn); // Drop DB lock before index_dirs to prevent deadlock
        crate::scan_service::index_dirs(&state, &app, indexed).ok();
        Ok(installed)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

/// Guard: a path may only be removed if it sits directly inside a known
/// skills root (depth + parent name checks), never the root itself.
fn assert_removable(conn: &Connection, path: &str) -> Result<PathBuf> {
    // If the path doesn't exist anymore, just return it so we can clean up the DB.
    let canon = std::fs::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
    
    let roots = agents::all_scan_roots(conn);
    for root in roots {
        let skill_dir = std::fs::canonicalize(&root.dir).unwrap_or_else(|_| root.dir.clone());
        // Global root: skill dirs live one level below the root.
        if let Ok(rel) = canon.strip_prefix(&skill_dir) {
            if rel.components().count() == 1 {
                return Ok(canon.clone());
            }
        }
        // Project subdirs: skills live one level below <root>/.claude/skills etc.
        for sub in &root.skill_subdirs {
            let sub_canon = std::fs::canonicalize(sub).unwrap_or_else(|_| sub.clone());
            if let Ok(rel2) = canon.strip_prefix(&sub_canon) {
                if rel2.components().count() == 1 {
                    return Ok(canon.clone());
                }
            }
        }
    }
    Err(Error::UnsafePath)
}

#[tauri::command]
pub async fn uninstall_skills(
    state: tauri::State<'_, Arc<AppState>>,
    req: UninstallReq,
    app: tauri::AppHandle,
) -> Cmd<Vec<String>> {
    let state = state.inner().clone();
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = db(&state);
        let mut removed = Vec::new();
        for p in &req.paths {
            let canon = assert_removable(&conn, p)?;
            if canon.exists() {
                std::fs::remove_dir_all(&canon)?;
            }
            repos::delete_skill(&conn, &canon.to_string_lossy())?;
            removed.push(canon.to_string_lossy().into_owned());
        }
        crate::scan_service::emit(
            &app,
            "skills:changed",
            serde_json::json!({ "phase": "done", "outcome": { "total": 0 } }),
        );
        Ok(removed)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?
}

// ---------------------------------------------------------------- agents / projects

#[tauri::command]
pub async fn redetect_agents(state: tauri::State<'_, Arc<AppState>>) -> Cmd<Vec<AgentInfo>> {
    let state = state.inner().clone();
    Ok(tauri::async_runtime::spawn_blocking(move || {
        let conn = db(&state);
        agents::detect_all(&conn)
    })
    .await
    .map_err(|e| Error::Other(e.to_string()))?)
}

#[tauri::command]
pub fn add_project_root(state: tauri::State<'_, Arc<AppState>>, path: String) -> Cmd<ProjectInfo> {
    let conn = db(&state);
    let norm = paths::normalize_path(&path);
    if !norm.is_dir() {
        return Err(Error::InvalidInput("That folder doesn't exist.".into()));
    }
    repos::add_project(&conn, &norm.to_string_lossy())?;
    let list = repos::list_projects(&conn)?;
    let proj = list
        .into_iter()
        .find(|p| paths::normalize_path(&p.path) == norm)
        .ok_or_else(|| Error::InvalidInput("Couldn't add that folder.".into()))?;
    Ok(proj)
}

#[tauri::command]
pub fn remove_project_root(state: tauri::State<'_, Arc<AppState>>, path: String) -> Cmd<()> {
    let conn = db(&state);
    repos::remove_project(&conn, &path)?;
    Ok(())
}

// ---------------------------------------------------------------- groups

#[tauri::command]
pub fn list_groups(state: tauri::State<'_, Arc<AppState>>) -> Cmd<Vec<GroupRow>> {
    let conn = db(&state);
    Ok(repos::list_groups(&conn)?)
}

#[tauri::command]
pub fn create_group(state: tauri::State<'_, Arc<AppState>>, name: String) -> Cmd<GroupRow> {
    let conn = db(&state);
    let id = repos::create_group(&conn, &name)?;
    Ok(GroupRow { id, name: name.trim().into(), sort: 0, skill_count: 0 })
}

#[tauri::command]
pub fn rename_group(state: tauri::State<'_, Arc<AppState>>, id: i64, name: String) -> Cmd<()> {
    let conn = db(&state);
    repos::rename_group(&conn, id, &name)?;
    Ok(())
}

#[tauri::command]
pub fn delete_group(state: tauri::State<'_, Arc<AppState>>, id: i64) -> Cmd<()> {
    let conn = db(&state);
    repos::delete_group(&conn, id)?;
    Ok(())
}

#[tauri::command]
pub fn assign_group(state: tauri::State<'_, Arc<AppState>>, req: AssignReq) -> Cmd<()> {
    let conn = db(&state);
    repos::assign_group(&conn, &req.group_name, &req.skill_path)?;
    Ok(())
}

#[tauri::command]
pub fn unassign_group(state: tauri::State<'_, Arc<AppState>>, req: AssignReq) -> Cmd<()> {
    let conn = db(&state);
    repos::unassign_group(&conn, &req.group_name, &req.skill_path)?;
    Ok(())
}

// ---------------------------------------------------------------- settings / ui

#[tauri::command]
pub fn set_setting(state: tauri::State<'_, Arc<AppState>>, key: String, value: String) -> Cmd<()> {
    let conn = db(&state);
    repos::set_setting(&conn, &key, &value)?;
    Ok(())
}

#[tauri::command]
pub fn set_ui(state: tauri::State<'_, Arc<AppState>>, ui: UiState) -> Cmd<()> {
    let conn = db(&state);
    repos::set_setting(&conn, "ui.sidebar", &ui.sidebar)?;
    repos::set_setting(&conn, "ui.inspector_open", if ui.inspector_open { "true" } else { "false" })?;
    repos::set_setting(&conn, "ui.inspector_pinned", if ui.inspector_pinned { "true" } else { "false" })?;
    Ok(())
}

// ---------------------------------------------------------------- filesystem helpers

#[tauri::command]
pub fn scan_now(state: tauri::State<'_, Arc<AppState>>, app: tauri::AppHandle) -> Cmd<()> {
    let state = state.inner().clone();
    std::thread::spawn(move || {
        let _ = crate::scan_service::rescan_all(&state, &app);
    });
    Ok(())
}

/// Placeholder serializer used by tests.
pub fn _serializable<T: Serialize>(_v: T) {}

// ---------------------------------------------------------------- marketplace

/// One skill from the skills.sh registry (search hit or leaderboard).
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketSkill {
    pub id: String,
    pub skill_id: String,
    pub name: String,
    pub installs: i64,
    pub source: String,
    pub is_official: bool,
}

/// The full popularity-sorted catalog (leaderboard order — most installs first).
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketCatalog {
    pub items: Vec<MarketSkill>,
    pub refreshed_at_ms: i64,
}

const CATALOG_TTL_SECS: i64 = 12 * 60 * 60;

fn catalog_cache_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("skillbench"))
        .join("market_catalog.json")
}

/// Parse the leaderboard array that skills.sh embeds in its homepage RSC payload:
/// `..."initialSkills":[{"source","skillId","name","installs","weeklyInstalls","isOfficial"}...]`
/// The page body escapes every quote, so we unescape before JSON parsing.
fn parse_leaderboard(html: &str) -> Vec<MarketSkill> {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Raw {
        source: String,
        skill_id: String,
        name: String,
        installs: i64,
        #[serde(default)]
        is_official: bool,
    }

    let Some(idx) = html.find("initialSkills") else {
        return Vec::new();
    };
    let rest = &html[idx..];
    let Some(open) = rest.find('[') else {
        return Vec::new();
    };
    let mut depth = 0usize;
    let mut end = None;
    let mut bytes = rest[open..].bytes();
    let mut offset = open;
    loop {
        match bytes.next() {
            None => break,
            Some(b'\\') => {
                bytes.next();
                offset += 2;
                continue;
            }
            Some(b'[') => {
                depth += 1;
                offset += 1;
            }
            Some(b']') => {
                depth -= 1;
                offset += 1;
                if depth == 0 {
                    end = Some(offset);
                    break;
                }
            }
            Some(_) => offset += 1,
        }
    }
    let Some(end) = end else { return Vec::new() };
    let raw = rest[open..end].replace("\\\"", "\"");
    let Ok(list) = serde_json::from_str::<Vec<Raw>>(&raw) else {
        return Vec::new();
    };
    list.into_iter()
        .map(|r| MarketSkill {
            id: format!("{}/{}", r.source, r.skill_id),
            skill_id: r.skill_id,
            name: r.name,
            installs: r.installs,
            source: r.source,
            is_official: r.is_official,
        })
        .collect()
}

fn read_cached_catalog(app: &tauri::AppHandle, allow_stale: bool) -> Option<MarketCatalog> {
    let path = catalog_cache_path(app);
    let text = std::fs::read_to_string(&path).ok()?;
    let cat: MarketCatalog = serde_json::from_str(&text).ok()?;
    if !allow_stale {
        let now = chrono_now_ms();
        if now - cat.refreshed_at_ms > CATALOG_TTL_SECS * 1000 {
            return None;
        }
    }
    Some(cat)
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Popularity-sorted catalog from skills.sh. Served from a local cache when
/// fresh; refreshes from the leaderboard behind a hard timeout and falls back
/// to the last known copy (even stale) rather than failing.
#[tauri::command]
pub async fn market_catalog(app: tauri::AppHandle, force: Option<bool>) -> Cmd<MarketCatalog> {
    let force = force.unwrap_or(false);
    if !force {
        if let Some(fresh) = read_cached_catalog(&app, false) {
            return Ok(fresh);
        }
    }
    let app2 = app.clone();
    let fetched = tauri::async_runtime::spawn_blocking(move || -> Option<MarketCatalog> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .user_agent("skillbench/0.1")
            .build()
            .ok()?;
        let html = client.get("https://www.skills.sh/").send().ok()?.text().ok()?;
        let items = parse_leaderboard(&html);
        if items.is_empty() {
            return None;
        }
        let cat = MarketCatalog {
            items,
            refreshed_at_ms: chrono_now_ms(),
        };
        let path = catalog_cache_path(&app2);
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(json) = serde_json::to_string(&cat) {
            let _ = std::fs::write(&path, json);
        }
        Some(cat)
    })
    .await
    .ok()
    .flatten();
    if let Some(cat) = fetched {
        return Ok(cat);
    }
    // No fresh copy and fetch failed — serve the last known catalog.
    if let Some(stale) = read_cached_catalog(&app, true) {
        return Ok(stale);
    }
    Err(Error::Other("Couldn't reach skills.sh to load the catalog.".into()))
}

/// Live search against skills.sh. Runs off the main thread with a hard
/// timeout so a slow network never freezes the UI.
#[tauri::command]
pub async fn market_search(query: String, limit: usize) -> Cmd<Vec<MarketSkill>> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let limit = limit.clamp(1, 60);
    tauri::async_runtime::spawn_blocking(move || {
        let url = format!(
            "https://www.skills.sh/api/search?q={}&limit={}",
            urlencoding::encode(&query),
            limit
        );
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("skillbench/0.1")
            .build()
            .map_err(|e| Error::Other(format!("network: {e}")))?;
        let resp = client
            .get(&url)
            .send()
            .map_err(|e| Error::Other(format!("network: {e}")))?;
        if !resp.status().is_success() {
            return Err(Error::Other(format!("marketplace unreachable (HTTP {})", resp.status().as_u16())));
        }
        let body: serde_json::Value = resp
            .json()
            .map_err(|e| Error::Other(format!("bad response: {e}")))?;
        let mut out = Vec::new();
        if let Some(skills) = body.get("skills").and_then(|v| v.as_array()) {
            for s in skills {
                let get = |k: &str| s.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
                out.push(MarketSkill {
                    id: get("id"),
                    skill_id: get("skillId"),
                    name: get("name"),
                    installs: s.get("installs").and_then(|v| v.as_i64()).unwrap_or(0),
                    source: get("source"),
                    is_official: false,
                });
            }
        }
        Ok(out)
    })
    .await
    .map_err(|e| Error::Other(format!("search worker: {e}")))?
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
pub mod test_helpers {
    // Kept empty: domain tests live in module-level #[cfg(test)].
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::open;

    #[test]
    fn slugify_normalizes() {
        assert_eq!(slugify("Frontend Design").unwrap(), "frontend-design");
        assert_eq!(slugify("  React Best Practices! ").unwrap(), "react-best-practices");
        assert!(slugify("!!").is_err());
        assert!(slugify("x").is_err());
    }

    #[test]
    fn resolve_rejects_traversal() {
        let tmp = crate::error::test_dir("cmd");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("skill")).unwrap();
        std::fs::write(tmp.join("skill/SKILL.md"), "ok").unwrap();
        let db = tmp.join("t.db");
        let conn = open(&db).unwrap();
        repos::upsert_skill(
            &conn,
            &repos::SkillRow {
                path: tmp.join("skill").to_string_lossy().into_owned(),
                name: "skill".into(),
                slug: "skill".into(),
                description: None,
                author: None,
                version: None,
                scope: "global".into(),
                agent_id: "claude".into(),
                project_path: None,
                status: "ok".into(),
                content_hash: "h".into(),
                file_count: 1,
                mtime_ms: 0,
                indexed_at_ms: 0,
                tracked: true,
            },
        )
        .unwrap();
        assert!(resolve_skill_file(&conn, &tmp.join("skill").to_string_lossy(), "../outside.md").is_err());
        assert!(resolve_skill_file(&conn, &tmp.join("skill").to_string_lossy(), "/etc/passwd").is_err());
        assert!(resolve_skill_file(&conn, &tmp.join("skill").to_string_lossy(), "SKILL.md").is_ok());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn assert_removable_only_accepts_direct_children() {
        let tmp = crate::error::test_dir("rem");
        let _ = std::fs::remove_dir_all(&tmp);
        let skills = tmp.join("skills");
        std::fs::create_dir_all(skills.join("ok-skill")).unwrap();
        std::fs::create_dir_all(tmp.join("outside")).unwrap();
        let db = tmp.join("t.db");
        let conn = open(&db).unwrap();
        // assert_removable uses all_scan_roots which only includes existing
        // global dirs; the fake root is not registered, so both must be refused.
        assert!(assert_removable(&conn, &skills.join("ok-skill").to_string_lossy()).is_err());
        assert!(assert_removable(&conn, &tmp.join("outside").to_string_lossy()).is_err());
        std::fs::remove_dir_all(&tmp).ok();
    }
}