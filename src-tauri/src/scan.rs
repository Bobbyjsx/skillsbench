//! Filesystem scanning: turns skill directories into indexed rows.
//!
//! The filesystem stays the source of truth. The scanner never deletes user
//! files; it only (re)indexes. Rows whose folders vanished are marked
//! `broken` so the UI can offer recovery instead of silently forgetting them.

use crate::agents::{RootKind, ScanRoot};
use crate::database::repos::{self, SkillRow};
use crate::error::Result;
use crate::frontmatter::parse_frontmatter;
use crate::hash::summarize_dir;
use crate::paths;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

/// A single scan pass result, used for events and toasts.
#[derive(Debug, Default, Clone)]
pub struct ScanOutcome {
    pub added: usize,
    pub updated: usize,
    pub modified: usize,
    pub healed: usize,
    pub broken: usize,
    pub dropped: usize,
    pub total: usize,
}

const NOISE_DIRS: &[&str] = &[".git", "node_modules", ".DS_Store", ".trash", "__pycache__"];

fn is_noise(name: &str) -> bool {
    NOISE_DIRS.contains(&name) || (name.starts_with("_") && name.ends_with(".tmp"))
}

/// Index one skill candidate directory. Returns None when the dir isn't a skill.
pub fn index_skill_dir(
    conn: &Connection,
    dir: &Path,
    agent_id: &str,
    scope: &str,
    project_path: Option<&str>,
    tracked: bool,
) -> Result<Option<bool>> {
    if !dir.is_dir() {
        return Ok(None);
    }
    let summary = summarize_dir(dir)?;
    let Some(skill_md) = summary.skill_md else {
        // No SKILL.md: downgrade a previously-indexed row to broken.
        if let Ok(canon) = dir.canonicalize() {
            let p = canon.to_string_lossy().into_owned();
            conn.execute(
                "UPDATE skills SET status = 'broken' WHERE path = ?1 AND status != 'broken'",
                [&p],
            )?;
        }
        return Ok(None);
    };

    let fm = parse_frontmatter(&skill_md);
    let slug = dir.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
    let name = fm.name.clone().unwrap_or_else(|| slug.clone());
    let canon = dir.canonicalize().ok().unwrap_or_else(|| dir.to_path_buf());
    let path = canon.to_string_lossy().into_owned();

    // External modification detection: hash changed since last index.
    let previous_hash = repos::skill_hash_by_path(conn, &path);
    let was_indexed_before = previous_hash.is_some();
    let mut status = "ok";
    let mut modified = false;
    if let Some(old_hash) = previous_hash {
        if old_hash != summary.content_hash {
            status = "modified";
            modified = true;
        }
    }

    let row = SkillRow {
        path: path.clone(),
        name,
        slug,
        description: fm.description,
        author: fm.author,
        version: fm.version,
        scope: scope.to_string(),
        agent_id: agent_id.to_string(),
        project_path: project_path.map(str::to_string),
        status: status.to_string(),
        content_hash: summary.content_hash,
        file_count: summary.file_count as i64,
        mtime_ms: summary.mtime_ms,
        indexed_at_ms: paths::now_ms(),
        tracked,
    };
    repos::upsert_skill(conn, &row)?;

    Ok(Some(modified || !was_indexed_before))
}

/// Scan a set of roots (global or project). Emits progress via `on_progress`.
pub fn scan_roots(
    conn: &Connection,
    roots: &[ScanRoot],
    on_progress: &mut dyn FnMut(usize, usize),
) -> Result<ScanOutcome> {
    let mut outcome = ScanOutcome::default();
    let mut count = 0usize;

    for root in roots {
        let candidates: Vec<(PathBuf, String, Option<String>)> = match &root.kind {
            RootKind::Global { agent } => {
                let mut out = Vec::new();
                if let Ok(rd) = std::fs::read_dir(&root.dir) {
                    for e in rd.flatten() {
                        let p = e.path();
                        if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            let name = e.file_name().to_string_lossy().into_owned();
                            if is_noise(&name) {
                                continue;
                            }
                            if p.join("SKILL.md").is_file() {
                                out.push((p, agent.clone(), None));
                            }
                        }
                    }
                }
                out
            }
            RootKind::Project { path } => root
                .skill_subdirs
                .iter()
                .filter_map(|sub| std::fs::read_dir(sub).ok().map(|rd| (sub.clone(), rd)))
                .flat_map(|(parent, rd)| {
                    let proj = path.clone();
                    let agent = parent
                        .file_name()
                        .and_then(|f| f.to_str())
                        .map(|s| s.trim_start_matches('.').to_string())
                        .unwrap_or_else(|| "opencode".into());
                    rd.flatten()
                        .filter_map(move |e| {
                            let p = e.path();
                            let name = e.file_name().to_string_lossy().into_owned();
                            if !e.file_type().map(|t| t.is_dir()).unwrap_or(false) || is_noise(&name) {
                                return None;
                            }
                            if p.join("SKILL.md").is_file() {
                                Some((p, agent.clone(), Some(proj.clone())))
                            } else {
                                None
                            }
                        })
                })
                .collect::<Vec<_>>(),
            RootKind::Targeted { agent, project } => vec![(
                root.dir.clone(),
                agent.clone(),
                project.clone(),
            )],
        };

        for (dir, agent_id, project) in candidates.into_iter() {
            count += 1;
            on_progress(count, 0);
            let prev_exists = {
                let canon = dir.canonicalize().unwrap_or_else(|_| dir.clone());
                let p = canon.to_string_lossy().into_owned();
                let hash = repos::skill_hash_by_path(conn, &p);
                hash.is_some()
            };
            let scope = if project.is_some() { "project" } else { "global" };
            match index_skill_dir(conn, &dir, &agent_id, scope, project.as_deref(), true)? {
                Some(was_modified_or_new) => {
                    outcome.total += 1;
                    if prev_exists {
                        if was_modified_or_new {
                            outcome.modified += 1;
                            outcome.updated += 1;
                        } else {
                            outcome.healed += 1;
                        }
                    } else {
                        outcome.added += 1;
                    }
                }
                None => {}
            }
        }
    }

    Ok(outcome)
}

