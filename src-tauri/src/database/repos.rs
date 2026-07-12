use crate::error::{Error, Result};
use crate::models::*;
use crate::paths;
use rusqlite::{params, Connection, OptionalExtension, ToSql};

// ---------------------------------------------------------------- settings

pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
        .optional()
        .ok()
        .flatten()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn app_settings(conn: &Connection) -> AppSettings {
    let mut s = AppSettings::default();
    if let Some(t) = get_setting(conn, "theme") {
        s.theme = t;
    }
    s.first_launch_done = get_setting(conn, "first_launch_done")
        .map(|v| v == "1" || v == "true" || v == "yes")
        .unwrap_or(false);
    s
}

pub fn ui_state(conn: &Connection) -> UiState {
    UiState {
        sidebar: get_setting(conn, "ui.sidebar").unwrap_or_else(|| "full".into()),
        inspector_open: get_setting(conn, "ui.inspector_open").unwrap_or_else(|| "false".into()) == "true",
        inspector_pinned: get_setting(conn, "ui.inspector_pinned").unwrap_or_else(|| "false".into()) == "true",
    }
}

// ---------------------------------------------------------------- agents

pub fn upsert_agent_detection(
    conn: &Connection,
    agent_id: &str,
    detected: bool,
    binary: bool,
    version: Option<&str>,
    now: i64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO agent_detection (agent_id, detected, version, binary, checked_at_ms)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(agent_id) DO UPDATE SET
            detected = excluded.detected, version = excluded.version,
            binary = excluded.binary, checked_at_ms = excluded.checked_at_ms",
        params![agent_id, detected as i32, version, binary as i32, now],
    )?;
    Ok(())
}

pub fn agent_distinguishing(conn: &Connection, agent_id: &str) -> Option<(bool, bool)> {
    conn.query_row(
        "SELECT detected, binary FROM agent_detection WHERE agent_id = ?1",
        [agent_id],
        |r| Ok((r.get::<_, i32>(0)? == 1, r.get::<_, i32>(1)? == 1)),
    )
    .optional()
    .ok()
    .flatten()
}

pub fn skill_count_for_agent(conn: &Connection, agent_id: &str) -> i64 {
    conn.query_row("SELECT count(*) FROM skills WHERE agent_id = ?1", [agent_id], |r| r.get(0))
        .unwrap_or(0)
}

pub fn project_skill_count_for_agent(conn: &Connection, agent_id: &str) -> i64 {
    conn.query_row(
        "SELECT count(*) FROM skills WHERE agent_id = ?1 AND scope = 'project'",
        [agent_id],
        |r| r.get(0),
    )
    .unwrap_or(0)
}

// ---------------------------------------------------------------- projects

pub fn add_project(conn: &Connection, path: &str) -> Result<i64> {
    let norm = paths::normalize_path(path);
    let canon = norm.to_string_lossy().into_owned();
    conn.execute(
        "INSERT INTO projects (path, added_at_ms) VALUES (?1, ?2)
         ON CONFLICT(path) DO NOTHING",
        params![canon, paths::now_ms()],
    )?;
    Ok(conn.last_insert_rowid())
}

fn project_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

