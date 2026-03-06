use std::{fs, path::PathBuf};

use crate::models::{ParsedSourceChange, SourceType};

pub struct ParserInput {
    pub changed_path: PathBuf,
}

pub trait SourceParser: Send + Sync {
    fn parse(&self, input: &ParserInput) -> Result<ParsedSourceChange, String>;
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
    fn parse(&self, input: &ParserInput) -> Result<ParsedSourceChange, String> {
        let metadata = fs::metadata(&input.changed_path)
            .map_err(|error| format!("Failed to read {:?}: {error}", input.changed_path))?;

        Ok(ParsedSourceChange {
            source: self.source.clone(),
            file_path: input.changed_path.to_string_lossy().into_owned(),
            file_size_bytes: metadata.len(),
        })
    }
}

pub fn create_parser(source: &SourceType) -> Box<dyn SourceParser> {
    Box::new(FileMetadataParser::new(source.clone()))
}
