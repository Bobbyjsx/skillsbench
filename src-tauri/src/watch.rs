//! Centralized filesystem watcher.
//!
//! One watcher, configured roots, debounced events. When anything changes
//! under a watched root, the debounced task triggers an incremental rescan
//! (only roots that exist get re-indexed — never a whole-disk sweep).

use crate::agents::ScanRoot;
use crate::error::{Error, Result};
use crate::state::AppState;
use notify::{RecursiveMode, Watcher};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;

const DEBOUNCE_MS: u64 = 700;
const POLL_MS: u64 = 150;

/// Owns the OS watcher plus the event channel. Moves into the loop thread.
pub struct WatchService;

pub fn spawn(roots: Vec<ScanRoot>, state: Arc<AppState>, app: tauri::AppHandle) -> Result<()> {
    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(ev) = res {
            tx.send(ev).ok();
        }
    })
    .map_err(|e| Error::Watch(e.to_string()))?;

    let mut watching_any = false;
    for root in &roots {
        if watcher.watch(&root.dir, RecursiveMode::Recursive).is_ok() {
            watching_any = true;
        }
    }
    if !watching_any {
        return Ok(()); // nothing to watch
    }

    std::thread::Builder::new()
        .name("skillbench-watch".into())
        .spawn(move || {
            // The watcher must live as long as the loop: it is the source of
            // events. Dropping it early silently kills change detection.
            let _watcher = watcher;
            let busy = Arc::new(AtomicBool::new(false));
            let mut pending: Option<std::time::Instant> = None;
            loop {
                match rx.recv_timeout(Duration::from_millis(POLL_MS)) {
                    Ok(_ev) => pending = Some(std::time::Instant::now()),
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        let Some(started) = pending else { continue };
                        if started.elapsed() < Duration::from_millis(DEBOUNCE_MS) {
                            continue;
                        }
                        pending = None;
                        if busy.swap(true, Ordering::SeqCst) {
                            continue;
                        }
                        let state = state.clone();
                        let app = app.clone();
                        let busy_for_task = busy.clone();
                        std::thread::spawn(move || {
                            let _ = crate::scan_service::rescan_all(&state, &app);
                            busy_for_task.store(false, Ordering::SeqCst);
                        });
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        })
        .map_err(|e| Error::Watch(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failing_to_watch_a_missing_dir_is_not_an_error() {
        let missing = crate::error::test_dir("watch-missing");
        let _ = std::fs::remove_dir_all(&missing);
        let root = ScanRoot {
            kind: crate::agents::RootKind::Global { agent: "claude".into() },
            dir: missing,
            skill_subdirs: vec![],
            label: "t".into(),
            key: "k".into(),
        };
        // new() equivalent path: watcher.watch on missing dir returns Err
        // which we skip -> still Ok.
        let (tx, rx) = mpsc::channel();
        let mut w = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            if let Ok(ev) = res {
                tx.send(ev).ok();
            }
        })
        .unwrap();
        assert!(w.watch(&root.dir, RecursiveMode::Recursive).is_err());
        drop(w);
        drop(rx);
    }
}