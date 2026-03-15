use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

use serde::Deserialize;
use serde_json::Value;

use crate::{
    models::{
        ParsedSourceChange, ParsedSourceObservation, ParsedSourceUnresolvedCase,
        ParsedSourceUnresolvedCaseKind, SourcePathsConfig, SourceType,
    },
    parsers::{ParserInput, SourceParser},
};

const SUMMARY_DEBOUNCE_MS: u64 = 120;
const SUMMARY_PARSE_RETRY_COUNT: usize = 2;
const SUMMARY_PARSE_RETRY_DELAY_MS: u64 = 80;
const RECENT_PARSE_RETRY_COUNT: usize = 2;
const RECENT_PARSE_RETRY_DELAY_MS: u64 = 80;
const RECENT_MISSING_RETRY_COUNT: usize = 2;
const RECENT_MISSING_RETRY_DELAY_MS: u64 = 120;

#[derive(Clone, Debug, Deserialize)]
struct NotebookExportRecentFile {
    #[serde(default)]
    list: Vec<NotebookRecentEntry>,
}

#[derive(Clone, Debug, Deserialize)]
struct NotebookRecentEntry {
    timestamp: String,
    difficulty: String,
    music: String,
    score: i64,
    misscount: i64,
}

#[derive(Clone, Debug, Deserialize)]
struct WorkerChartMasterSnapshot {
    #[serde(default)]
    charts: Vec<WorkerChartMasterChart>,
    #[serde(default)]
    aliases: HashMap<String, String>,
}

#[derive(Clone, Debug, Deserialize)]
struct WorkerChartMasterChart {
    play_style: String,
    difficulty: String,
    title: String,
    title_search_key: String,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct SummaryChartKey {
    musicname: String,
    play_style: String,
    difficulty: String,
}

#[derive(Clone, Debug)]
struct SummaryLatestRecord {
    musicname: String,
    play_style: String,
    difficulty: String,
    latest_timestamp: String,
    score: Option<u32>,
    misscount: Option<u32>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct SummaryLatestValue {
    latest_timestamp: String,
    score: Option<u32>,
    misscount: Option<u32>,
}

#[derive(Clone, Debug, Default)]
struct SummarySnapshot {
    latest_by_chart: HashMap<SummaryChartKey, SummaryLatestValue>,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct ChartIndexKey {
    play_style: String,
    difficulty: String,
    title_search_key: String,
}

#[derive(Clone, Debug, Default)]
struct AliasCatalog {
    alias_to_title_search_key: HashMap<String, String>,
    chart_index: HashSet<ChartIndexKey>,
}

impl AliasCatalog {
    fn resolve_alias_exact(&self, musicname: &str) -> Option<&String> {
        self.alias_to_title_search_key.get(musicname.trim())
    }

    fn has_chart(&self, play_style: &str, difficulty: &str, title_search_key: &str) -> bool {
        self.chart_index.contains(&ChartIndexKey {
            play_style: play_style.to_string(),
            difficulty: difficulty.to_string(),
            title_search_key: title_search_key.to_string(),
        })
    }
}

#[derive(Clone, Debug)]
struct RecentIndexedRecord {
    music: String,
    difficulty_raw: String,
    difficulty_normalized: Option<String>,
    score: u32,
    misscount: u32,
}

#[derive(Clone, Debug, Default)]
struct RecentTimestampIndex {
    by_timestamp: HashMap<String, Vec<RecentIndexedRecord>>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum NotebookResolutionStatus {
    ResolvedFull,
    ResolvedPartial,
    UnresolvedAlias,
    AmbiguousRecent,
}

#[derive(Clone, Debug)]
struct NotebookResolutionResult {
    status: NotebookResolutionStatus,
    summary: SummaryLatestRecord,
    title_search_key: Option<String>,
    recent: Option<RecentIndexedRecord>,
    recent_candidate_count: Option<u32>,
    warnings: Vec<String>,
}

pub struct NotebookParser {
    summary_path: PathBuf,
    summary_path_key: String,
    recent_path: PathBuf,
    last_summary_snapshot: SummarySnapshot,
    alias_catalog: AliasCatalog,
}

impl NotebookParser {
    pub fn new(source_paths: &SourcePathsConfig) -> Self {
        Self::new_internal(source_paths, load_alias_catalog())
    }

    #[cfg(test)]
    fn new_with_catalog(source_paths: &SourcePathsConfig, alias_catalog: AliasCatalog) -> Self {
        Self::new_internal(source_paths, alias_catalog)
    }

