use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};

use unicode_normalization::UnicodeNormalization;

use crate::{
    models::{ParsedSourceChange, ParsedSourceObservation, SourcePathsConfig, SourceType},
    parsers::{ParserInput, SourceParser},
};

struct ParsedDakenItem {
    fingerprint: String,
    observation: ParsedSourceObservation,
}

pub struct DakenParser {
    xml_path: PathBuf,
    xml_path_key: String,
    known_fingerprints: HashSet<String>,
}

impl DakenParser {
    pub fn new(source_paths: &SourcePathsConfig) -> Self {
        let xml_path = PathBuf::from(source_paths.daken_today_update_xml.trim());
        let known_fingerprints = read_daken_items(&xml_path)
            .map(|items| {
                items
                    .into_iter()
                    .map(|item| item.fingerprint)
                    .collect::<HashSet<_>>()
            })
            .unwrap_or_default();

        Self {
            xml_path_key: path_key(&xml_path),
            xml_path,
            known_fingerprints,
        }
    }
}

impl SourceParser for DakenParser {
    fn parse(&mut self, input: &ParserInput) -> Result<Option<ParsedSourceChange>, String> {
        let metadata = fs::metadata(&input.changed_path)
            .map_err(|error| format!("Failed to read {:?}: {error}", input.changed_path))?;
        let changed_path_key = path_key(&input.changed_path);

        if changed_path_key != self.xml_path_key {
            return Ok(Some(ParsedSourceChange {
                source: SourceType::InfDakenCounter,
                file_path: input.changed_path.to_string_lossy().into_owned(),
                file_size_bytes: metadata.len(),
                observations: Vec::new(),
                unresolved_cases: Vec::new(),
            }));
        }

        let items = read_daken_items(&self.xml_path)?;
        let current_fingerprints = items
            .iter()
            .map(|item| item.fingerprint.clone())
            .collect::<HashSet<_>>();
        let observations = items
            .into_iter()
            .rev()
            .filter(|item| !self.known_fingerprints.contains(&item.fingerprint))
            .map(|item| item.observation)
            .collect::<Vec<_>>();

        self.known_fingerprints = current_fingerprints;

        Ok(Some(ParsedSourceChange {
            source: SourceType::InfDakenCounter,
            file_path: self.xml_path.to_string_lossy().into_owned(),
            file_size_bytes: metadata.len(),
            observations,
            unresolved_cases: Vec::new(),
        }))
    }
}

fn read_daken_items(path: &Path) -> Result<Vec<ParsedDakenItem>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw_xml = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read {}: {error}", path.to_string_lossy()))?;

    extract_item_blocks(&raw_xml)?
        .into_iter()
        .map(parse_daken_item)
        .collect()
}

fn extract_item_blocks(raw_xml: &str) -> Result<Vec<&str>, String> {
    let mut items = Vec::new();
    let mut cursor = raw_xml;

    while let Some(start_index) = cursor.find("<item>") {
        let after_start = &cursor[start_index + "<item>".len()..];
        let Some(end_index) = after_start.find("</item>") else {
            return Err(
                "inf_daken_counter today_update.xml is missing a closing </item> tag.".to_string(),
            );
        };

        items.push(&after_start[..end_index]);
        cursor = &after_start[end_index + "</item>".len()..];
    }

    Ok(items)
}

fn parse_daken_item(raw_item: &str) -> Result<ParsedDakenItem, String> {
    let title = normalize_title(extract_tag(raw_item, "title")?.as_str())?;
    let raw_difficulty = extract_tag(raw_item, "difficulty")?;
    let (play_style, difficulty) = parse_chart_difficulty(raw_difficulty.as_str())?;
    let score = parse_metric_value(extract_tag(raw_item, "score_cur")?.as_str(), "score_cur")?;
    let misscount = parse_metric_value(extract_tag(raw_item, "bp")?.as_str(), "bp")?;
    let fingerprint = format!("{play_style}::{difficulty}::{title}::{score}::{misscount}");

    Ok(ParsedDakenItem {
        fingerprint,
        observation: ParsedSourceObservation {
            timestamp: String::new(),
            play_style: Some(play_style),
            difficulty,
            title: title.clone(),
            title_search_key: title,
            score,
            misscount,
        },
    })
}

