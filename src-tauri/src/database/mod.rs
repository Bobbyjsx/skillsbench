pub mod repos;

use rusqlite::Connection;
use std::path::Path;

pub const MIGRATIONS: &[&str] = &[
    // V1 — core schema
    r#"
    CREATE TABLE IF NOT EXISTS skills (
        id            INTEGER PRIMARY KEY,
        path          TEXT NOT NULL UNIQUE,
        name          TEXT NOT NULL,
        slug          TEXT NOT NULL,
        description   TEXT,
        author        TEXT,
        version       TEXT,
        scope         TEXT NOT NULL DEFAULT 'global',
        agent_id      TEXT NOT NULL,
        project_path  TEXT,
        status        TEXT NOT NULL DEFAULT 'ok',
        content_hash  TEXT NOT NULL,
        skill_md_hash TEXT,
        file_count    INTEGER NOT NULL DEFAULT 0,
        mtime_ms      INTEGER NOT NULL DEFAULT 0,
        indexed_at_ms INTEGER NOT NULL DEFAULT 0,
        tracked       INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_skills_hash  ON skills(content_hash);
    CREATE INDEX IF NOT EXISTS idx_skills_agent ON skills(agent_id);
    CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);

    CREATE TABLE IF NOT EXISTS agent_detection (
        agent_id      TEXT PRIMARY KEY,
        detected      INTEGER NOT NULL DEFAULT 0,
        version       TEXT,
        binary        INTEGER NOT NULL DEFAULT 0,
        checked_at_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY,
        path        TEXT NOT NULL UNIQUE,
        added_at_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS groups (
        id    INTEGER PRIMARY KEY,
        name  TEXT NOT NULL UNIQUE,
        sort  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS skill_groups (
        skill_path TEXT NOT NULL,
        group_id   INTEGER NOT NULL,
        PRIMARY KEY (skill_path, group_id),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collections (
        id   INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS collection_skills (
        collection_id INTEGER NOT NULL,
        skill_path    TEXT NOT NULL,
        sort          INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (collection_id, skill_path),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sources (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        kind       TEXT NOT NULL,
        config     TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS security_scans (
        skill_path     TEXT NOT NULL UNIQUE,
        risk           TEXT NOT NULL,
        findings       TEXT NOT NULL DEFAULT '[]',
        scripts        INTEGER NOT NULL DEFAULT 0,
        networks       INTEGER NOT NULL DEFAULT 0,
        credentials    INTEGER NOT NULL DEFAULT 0,
        destructive    INTEGER NOT NULL DEFAULT 0,
        checked_files  INTEGER NOT NULL DEFAULT 0,
        scanned_at_ms  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name, description, slug, author,
        content='skills', content_rowid='id',
        tokenize='unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS skills_fts_ai AFTER INSERT ON skills BEGIN
        INSERT INTO skills_fts(rowid, name, description, slug, author)
        VALUES (new.id, new.name, new.description, new.slug, new.author);
    END;
    CREATE TRIGGER IF NOT EXISTS skills_fts_ad AFTER DELETE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, description, slug, author)
        VALUES ('delete', old.id, old.name, old.description, old.slug, old.author);
    END;
    CREATE TRIGGER IF NOT EXISTS skills_fts_au AFTER UPDATE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, description, slug, author)
        VALUES ('delete', old.id, old.name, old.description, old.slug, old.author);
        INSERT INTO skills_fts(rowid, name, description, slug, author)
        VALUES (new.id, new.name, new.description, new.slug, new.author);
    END;
    "#,
];

/// Schema version stored in `settings` under `schema_version`.
pub fn open(db_path: &Path) -> rusqlite::Result<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn
        .query_row(
            "SELECT COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'schema_version'), 0)",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let v = i as i64 + 1;
        if v <= version {
            continue;
        }
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('schema_version', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [v.to_string()],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let path = crate::error::test_dir("db");
        let _ = std::fs::remove_file(&path);
        let conn = open(&path).expect("open");
        conn
    }

    #[test]
    fn migrations_run_and_are_idempotent() {
        let conn = test_conn();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        let names: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger') AND name LIKE 'skills%'")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(names.contains(&"skills".to_string()));
        assert!(names.contains(&"skills_fts".to_string()));
        assert!(names.iter().any(|n| n.contains("_au")));
    }

    #[test]
    fn fts_triggers_index_instantly() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO skills (path,name,slug,description,agent_id,content_hash)
             VALUES ('/x/a','frontend-design','frontend-design','build UI','claude','h1')",
            [],
        )
        .unwrap();
        let hit: i64 = conn
            .query_row(
                "SELECT count(*) FROM skills_fts WHERE skills_fts MATCH 'design'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hit, 1);
    }
}