    fn new_internal(source_paths: &SourcePathsConfig, alias_catalog: AliasCatalog) -> Self {
        let summary_path = PathBuf::from(source_paths.notebook_records_recent_json.trim());
        let recent_path = PathBuf::from(source_paths.notebook_export_recent_json.trim());
        let last_summary_snapshot = read_summary_snapshot_once(&summary_path)
            .unwrap_or_else(|_| SummarySnapshot::default());
        Self {
            summary_path_key: path_key(&summary_path),
            summary_path,
            recent_path,
            last_summary_snapshot,
            alias_catalog,
        }
    }
}

impl SourceParser for NotebookParser {
    fn parse(&mut self, input: &ParserInput) -> Result<Option<ParsedSourceChange>, String> {
        let metadata = fs::metadata(&input.changed_path)
            .map_err(|error| format!("Failed to read {:?}: {error}", input.changed_path))?;
        let changed_path_key = path_key(&input.changed_path);
        if changed_path_key != self.summary_path_key {
            return Ok(Some(ParsedSourceChange {
                source: SourceType::InfNotebook,
                file_path: input.changed_path.to_string_lossy().into_owned(),
                file_size_bytes: metadata.len(),
                observations: Vec::new(),
                unresolved_cases: Vec::new(),
            }));
        }

        thread::sleep(Duration::from_millis(SUMMARY_DEBOUNCE_MS));
        let Some(current_summary_snapshot) = read_summary_snapshot_with_retry(&self.summary_path)?
        else {
            return Ok(None);
        };

        let changed_latest_entries =
            extract_changed_latest_entries(&self.last_summary_snapshot, &current_summary_snapshot);
        self.last_summary_snapshot = current_summary_snapshot;
        if changed_latest_entries.is_empty() {
            return Ok(Some(ParsedSourceChange {
                source: SourceType::InfNotebook,
                file_path: self.summary_path.to_string_lossy().into_owned(),
                file_size_bytes: metadata.len(),
                observations: Vec::new(),
                unresolved_cases: Vec::new(),
            }));
        }

        let mut recent_index = read_recent_index_with_retry(&self.recent_path)?;
        let resolution_results = resolve_latest_entries_with_recent_retry(
            &changed_latest_entries,
            &self.alias_catalog,
            &self.recent_path,
            &mut recent_index,
        )?;
        log_resolution_results(&resolution_results);

        let observations = resolution_results
            .iter()
            .filter_map(resolution_result_to_observation)
            .collect::<Vec<_>>();
        let unresolved_cases = resolution_results
            .iter()
            .filter_map(resolution_result_to_unresolved_case)
            .collect::<Vec<_>>();

        Ok(Some(ParsedSourceChange {
            source: SourceType::InfNotebook,
            file_path: self.summary_path.to_string_lossy().into_owned(),
            file_size_bytes: metadata.len(),
            observations,
            unresolved_cases,
        }))
    }
}

fn read_summary_snapshot_once(path: &Path) -> Result<SummarySnapshot, String> {
    if !path.exists() {
        return Ok(SummarySnapshot::default());
    }
    let raw_json = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;
    parse_summary_snapshot(&raw_json)
}

fn read_summary_snapshot_with_retry(path: &Path) -> Result<Option<SummarySnapshot>, String> {
    if !path.exists() {
        return Err(format!(
            "Failed to read {}: file does not exist.",
            path.to_string_lossy()
        ));
    }
    for attempt in 0..=SUMMARY_PARSE_RETRY_COUNT {
        let raw_json = fs::read_to_string(path)
            .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;
        match parse_summary_snapshot(&raw_json) {
            Ok(snapshot) => return Ok(Some(snapshot)),
            Err(error) => {
                if attempt < SUMMARY_PARSE_RETRY_COUNT {
                    thread::sleep(Duration::from_millis(SUMMARY_PARSE_RETRY_DELAY_MS));
                    continue;
                }
                eprintln!(
                    "inf-notebook: ignored summary update because records/summary.json is not readable yet ({}): {error}",
                    path.to_string_lossy()
                );
                return Ok(None);
            }
        }
    }
    Ok(None)
}

fn parse_summary_snapshot(raw_json: &str) -> Result<SummarySnapshot, String> {
    let root: Value = serde_json::from_str(raw_json)
        .map_err(|error| format!("Failed to parse summary.json payload: {error}"))?;
    let Some(musics) = root.get("musics").and_then(Value::as_object) else {
        return Err("summary.json is missing object field 'musics'.".to_string());
    };

    let mut latest_by_chart = HashMap::new();
    for (musicname_raw, playtype_value) in musics {
        let musicname = musicname_raw.trim();
        if musicname.is_empty() {
            continue;
        }
        let Some(playtypes) = playtype_value.as_object() else {
            continue;
        };
        for (playtype_raw, difficulty_value) in playtypes {
            let Some(play_style) = normalize_play_style(playtype_raw) else {
                continue;
            };
            let Some(difficulties) = difficulty_value.as_object() else {
                continue;
            };
            for (difficulty_raw, chart_record_value) in difficulties {
                let Some(difficulty) = normalize_chart_difficulty(difficulty_raw) else {
                    continue;
                };
                let Some(latest_value) = extract_latest_value(chart_record_value) else {
                    continue;
                };
                latest_by_chart.insert(
                    SummaryChartKey {
                        musicname: musicname.to_string(),
                        play_style: play_style.clone(),
                        difficulty,
                    },
                    latest_value,
                );
            }
        }
    }
    Ok(SummarySnapshot { latest_by_chart })
}

fn extract_latest_value(chart_record: &Value) -> Option<SummaryLatestValue> {
    let latest_node = chart_record.get("latest");
    let latest_timestamp_raw = latest_node
        .and_then(|node| {
            node.as_str()
                .or_else(|| node.get("timestamp").and_then(Value::as_str))
        })
        .or_else(|| chart_record.get("latest_timestamp").and_then(Value::as_str))?;
    let latest_timestamp = parse_timestamp(latest_timestamp_raw).ok()?;

    let score = parse_optional_summary_metric(
        latest_node.and_then(|node| node.get("score")),
        "score",
        &latest_timestamp,
    );
    let misscount = parse_optional_summary_metric(
        latest_node.and_then(|node| node.get("misscount")),
        "misscount",
        &latest_timestamp,
    );

    Some(SummaryLatestValue {
        latest_timestamp,
        score,
        misscount,
    })
}

fn parse_optional_summary_metric(
    raw_value: Option<&Value>,
    field_name: &str,
    timestamp: &str,
) -> Option<u32> {
    let value = raw_value?;
    let Some(raw_metric_value) = value.as_i64() else {
        return None;
    };

    match parse_metric_value(raw_metric_value, field_name, timestamp) {
        Ok(metric_value) => Some(metric_value),
        Err(error) => {
            eprintln!("inf-notebook: ignored latest.{field_name} at {timestamp}: {error}");
            None
        }
    }
}

fn extract_changed_latest_entries(
    previous_snapshot: &SummarySnapshot,
    current_snapshot: &SummarySnapshot,
) -> Vec<SummaryLatestRecord> {
    let mut changed_entries = current_snapshot
        .latest_by_chart
        .iter()
        .filter_map(|(key, latest_value)| {
            let previous_timestamp = previous_snapshot
                .latest_by_chart
                .get(key)
                .map(|value| value.latest_timestamp.as_str());
            if previous_timestamp == Some(latest_value.latest_timestamp.as_str()) {
                return None;
            }
            Some(SummaryLatestRecord {
                musicname: key.musicname.clone(),
                play_style: key.play_style.clone(),
                difficulty: key.difficulty.clone(),
                latest_timestamp: latest_value.latest_timestamp.clone(),
                score: latest_value.score,
                misscount: latest_value.misscount,
            })
        })
        .collect::<Vec<_>>();

    changed_entries.sort_by(|left, right| {
        right
            .latest_timestamp
            .cmp(&left.latest_timestamp)
            .then_with(|| left.musicname.cmp(&right.musicname))
            .then_with(|| left.play_style.cmp(&right.play_style))
            .then_with(|| left.difficulty.cmp(&right.difficulty))
    });
    changed_entries
}

fn read_recent_index_with_retry(path: &Path) -> Result<Option<RecentTimestampIndex>, String> {
    if !path.exists() {
        return Err(format!(
            "Failed to read {}: file does not exist.",
            path.to_string_lossy()
        ));
    }
    for attempt in 0..=RECENT_PARSE_RETRY_COUNT {
        let raw_json = fs::read_to_string(path)
            .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;
        match parse_recent_timestamp_index(&raw_json) {
            Ok(index) => return Ok(Some(index)),
            Err(error) => {
                if attempt < RECENT_PARSE_RETRY_COUNT {
                    thread::sleep(Duration::from_millis(RECENT_PARSE_RETRY_DELAY_MS));
                    continue;
                }
                eprintln!(
                    "inf-notebook: could not parse export/recent.json yet ({}): {error}",
                    path.to_string_lossy()
                );
                return Ok(None);
            }
        }
    }
    Ok(None)
}

fn parse_recent_timestamp_index(raw_json: &str) -> Result<RecentTimestampIndex, String> {
    let export_recent = serde_json::from_str::<NotebookExportRecentFile>(raw_json)
        .map_err(|error| format!("Failed to parse export/recent.json payload: {error}"))?;
    Ok(build_recent_timestamp_index(&export_recent.list))
}

fn build_recent_timestamp_index(entries: &[NotebookRecentEntry]) -> RecentTimestampIndex {
    let mut by_timestamp: HashMap<String, Vec<RecentIndexedRecord>> = HashMap::new();
    for entry in entries {
        let timestamp = match parse_timestamp(entry.timestamp.as_str()) {
            Ok(timestamp) => timestamp,
            Err(error) => {
                eprintln!(
                    "inf-notebook: skipped recent entry due to timestamp parse error: {error}"
                );
                continue;
            }
        };
        let score = match parse_metric_value(entry.score, "score", &timestamp) {
            Ok(score) => score,
            Err(error) => {
                eprintln!("inf-notebook: skipped recent entry due to score parse error: {error}");
                continue;
            }
        };
        let misscount = match parse_metric_value(entry.misscount, "misscount", &timestamp) {
            Ok(misscount) => misscount,
            Err(error) => {
                eprintln!(
                    "inf-notebook: skipped recent entry due to misscount parse error: {error}"
                );
                continue;
            }
        };
        by_timestamp
            .entry(timestamp)
            .or_default()
            .push(RecentIndexedRecord {
                music: entry.music.trim().to_string(),
                difficulty_raw: entry.difficulty.trim().to_string(),
                difficulty_normalized: normalize_chart_difficulty(entry.difficulty.as_str()),
                score,
                misscount,
            });
    }
    RecentTimestampIndex { by_timestamp }
}

fn resolve_latest_entries_with_recent_retry(
    changed_entries: &[SummaryLatestRecord],
    alias_catalog: &AliasCatalog,
    recent_path: &Path,
    recent_index: &mut Option<RecentTimestampIndex>,
) -> Result<Vec<NotebookResolutionResult>, String> {
    let mut results = Vec::with_capacity(changed_entries.len());
    for entry in changed_entries {
        let mut candidates = recent_index
            .as_ref()
            .and_then(|index| index.by_timestamp.get(&entry.latest_timestamp))
            .cloned()
            .unwrap_or_default();

        if candidates.is_empty() {
            for _ in 0..RECENT_MISSING_RETRY_COUNT {
                thread::sleep(Duration::from_millis(RECENT_MISSING_RETRY_DELAY_MS));
                *recent_index = read_recent_index_with_retry(recent_path)?;
                candidates = recent_index
                    .as_ref()
                    .and_then(|index| index.by_timestamp.get(&entry.latest_timestamp))
                    .cloned()
                    .unwrap_or_default();
                if !candidates.is_empty() {
                    break;
                }
            }
        }

        results.push(resolve_entry_with_candidates(
            entry,
            alias_catalog,
            &candidates,
        ));
    }
    Ok(results)
}

fn resolve_entry_with_candidates(
    entry: &SummaryLatestRecord,
    alias_catalog: &AliasCatalog,
    recent_candidates: &[RecentIndexedRecord],
) -> NotebookResolutionResult {
    let Some(title_search_key) = alias_catalog
        .resolve_alias_exact(entry.musicname.as_str())
        .cloned()
    else {
        return NotebookResolutionResult {
            status: NotebookResolutionStatus::UnresolvedAlias,
            summary: entry.clone(),
            title_search_key: None,
            recent: None,
            recent_candidate_count: Some(recent_candidates.len() as u32),
            warnings: Vec::new(),
        };
    };

    if !alias_catalog.has_chart(
        entry.play_style.as_str(),
        entry.difficulty.as_str(),
        title_search_key.as_str(),
    ) {
        return NotebookResolutionResult {
            status: NotebookResolutionStatus::UnresolvedAlias,
            summary: entry.clone(),
            title_search_key: None,
            recent: None,
            recent_candidate_count: Some(recent_candidates.len() as u32),
            warnings: Vec::new(),
        };
    }

    match recent_candidates {
        [] => NotebookResolutionResult {
            status: NotebookResolutionStatus::ResolvedPartial,
            summary: entry.clone(),
            title_search_key: Some(title_search_key),
            recent: None,
            recent_candidate_count: Some(0),
            warnings: Vec::new(),
        },
        [candidate] => NotebookResolutionResult {
            status: NotebookResolutionStatus::ResolvedFull,
            summary: entry.clone(),
            title_search_key: Some(title_search_key),
            recent: Some(candidate.clone()),
            recent_candidate_count: Some(1),
            warnings: collect_recent_mismatch_warnings(entry, candidate),
        },
        _ => NotebookResolutionResult {
            status: NotebookResolutionStatus::AmbiguousRecent,
            summary: entry.clone(),
            title_search_key: Some(title_search_key),
            recent: None,
            recent_candidate_count: Some(recent_candidates.len() as u32),
            warnings: Vec::new(),
        },
    }
}

fn collect_recent_mismatch_warnings(
    summary: &SummaryLatestRecord,
    recent: &RecentIndexedRecord,
) -> Vec<String> {
    let mut warnings = Vec::new();
    if recent.music.trim() != summary.musicname {
        warnings.push(format!(
            "recent.music mismatch at {}: summary='{}' recent='{}'",
            summary.latest_timestamp, summary.musicname, recent.music
        ));
    }
    if let Some(recent_difficulty) = recent.difficulty_normalized.as_deref() {
        if recent_difficulty != summary.difficulty {
            warnings.push(format!(
                "recent.difficulty mismatch at {}: summary='{}' recent='{}' (raw='{}')",
                summary.latest_timestamp,
                summary.difficulty,
                recent_difficulty,
                recent.difficulty_raw
            ));
        }
    }
    warnings
}

fn resolution_result_to_observation(
    resolution_result: &NotebookResolutionResult,
) -> Option<ParsedSourceObservation> {
    if resolution_result.status != NotebookResolutionStatus::ResolvedFull {
        return None;
    }
    let title_search_key = resolution_result.title_search_key.as_ref()?;
    let recent = resolution_result.recent.as_ref()?;
    Some(ParsedSourceObservation {
        timestamp: resolution_result.summary.latest_timestamp.clone(),
        play_style: Some(resolution_result.summary.play_style.clone()),
        difficulty: resolution_result.summary.difficulty.clone(),
        title: resolution_result.summary.musicname.clone(),
        title_search_key: title_search_key.clone(),
        score: recent.score,
        misscount: recent.misscount,
    })
}

fn resolution_result_to_unresolved_case(
    resolution_result: &NotebookResolutionResult,
) -> Option<ParsedSourceUnresolvedCase> {
    let kind = match resolution_result.status {
        NotebookResolutionStatus::ResolvedPartial => ParsedSourceUnresolvedCaseKind::ResolvedPartial,
        NotebookResolutionStatus::AmbiguousRecent => {
            ParsedSourceUnresolvedCaseKind::AmbiguousRecent
        }
        _ => return None,
    };

    Some(ParsedSourceUnresolvedCase {
        kind,
        timestamp: resolution_result.summary.latest_timestamp.clone(),
        play_style: resolution_result.summary.play_style.clone(),
        difficulty: resolution_result.summary.difficulty.clone(),
        title: resolution_result.summary.musicname.clone(),
        title_search_key: resolution_result.title_search_key.clone(),
        score: resolution_result
            .summary
            .score
            .or_else(|| resolution_result.recent.as_ref().map(|recent| recent.score)),
        misscount: resolution_result
            .summary
            .misscount
            .or_else(|| resolution_result.recent.as_ref().map(|recent| recent.misscount)),
        recent_candidate_count: resolution_result.recent_candidate_count,
    })
}

fn log_resolution_results(results: &[NotebookResolutionResult]) {
    if results.is_empty() {
        return;
    }
    let mut resolved_full = 0usize;
    let mut resolved_partial = 0usize;
    let mut unresolved_alias = 0usize;
    let mut ambiguous_recent = 0usize;

    for result in results {
        for warning in &result.warnings {
            eprintln!("inf-notebook warning: {warning}");
        }
        match result.status {
            NotebookResolutionStatus::ResolvedFull => resolved_full += 1,
            NotebookResolutionStatus::ResolvedPartial => {
                resolved_partial += 1;
                eprintln!(
                    "inf-notebook resolved_partial: {} / {} / {} @ {} (summary updated, recent not reflected yet)",
                    result.summary.musicname,
                    result.summary.play_style,
                    result.summary.difficulty,
                    result.summary.latest_timestamp
                );
            }
            NotebookResolutionStatus::UnresolvedAlias => {
                unresolved_alias += 1;
                eprintln!(
                    "inf-notebook unresolved_alias: {} / {} / {} @ {}",
                    result.summary.musicname,
                    result.summary.play_style,
                    result.summary.difficulty,
                    result.summary.latest_timestamp
                );
            }
            NotebookResolutionStatus::AmbiguousRecent => {
                ambiguous_recent += 1;
                eprintln!(
                    "inf-notebook ambiguous_recent: {} / {} / {} @ {}",
                    result.summary.musicname,
                    result.summary.play_style,
                    result.summary.difficulty,
                    result.summary.latest_timestamp
                );
            }
        }
    }

    eprintln!(
        "inf-notebook summary diff processed: resolved_full={resolved_full}, resolved_partial={resolved_partial}, unresolved_alias={unresolved_alias}, ambiguous_recent={ambiguous_recent}"
    );
}

fn load_alias_catalog() -> AliasCatalog {
    let raw_json = include_str!("../../../../worker/src/master/generated/iidx-song-master.json");
    let snapshot = match serde_json::from_str::<WorkerChartMasterSnapshot>(raw_json) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            eprintln!("inf-notebook: failed to load alias catalog from chart master: {error}");
            return AliasCatalog::default();
        }
    };

