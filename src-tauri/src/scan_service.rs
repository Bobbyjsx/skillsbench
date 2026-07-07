//! Scan orchestration: initial background scan + rescan triggers. Runs off the
//! main thread and emits events; never blocks UI startup.

use crate::agents::{self, RootKind, ScanRoot};
use crate::error::Result;
use crate::scan::ScanOutcome;
use crate::state::AppState;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanEvent {
    pub phase: String,
    pub found: i64,
    pub total: i64,
    pub outcome: Option<ScanOutcomeView>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOutcomeView {
    pub added: usize,
    pub updated: usize,
    pub modified: usize,
    pub healed: usize,
    pub broken: usize,
    pub total: usize,
}

impl From<&ScanOutcome> for ScanOutcomeView {
    fn from(o: &ScanOutcome) -> Self {
        Self {
            added: o.added,
            updated: o.updated,
            modified: o.modified,
            healed: o.healed,
            broken: o.broken,
            total: o.total,
        }
    }
}

pub fn emit(app: &tauri::AppHandle, event: &str, payload: impl Serialize + Clone) {
    app.emit(event, payload).ok();
}

/// Where a scan pass runs. `roots` are known, existing roots only.
pub fn run_scan_pass(
    state: &AppState,
    app: &tauri::AppHandle,
    promise_found: usize,
) -> Result<ScanOutcome> {
    let roots = roots_from_db(state);
    let scan_running = state.scan_running.clone();
    let first_done = state.first_scan_done.clone();

    let mut outcome = ScanOutcome::default();
    if scan_running.swap(true, Ordering::SeqCst) {
        return Ok(outcome);
    }

    let result = (|| -> Result<ScanOutcome> {
        let mut progress = |found: usize, _total: usize| {
            emit(
                app,
                "scan:progress",
                ScanEvent {
                    phase: "indexing".into(),
                    found: found as i64,
                    total: 0,
                    outcome: None,
                },
            );
        };

        let conn = state.db.lock().unwrap_or_else(|p| p.into_inner());
        let mut o = crate::scan::scan_roots(&conn, &roots, &mut progress)?;
        let broken_count = crate::scan::reconcile_missing(&conn, &roots)?.len();
        o.broken = broken_count;
        outcome = o;
        Ok(outcome.clone())
    })();

    scan_running.store(false, Ordering::SeqCst);
    first_done.store(true, Ordering::SeqCst);
    let _ = promise_found;

    let ev = ScanEvent {
        phase: "done".into(),
        found: outcome.total as i64,
        total: 0,
        outcome: Some(ScanOutcomeView::from(&outcome)),
    };
    emit(app, "scan:done", ev.clone());
    emit(app, "skills:changed", ev);

    match result {
        Ok(o) => Ok(o),
        Err(e) => {
            emit(
                app,
                "app:error",
                serde_json::json!({ "message": e.user_message(), "kind": "scan" }),
            );
            Err(e)
        }
    }
}

/// Full rescan from a watcher event or the Command palette.
pub fn rescan_all(state: &AppState, app: &tauri::AppHandle) -> Result<ScanOutcome> {
    run_scan_pass(state, app, 0)
}

/// Index only skill directories that were just created/installed, then notify
/// the UI. Keeps mutations like "Create skill" sub-millisecond instead of
/// walking every watched root on the main thread.
pub fn index_dirs(
    state: &AppState,
    app: &tauri::AppHandle,
    skills: Vec<(PathBuf, String, Option<String>)>,
) -> Result<ScanOutcome> {
    let roots: Vec<ScanRoot> = skills
        .into_iter()
        .map(|(dir, agent, project)| ScanRoot {
            kind: RootKind::Targeted { agent, project },
            dir,
            skill_subdirs: vec![],
            label: "targeted".into(),
            key: "t".into(),
        })
        .collect();
    if roots.is_empty() {
        return Ok(ScanOutcome::default());
    }
    let outcome = {
        let conn = state.db.lock().unwrap_or_else(|p| p.into_inner());
        crate::scan::scan_roots(&conn, &roots, &mut |_, _| {})?
    };
    emit(
        app,
        "skills:changed",
        serde_json::json!({ "phase": "done", "targeted": true }),
    );
    Ok(outcome)
}

/// Initial background scan at startup. Never blocks the first UI paint.
pub fn start_background_scan(state: Arc<AppState>, app: tauri::AppHandle) {
    std::thread::Builder::new()
        .name("skillbench-scan".into())
        .spawn(move || {
            let _ = run_scan_pass(&state, &app, 0);
        })
        .ok();
}

/// Compute watch roots from the current database state.
pub fn roots_from_db(state: &AppState) -> Vec<ScanRoot> {
    state.with_db(|conn| agents::all_scan_roots(conn))
}