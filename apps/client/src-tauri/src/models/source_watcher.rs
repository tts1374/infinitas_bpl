use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub const SOURCE_WATCHER_EVENT_NAME: &str = "source-watcher://event";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum SourceType {
    #[serde(rename = "inf_daken_counter")]
    InfDakenCounter,
    #[serde(rename = "inf-notebook")]
    InfNotebook,
}

impl SourceType {
    pub fn label(&self) -> &'static str {
        match self {
            Self::InfDakenCounter => "inf_daken_counter",
            Self::InfNotebook => "inf-notebook",
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourcePathsConfig {
    pub daken_today_update_xml: String,
    pub notebook_export_recent_json: String,
    pub notebook_records_recent_json: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSourceWatcherRequest {
    pub source: SourceType,
    pub source_paths: SourcePathsConfig,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SourceWatcherStatus {
    #[default]
    Idle,
    Running,
    Stopped,
    Error,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceWatcherStatePayload {
    pub status: SourceWatcherStatus,
    pub source: Option<SourceType>,
    pub watched_paths: Vec<String>,
    pub detail: String,
    pub last_event_at_ms: Option<u64>,
}

impl Default for SourceWatcherStatePayload {
    fn default() -> Self {
        Self {
            status: SourceWatcherStatus::Idle,
            source: None,
            watched_paths: Vec::new(),
            detail: "Watcher not started.".to_string(),
            last_event_at_ms: None,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSourceObservation {
    pub timestamp: String,
    pub play_style: Option<String>,
    pub difficulty: String,
    pub title: String,
    pub title_search_key: String,
    pub score: u32,
    pub misscount: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ParsedSourceUnresolvedCaseKind {
    ResolvedPartial,
    AmbiguousRecent,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSourceUnresolvedCase {
    pub kind: ParsedSourceUnresolvedCaseKind,
    pub timestamp: String,
    pub play_style: String,
    pub difficulty: String,
    pub title: String,
    pub title_search_key: Option<String>,
    pub score: Option<u32>,
    pub misscount: Option<u32>,
    pub recent_candidate_count: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSourceChange {
    pub source: SourceType,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub observations: Vec<ParsedSourceObservation>,
    pub unresolved_cases: Vec<ParsedSourceUnresolvedCase>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SourceWatcherEventKind {
    Started,
    Stopped,
    FileChanged,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceWatcherEventPayload {
    pub kind: SourceWatcherEventKind,
    pub state: SourceWatcherStatePayload,
    pub file_path: Option<String>,
    pub detail: String,
    pub occurred_at_ms: u64,
    pub parser_output: Option<ParsedSourceChange>,
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(u64::MAX))
        .unwrap_or(0)
}
