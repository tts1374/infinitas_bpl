mod daken;
mod notebook;
mod reflux;
mod runtime_alias;

use std::path::PathBuf;

use crate::models::{ParsedSourceChange, SourcePathsConfig, SourceType};

pub struct ParserInput {
    pub changed_path: PathBuf,
}

pub trait SourceParser: Send + Sync {
    fn parse(&mut self, input: &ParserInput) -> Result<Option<ParsedSourceChange>, String>;
}

pub fn create_parser(
    source: &SourceType,
    source_paths: &SourcePathsConfig,
    api_base_url: Option<&str>,
) -> Box<dyn SourceParser> {
    match source {
        SourceType::InfNotebook => Box::new(notebook::NotebookParser::new(source_paths, api_base_url)),
        SourceType::InfDakenCounter => Box::new(daken::DakenParser::new(source_paths)),
        SourceType::Reflux => Box::new(reflux::RefluxParser::new(source_paths, api_base_url)),
    }
}
