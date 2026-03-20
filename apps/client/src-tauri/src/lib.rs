mod commands;
mod models;
mod parsers;
mod watchers;

use commands::{
    get_source_watcher_state, pick_directory, start_source_watcher, stop_source_watcher,
    validate_source_directory, write_e2e_binary_file, write_e2e_text_file,
};
use commands::save_local_result_json;
use watchers::SourceWatcherManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SourceWatcherManager::default())
        .invoke_handler(tauri::generate_handler![
            get_source_watcher_state,
            pick_directory,
            save_local_result_json,
            start_source_watcher,
            stop_source_watcher,
            validate_source_directory,
            write_e2e_binary_file,
            write_e2e_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
