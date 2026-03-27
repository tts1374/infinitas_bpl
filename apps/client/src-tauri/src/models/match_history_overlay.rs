use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMatchHistoryOverlayRequest {
    pub json_text: String,
    pub output_directory: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMatchHistoryOverlayResponse {
    pub json_file_path: String,
    pub html_file_path: String,
    pub css_file_path: String,
    pub js_file_path: String,
}
