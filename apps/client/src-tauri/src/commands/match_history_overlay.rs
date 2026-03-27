use std::{
    env,
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

use crate::models::{SaveMatchHistoryOverlayRequest, SaveMatchHistoryOverlayResponse};

const OBS_DIRECTORY_NAME: &str = "obs";
const MATCH_HISTORY_JSON_FILE_NAME: &str = "match_history.json";
const MATCH_HISTORY_HTML_FILE_NAME: &str = "match_history.html";
const MATCH_HISTORY_CSS_FILE_NAME: &str = "match_history.css";
const MATCH_HISTORY_JS_FILE_NAME: &str = "match_history.js";
const INSTANCE_ID_ENV_KEY: &str = "INFINITAS_INSTANCE_ID";

const MATCH_HISTORY_HTML_TEMPLATE: &str = include_str!("../../assets/obs/match_history.html");
const MATCH_HISTORY_CSS_TEMPLATE: &str = include_str!("../../assets/obs/match_history.css");
const MATCH_HISTORY_JS_TEMPLATE: &str = include_str!("../../assets/obs/match_history.js");

#[tauri::command]
pub fn save_match_history_overlay(
    app: AppHandle,
    request: SaveMatchHistoryOverlayRequest,
) -> Result<SaveMatchHistoryOverlayResponse, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;

    let obs_dir = resolve_obs_directory(&base_dir, request.output_directory.as_deref());
    fs::create_dir_all(&obs_dir)
        .map_err(|error| format!("Failed to create obs directory: {error}"))?;

    let json_file_path = obs_dir.join(MATCH_HISTORY_JSON_FILE_NAME);
    let html_file_path = obs_dir.join(MATCH_HISTORY_HTML_FILE_NAME);
    let css_file_path = obs_dir.join(MATCH_HISTORY_CSS_FILE_NAME);
    let js_file_path = obs_dir.join(MATCH_HISTORY_JS_FILE_NAME);

    write_text_atomic(&json_file_path, &request.json_text)?;
    write_text_atomic(&html_file_path, MATCH_HISTORY_HTML_TEMPLATE)?;
    write_text_atomic(&css_file_path, MATCH_HISTORY_CSS_TEMPLATE)?;
    write_text_atomic(&js_file_path, MATCH_HISTORY_JS_TEMPLATE)?;

    Ok(SaveMatchHistoryOverlayResponse {
        json_file_path: json_file_path.to_string_lossy().into_owned(),
        html_file_path: html_file_path.to_string_lossy().into_owned(),
        css_file_path: css_file_path.to_string_lossy().into_owned(),
        js_file_path: js_file_path.to_string_lossy().into_owned(),
    })
}

fn build_obs_directory(base_dir: &Path) -> PathBuf {
    let obs_dir = base_dir.join(OBS_DIRECTORY_NAME);
    let Ok(instance_id) = env::var(INSTANCE_ID_ENV_KEY) else {
        return obs_dir;
    };

    let trimmed = instance_id.trim();
    if trimmed.is_empty() {
        return obs_dir;
    }

    obs_dir.join(sanitize_file_component(trimmed))
}

fn resolve_obs_directory(base_dir: &Path, configured_output_directory: Option<&str>) -> PathBuf {
    let Some(raw_directory) = configured_output_directory else {
        return build_obs_directory(base_dir);
    };

    let trimmed = raw_directory.trim();
    if trimmed.is_empty() {
        return build_obs_directory(base_dir);
    }

    PathBuf::from(trimmed)
}

fn sanitize_file_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| match character {
            'a'..='z' | 'A'..='Z' | '0'..='9' => character,
            _ => '-',
        })
        .collect();

    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "obs".to_string()
    } else {
        trimmed.to_string()
    }
}

fn write_text_atomic(file_path: &Path, raw_text: &str) -> Result<(), String> {
    let temp_path = build_temp_path(file_path);
    let normalized = raw_text.replace("\r\n", "\n");

    fs::write(&temp_path, normalized.as_bytes())
        .map_err(|error| format!("Failed to write temp match history file: {error}"))?;

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|error| format!("Failed to replace match history file: {error}"))?;
    }

    fs::rename(&temp_path, file_path)
        .map_err(|error| format!("Failed to finalize match history file: {error}"))?;

    Ok(())
}

fn build_temp_path(file_path: &Path) -> PathBuf {
    let file_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("match_history.tmp");

    file_path.with_file_name(format!("{file_name}.tmp"))
}
