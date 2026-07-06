use sha2::{Digest, Sha256};
use std::path::Path;
use walkdir::WalkDir;

/// Hash a single file's bytes as hex.
pub fn hash_bytes(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

/// Hash the entire contents of a skill directory: every file's relative path +
/// bytes, so `~/.claude/skills/x` and `~/.codex/skills/x` with identical
/// contents produce identical hashes (duplicate detection). `.git` is skipped.
pub fn hash_dir(dir: &Path) -> std::io::Result<(String, u64)> {
    let mut h = Sha256::new();
    let mut count: u64 = 0;
    for entry in WalkDir::new(dir)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !matches!(name.as_ref(), ".git" | "node_modules" | ".DS_Store")
        })
    {
        let entry = entry.map_err(|e| e.into_io_error().unwrap_or_else(|| std::io::Error::other("walk failed")))?;
        if entry.file_type().is_symlink() || !entry.file_type().is_file() {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(dir)
            .unwrap_or(entry.path())
            .to_string_lossy();
        let bytes = std::fs::read(entry.path())?;
        h.update(rel.as_bytes());
        h.update(b"\0");
        h.update(&bytes);
        h.update(b"\0");
        count += 1;
    }
    Ok((hex::encode(h.finalize()), count))
}

/// Lightweight summary of one skill directory.
pub struct DirSummary {
    pub content_hash: String,
    pub file_count: u64,
    pub skill_md_hash: Option<String>,
    pub skill_md: Option<String>,
    pub mtime_ms: i64,
}

/// Scan a skill directory: content hash, SKILL.md content, newest mtime.
pub fn summarize_dir(dir: &Path) -> std::io::Result<DirSummary> {
    let (content_hash, file_count) = hash_dir(dir)?;
    let md_path = dir.join("SKILL.md");
    let (skill_md_hash, skill_md) = match std::fs::read(&md_path) {
        Ok(bytes) => {
            let hex_hash = hash_bytes(&bytes);
            let text = String::from_utf8_lossy(&bytes).into_owned();
            (Some(hex_hash), Some(text))
        }
        Err(_) => (None, None),
    };
    let mtime_ms = newest_mtime(dir);
    Ok(DirSummary {
        content_hash,
        file_count,
        skill_md_hash,
        skill_md,
        mtime_ms,
    })
}

fn newest_mtime(dir: &Path) -> i64 {
    let mut newest = 0i64;
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(md) = entry.metadata() {
                if let Ok(t) = md.modified() {
                    if let Ok(d) = t.duration_since(std::time::UNIX_EPOCH) {
                        newest = newest.max(d.as_millis() as i64);
                    }
                }
            }
        }
    }
    newest
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_dirs_hash_equally() {
        let dir = crate::error::test_dir("hash");
        let a = dir.join("a");
        let b = dir.join("b");
        std::fs::create_dir_all(a.join("sub")).unwrap();
        std::fs::create_dir_all(b.join("sub")).unwrap();
        std::fs::write(a.join("SKILL.md"), "x").unwrap();
        std::fs::write(b.join("SKILL.md"), "x").unwrap();
        std::fs::write(a.join("sub/run.sh"), "echo hi").unwrap();
        std::fs::write(b.join("sub/run.sh"), "echo hi").unwrap();
        let (ha, _) = hash_dir(&a).unwrap();
        let (hb, _) = hash_dir(&b).unwrap();
        assert_eq!(ha, hb, "same content must hash identically");
        std::fs::write(b.join("sub/run.sh"), "echo bye").unwrap();
        let (hb2, _) = hash_dir(&b).unwrap();
        assert_ne!(ha, hb2);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}