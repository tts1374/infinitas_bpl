use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::models::SourceType;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSourceDirectoryRequest {
    pub source: SourceType,
    pub directory_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSourceDirectoryResponse {
    pub missing_paths: Vec<String>,
}

#[tauri::command]
pub fn validate_source_directory(
    request: ValidateSourceDirectoryRequest,
) -> Result<ValidateSourceDirectoryResponse, String> {
    let base_directory = request.directory_path.trim();
    if base_directory.is_empty() {
        return Ok(ValidateSourceDirectoryResponse {
            missing_paths: vec![],
        });
    }

    let required_paths = match request.source {
        SourceType::InfDakenCounter => vec![join_path(base_directory, &["today_update.xml"])],
        SourceType::InfNotebook => vec![
            join_path(base_directory, &["export", "recent.json"]),
            join_path(base_directory, &["records", "recent.json"]),
        ],
    };

    let missing_paths = required_paths
        .into_iter()
        .filter(|path| !path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect();

    Ok(ValidateSourceDirectoryResponse { missing_paths })
}

fn join_path(base_directory: &str, segments: &[&str]) -> PathBuf {
    let mut path = Path::new(base_directory).to_path_buf();
    for segment in segments {
        path.push(segment);
    }
    path
}
