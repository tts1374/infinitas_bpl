mod notebook;

use std::{fs, path::PathBuf};

use crate::models::{ParsedSourceChange, ParsedSourceObservation, SourcePathsConfig, SourceType};

pub struct ParserInput {
    pub changed_path: PathBuf,
}

pub trait SourceParser: Send + Sync {
    fn parse(&mut self, input: &ParserInput) -> Result<Option<ParsedSourceChange>, String>;
}

pub struct FileMetadataParser {
    source: SourceType,
}

impl FileMetadataParser {
    pub fn new(source: SourceType) -> Self {
        Self { source }
    }
}

impl SourceParser for FileMetadataParser {
    fn parse(&mut self, input: &ParserInput) -> Result<Option<ParsedSourceChange>, String> {
        let metadata = fs::metadata(&input.changed_path)
            .map_err(|error| format!("Failed to read {:?}: {error}", input.changed_path))?;

        Ok(Some(ParsedSourceChange {
            source: self.source.clone(),
            file_path: input.changed_path.to_string_lossy().into_owned(),
            file_size_bytes: metadata.len(),
            observations: Vec::<ParsedSourceObservation>::new(),
        }))
    }
}

pub fn create_parser(
    source: &SourceType,
    source_paths: &SourcePathsConfig,
) -> Box<dyn SourceParser> {
    match source {
        SourceType::InfNotebook => Box::new(notebook::NotebookParser::new(source_paths)),
        SourceType::InfDakenCounter => Box::new(FileMetadataParser::new(source.clone())),
    }
}