fn extract_tag(raw_item: &str, tag: &str) -> Result<String, String> {
    let opening_tag = format!("<{tag}>");
    let closing_tag = format!("</{tag}>");
    let Some(start_index) = raw_item.find(&opening_tag) else {
        return Err(format!("inf_daken_counter item is missing <{tag}>."));
    };
    let after_start = &raw_item[start_index + opening_tag.len()..];
    let Some(end_index) = after_start.find(&closing_tag) else {
        return Err(format!("inf_daken_counter item is missing {closing_tag}."));
    };
    decode_xml_text(after_start[..end_index].trim())
}

fn decode_xml_text(raw_value: &str) -> Result<String, String> {
    let mut decoded = String::with_capacity(raw_value.len());
    let mut cursor = raw_value;

    while let Some(entity_start) = cursor.find('&') {
        decoded.push_str(&cursor[..entity_start]);
        let after_entity_start = &cursor[entity_start + 1..];
        let Some(entity_end) = after_entity_start.find(';') else {
            return Err("inf_daken_counter item contains an unterminated XML entity.".to_string());
        };

        let entity = &after_entity_start[..entity_end];
        match entity {
            "amp" => decoded.push('&'),
            "lt" => decoded.push('<'),
            "gt" => decoded.push('>'),
            "quot" => decoded.push('"'),
            "apos" => decoded.push('\''),
            _ => {
                let decoded_char = if let Some(hex_value) = entity
                    .strip_prefix("#x")
                    .or_else(|| entity.strip_prefix("#X"))
                {
                    u32::from_str_radix(hex_value, 16)
                        .ok()
                        .and_then(char::from_u32)
                } else if let Some(decimal_value) = entity.strip_prefix('#') {
                    decimal_value.parse::<u32>().ok().and_then(char::from_u32)
                } else {
                    None
                };

                let Some(decoded_char) = decoded_char else {
                    return Err(format!(
                        "inf_daken_counter item contains an unsupported XML entity: &{entity};"
                    ));
                };
                decoded.push(decoded_char);
            }
        }

        cursor = &after_entity_start[entity_end + 1..];
    }

    decoded.push_str(cursor);
    Ok(decoded)
}

fn parse_chart_difficulty(raw_difficulty: &str) -> Result<(String, String), String> {
    let normalized = raw_difficulty
        .trim()
        .nfkc()
        .collect::<String>()
        .to_uppercase();

    let parsed = match normalized.as_str() {
        "SPB" => ("SP", "BEGINNER"),
        "SPN" => ("SP", "NORMAL"),
        "SPH" => ("SP", "HYPER"),
        "SPA" => ("SP", "ANOTHER"),
        "SPL" => ("SP", "LEGGENDARIA"),
        "DPB" => ("DP", "BEGINNER"),
        "DPN" => ("DP", "NORMAL"),
        "DPH" => ("DP", "HYPER"),
        "DPA" => ("DP", "ANOTHER"),
        "DPL" => ("DP", "LEGGENDARIA"),
        _ => {
            return Err(format!(
                "inf_daken_counter item has an invalid difficulty: {raw_difficulty}"
            ))
        }
    };

    Ok((parsed.0.to_string(), parsed.1.to_string()))
}

