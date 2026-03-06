mod commands;
mod models;
mod parsers;
mod watchers;

use commands::{get_source_watcher_state, start_source_watcher, stop_source_watcher};
use watchers::SourceWatcherManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SourceWatcherManager::default())
        .invoke_handler(tauri::generate_handler![
            get_source_watcher_state,
            start_source_watcher,
            stop_source_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
