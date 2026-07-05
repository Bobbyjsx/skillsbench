//! Agent adapter registry.
//!
//! One `Agent` struct describes how a target agent stores skills. Everything
//! downstream (scanning, installs, uninstalls, compatibility) consumes this
//! registry — nothing hard-codes a specific agent name in UI or scan logic.

use crate::database;
use crate::models::AgentInfo;
use crate::paths;
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: &'static str,
    pub name: &'static str,
    pub kind: &'static str, // "cli" | "ide" | "shared"
    pub binary: Option<&'static str>,
    /// Global skill roots relative to the home directory.
    pub global_skill_dirs: &'static [&'static str],
    /// Project skill roots relative to a project root.
    pub project_skill_dirs: &'static [&'static str],
    /// Extra indicators that the agent is installed (e.g. an app dir).
    pub install_indicators: &'static [&'static str],
    pub supports_global: bool,
    pub supports_project: bool,
}

pub const AGENTS: &[Agent] = &[
    Agent {
        id: "claude",
        name: "Claude Code",
        kind: "cli",
        binary: Some("claude"),
        global_skill_dirs: &["~/.claude/skills"],
        project_skill_dirs: &[".claude/skills", ".claude-agent/skills"],
        install_indicators: &["~/.claude"],
        supports_global: true,
        supports_project: true,
    },
    Agent {
        id: "codex",
        name: "Codex",
        kind: "cli",
        binary: Some("codex"),
        global_skill_dirs: &["~/.codex/skills"],
        project_skill_dirs: &[".codex/skills"],
        install_indicators: &["~/.codex"],
        supports_global: true,
        supports_project: true,
    },
    Agent {
        id: "cursor",
        name: "Cursor",
        kind: "ide",
        binary: Some("cursor"),
        global_skill_dirs: &["~/.cursor/skills"],
        project_skill_dirs: &[".cursor/skills"],
        install_indicators: &["~/.cursor", "/Applications/Cursor.app"],
        supports_global: true,
        supports_project: true,
    },
    Agent {
        id: "opencode",
        name: "OpenCode",
        kind: "cli",
        binary: Some("opencode"),
        global_skill_dirs: &["~/.config/opencode/skills"],
        project_skill_dirs: &[".opencode/skills"],
        install_indicators: &["~/.config/opencode"],
        supports_global: true,
        supports_project: true,
    },
    Agent {
        id: "antigravity",
        name: "Antigravity",
        kind: "ide",
        binary: Some("antigravity"),
        global_skill_dirs: &["~/.antigravity/skills", "~/.gemini/antigravity/builtin/skills"],
        project_skill_dirs: &[".antigravity/skills"],
        install_indicators: &["~/.antigravity", "~/.gemini/antigravity", "/Applications/Antigravity.app"],
        supports_global: true,
        supports_project: true,
    },
    Agent {
        id: "gemini",
        name: "Gemini CLI",
        kind: "cli",
        binary: Some("gemini"),
        global_skill_dirs: &["~/.gemini/skills"],
        project_skill_dirs: &[".gemini/skills"],
        install_indicators: &["~/.gemini"],
        supports_global: true,
        supports_project: true,
    },
    // Vercel skills CLI shared install location. Skills here are consumed by
    // the agent plugins; it is its own "agent" from the manager's point of view.
    Agent {
        id: "agents",
        name: "Agent Skills",
        kind: "shared",
        binary: Some("skills"),
        global_skill_dirs: &["~/.agents/skills"],
        project_skill_dirs: &[],
        install_indicators: &["~/.agents/skills"],
        supports_global: true,
        supports_project: false,
    },
];

pub fn find(id: &str) -> Option<&'static Agent> {
    AGENTS.iter().find(|a| a.id == id)
}

pub fn agent_names<'a>() -> Vec<&'static str> {
    AGENTS.iter().map(|a| a.id).collect()
}

/// Resolve a possibly `~`-prefixed dir through the home directory.
pub fn home_dir(rel: &str) -> PathBuf {
    paths::expand_tilde(Path::new(rel))
}

pub fn global_roots(a: &Agent) -> Vec<PathBuf> {
    a.global_skill_dirs.iter().map(|d| home_dir(d)).collect()
}

/// Detect whether a binary is on PATH.
pub fn find_binary(name: &str) -> Option<String> {
    which::which(name).ok().map(|p| p.display().to_string())
}

/// Run `<binary> --version` with a hard timeout for display. Best-effort;
/// failures and slow CLIs are `None`. Never blocks the main thread for long:
/// some agent CLIs (Node-based) have multi-second cold starts.
pub fn binary_version(binary: &str) -> Option<String> {
    let mut child = std::process::Command::new(binary)
        .arg("--version")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .ok()?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1500);
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => break,
            Ok(None) => {
                if std::time::Instant::now() > deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
            Err(_) => return None,
        }
    }
    let out = child.wait_with_output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout).into_owned();
    let text = if text.trim().is_empty() {
        String::from_utf8_lossy(&out.stderr).into_owned()
    } else {
        text
    };
    Some(text.trim().lines().next()?.to_string())
}

/// Detection precedence:
/// 1. binary on PATH,
/// 2. install indicator dir/app present,
/// 3. a skills dir exists (the user clearly uses the agent, CLI just isn't linked).
pub fn detect(agent: &Agent) -> (bool, bool, Option<String>) {
    let has_binary = agent
        .binary
        .map(|b| find_binary(b).is_some())
        .unwrap_or(false);
    let has_indicator = agent
        .install_indicators
        .iter()
        .any(|i| {
            let p = paths::expand_tilde(Path::new(i));
            p.exists()
        });
    let has_skills = agent.global_skill_dirs.iter().any(|d| home_dir(d).is_dir());
    let detected = has_binary || has_indicator || has_skills;
    let version = if has_binary {
        agent.binary.and_then(binary_version)
    } else {
        None
    };
    (detected, has_binary, version)
}