pub fn list_projects(conn: &Connection) -> Result<Vec<ProjectInfo>> {
    let mut stmt = conn.prepare(
        "SELECT p.path, (SELECT count(*) FROM skills s WHERE s.project_path = p.path)
         FROM projects p ORDER BY p.path",
    )?;
    let rows = stmt
        .query_map([], |r| {
            let path: String = r.get(0)?;
            Ok(ProjectInfo { path: path.clone(), name: project_name(&path), skill_count: r.get(1)? })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn remove_project(conn: &Connection, path: &str) -> Result<()> {
    let norm = paths::normalize_path(path);
    let canon = norm.to_string_lossy().into_owned();
    conn.execute("DELETE FROM projects WHERE path = ?1", [&canon])?;
    conn.execute("DELETE FROM skills WHERE project_path = ?1", [&canon])?;
    conn.execute("DELETE FROM security_scans WHERE skill_path NOT IN (SELECT path FROM skills)", [])?;
    Ok(())
}

// ---------------------------------------------------------------- skills

pub struct SkillRow {
    pub path: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub scope: String,
    pub agent_id: String,
    pub project_path: Option<String>,
    pub status: String,
    pub content_hash: String,
    pub file_count: i64,
    pub mtime_ms: i64,
    pub indexed_at_ms: i64,
    pub tracked: bool,
}

/// Upsert one installation. Keeping the same `path` preserves groups/security data.
pub fn upsert_skill(conn: &Connection, row: &SkillRow) -> Result<()> {
    conn.execute(
        "INSERT INTO skills (path, name, slug, description, author, version, scope, agent_id,
                             project_path, status, content_hash, skill_md_hash, file_count,
                             mtime_ms, indexed_at_ms, tracked)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
         ON CONFLICT(path) DO UPDATE SET
            name=excluded.name, slug=excluded.slug, description=excluded.description,
            author=excluded.author, version=excluded.version, scope=excluded.scope,
            agent_id=excluded.agent_id, project_path=excluded.project_path,
            status=excluded.status, content_hash=excluded.content_hash,
            skill_md_hash=excluded.skill_md_hash, file_count=excluded.file_count,
            mtime_ms=excluded.mtime_ms, indexed_at_ms=excluded.indexed_at_ms,
            tracked=excluded.tracked",
        params![
            row.path, row.name, row.slug, row.description, row.author, row.version, row.scope,
            row.agent_id, row.project_path, row.status, row.content_hash, "", row.file_count,
            row.mtime_ms, row.indexed_at_ms, row.tracked as i32
        ],
    )?;
    Ok(())
}

pub fn acknowledge_skill(conn: &Connection, path: &str) -> Result<()> {
    let updated = conn.execute(
        "UPDATE skills SET status = 'ok', tracked = 1 WHERE path = ?1 AND status IN ('modified','broken','invalid')",
        [path],
    )?;
    if updated == 0 {
        return Err(Error::NotFound(path.to_string()));
    }
    Ok(())
}

pub fn forget_skill(conn: &Connection, path: &str) -> Result<()> {
    conn.execute("DELETE FROM security_scans WHERE skill_path = ?1", [path])?;
    conn.execute("DELETE FROM skills WHERE path = ?1", [path])?;
    Ok(())
}

pub fn delete_skill(conn: &Connection, path: &str) -> Result<()> {
    conn.execute("DELETE FROM skills WHERE path = ?1", [path])?;
    Ok(())
}

pub fn counts(conn: &Connection) -> Result<Counts> {
    let one = |sql: &str| -> i64 { conn.query_row(sql, [], |r| r.get(0)).unwrap_or(0) };
    Ok(Counts {
        skills: one("SELECT count(DISTINCT content_hash) FROM skills"),
        instances: one("SELECT count(*) FROM skills"),
        updates: one("SELECT count(*) FROM skills WHERE status = 'update'"),
        modified: one("SELECT count(*) FROM skills WHERE status = 'modified'"),
        broken: one("SELECT count(*) FROM skills WHERE status = 'broken'"),
        invalid: one("SELECT count(*) FROM skills WHERE status = 'invalid'"),
        untracked: one("SELECT count(*) FROM skills WHERE tracked = 0"),
        duplicates: one(
            "SELECT count(*) FROM (SELECT content_hash FROM skills GROUP BY content_hash HAVING count(*) > 1)",
        ),
        groups: one("SELECT count(*) FROM groups"),
        projects: one("SELECT count(*) FROM projects"),
        agents: one("SELECT count(*) FROM agent_detection WHERE detected = 1"),
        warnings: 0,
    })
}

/// Escape a free-text query into a safe FTS5 expression: quoted ANDed terms.
fn fts_match(query: &str) -> Option<String> {
    let tokens: Vec<String> = query
        .split_whitespace()
        .map(|t| {
            t.chars()
                .filter(|c| !matches!(c, '"' | '\'' | '(' | ')' | '*' | ':' | ';' | '{' | '}'))
                .collect::<String>()
        })
        .filter(|t| t.len() >= 2)
        .collect();
    if tokens.is_empty() {
        None
    } else {
        Some(tokens.iter().map(|t| format!("\"{t}\"")).collect::<Vec<_>>().join(" AND "))
    }
}

const STATUS_RANK: &str = "CASE status WHEN 'broken' THEN 4 WHEN 'modified' THEN 3 WHEN 'invalid' THEN 2 WHEN 'update' THEN 1 ELSE 0 END";
const RANK_STATUS: [&str; 5] = ["ok", "update", "invalid", "modified", "broken"];

/// Where-clause for a list request. Returns (sql_after_table, params in order).
fn list_where(req: &ListSkillsReq) -> (String, Vec<String>) {
    let mut conds: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(a) = req.agent.as_deref() {
        conds.push("EXISTS (SELECT 1 FROM skills a WHERE a.content_hash = s.content_hash AND a.agent_id = ?)".into());
        params.push(a.to_string());
    }
    if let Some(sc) = req.scope.as_deref() {
        match sc {
            "global" => conds.push("EXISTS (SELECT 1 FROM skills sc_s WHERE sc_s.content_hash = s.content_hash AND sc_s.scope = 'global')".into()),
            "project" => conds.push("EXISTS (SELECT 1 FROM skills sc_s WHERE sc_s.content_hash = s.content_hash AND sc_s.scope = 'project')".into()),
            _ => {}
        }
    }
    if let Some(g) = req.group.as_deref() {
        conds.push(
            "s.content_hash IN (SELECT p.content_hash FROM skills p JOIN skill_groups sg ON sg.skill_path = p.path JOIN groups gg ON gg.id = sg.group_id WHERE gg.name = ?)"
                .into(),
        );
        params.push(g.to_string());
    }
    let where_sql = if conds.is_empty() { String::new() } else { format!("AND {}", conds.join(" AND ")) };
    (where_sql, params)
}

pub fn list_skills(conn: &Connection, req: &ListSkillsReq) -> Result<Vec<SkillSummary>> {
    let (where_sql, base_params) = list_where(req);
    let fts = req.query.as_deref().and_then(fts_match);
    let fts_sql = if fts.is_some() {
        "AND s.id IN (SELECT rowid FROM skills_fts WHERE skills_fts MATCH ?)"
    } else {
        ""
    };
    let sort = match req.sort.as_deref() {
        Some("name") => "s.name COLLATE NOCASE ASC",
        Some("installed") => "s.indexed_at_ms DESC",
        _ => "s.mtime_ms DESC",
    };
    let limit = req.limit.unwrap_or(500).clamp(1, 5000);
    let offset = req.offset.unwrap_or(0).max(0);

    let sql = format!(
        "SELECT s.path, s.name, s.slug, s.description, s.author, s.version, s.scope,
                s.project_path, s.status, s.content_hash, s.file_count, s.mtime_ms,
                s.indexed_at_ms,
                (SELECT count(*) FROM skills x WHERE x.content_hash = s.content_hash) AS dup,
                (SELECT group_concat(g.name, '|') FROM skill_groups sg JOIN groups g ON g.id = sg.group_id WHERE sg.skill_path = s.path) AS grp
         FROM skills s
         WHERE s.id = (SELECT min(id) FROM skills p WHERE p.content_hash = s.content_hash)
         {fts_sql}
         {where_sql}
         ORDER BY {sort}"
    );

    let mut out_params: Vec<Box<dyn ToSql>> = Vec::new();
    if let Some(m) = &fts {
        out_params.push(Box::new(m.clone()));
    }
    out_params.extend(base_params.iter().map(|p| Box::new(p.clone()) as Box<dyn ToSql>));
    let param_refs: Vec<&dyn ToSql> = out_params.iter().map(|b| b.as_ref()).collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(param_refs.as_slice(), |r| {
            let dup: i64 = r.get(13)?;
            let grp: Option<String> = r.get(14)?;
            Ok((
                SkillSummary {
                    id: r.get::<_, String>(9)?,
                    path: r.get(0)?,
                    name: r.get(1)?,
                    slug: r.get(2)?,
                    description: r.get(3)?,
                    author: r.get(4)?,
                    version: r.get(5)?,
                    scope: r.get(6)?,
                    project_path: r.get(7)?,
                    status: r.get(8)?,
                    duplicate_count: dup,
                    file_count: r.get(10)?,
                    mtime_ms: r.get(11)?,
                    agent_ids: Vec::new(),
                    groups: grp.map(|g| g.split('|').map(str::to_string).collect()).unwrap_or_default(),
                },
                r.get::<_, String>(9)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    // Batch-enrich: agent presence + aggregate status per content hash.
    let hashes: Vec<String> = rows.iter().map(|(_, h)| h.clone()).collect();
    let (agents_by_hash, status_by_hash, untracked_by_hash) = batch_enrich(conn, &hashes)?;

    let mut items: Vec<SkillSummary> = Vec::with_capacity(rows.len());
    for (mut s, h) in rows {
        s.agent_ids = agents_by_hash.get(&h).cloned().unwrap_or_default();
        s.status = status_by_hash.get(&h).cloned().unwrap_or_else(|| s.status.clone());
        if untracked_by_hash.get(&h).copied().unwrap_or(false) && s.status == "ok" {
            s.status = "untracked".into();
        }
        s.duplicate_count = (s.duplicate_count - 1).max(0);
        
        let keep = match req.tab.as_deref() {
            Some("updates") => s.status == "update",
            Some("issues") => s.status == "broken" || s.status == "invalid" || s.status == "modified",
            Some("untracked") => s.status == "untracked",
            Some("installed") => s.status != "untracked", // assuming installed means tracked
            _ => true,
        };
        if keep {
            items.push(s);
        }
    }
    
    let limit = req.limit.unwrap_or(500).clamp(1, 5000) as usize;
    let offset = req.offset.unwrap_or(0).max(0) as usize;
    let paginated = items.into_iter().skip(offset).take(limit).collect();
    
    Ok(paginated)
}

fn batch_enrich(
    conn: &Connection,
    hashes: &[String],
) -> Result<(std::collections::HashMap<String, Vec<String>>, std::collections::HashMap<String, String>, std::collections::HashMap<String, bool>)> {
    let mut agents: std::collections::HashMap<String, Vec<String>> = Default::default();
    let mut statuses: std::collections::HashMap<String, String> = Default::default();
    let mut untracked: std::collections::HashMap<String, bool> = Default::default();
    if hashes.is_empty() {
        return Ok((agents, statuses, untracked));
    }

    // Chunked IN clause (SQLite caps placeholders per statement).
    const CHUNK: usize = 700;
    for chunk in hashes.chunks(CHUNK) {
        let placeholders = vec!["?"; chunk.len()].join(",");
        let params: Vec<&dyn ToSql> = chunk.iter().map(|h| h as &dyn ToSql).collect();

        // Agent presence per hash (dedupe distinct agent ids in Rust).
        {
            let sql = format!(
                "SELECT content_hash, agent_id FROM skills
                 WHERE content_hash IN ({placeholders}) ORDER BY content_hash, agent_id"
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt
                .query_map(params.as_slice(), |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            for (hash, id) in rows {
                let list = agents.entry(hash).or_default();
                if !list.contains(&id) {
                    list.push(id);
                }
            }
        }

        // Worst aggregate status across installations.
        {
            let sql = format!(
                "SELECT content_hash, MAX({STATUS_RANK}) FROM skills
                 WHERE content_hash IN ({placeholders}) GROUP BY content_hash"
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt
                .query_map(params.as_slice(), |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            for (hash, rank) in rows {
                statuses.insert(hash, RANK_STATUS[(rank as usize).min(4)].to_string());
            }
        }

        // Has any installation fallen out of tracking?
        {
            let sql = format!(
                "SELECT content_hash, MAX(CASE WHEN tracked = 0 THEN 1 ELSE 0 END)
                 FROM skills WHERE content_hash IN ({placeholders}) GROUP BY content_hash"
            );
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt
                .query_map(params.as_slice(), |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            for (hash, any) in rows {
                untracked.insert(hash, any == 1);
            }
        }
    }
    Ok((agents, statuses, untracked))
}

pub fn get_installations(conn: &Connection, content_hash: &str) -> Vec<InstallLocation> {
    conn.prepare(
        "SELECT agent_id, path, scope, project_path, status FROM skills WHERE content_hash = ?1 ORDER BY path",
    )
    .and_then(|mut stmt| {
        stmt.query_map([content_hash], |r| {
            Ok(InstallLocation {
                agent_id: r.get(0)?,
                path: r.get(1)?,
                scope: r.get(2)?,
                project_path: r.get(3)?,
                status: r.get(4)?,
            })
        })?
        .collect()
    })
    .unwrap_or_default()
}

pub fn skill_by_path(conn: &Connection, path: &str) -> Result<SkillRow> {
    conn.query_row(
        "SELECT path, name, slug, description, author, version, scope, agent_id, project_path,
                status, content_hash, file_count, mtime_ms, indexed_at_ms, tracked
         FROM skills WHERE path = ?1",
        [path],
        |r| {
            Ok(SkillRow {
                path: r.get(0)?,
                name: r.get(1)?,
                slug: r.get(2)?,
                description: r.get(3)?,
                author: r.get(4)?,
                version: r.get(5)?,
                scope: r.get(6)?,
                agent_id: r.get(7)?,
                project_path: r.get(8)?,
                status: r.get(9)?,
                content_hash: r.get(10)?,
                file_count: r.get(11)?,
                mtime_ms: r.get(12)?,
                indexed_at_ms: r.get(13)?,
                tracked: r.get::<_, i32>(14)? == 1,
            })
        },
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(path.to_string()))
}

pub fn skill_hash_by_path(conn: &Connection, path: &str) -> Option<String> {
    conn.query_row("SELECT content_hash FROM skills WHERE path = ?1", [path], |r| r.get(0))
        .optional()
        .ok()
        .flatten()
}

pub fn list_broken_paths(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT path, agent_id FROM skills WHERE status = 'broken'")?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn total_skills(conn: &Connection) -> i64 {
    conn.query_row("SELECT count(DISTINCT content_hash) FROM skills", [], |r| r.get(0)).unwrap_or(0)
}

// ---------------------------------------------------------------- groups

pub fn list_groups(conn: &Connection) -> Result<Vec<GroupRow>> {
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.sort, (SELECT count(*) FROM skill_groups sg WHERE sg.group_id = g.id)
         FROM groups g ORDER BY g.sort, g.name COLLATE NOCASE",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(GroupRow { id: r.get(0)?, name: r.get(1)?, sort: r.get(2)?, skill_count: r.get(3)? })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn create_group(conn: &Connection, name: &str) -> Result<i64> {
    let name = name.trim();
    if name.is_empty() {
        return Err(Error::InvalidInput("Group name can't be empty.".into()));
    }
    if name.len() > 48 {
        return Err(Error::InvalidInput("Keep the group name under 48 characters.".into()));
    }
    let sort: i64 = conn.query_row("SELECT COALESCE(MAX(sort), 0) + 1 FROM groups", [], |r| r.get(0))?;
    let mut stmt = conn.prepare("INSERT INTO groups (name, sort) VALUES (?1, ?2) RETURNING id")?;
    let id: i64 = stmt.query_row(params![name, sort], |r| r.get(0))?;
    Ok(id)
}

pub fn rename_group(conn: &Connection, id: i64, name: &str) -> Result<()> {
    let name = name.trim();
    if name.is_empty() {
        return Err(Error::InvalidInput("Group name can't be empty.".into()));
    }
    conn.execute("UPDATE groups SET name = ?1 WHERE id = ?2", params![name, id])?;
    Ok(())
}

pub fn delete_group(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM groups WHERE id = ?1", [id])?;
    Ok(())
}

pub fn reorder_group(conn: &Connection, id: i64, sort: i64) -> Result<()> {
    conn.execute("UPDATE groups SET sort = ?1 WHERE id = ?2", params![sort, id])?;
    Ok(())
}

pub fn assign_group(conn: &Connection, group_name: &str, skill_path: &str) -> Result<()> {
    let gid: i64 = conn
        .query_row("SELECT id FROM groups WHERE name = ?1", [group_name], |r| r.get(0))
        .optional()?
        .ok_or_else(|| Error::InvalidInput("Group no longer exists.".into()))?;
    conn.execute(
        "INSERT OR IGNORE INTO skill_groups (skill_path, group_id) VALUES (?1, ?2)",
        params![skill_path, gid],
    )?;
    Ok(())
}

pub fn unassign_group(conn: &Connection, group_name: &str, skill_path: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM skill_groups WHERE skill_path = ?1
         AND group_id = (SELECT id FROM groups WHERE name = ?2)",
        params![skill_path, group_name],
    )?;
    Ok(())
}

pub fn groups_for_path(conn: &Connection, path: &str) -> Vec<String> {
    conn.prepare(
        "SELECT g.name FROM skill_groups sg JOIN groups g ON g.id = sg.group_id WHERE sg.skill_path = ?1 ORDER BY g.name",
    )
    .and_then(|mut stmt| {
        stmt.query_map([path], |r| r.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()
    })
    .unwrap_or_default()
}

// ---------------------------------------------------------------- security

pub fn save_security_scan(
    conn: &Connection,
    skill_path: &str,
    report: &SecurityReport,
) -> Result<()> {
    let findings = serde_json::to_string(&report.findings).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "INSERT INTO security_scans (skill_path, risk, findings, scripts, networks, credentials, destructive, checked_files, scanned_at_ms)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(skill_path) DO UPDATE SET
            risk=excluded.risk, findings=excluded.findings, scripts=excluded.scripts,
            networks=excluded.networks, credentials=excluded.credentials,
            destructive=excluded.destructive, checked_files=excluded.checked_files,
            scanned_at_ms=excluded.scanned_at_ms",
        params![
            skill_path, report.risk, findings, report.scripts, report.networks,
            report.credentials, report.destructive, report.checked_files, paths::now_ms()
        ],
    )?;
    Ok(())
}

pub fn security_for_path(conn: &Connection, path: &str) -> Option<SecurityReport> {
    let (risk, findings, scripts, networks, credentials, destructive, checked_files): (
        String, String, i64, i64, i64, i64, i64,
    ) = conn
        .query_row(
            "SELECT risk, findings, scripts, networks, credentials, destructive, checked_files
             FROM security_scans WHERE skill_path = ?1",
            [path],
            |r| {
                Ok((
                    r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?,
                ))
            },
        )
        .optional()
        .ok()
        .flatten()?;
    let findings: Vec<Finding> = serde_json::from_str(&findings).unwrap_or_default();
    let n: i64 = findings.len() as i64;
    Some(SecurityReport {
        risk,
        checked_files,
        scripts,
        networks,
        credentials,
        destructive,
        findings,
        header: if n == 0 { "No suspicious patterns detected.".into() } else { format!("{} suspicious patterns found.", n) },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::open;

    fn conn() -> Connection {
        let path = crate::error::test_dir("repos");
        let _ = std::fs::remove_file(&path);
        open(&path).unwrap()
    }

    fn row(path: &str, hash: &str, agent: &str, mtime: i64) -> SkillRow {
        SkillRow {
            path: path.into(),
            name: path.rsplit('/').next().unwrap_or("x").into(),
            slug: path.rsplit('/').next().unwrap_or("x").into(),
            description: Some("desc".into()),
            author: None,
            version: None,
            scope: "global".into(),
            agent_id: agent.into(),
            project_path: None,
            status: "ok".into(),
            content_hash: hash.into(),
            file_count: 1,
            mtime_ms: mtime,
            indexed_at_ms: mtime,
            tracked: true,
        }
    }

    #[test]
    fn first_launch_done_roundtrips_true_string() {
        let c = conn();
        assert!(!app_settings(&c).first_launch_done);
        set_setting(&c, "first_launch_done", "true").unwrap();
        assert!(app_settings(&c).first_launch_done);
        set_setting(&c, "first_launch_done", "1").unwrap();
        assert!(app_settings(&c).first_launch_done);
        set_setting(&c, "first_launch_done", "false").unwrap();
        assert!(!app_settings(&c).first_launch_done);
    }

    #[test]
    fn list_groups_by_hash_merges_agents() {
        let c = conn();
        upsert_skill(&c, &row("/h/.claude/skills/fd", "H1", "claude", 10)).unwrap();
        upsert_skill(&c, &row("/h/.codex/skills/fd", "H1", "codex", 11)).unwrap();
        upsert_skill(&c, &row("/h/.claude/skills/other", "H2", "claude", 12)).unwrap();
        let items = list_skills(&c, &ListSkillsReq::default()).unwrap();
        assert_eq!(items.len(), 2);
        let fd = items.iter().find(|s| s.path.contains("claude/skills/fd")).unwrap();
        assert_eq!(fd.agent_ids, vec!["claude", "codex"]);
        assert_eq!(fd.duplicate_count, 1);
    }

    #[test]
    fn fts_search_finds_by_name_and_desc() {
        let c = conn();
        upsert_skill(&c, &row("/h/.claude/skills/playwright", "H1", "claude", 1)).unwrap();
        let res = list_skills(
            &c,
            &ListSkillsReq { query: Some("playwright".into()), ..Default::default() },
        )
        .unwrap();
        assert_eq!(res.len(), 1);
        assert!(res[0].name.contains("playwright"));
    }

    #[test]
    fn modified_flow() {
        let c = conn();
        upsert_skill(&c, &row("/h/.claude/skills/x", "OLD", "claude", 1)).unwrap();
        let res = list_skills(&c, &ListSkillsReq::default()).unwrap();
        assert_eq!(res[0].status, "ok");
        // simulate external change: re-index with new hash
        let mut r = row("/h/.claude/skills/x", "OLD", "claude", 2);
        r.status = "modified".into();
        upsert_skill(&c, &r).unwrap();
        let res = list_skills(&c, &ListSkillsReq::default()).unwrap();
        assert_eq!(res[0].status, "modified");
        acknowledge_skill(&c, "/h/.claude/skills/x").unwrap();
        let res = list_skills(&c, &ListSkillsReq::default()).unwrap();
        assert_eq!(res[0].status, "ok");
    }

    #[test]
    fn groups_roundtrip() {
        let c = conn();
        create_group(&c, "Frontend").unwrap();
        create_group(&c, "Testing").unwrap();
        assign_group(&c, "Frontend", "/p").unwrap();
        assign_group(&c, "Testing", "/p").unwrap();
        let gs = list_groups(&c).unwrap();
        assert_eq!(gs.len(), 2);
        assert_eq!(gs[0].skill_count, 1);
        assert_eq!(groups_for_path(&c, "/p"), vec!["Frontend", "Testing"]);
        delete_group(&c, gs[0].id).unwrap();
        assert!(groups_for_path(&c, "/p").contains(&"Testing".to_string()));
    }

    #[test]
    fn invalid_group_input() {
        let c = conn();
        assert!(create_group(&c, "  ").is_err());
        assert!(create_group(&c, &"x".repeat(100)).is_err());
    }
}