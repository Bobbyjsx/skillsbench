use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("filesystem watch error: {0}")]
    Watch(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("path is outside of known skill roots")]
    UnsafePath,
    #[error("skill not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("{0}")]
    Other(String),
}

impl Error {
    /// Human-readable message for the UI. Never leaks raw system details.
    pub fn user_message(&self) -> String {
        match self {
            Error::NotFound(_) => "Couldn't open this skill.\n\nThe skill folder no longer exists.".into(),
            Error::InvalidPath(_) => "That path isn't a valid skill location.".into(),
            Error::UnsafePath => "That operation targets a path outside your skill folders.".into(),
            Error::InvalidInput(msg) => msg.clone(),
            Error::Watch(_) => "Couldn't watch the filesystem for changes.".into(),
            Error::Database(_) => "Something went wrong with the local database.".into(),
            Error::Io(_) => "Something went wrong reading the filesystem.".into(),
            Error::Other(msg) => msg.clone(),
        }
    }
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.user_message())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_messages_are_human() {
        let e = Error::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "ENOENT"));
        assert!(!e.user_message().contains("ENOENT"));
        assert!(Error::NotFound("/x".into()).user_message().contains("no longer exists"));
    }
}
/// Unique temp path helper for tests (process id is shared across parallel
/// test threads, so it can't be the only discriminator).
#[cfg(test)]
pub fn test_dir(tag: &str) -> std::path::PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    std::env::temp_dir().join(format!("sb-{tag}-{}-{n}", std::process::id()))
}