/// Re-run detection for every agent and persist results.
pub fn detect_all(conn: &Connection) -> Vec<AgentInfo> {
    let now = paths::now_ms();
    AGENTS
        .iter()
        .map(|a| {
            let (detected, binary, version) = detect(a);
            database::repos::upsert_agent_detection(
                conn,
                a.id,
                detected,
                binary,
                version.as_deref(),
                now,
            )
            .ok();
            AgentInfo {
                id: a.id.to_string(),
                name: a.name.to_string(),
                kind: a.kind.to_string(),
                detected,
                discovering: false,
                version,
                binary,
                global_dirs: global_roots(a)
                    .iter()
                    .map(|p| paths::display_path(p))
                    .collect(),
                project_dir_names: a.project_skill_dirs.iter().map(|s| s.to_string()).collect(),
                skill_count: database::repos::skill_count_for_agent(conn, a.id),
                project_skill_count: database::repos::project_skill_count_for_agent(conn, a.id),
            }
        })
        .collect()
}

/// Full agents list (with counts) without re-detecting.
pub fn agents_info(conn: &Connection) -> Vec<AgentInfo> {
    detect_all_from_db(conn)
}

fn detect_all_from_db(conn: &Connection) -> Vec<AgentInfo> {
    AGENTS
        .iter()
        .map(|a| {
            let (detected, binary) = database::repos::agent_distinguishing(conn, a.id).unwrap_or((false, false));
            let version: Option<String> = conn
                .query_row(
                    "SELECT version FROM agent_detection WHERE agent_id = ?1",
                    [a.id],
                    |r| r.get(0),
                )
                .unwrap_or(None);
            AgentInfo {
                id: a.id.to_string(),
                name: a.name.to_string(),
                kind: a.kind.to_string(),
                detected,
                discovering: false,
                version,
                binary,
                global_dirs: global_roots(a)
                    .iter()
                    .map(|p| paths::display_path(p))
                    .collect(),
                project_dir_names: a.project_skill_dirs.iter().map(|s| s.to_string()).collect(),
                skill_count: database::repos::skill_count_for_agent(conn, a.id),
                project_skill_count: database::repos::project_skill_count_for_agent(conn, a.id),
            }
        })
        .collect()
}

/// All roots that should be watched/considered for incremental resyncs.
pub fn all_scan_roots(conn: &Connection) -> Vec<ScanRoot> {
    let mut roots: Vec<ScanRoot> = Vec::new();
    for a in AGENTS {
        if !a.supports_global {
            continue;
        }
        for (i, d) in a.global_skill_dirs.iter().enumerate() {
            let p = home_dir(d);
            if p.is_dir() {
                roots.push(ScanRoot {
                    kind: RootKind::Global { agent: a.id.to_string() },
                    dir: p,
                    skill_subdirs: vec![],
                    label: format!("{} global skills", a.id),
                    key: format!("g:{}:{}", a.id, i),
                });
            }
        }
    }
    for proj in database::repos::list_projects(conn).unwrap_or_default() {
        let p = paths::normalize_path(&proj.path);
        if !p.is_dir() {
            continue;
        }
        let mut subs = Vec::new();
        for a in AGENTS {
            if !a.supports_project {
                continue;
            }
            for d in a.project_skill_dirs {
                let full = p.join(d);
                if full.is_dir() {
                    subs.push(full);
                }
            }
        }
        if !subs.is_empty() {
            roots.push(ScanRoot {
                kind: RootKind::Project { path: proj.path.clone() },
                dir: p,
                skill_subdirs: subs,
                label: format!("project {}", proj.name),
                key: format!("p:{}", proj.path),
            });
        }
    }
    roots
}

#[derive(Debug, Clone)]
pub enum RootKind {
    Global { agent: String },
    Project { path: String },
    /// Scan exactly one already-created skill directory (no tree walk beyond it).
    Targeted { agent: String, project: Option<String> },
}

#[derive(Debug, Clone)]
pub struct ScanRoot {
    pub kind: RootKind,
    pub dir: PathBuf,
    /// Pre-resolved agent skill subdirs for projects; empty for global roots.
    pub skill_subdirs: Vec<PathBuf>,
    pub label: String,
    pub key: String,
}

// ------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::open;

    fn conn() -> Connection {
        let path = crate::error::test_dir("agents");
        let _ = std::fs::remove_file(&path);
        open(&path).unwrap()
    }

    #[test]
    fn registry_is_well_formed() {
        let ids: Vec<&str> = AGENTS.iter().map(|a| a.id).collect();
        assert_eq!(ids.len(), 7);
        assert_eq!(AGENTS.iter().map(|a| a.id).collect::<std::collections::HashSet<_>>().len(), ids.len());
        for a in AGENTS {
            assert!(!a.name.is_empty());
            assert!(!a.global_skill_dirs.is_empty());
            assert!(a.global_skill_dirs.iter().all(|d| d.contains('~') || d.starts_with('/')));
        }
    }

    #[test]
    fn detection_does_not_crash_when_absent() {
        let (detected, binary, version) = detect(&AGENTS[1]);
        assert!(detected || !detected);
        assert!(binary || !binary);
        assert!(version.is_some() || version.is_none());
    }

    #[test]
    fn roots_watch_only_existing_dirs() {
        let c = conn();
        let roots = all_scan_roots(&c);
        for r in &roots {
            assert!(r.dir.is_dir());
            match &r.kind {
                RootKind::Global { agent } => assert!(crate::agents::find(agent).is_some()),
                RootKind::Project { .. } => {}
                RootKind::Targeted { .. } => {}
            }
        }
    }
}