use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShowMatchHistoryWindowResponse {
    pub focused_existing: bool,
}