fn parse_metric_value(raw_value: &str, field_name: &str) -> Result<u32, String> {
    raw_value.trim().parse::<u32>().map_err(|error| {
        format!("inf_daken_counter item has an invalid {field_name}: {raw_value} ({error})")
    })
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
        return Err("inf_daken_counter item is missing title.".to_string());
    }

    Ok(normalized)
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
        parsers::{daken::DakenParser, ParserInput, SourceParser},
    };

    #[test]
    fn daken_parser_emits_only_new_fingerprints_and_maps_play_style() {
        let temp_dir = create_temp_dir("daken-parser");
        let xml_path = temp_dir.join("today_update.xml");
        write_file(
            &xml_path,
            r#"<Results>
  <item>
    <title>Old Song</title>
    <difficulty>SPH</difficulty>
    <score_cur>1750</score_cur>
    <bp>15</bp>
  </item>
</Results>"#,
        );

        let mut parser = DakenParser::new(&SourcePathsConfig {
            daken_today_update_xml: xml_path.to_string_lossy().into_owned(),
            ..SourcePathsConfig::default()
        });

        write_file(
            &xml_path,
            r#"<Results>
  <item>
    <title>Old Song</title>
    <difficulty>SPH</difficulty>
    <score_cur>1750</score_cur>
    <bp>15</bp>
  </item>
  <item>
    <title>Summer Vacation (CU mix)</title>
    <difficulty>DPH</difficulty>
    <score_cur>2878</score_cur>
    <bp>13</bp>
  </item>
</Results>"#,
        );

        let parsed_change = parser
            .parse(&ParserInput {
                changed_path: xml_path.clone(),
            })
            .expect("parse should succeed")
            .expect("parser should emit a change");

        assert_eq!(parsed_change.observations.len(), 1);
        assert_eq!(
            parsed_change.observations[0].play_style.as_deref(),
            Some("DP")
        );
        assert_eq!(parsed_change.observations[0].difficulty, "HYPER");
        assert_eq!(
            parsed_change.observations[0].title_search_key,
            "summer vacation(cu mix)"
        );
        assert_eq!(parsed_change.observations[0].score, 2878);
        assert_eq!(parsed_change.observations[0].misscount, 13);

        let repeated_change = parser
            .parse(&ParserInput {
                changed_path: xml_path.clone(),
            })
            .expect("repeat parse should succeed")
            .expect("repeat parse should emit a metadata change");

        assert!(repeated_change.observations.is_empty());

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn daken_parser_decodes_xml_entities() {
        let temp_dir = create_temp_dir("daken-entities");
        let xml_path = temp_dir.join("today_update.xml");
        let mut parser = DakenParser::new(&SourcePathsConfig {
            daken_today_update_xml: xml_path.to_string_lossy().into_owned(),
            ..SourcePathsConfig::default()
        });

        write_file(
            &xml_path,
            r#"<Results>
  <item>
    <title>Raison d&apos;&#234;tre &amp; More</title>
    <difficulty>SPA</difficulty>
    <score_cur>2111</score_cur>
    <bp>4</bp>
  </item>
</Results>"#,
        );

        let parsed_change = parser
            .parse(&ParserInput {
                changed_path: xml_path.clone(),
            })
            .expect("parse should succeed")
            .expect("parser should emit a change");

        assert_eq!(parsed_change.observations.len(), 1);
        assert_eq!(
            parsed_change.observations[0].title,
            "raison d'\u{00ea}tre & more"
        );
        assert_eq!(parsed_change.observations[0].difficulty, "ANOTHER");
        assert_eq!(
            parsed_change.observations[0].play_style.as_deref(),
            Some("SP")
        );

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn daken_parser_reports_invalid_xml_content() {
        let temp_dir = create_temp_dir("daken-invalid");
        let xml_path = temp_dir.join("today_update.xml");

        let mut parser = DakenParser::new(&SourcePathsConfig {
            daken_today_update_xml: xml_path.to_string_lossy().into_owned(),
            ..SourcePathsConfig::default()
        });

        write_file(
            &xml_path,
            r#"<Results>
  <item>
    <title>Broken Song</title>
    <difficulty>???</difficulty>
    <score_cur>not-a-number</score_cur>
  </item>
</Results>"#,
        );

        let error = parser
            .parse(&ParserInput {
                changed_path: xml_path.clone(),
            })
            .expect_err("invalid xml should fail");

        assert!(
            error.contains("invalid difficulty") || error.contains("invalid score_cur"),
            "unexpected error: {error}"
        );

        let _ = fs::remove_dir_all(temp_dir);
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
