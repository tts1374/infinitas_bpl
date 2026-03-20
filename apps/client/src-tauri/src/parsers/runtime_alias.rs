use std::{
    collections::HashMap,
    hash::{Hash, Hasher},
    time::{Duration, Instant},
};

use serde::Deserialize;

const ALIAS_CACHE_TTL: Duration = Duration::from_secs(90);
const ALIAS_RESOLVE_TIMEOUT: Duration = Duration::from_millis(1500);

#[derive(Clone, Debug, Eq)]
struct ResolveCacheKey {
    alias: String,
    play_style: String,
    difficulty: String,
}

impl PartialEq for ResolveCacheKey {
    fn eq(&self, other: &Self) -> bool {
        self.alias == other.alias
            && self.play_style == other.play_style
            && self.difficulty == other.difficulty
    }
}

impl Hash for ResolveCacheKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.alias.hash(state);
        self.play_style.hash(state);
        self.difficulty.hash(state);
    }
}

#[derive(Clone, Debug)]
struct CachedResolveResult {
    fetched_at: Instant,
    result: RuntimeAliasResolveResult,
}

#[derive(Clone, Debug, Default)]
pub struct RuntimeAliasResolveResult {
    pub alias_exists: bool,
    pub title_search_keys: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct RuntimeAliasResolveHttpResponse {
    #[serde(default)]
    alias_exists: bool,
    #[serde(default)]
    title_search_keys: Vec<String>,
}

pub struct RuntimeAliasResolver {
    source_label: &'static str,
    api_base_url: String,
    client: reqwest::blocking::Client,
    cache: HashMap<ResolveCacheKey, CachedResolveResult>,
}

impl RuntimeAliasResolver {
    pub fn new(source_label: &'static str, api_base_url: Option<&str>) -> Option<Self> {
        let normalized_base_url = api_base_url
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| value.trim_end_matches('/').to_string())?;

        let client = match reqwest::blocking::Client::builder()
            .timeout(ALIAS_RESOLVE_TIMEOUT)
            .build()
        {
            Ok(client) => client,
            Err(error) => {
                eprintln!("{source_label}: failed to initialize alias resolver client: {error}");
                return None;
            }
        };

        Some(Self {
            source_label,
            api_base_url: normalized_base_url,
            client,
            cache: HashMap::new(),
        })
    }

    pub fn resolve_exact(
        &mut self,
        raw_alias: &str,
        play_style: &str,
        difficulty: &str,
    ) -> Result<RuntimeAliasResolveResult, String> {
        let alias = raw_alias.trim();
        if alias.is_empty() {
            return Ok(RuntimeAliasResolveResult::default());
        }

        let cache_key = ResolveCacheKey {
            alias: alias.to_string(),
            play_style: play_style.to_string(),
            difficulty: difficulty.to_string(),
        };

        let now = Instant::now();
        if let Some(cached) = self.cache.get(&cache_key) {
            if now.duration_since(cached.fetched_at) <= ALIAS_CACHE_TTL {
                return Ok(cached.result.clone());
            }
        }

        match self.fetch_alias_resolve(alias, play_style, difficulty) {
            Ok(result) => {
                self.cache.insert(
                    cache_key,
                    CachedResolveResult {
                        fetched_at: now,
                        result: result.clone(),
                    },
                );
                Ok(result)
            }
            Err(error) => {
                if let Some(cached) = self.cache.get(&cache_key) {
                    eprintln!(
                        "{}: alias resolve request failed; using stale cache for '{}' / {} / {}: {}",
                        self.source_label, alias, play_style, difficulty, error
                    );
                    return Ok(cached.result.clone());
                }
                Err(error)
            }
        }
    }

    fn fetch_alias_resolve(
        &self,
        alias: &str,
        play_style: &str,
        difficulty: &str,
    ) -> Result<RuntimeAliasResolveResult, String> {
        let request_url = format!("{}/api/chart-aliases/resolve", self.api_base_url);
        let response = self
            .client
            .get(request_url)
            .query(&[
                ("alias", alias),
                ("play_style", play_style),
                ("difficulty", difficulty),
            ])
            .send()
            .map_err(|error| {
                format!(
                    "failed to fetch runtime alias resolve for '{}' / {} / {}: {error}",
                    alias, play_style, difficulty
                )
            })?;

        if !response.status().is_success() {
            return Err(format!(
                "runtime alias resolve returned status {} for '{}' / {} / {}",
                response.status(),
                alias,
                play_style,
                difficulty
            ));
        }

        let payload = response
            .json::<RuntimeAliasResolveHttpResponse>()
            .map_err(|error| {
                format!(
                    "failed to parse runtime alias resolve response for '{}' / {} / {}: {error}",
                    alias, play_style, difficulty
                )
            })?;

        let mut deduped = Vec::new();
        for title_search_key in payload.title_search_keys {
            let normalized = title_search_key.trim();
            if normalized.is_empty() {
                continue;
            }
            if !deduped.iter().any(|value: &String| value == normalized) {
                deduped.push(normalized.to_string());
            }
        }

        Ok(RuntimeAliasResolveResult {
            alias_exists: payload.alias_exists,
            title_search_keys: deduped,
        })
    }
}
