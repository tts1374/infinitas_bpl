use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLocalResultRequest {
    pub room_id: String,
    pub created_at: Option<String>,
    pub json_text: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLocalResultResponse {
    pub file_path: String,
}