    let mut alias_to_title_search_key = HashMap::new();
    let mut chart_index = HashSet::new();

    for chart in &snapshot.charts {
        let Some(play_style) = normalize_play_style(chart.play_style.as_str()) else {
            continue;
        };
        let Some(difficulty) = normalize_chart_difficulty(chart.difficulty.as_str()) else {
            continue;
        };
        let title_search_key = chart.title_search_key.trim();
        if title_search_key.is_empty() {
            continue;
        }

        chart_index.insert(ChartIndexKey {
            play_style,
            difficulty,
            title_search_key: title_search_key.to_string(),
        });
        insert_alias_exact(
            &mut alias_to_title_search_key,
            chart.title.as_str(),
            title_search_key,
        );
    }

    for (alias, title_search_key) in &snapshot.aliases {
        insert_alias_exact(&mut alias_to_title_search_key, alias, title_search_key);
    }

    AliasCatalog {
        alias_to_title_search_key,
        chart_index,
    }
}

fn insert_alias_exact(
    alias_to_title_search_key: &mut HashMap<String, String>,
    raw_alias: &str,
    raw_title_search_key: &str,
) {
    let alias = raw_alias.trim();
    let title_search_key = raw_title_search_key.trim();
    if alias.is_empty() || title_search_key.is_empty() {
        return;
    }
    alias_to_title_search_key
        .entry(alias.to_string())
        .or_insert_with(|| title_search_key.to_string());
}

fn parse_timestamp(raw_timestamp: &str) -> Result<String, String> {
    let trimmed = raw_timestamp.trim();
    let is_valid = trimmed.len() == 15
        && trimmed.chars().enumerate().all(|(index, ch)| match index {
            8 => ch == '-',
            _ => ch.is_ascii_digit(),
        });
    if !is_valid {
        return Err(format!(
            "inf-notebook entry has an invalid timestamp: {raw_timestamp}"
        ));
    }
    Ok(trimmed.to_string())
}

fn parse_metric_value(value: i64, field_name: &str, timestamp: &str) -> Result<u32, String> {
    u32::try_from(value).map_err(|_| {
        format!("inf-notebook entry at {timestamp} has an invalid {field_name}: {value}")
    })
}

fn normalize_play_style(raw_play_style: &str) -> Option<String> {
    let normalized = raw_play_style.trim().to_uppercase();
    match normalized.as_str() {
        "SP" | "SINGLE" | "SINGLEPLAY" => Some("SP".to_string()),
        "DP" | "DOUBLE" | "DOUBLEPLAY" => Some("DP".to_string()),
        _ => None,
    }
}

fn normalize_chart_difficulty(raw_difficulty: &str) -> Option<String> {
    let normalized = raw_difficulty
        .trim()
        .to_uppercase()
        .replace([' ', '-', '_'], "");
    let resolved = match normalized.as_str() {
        "B" | "BEGINNER" | "SPB" | "DPB" => "BEGINNER",
        "N" | "NORMAL" | "NOVICE" | "SPN" | "DPN" => "NORMAL",
        "H" | "HYPER" | "SPH" | "DPH" => "HYPER",
        "A" | "ANOTHER" | "SPA" | "DPA" => "ANOTHER",
        "L" | "LEGGENDARIA" | "SPL" | "DPL" => "LEGGENDARIA",
        _ => return None,
    };
    Some(resolved.to_string())
}

fn path_key(path: &Path) -> String {
    let normalized = path
        .canonicalize()
        .unwrap_or_else(|_| {
            if path.is_absolute() {
                path.to_path_buf()
            } else {
                env::current_dir()
                    .map(|current_dir| current_dir.join(path))
                    .unwrap_or_else(|_| path.to_path_buf())
            }
        })
        .to_string_lossy()
        .replace('/', "\\");

    normalized
        .strip_prefix("\\\\?\\UNC\\")
        .map(|remainder| format!("\\\\{remainder}"))
        .or_else(|| normalized.strip_prefix("\\\\?\\").map(str::to_string))
        .unwrap_or(normalized)
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use std::{
        collections::{HashMap, HashSet},
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::{
        models::SourcePathsConfig,
        parsers::{
            notebook::{
                build_recent_timestamp_index, extract_changed_latest_entries,
                parse_recent_timestamp_index, parse_summary_snapshot,
                resolve_entry_with_candidates, AliasCatalog, ChartIndexKey, NotebookParser,
                NotebookRecentEntry, NotebookResolutionStatus, RecentIndexedRecord,
                SummaryLatestRecord,
            },
            ParserInput, SourceParser,
        },
    };

    #[test]
    fn summary_diff_extracts_only_changed_latest() {
        let previous = parse_summary_snapshot(
            r#"{"musics":{"Song A":{"SP":{"ANOTHER":{"latest":{"timestamp":"20260101-120000"}}}}}}"#,
        )
        .expect("previous snapshot should parse");
        let current = parse_summary_snapshot(
            r#"{"musics":{"Song A":{"SP":{"ANOTHER":{"latest":{"timestamp":"20260101-120000"}}}},"Song B":{"DP":{"HYPER":{"latest":{"timestamp":"20260101-120100"}}}}}}"#,
        )
        .expect("current snapshot should parse");

        let changed = extract_changed_latest_entries(&previous, &current);
        assert_eq!(changed.len(), 1);
        assert_eq!(changed[0].musicname, "Song B");
        assert_eq!(changed[0].play_style, "DP");
        assert_eq!(changed[0].difficulty, "HYPER");
        assert_eq!(changed[0].latest_timestamp, "20260101-120100");
    }

    #[test]
    fn recent_timestamp_index_uses_multimap() {
        let parsed = parse_recent_timestamp_index(
            r#"{"list":[{"timestamp":"20260101-130000","difficulty":"ANOTHER","music":"Song A","score":2000,"misscount":30},{"timestamp":"20260101-130000","difficulty":"HYPER","music":"Song B","score":1800,"misscount":45}]}"#,
        )
        .expect("recent payload should parse");

        let candidates = parsed
            .by_timestamp
            .get("20260101-130000")
            .expect("timestamp key should exist");
        assert_eq!(candidates.len(), 2);
    }

    #[test]
    fn resolve_entry_classifies_0_1_2_and_alias_cases() {
        let catalog = build_test_catalog();
        let summary = SummaryLatestRecord {
            musicname: "Song A".to_string(),
            play_style: "SP".to_string(),
            difficulty: "ANOTHER".to_string(),
            latest_timestamp: "20260101-130000".to_string(),
            score: None,
            misscount: None,
        };

        let partial = resolve_entry_with_candidates(&summary, &catalog, &[]);
        assert_eq!(partial.status, NotebookResolutionStatus::ResolvedPartial);

        let mismatch = RecentIndexedRecord {
            music: "Different Song".to_string(),
            difficulty_raw: "HYPER".to_string(),
            difficulty_normalized: Some("HYPER".to_string()),
            score: 2111,
            misscount: 22,
        };
        let full = resolve_entry_with_candidates(&summary, &catalog, &[mismatch]);
        assert_eq!(full.status, NotebookResolutionStatus::ResolvedFull);
        assert_eq!(full.warnings.len(), 2);

        let ambiguous = resolve_entry_with_candidates(
            &summary,
            &catalog,
            &[
                RecentIndexedRecord {
                    music: "Song A".to_string(),
                    difficulty_raw: "ANOTHER".to_string(),
                    difficulty_normalized: Some("ANOTHER".to_string()),
                    score: 2111,
                    misscount: 22,
                },
                RecentIndexedRecord {
                    music: "Song A".to_string(),
                    difficulty_raw: "ANOTHER".to_string(),
                    difficulty_normalized: Some("ANOTHER".to_string()),
                    score: 2112,
                    misscount: 21,
                },
            ],
        );
        assert_eq!(ambiguous.status, NotebookResolutionStatus::AmbiguousRecent);

        let unresolved = SummaryLatestRecord {
            musicname: "Unknown Song".to_string(),
            play_style: "SP".to_string(),
            difficulty: "ANOTHER".to_string(),
            latest_timestamp: "20260101-130500".to_string(),
            score: None,
            misscount: None,
        };
        let unresolved_alias = resolve_entry_with_candidates(&unresolved, &catalog, &[]);
        assert_eq!(
            unresolved_alias.status,
            NotebookResolutionStatus::UnresolvedAlias
        );
    }

    #[test]
    fn resolve_alias_exact_keeps_case_sensitive_distinction() {
        let mut alias_to_title_search_key = HashMap::new();
        alias_to_title_search_key.insert("SHOOTING STAR".to_string(), "shooting-star-upper".to_string());
        alias_to_title_search_key.insert("Shooting Star".to_string(), "shooting-star-mixed".to_string());
        let catalog = AliasCatalog {
            alias_to_title_search_key,
            chart_index: HashSet::new(),
        };

        assert_eq!(
            catalog
                .resolve_alias_exact("SHOOTING STAR")
                .map(String::as_str),
            Some("shooting-star-upper")
        );
        assert_eq!(
            catalog
                .resolve_alias_exact("Shooting Star")
                .map(String::as_str),
            Some("shooting-star-mixed")
        );
        assert_eq!(catalog.resolve_alias_exact("shooting star"), None);
    }

    #[test]
    fn notebook_parser_waits_for_next_update_when_summary_json_is_invalid() {
        let temp_dir = create_temp_dir("notebook-invalid-summary");
        let summary_path = temp_dir.join("summary.json");
        let recent_path = temp_dir.join("recent.json");
        write_file(&summary_path, "{invalid json");
        write_file(&recent_path, r#"{"list":[]}"#);

        let mut parser = NotebookParser::new_with_catalog(
            &SourcePathsConfig {
                notebook_export_recent_json: recent_path.to_string_lossy().into_owned(),
                notebook_records_recent_json: summary_path.to_string_lossy().into_owned(),
                ..SourcePathsConfig::default()
            },
            build_test_catalog(),
        );

        let parsed = parser
            .parse(&ParserInput {
                changed_path: summary_path.clone(),
            })
            .expect("invalid summary should not fail immediately");
        assert!(parsed.is_none());

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn notebook_parser_emits_resolved_full_observation() {
        let temp_dir = create_temp_dir("notebook-summary");
        let summary_path = temp_dir.join("summary.json");
        let recent_path = temp_dir.join("recent.json");
        write_file(
            &summary_path,
            r#"{"musics":{"Song A":{"SP":{"ANOTHER":{"latest":{"timestamp":"20260101-120000"}}}}}}"#,
        );
        write_file(
            &recent_path,
            r#"{"list":[{"timestamp":"20260101-130000","difficulty":"ANOTHER","music":"Song A","score":2450,"misscount":18}]}"#,
        );

        let mut parser = NotebookParser::new_with_catalog(
            &SourcePathsConfig {
                notebook_export_recent_json: recent_path.to_string_lossy().into_owned(),
                notebook_records_recent_json: summary_path.to_string_lossy().into_owned(),
                ..SourcePathsConfig::default()
            },
            build_test_catalog(),
        );

        write_file(
            &summary_path,
            r#"{"musics":{"Song A":{"SP":{"ANOTHER":{"latest":{"timestamp":"20260101-130000"}}}}}}"#,
        );

        let parsed_change = parser
            .parse(&ParserInput {
                changed_path: summary_path.clone(),
            })
            .expect("parse should succeed")
            .expect("parser should emit payload");

        assert_eq!(parsed_change.observations.len(), 1);
        assert!(parsed_change.unresolved_cases.is_empty());
        assert_eq!(parsed_change.observations[0].score, 2450);
        assert_eq!(parsed_change.observations[0].misscount, 18);
        assert_eq!(
            parsed_change.observations[0].play_style.as_deref(),
            Some("SP")
        );
        assert_eq!(parsed_change.observations[0].difficulty, "ANOTHER");
        assert_eq!(parsed_change.observations[0].title_search_key, "song-a");

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn build_recent_timestamp_index_skips_invalid_rows() {
        let entries = vec![
            NotebookRecentEntry {
                timestamp: "20260101-140000".to_string(),
                difficulty: "ANOTHER".to_string(),
                music: "Song A".to_string(),
                score: 2000,
                misscount: 30,
            },
            NotebookRecentEntry {
                timestamp: "broken".to_string(),
                difficulty: "ANOTHER".to_string(),
                music: "Song B".to_string(),
                score: 1900,
                misscount: 40,
            },
        ];

        let index = build_recent_timestamp_index(&entries);
        assert_eq!(index.by_timestamp.len(), 1);
    }

    fn build_test_catalog() -> AliasCatalog {
        let mut alias_to_title_search_key = HashMap::new();
        alias_to_title_search_key.insert("Song A".to_string(), "song-a".to_string());
        alias_to_title_search_key.insert("song a".to_string(), "song-a-lower".to_string());

        let mut chart_index = HashSet::new();
        chart_index.insert(ChartIndexKey {
            play_style: "SP".to_string(),
            difficulty: "ANOTHER".to_string(),
            title_search_key: "song-a".to_string(),
        });
        chart_index.insert(ChartIndexKey {
            play_style: "SP".to_string(),
            difficulty: "ANOTHER".to_string(),
            title_search_key: "song-a-lower".to_string(),
        });

        AliasCatalog {
            alias_to_title_search_key,
            chart_index,
        }
    }

    fn create_temp_dir(prefix: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        let temp_dir = env::temp_dir().join(format!("infinitas-arena-{prefix}-{unique_suffix}"));
        fs::create_dir_all(&temp_dir).expect("temp dir should be created");
        temp_dir
    }

    fn write_file(path: &PathBuf, contents: &str) {
        fs::write(path, contents).expect("fixture file should be written");
    }
}
