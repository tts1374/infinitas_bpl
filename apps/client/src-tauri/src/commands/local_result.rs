use std::{
    env,
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

use crate::models::{SaveLocalResultRequest, SaveLocalResultResponse};

const RESULT_DIRECTORY_NAME: &str = "room-results";
const INSTANCE_ID_ENV_KEY: &str = "INFINITAS_INSTANCE_ID";

#[tauri::command]
pub fn save_local_result_json(
    app: AppHandle,
    request: SaveLocalResultRequest,
) -> Result<SaveLocalResultResponse, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Failed to resolve app local data directory: {error}"))?;

    let result_dir = build_result_directory(&base_dir);
    fs::create_dir_all(&result_dir)
        .map_err(|error| format!("Failed to create result directory: {error}"))?;

    let file_path = result_dir.join(build_result_file_name(&request));
    write_json_atomic(&file_path, &request.json_text)?;

    Ok(SaveLocalResultResponse {
        file_path: file_path.to_string_lossy().into_owned(),
    })
}

fn build_result_directory(base_dir: &Path) -> PathBuf {
    let result_dir = base_dir.join(RESULT_DIRECTORY_NAME);
    let Ok(instance_id) = env::var(INSTANCE_ID_ENV_KEY) else {
        return result_dir;
    };

    let trimmed = instance_id.trim();
    if trimmed.is_empty() {
        return result_dir;
    }

    result_dir.join(sanitize_file_component(trimmed))
}

fn build_result_file_name(request: &SaveLocalResultRequest) -> String {
    let room_id = sanitize_file_component(&request.room_id);
    let created_at = sanitize_file_component(
        request
            .created_at
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("unspecified"),
    );

    format!("{created_at}-{room_id}.json")
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
        "result".to_string()
    } else {
        trimmed.to_string()
    }
}

fn write_json_atomic(file_path: &Path, json_text: &str) -> Result<(), String> {
    let temp_path = build_temp_path(file_path);
    let normalized = json_text.replace("\r\n", "\n");

    fs::write(&temp_path, normalized.as_bytes())
        .map_err(|error| format!("Failed to write temp result file: {error}"))?;

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|error| format!("Failed to replace result file: {error}"))?;
    }

    fs::rename(&temp_path, file_path)
        .map_err(|error| format!("Failed to finalize result file: {error}"))?;

    Ok(())
}

fn build_temp_path(file_path: &Path) -> PathBuf {
    let file_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("result.json");

    file_path.with_file_name(format!("{file_name}.tmp"))
}
