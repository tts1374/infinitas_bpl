use tauri::State;

use crate::models::{SourceWatcherStatePayload, StartSourceWatcherRequest};
use crate::watchers::SourceWatcherManager;

#[tauri::command]
pub fn get_source_watcher_state(
    manager: State<'_, SourceWatcherManager>,
) -> SourceWatcherStatePayload {
    manager.get_state()
}

#[tauri::command]
pub fn start_source_watcher(
    app: tauri::AppHandle,
    manager: State<'_, SourceWatcherManager>,
    request: StartSourceWatcherRequest,
) -> Result<SourceWatcherStatePayload, String> {
    manager.start(&app, request)
}

#[tauri::command]
pub fn stop_source_watcher(
    app: tauri::AppHandle,
    manager: State<'_, SourceWatcherManager>,
) -> Result<SourceWatcherStatePayload, String> {
    Ok(manager.stop(&app, "Watcher stopped from client."))
}