/// Reconcile stale rows: directories that vanished become `broken`.
pub fn reconcile_missing(conn: &Connection, roots: &[ScanRoot]) -> Result<Vec<String>> {
    let all_paths: Vec<(String, String, String, Option<String>)> = {
        let mut stmt = conn.prepare(
            "SELECT path, agent_id, scope, project_path FROM skills WHERE status != 'broken'",
        )?;
        let mut out = Vec::new();
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
            ))
        })?;
        for row in rows {
            out.push(row?);
        }
        out
    };

    let mut broken: Vec<String> = Vec::new();
    for (path, agent_id, scope, project_path) in all_paths {
        if Path::new(&path).exists() {
            continue;
        }
        // Only flag under roots we actually own; otherwise it may be a
        // project the user just removed from settings.
        let relevant = match (scope.as_str(), project_path) {
            ("project", Some(proj)) => roots
                .iter()
                .any(|r| matches!(&r.kind, RootKind::Project { path } if *path == proj)),
            ("global", _) => {
                roots.iter().any(|r| matches!(&r.kind, RootKind::Global { agent } if *agent == agent_id))
            }
            _ => false,
        };
        if relevant {
            conn.execute("UPDATE skills SET status = 'broken' WHERE path = ?1", [&path])?;
            broken.push(path);
        }
    }
    Ok(broken)
}

// ------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::open;

    fn setup() -> (Connection, PathBuf) {
        let tmp = crate::error::test_dir("scan");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let db = tmp.join("t.db");
        let conn = open(&db).unwrap();
        (conn, tmp)
    }

    fn write_skill(root: &Path, name: &str, body: &str) -> PathBuf {
        let d = root.join(name);
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("SKILL.md"), body).unwrap();
        d
    }

    #[test]
    fn scans_and_indexes_real_skills() {
        let (conn, tmp) = setup();
        write_skill(&tmp.join("global"), "frontend-design", "---\nname: frontend-design\ndescription: Build UI\n---\nbody");
        let outcome = scan_roots(&conn, &[], &mut |_, _| {});
        // no roots -> nothing
        assert_eq!(outcome.unwrap().total, 0);

        let root = ScanRoot {
            kind: RootKind::Global { agent: "claude".into() },
            dir: tmp.join("global"),
            skill_subdirs: vec![],
            label: "t".into(),
            key: "k".into(),
        };
        let outcome = scan_roots(&conn, &[root], &mut |_, _| {}).unwrap();
        assert_eq!(outcome.added, 1);
        assert_eq!(outcome.total, 1);

        let items = repos::list_skills(&conn, &Default::default()).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "frontend-design");
        assert_eq!(items[0].description.as_deref(), Some("Build UI"));
    }

    #[test]
    fn external_edit_flags_modified() {
        let (conn, tmp) = setup();
        let d = write_skill(&tmp, "demo", "---\nname: demo\n---\none");
        let root = ScanRoot {
            kind: RootKind::Global { agent: "claude".into() },
            dir: tmp,
            skill_subdirs: vec![],
            label: "t".into(),
            key: "k".into(),
        };
        scan_roots(&conn, &[root.clone()], &mut |_, _| {}).unwrap();
        assert_eq!(repos::list_skills(&conn, &Default::default()).unwrap()[0].status, "ok");

        // External edit
        std::fs::write(d.join("SKILL.md"), "---\nname: demo\n---\nchanged!").unwrap();
        scan_roots(&conn, &[root.clone()], &mut |_, _| {}).unwrap();
        let items = repos::list_skills(&conn, &Default::default()).unwrap();
        assert_eq!(items[0].status, "modified");
    }
}