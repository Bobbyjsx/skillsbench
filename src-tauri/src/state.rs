//! Shared application state handed to Tauri commands.

use rusqlite::Connection;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub scan_running: Arc<AtomicBool>,
    pub first_scan_done: Arc<AtomicBool>,
}

impl AppState {
    pub fn new(db: Connection) -> Self {
        Self {
            db: Arc::new(Mutex::new(db)),
            scan_running: Arc::new(AtomicBool::new(false)),
            first_scan_done: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn with_db<T>(&self, f: impl FnOnce(&Connection) -> T) -> T {
        let guard = self.db.lock().unwrap_or_else(|p| p.into_inner());
        f(&guard)
    }
}

pub type AppHandleState = Arc<AppState>;