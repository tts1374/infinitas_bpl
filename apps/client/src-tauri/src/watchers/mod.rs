use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::models::{
    now_ms, SourcePathsConfig, SourceType, SourceWatcherEventKind, SourceWatcherEventPayload,
    SourceWatcherStatePayload, SourceWatcherStatus, StartSourceWatcherRequest,
    SOURCE_WATCHER_EVENT_NAME,
};
use crate::parsers::{create_parser, ParserInput};

#[derive(Default)]
pub struct SourceWatcherManager {
    inner: Arc<Mutex<ManagerState>>,
}

struct ManagerState {
    payload: SourceWatcherStatePayload,
    active: Option<ActiveWatcher>,
}

impl Default for ManagerState {
    fn default() -> Self {
        Self {
            payload: SourceWatcherStatePayload::default(),
            active: None,
        }
    }
}

struct ActiveWatcher {
    shutdown_tx: Sender<()>,
    join_handle: JoinHandle<()>,
}

struct WatchSpec {
    source: SourceType,
    source_paths: SourcePathsConfig,
    watched_paths: Vec<String>,
    watched_keys: HashSet<String>,
    parent_directories: Vec<PathBuf>,
}

impl SourceWatcherManager {
    pub fn get_state(&self) -> SourceWatcherStatePayload {
        self.inner
            .lock()
            .expect("source watcher state poisoned")
            .payload
            .clone()
    }

    pub fn start(
        &self,
        app: &AppHandle,
        request: StartSourceWatcherRequest,
    ) -> Result<SourceWatcherStatePayload, String> {
        let spec = WatchSpec::from_request(&request)?;
        let watched_paths = spec.watched_paths.clone();
        let source = spec.source.clone();
        let has_active_watcher = self
            .inner
            .lock()
            .expect("source watcher state poisoned")
            .active
            .is_some();

        if has_active_watcher {
            self.stop(app, "Watcher restarted with updated source settings.");
        }

        let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
        let inner = Arc::clone(&self.inner);
        let thread_inner = Arc::clone(&self.inner);
        let app_handle = app.clone();

        {
            let mut guard = inner.lock().expect("source watcher state poisoned");
            guard.payload = SourceWatcherStatePayload {
                status: SourceWatcherStatus::Running,
                source: Some(source),
                watched_paths,
                detail: "Watching source files.".to_string(),
                last_event_at_ms: Some(now_ms()),
            };
        }

        let join_handle = thread::spawn(move || {
            run_watcher_loop(app_handle, thread_inner, spec, shutdown_rx);
        });

        let payload = {
            let mut guard = inner.lock().expect("source watcher state poisoned");
            let payload = guard.payload.clone();
            guard.active = Some(ActiveWatcher {
                shutdown_tx,
                join_handle,
            });
            payload
        };

        emit_event(
            app,
            SourceWatcherEventPayload {
                kind: SourceWatcherEventKind::Started,
                state: payload.clone(),
                file_path: None,
                detail: payload.detail.clone(),
                occurred_at_ms: now_ms(),
                parser_output: None,
            },
        );

        Ok(payload)
    }

    pub fn stop(&self, app: &AppHandle, detail: &str) -> SourceWatcherStatePayload {
        let active = {
            self.inner
                .lock()
                .expect("source watcher state poisoned")
                .active
                .take()
        };

        if let Some(active) = active {
            let _ = active.shutdown_tx.send(());
            let _ = active.join_handle.join();
        }

        let payload = {
            let mut guard = self.inner.lock().expect("source watcher state poisoned");
            let previous_source = guard.payload.source.clone();
            let previous_paths = guard.payload.watched_paths.clone();
            let status = if previous_source.is_some() {
                SourceWatcherStatus::Stopped
            } else {
                SourceWatcherStatus::Idle
            };

            guard.payload = SourceWatcherStatePayload {
                status,
                source: previous_source,
                watched_paths: previous_paths,
                detail: detail.to_string(),
                last_event_at_ms: Some(now_ms()),
            };
            guard.payload.clone()
        };

        emit_event(
            app,
            SourceWatcherEventPayload {
                kind: SourceWatcherEventKind::Stopped,
                state: payload.clone(),
                file_path: None,
                detail: payload.detail.clone(),
                occurred_at_ms: now_ms(),
                parser_output: None,
            },
        );

        payload
    }
}

