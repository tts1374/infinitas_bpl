use std::{
    env, fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use unicode_normalization::UnicodeNormalization;

use crate::{
    models::{ParsedSourceChange, ParsedSourceObservation, SourcePathsConfig, SourceType},
    parsers::{ParserInput, SourceParser},
};

#[derive(Clone, Debug, Deserialize)]
struct NotebookExportRecentFile {
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

pub struct NotebookParser {
    export_recent_path: PathBuf,
    export_recent_path_key: String,
    last_seen_timestamp: Option<String>,
}

impl NotebookParser {
    pub fn new(source_paths: &SourcePathsConfig) -> Self {
        let export_recent_path = PathBuf::from(source_paths.notebook_export_recent_json.trim());
        let last_seen_timestamp = read_latest_timestamp(&export_recent_path).ok().flatten();

        Self {
            export_recent_path_key: path_key(&export_recent_path),
            export_recent_path,
            last_seen_timestamp,
        }
    }
}

impl SourceParser for NotebookParser {
    fn parse(&mut self, input: &ParserInput) -> Result<Option<ParsedSourceChange>, String> {
        let metadata = fs::metadata(&input.changed_path)
            .map_err(|error| format!("Failed to read {:?}: {error}", input.changed_path))?;
        let changed_path_key = path_key(&input.changed_path);

        if changed_path_key != self.export_recent_path_key {
            return Ok(Some(ParsedSourceChange {
                source: SourceType::InfNotebook,
                file_path: input.changed_path.to_string_lossy().into_owned(),
                file_size_bytes: metadata.len(),
                observations: Vec::new(),
            }));
        }

        let export_recent = read_export_recent(&self.export_recent_path)?;
        let latest_timestamp = export_recent
            .list
            .iter()
            .map(|entry| entry.timestamp.as_str())
            .max()
            .map(str::to_string);
        let previous_last_seen = self.last_seen_timestamp.as_deref();

        let observations = export_recent
            .list
            .iter()
            .rev()
            .filter(|entry| is_newer_timestamp(entry.timestamp.as_str(), previous_last_seen))
            .map(parse_observation)
            .collect::<Result<Vec<_>, _>>()?;

        self.last_seen_timestamp = latest_timestamp;

        Ok(Some(ParsedSourceChange {
            source: SourceType::InfNotebook,
            file_path: self.export_recent_path.to_string_lossy().into_owned(),
            file_size_bytes: metadata.len(),
            observations,
        }))
    }
}

fn read_latest_timestamp(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let export_recent = read_export_recent(path)?;
    Ok(export_recent
        .list
        .iter()
        .map(|entry| entry.timestamp.as_str())
        .max()
        .map(str::to_string))
}

fn read_export_recent(path: &Path) -> Result<NotebookExportRecentFile, String> {
    let raw_json = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;
    serde_json::from_str::<NotebookExportRecentFile>(&raw_json).map_err(|error| {
        format!(
            "Failed to parse {} as inf-notebook recent.json: {error}",
            path.to_string_lossy()
        )
    })
}

fn parse_observation(entry: &NotebookRecentEntry) -> Result<ParsedSourceObservation, String> {
    let timestamp = parse_timestamp(entry.timestamp.as_str())?;
    let difficulty = normalize_difficulty(entry.difficulty.as_str())?;
    let title = normalize_title(entry.music.as_str())?;
    let score = parse_metric_value(entry.score, "score", &timestamp)?;
    let misscount = parse_metric_value(entry.misscount, "misscount", &timestamp)?;

    Ok(ParsedSourceObservation {
        timestamp,
        play_style: None,
        difficulty,
        title_search_key: title.clone(),
        title,
        score,
        misscount,
    })
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

fn normalize_difficulty(raw_difficulty: &str) -> Result<String, String> {
    let normalized = raw_difficulty
        .trim()
        .nfkc()
        .collect::<String>()
        .to_uppercase();
    if normalized.is_empty() {
        return Err("inf-notebook entry is missing difficulty.".to_string());
    }

    Ok(normalized)
}

fn normalize_title(raw_title: &str) -> Result<String, String> {
    let normalized = raw_title
        .trim()
        .nfkc()
        .collect::<String>()
        .replace('\u{3000}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .replace(" (", "(")
        .to_lowercase();

    if normalized.is_empty() {
        return Err("inf-notebook entry is missing music title.".to_string());
    }

    Ok(normalized)
}

fn parse_metric_value(value: i64, field_name: &str, timestamp: &str) -> Result<u32, String> {
    u32::try_from(value).map_err(|_| {
        format!("inf-notebook entry at {timestamp} has an invalid {field_name}: {value}")
    })
}

fn is_newer_timestamp(timestamp: &str, last_seen_timestamp: Option<&str>) -> bool {
    match last_seen_timestamp {
        Some(last_seen_timestamp) => timestamp > last_seen_timestamp,
        None => true,
    }
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
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::{
        models::SourcePathsConfig,
        parsers::{notebook::NotebookParser, ParserInput, SourceParser},
    };

    #[test]
    fn notebook_parser_emits_only_newer_entries_in_newest_first_order() {
        let temp_dir = create_temp_dir("notebook-parser");
        let export_recent_path = temp_dir.join("recent.json");
        write_file(
            &export_recent_path,
            r#"{
  "version": "0.19.0.0",
  "count": 1,
  "list": [
    {
      "timestamp": "20250729-201348",
      "difficulty": "ANOTHER",
      "music": "Old Song",
      "score": 2000,
      "misscount": 30
    }
  ]
}"#,
        );

        let mut parser = NotebookParser::new(&SourcePathsConfig {
            notebook_export_recent_json: export_recent_path.to_string_lossy().into_owned(),
            ..SourcePathsConfig::default()
        });

        write_file(
            &export_recent_path,
            r#"{
  "version": "0.19.0.0",
  "count": 3,
  "list": [
    {
      "timestamp": "20250729-201348",
      "difficulty": "ANOTHER",
      "music": "Old Song",
      "score": 2000,
      "misscount": 30
    },
    {
      "timestamp": "20250729-202500",
      "difficulty": "hyper",
      "music": "Mismatch Song",
      "score": 2500,
      "misscount": 40
    },
    {
      "timestamp": "20250729-203000",
      "difficulty": "ANOTHER",
      "music": "Summer Vacation (CU mix)",
      "score": 2878,
      "misscount": 13
    }
  ]
}"#,
        );

        let parsed_change = parser
            .parse(&ParserInput {
                changed_path: export_recent_path.clone(),
            })
            .expect("parse should succeed")
            .expect("parser should emit a change");

        assert_eq!(parsed_change.observations.len(), 2);
        assert_eq!(parsed_change.observations[0].timestamp, "20250729-203000");
        assert_eq!(parsed_change.observations[0].difficulty, "ANOTHER");
        assert_eq!(
            parsed_change.observations[0].title_search_key,
            "summer vacation(cu mix)"
        );
        assert_eq!(parsed_change.observations[0].score, 2878);
        assert_eq!(parsed_change.observations[0].misscount, 13);
        assert_eq!(parsed_change.observations[1].timestamp, "20250729-202500");

        let repeated_change = parser
            .parse(&ParserInput {
                changed_path: export_recent_path.clone(),
            })
            .expect("second parse should succeed")
            .expect("second parse should still emit a metadata change");

        assert!(repeated_change.observations.is_empty());

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn notebook_parser_ignores_records_recent_changes_for_submission_payloads() {
        let temp_dir = create_temp_dir("notebook-records");
        let export_recent_path = temp_dir.join("export-recent.json");
        let records_recent_path = temp_dir.join("records-recent.json");

        write_file(
            &export_recent_path,
            r#"{
  "version": "0.19.0.0",
  "count": 1,
  "list": [
    {
      "timestamp": "20250729-201348",
      "difficulty": "ANOTHER",
      "music": "Thunderbolt",
      "score": 2878,
      "misscount": 13
    }
  ]
}"#,
        );
        write_file(&records_recent_path, r#"{"list":[]}"#);

        let mut parser = NotebookParser::new(&SourcePathsConfig {
            notebook_export_recent_json: export_recent_path.to_string_lossy().into_owned(),
            notebook_records_recent_json: records_recent_path.to_string_lossy().into_owned(),
            ..SourcePathsConfig::default()
        });

        let parsed_change = parser
            .parse(&ParserInput {
                changed_path: records_recent_path.clone(),
            })
            .expect("parse should succeed")
            .expect("parser should emit a metadata change");

        assert!(parsed_change.observations.is_empty());

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn notebook_parser_reports_invalid_json() {
        let temp_dir = create_temp_dir("notebook-invalid");
        let export_recent_path = temp_dir.join("recent.json");
        write_file(&export_recent_path, "{invalid json");

        let mut parser = NotebookParser::new(&SourcePathsConfig {
            notebook_export_recent_json: export_recent_path.to_string_lossy().into_owned(),
            ..SourcePathsConfig::default()
        });

        let error = parser
            .parse(&ParserInput {
                changed_path: export_recent_path.clone(),
            })
            .expect_err("invalid json should fail");

        assert!(error.contains("Failed to parse"));

        let _ = fs::remove_dir_all(temp_dir);
    }

    fn create_temp_dir(prefix: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        let temp_dir = env::temp_dir().join(format!("infinitas-bpl-{prefix}-{unique_suffix}"));
        fs::create_dir_all(&temp_dir).expect("temp dir should be created");
        temp_dir
    }

    fn write_file(path: &PathBuf, contents: &str) {
        fs::write(path, contents).expect("fixture file should be written");
    }
}
