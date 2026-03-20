use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteE2eTextFileRequest {
    pub file_path: String,
    pub content: String,
    #[serde(default)]
    pub append: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteE2eBinaryFileRequest {
    pub file_path: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteE2eFileResponse {
    pub file_path: String,
    pub bytes_written: usize,
}

