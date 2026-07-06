pub mod agents;
pub mod commands;
pub mod database;
pub mod error;
pub mod frontmatter;
pub mod hash;
pub mod models;
pub mod paths;
pub mod scan;
pub mod scan_service;
pub mod security;
pub mod state;
pub mod watch;

use state::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

/// Resolve the database file inside the platform app-data directory.
fn db_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("skillbench"));
    dir.join("skillbench.sqlite3")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_path = db_path(&app.handle());
            let conn = crate::database::open(&db_path)
                .map_err(|e| std::io::Error::other(format!("database: {e}")))?;
            let state = Arc::new(AppState::new(conn));

            // Detection persists into the DB so the UI has it before any scan.
            // Done off the main thread: some agent CLIs have slow cold starts
            // and would otherwise delay the first window paint.
            let state_d = state.clone();
            tauri::async_runtime::spawn_blocking(move || {
                state_d.with_db(|c| {
                    crate::agents::detect_all(c);
                });
            });

            app.manage(state.clone());

            // First scan is background; the UI paints immediately from the DB.
            crate::scan_service::start_background_scan(state.clone(), app.handle().clone());

            // Centralized watcher after the first index pass has run. Roots are
            // re-derived by the watcher loop on every rescan.
            let state_w = state.clone();
            let app_w = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let roots = crate::scan_service::roots_from_db(&state_w);
                let _ = crate::watch::spawn(roots, state_w, app_w);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::log_line,
            commands::list_skills,
            commands::counts,
            commands::get_skill_detail,
            commands::acknowledge_skill,
            commands::forget_skill,
            commands::create_skill,
            commands::read_skill_file,
            commands::read_skill_file_data,
            commands::write_skill_file,
            commands::install_skill,
            commands::uninstall_skills,
            commands::redetect_agents,
            commands::add_project_root,
            commands::remove_project_root,
            commands::list_groups,
            commands::create_group,
            commands::rename_group,
            commands::delete_group,
            commands::assign_group,
            commands::unassign_group,
            commands::set_setting,
            commands::set_ui,
            commands::scan_now,
            commands::market_search,
            commands::market_catalog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Skillbench");
}