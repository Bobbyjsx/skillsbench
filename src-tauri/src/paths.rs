use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Normalize a path for storage: expand `~`, resolve symlinks where possible,
/// strip trailing slashes. Falls back to the raw path when canonicalization fails.
pub fn normalize_path(raw: &str) -> PathBuf {
    let expanded = expand_tilde(Path::new(raw));
    expanded
        .canonicalize()
        .unwrap_or_else(|_| expanded.clone())
}

pub fn expand_tilde(path: &Path) -> PathBuf {
    let raw = path.to_string_lossy();
    if raw == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from(raw.as_ref()));
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        return dirs::home_dir()
            .map(|h| h.join(rest))
            .unwrap_or_else(|| PathBuf::from(raw.as_ref()));
    }
    path.to_path_buf()
}

/// Human-friendly relative display for a home-relative path: `/Users/x/.claude/skills/f` -> `~/.claude/skills/f`.
pub fn display_path(path: &Path) -> String {
    if let Some(home) = dirs::home_dir() {
        if let Ok(rel) = path.strip_prefix(&home) {
            return format!("~{}", rel.display());
        }
    }
    path.display().to_string()
}

/// Does `child` live at or under `parent`? Both must be absolute.
pub fn is_under(child: &Path, parent: &Path) -> bool {
    let Ok(c) = child.canonicalize() else {
        return false;
    };
    let Ok(p) = parent.canonicalize() else {
        return false;
    };
    c.starts_with(p)
}

/// Remove the common-relative base, used for `target` containment checks before
/// destructive operations.
pub fn relative_safe(child: &Path, parent: &Path) -> Option<PathBuf> {
    let c = child.canonicalize().ok()?;
    let p = parent.canonicalize().ok()?;
    c.strip_prefix(p).ok().map(|r| r.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tilde_expands() {
        let home = dirs::home_dir().unwrap();
        assert_eq!(expand_tilde(Path::new("~")), home);
        assert_eq!(expand_tilde(Path::new("~/x/y")), home.join("x/y"));
        assert_eq!(expand_tilde(Path::new("/abs/path")), PathBuf::from("/abs/path"));
    }

    #[test]
    fn under_checks() {
        let tmp = crate::error::test_dir("paths");
        std::fs::create_dir_all(tmp.join("a/b/c")).unwrap();
        std::fs::create_dir_all(tmp.join("a/bc")).unwrap();
        assert!(is_under(&tmp.join("a/b/c"), &tmp.join("a/b")));
        assert!(!is_under(&tmp.join("a/bc"), &tmp.join("a/b")));
        assert!(!is_under(&tmp.join("x"), &tmp.join("a/b")));
        assert!(!is_under(Path::new("/nonexistent"), &tmp.join("a/b")));
        std::fs::remove_dir_all(&tmp).ok();
    }
}