impl WatchSpec {
    fn from_request(request: &StartSourceWatcherRequest) -> Result<Self, String> {
        let watched_files = resolve_watched_files(&request.source, &request.source_paths)?;
        let mut watched_paths = Vec::with_capacity(watched_files.len());
        let mut watched_keys = HashSet::with_capacity(watched_files.len());
        let mut parent_directories = Vec::new();
        let mut seen_directories = HashSet::new();

        for watched_file in watched_files {
            let key = path_key(&watched_file);
            let display_path = watched_file.to_string_lossy().into_owned();
            watched_paths.push(display_path);
            watched_keys.insert(key);

            let parent = watched_file.parent().ok_or_else(|| {
                format!(
                    "Cannot watch {} because the parent directory is missing.",
                    watched_file.to_string_lossy()
                )
            })?;

            if !parent.exists() || !parent.is_dir() {
                return Err(format!(
                    "Cannot watch {} because {} is not an existing directory.",
                    watched_file.to_string_lossy(),
                    parent.to_string_lossy()
                ));
            }

            let parent_key = path_key(parent);
            if seen_directories.insert(parent_key) {
                parent_directories.push(parent.to_path_buf());
            }
        }

        Ok(Self {
            source: request.source.clone(),
            source_paths: request.source_paths.clone(),
            watched_paths,
            watched_keys,
            parent_directories,
        })
    }
}

fn run_watcher_loop(
    app: AppHandle,
    inner: Arc<Mutex<ManagerState>>,
    spec: WatchSpec,
    shutdown_rx: mpsc::Receiver<()>,
) {
    let mut parser = create_parser(&spec.source, &spec.source_paths);
    let (event_tx, event_rx) = mpsc::channel::<Result<Event, notify::Error>>();
    let watcher_result = create_recommended_watcher(&spec, event_tx);

    let mut watcher = match watcher_result {
        Ok(watcher) => watcher,
        Err(error) => {
            publish_error(&app, &inner, &error, None);
            return;
        }
    };

    for directory in &spec.parent_directories {
        if let Err(error) = watcher.watch(directory, RecursiveMode::NonRecursive) {
            publish_error(
                &app,
                &inner,
                &format!("Failed to watch {}: {error}", directory.to_string_lossy()),
                None,
            );
            return;
        }
    }

    loop {
        if shutdown_rx.try_recv().is_ok() {
            break;
        }

        match event_rx.recv_timeout(Duration::from_millis(250)) {
            Ok(Ok(event)) => handle_notify_event(&app, &inner, &spec, parser.as_mut(), event),
            Ok(Err(error)) => publish_error(&app, &inner, &error.to_string(), None),
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => {
                publish_error(&app, &inner, "Watcher event channel disconnected.", None);
                break;
            }
        }
    }
}

fn create_recommended_watcher(
    spec: &WatchSpec,
    event_tx: Sender<Result<Event, notify::Error>>,
) -> Result<RecommendedWatcher, String> {
    let source_label = spec.source.label().to_string();

    RecommendedWatcher::new(
        move |event| {
            let _ = event_tx.send(event);
        },
        Config::default(),
    )
    .map_err(|error| format!("Failed to create {source_label} watcher: {error}"))
}

