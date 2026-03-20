use std::{
    env,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

use crate::models::{
    WriteE2eBinaryFileRequest, WriteE2eFileResponse, WriteE2eTextFileRequest,
};

const E2E_FLAG_ENV_KEY: &str = "INF_ARENA_E2E";

#[tauri::command]
pub fn write_e2e_text_file(request: WriteE2eTextFileRequest) -> Result<WriteE2eFileResponse, String> {
    ensure_e2e_mode_enabled()?;

    let file_path = PathBuf::from(request.file_path.trim());
    if file_path.as_os_str().is_empty() {
        return Err("file_path is required.".to_string());
    }

    ensure_parent_directory(&file_path)?;
    let normalized = request.content.replace("\r\n", "\n");
    let bytes = normalized.as_bytes();

    if request.append {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|error| format!("Failed to open e2e text file for append: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("Failed to append e2e text file: {error}"))?;
        file.flush()
            .map_err(|error| format!("Failed to flush e2e text file: {error}"))?;
    } else {
        write_text_atomic(&file_path, &normalized)?;
    }

    Ok(WriteE2eFileResponse {
        file_path: file_path.to_string_lossy().into_owned(),
        bytes_written: bytes.len(),
    })
}

#[tauri::command]
pub fn write_e2e_binary_file(
    request: WriteE2eBinaryFileRequest,
) -> Result<WriteE2eFileResponse, String> {
    ensure_e2e_mode_enabled()?;

    let file_path = PathBuf::from(request.file_path.trim());
    if file_path.as_os_str().is_empty() {
        return Err("file_path is required.".to_string());
    }

    ensure_parent_directory(&file_path)?;
    write_binary_atomic(&file_path, request.bytes.as_slice())?;

    Ok(WriteE2eFileResponse {
        file_path: file_path.to_string_lossy().into_owned(),
        bytes_written: request.bytes.len(),
    })
}

fn ensure_e2e_mode_enabled() -> Result<(), String> {
    let raw = env::var(E2E_FLAG_ENV_KEY).unwrap_or_default();
    let normalized = raw.trim().to_ascii_lowercase();
    if matches!(normalized.as_str(), "1" | "true" | "yes" | "on") {
        return Ok(());
    }

    Err("E2E file commands are disabled outside INF_ARENA_E2E mode.".to_string())
}

fn ensure_parent_directory(file_path: &Path) -> Result<(), String> {
    let Some(parent_dir) = file_path.parent() else {
        return Err("file_path must include a parent directory.".to_string());
    };
    fs::create_dir_all(parent_dir)
        .map_err(|error| format!("Failed to create e2e artifact directory: {error}"))
}

fn write_text_atomic(file_path: &Path, content: &str) -> Result<(), String> {
    let temp_path = build_temp_path(file_path);
    fs::write(&temp_path, content.as_bytes())
        .map_err(|error| format!("Failed to write temp e2e text file: {error}"))?;

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|error| format!("Failed to replace e2e text file: {error}"))?;
    }
    fs::rename(&temp_path, file_path)
        .map_err(|error| format!("Failed to finalize e2e text file: {error}"))?;
    Ok(())
}

fn write_binary_atomic(file_path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp_path = build_temp_path(file_path);
    fs::write(&temp_path, bytes)
        .map_err(|error| format!("Failed to write temp e2e binary file: {error}"))?;

    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|error| format!("Failed to replace e2e binary file: {error}"))?;
    }
    fs::rename(&temp_path, file_path)
        .map_err(|error| format!("Failed to finalize e2e binary file: {error}"))?;
    Ok(())
}

fn build_temp_path(file_path: &Path) -> PathBuf {
    let file_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("artifact");
    file_path.with_file_name(format!("{file_name}.tmp"))
}