fn handle_notify_event(
    app: &AppHandle,
    inner: &Arc<Mutex<ManagerState>>,
    spec: &WatchSpec,
    parser: &mut dyn crate::parsers::SourceParser,
    event: Event,
) {
    if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
        return;
    }

    for changed_path in event
        .paths
        .into_iter()
        .filter(|path| spec.watched_keys.contains(&path_key(path)))
    {
        let parser_input = ParserInput {
            changed_path: changed_path.clone(),
        };

        match parser.parse(&parser_input) {
            Ok(Some(parsed_change)) => {
                let occurred_at_ms = now_ms();
                let detail = format!("Detected file change: {}", parsed_change.file_path);
                let state = update_state(
                    inner,
                    SourceWatcherStatus::Running,
                    detail.clone(),
                    Some(occurred_at_ms),
                );

                emit_event(
                    app,
                    SourceWatcherEventPayload {
                        kind: SourceWatcherEventKind::FileChanged,
                        state,
                        file_path: Some(changed_path.to_string_lossy().into_owned()),
                        detail,
                        occurred_at_ms,
                        parser_output: Some(parsed_change),
                    },
                );
            }
            Ok(None) => {}
            Err(error) => {
                publish_unavailable(
                    app,
                    inner,
                    &error,
                    Some(changed_path.to_string_lossy().into_owned()),
                );
            }
        }
    }
}

fn publish_error(
    app: &AppHandle,
    inner: &Arc<Mutex<ManagerState>>,
    detail: &str,
    file_path: Option<String>,
) {
    publish_with_status(app, inner, SourceWatcherStatus::Error, detail, file_path);
}

fn publish_unavailable(
    app: &AppHandle,
    inner: &Arc<Mutex<ManagerState>>,
    detail: &str,
    file_path: Option<String>,
) {
    publish_with_status(
        app,
        inner,
        SourceWatcherStatus::Unavailable,
        detail,
        file_path,
    );
}

fn publish_with_status(
    app: &AppHandle,
    inner: &Arc<Mutex<ManagerState>>,
    status: SourceWatcherStatus,
    detail: &str,
    file_path: Option<String>,
) {
    let occurred_at_ms = now_ms();
    let state = update_state(inner, status, detail.to_string(), Some(occurred_at_ms));

    emit_event(
        app,
        SourceWatcherEventPayload {
            kind: SourceWatcherEventKind::Error,
            state,
            file_path,
            detail: detail.to_string(),
            occurred_at_ms,
            parser_output: None,
        },
    );
}

fn update_state(
    inner: &Arc<Mutex<ManagerState>>,
    status: SourceWatcherStatus,
    detail: String,
    last_event_at_ms: Option<u64>,
) -> SourceWatcherStatePayload {
    let mut guard = inner.lock().expect("source watcher state poisoned");
    guard.payload.status = status;
    guard.payload.detail = detail;
    guard.payload.last_event_at_ms = last_event_at_ms;
    guard.payload.clone()
}

fn emit_event(app: &AppHandle, payload: SourceWatcherEventPayload) {
    let _ = app.emit(SOURCE_WATCHER_EVENT_NAME, payload);
}

fn resolve_watched_files(
    source: &SourceType,
    source_paths: &SourcePathsConfig,
) -> Result<Vec<PathBuf>, String> {
    match source {
        SourceType::InfDakenCounter => Ok(vec![require_path(
            &source_paths.daken_today_update_xml,
            "inf_daken_counter / today_update.xml",
        )?]),
        SourceType::InfNotebook => {
            let mut paths = vec![require_path(
                &source_paths.notebook_export_recent_json,
                "inf-notebook / export/recent.json",
            )?];

            let optional_path = source_paths.notebook_records_recent_json.trim();
            if !optional_path.is_empty() {
                paths.push(PathBuf::from(optional_path));
            }

            Ok(paths)
        }
    }
}

fn require_path(raw_path: &str, label: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(format!("Set {label} before starting the watcher."));
    }

    Ok(PathBuf::from(trimmed))
}

fn path_key(path: &Path) -> String {
    let normalized = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .replace('/', "\\");

    normalized.to_lowercase()
}
