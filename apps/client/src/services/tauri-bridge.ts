import type { SourceType } from "@infinitas/shared";
import type { SourcePaths } from "../stores/settings-store";

const SOURCE_WATCHER_EVENT_NAME = "source-watcher://event";

export type SourceWatcherStatus = "IDLE" | "RUNNING" | "STOPPED" | "ERROR" | "UNAVAILABLE";
export type SourceWatcherEventKind = "STARTED" | "STOPPED" | "FILE_CHANGED" | "ERROR";

export interface SourceWatcherStatePayload {
  status: SourceWatcherStatus;
  source: SourceType | null;
  watchedPaths: string[];
  detail: string;
  lastEventAtMs: number | null;
}

export interface ParsedSourceObservationPayload {
  timestamp: string;
  difficulty: string;
  title: string;
  titleSearchKey: string;
  score: number;
  misscount: number;
}

export interface ParsedSourceChangePayload {
  source: SourceType;
  filePath: string;
  fileSizeBytes: number;
  observations: ParsedSourceObservationPayload[];
}

export interface SourceWatcherEventPayload {
  kind: SourceWatcherEventKind;
  state: SourceWatcherStatePayload;
  filePath: string | null;
  detail: string;
  occurredAtMs: number;
  parserOutput: ParsedSourceChangePayload | null;
}

interface StartSourceWatcherRequest {
  source: SourceType;
  sourcePaths: SourcePaths;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

export async function getSourceWatcherState(): Promise<SourceWatcherStatePayload> {
  if (!isTauriRuntime()) {
    return createUnavailableState();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SourceWatcherStatePayload>("get_source_watcher_state");
}

export async function startSourceWatcher(
  request: StartSourceWatcherRequest,
): Promise<SourceWatcherStatePayload> {
  if (!isTauriRuntime()) {
    return createUnavailableState();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SourceWatcherStatePayload>("start_source_watcher", { request });
}

export async function stopSourceWatcher(): Promise<SourceWatcherStatePayload> {
  if (!isTauriRuntime()) {
    return createUnavailableState();
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SourceWatcherStatePayload>("stop_source_watcher");
}

export async function listenToSourceWatcherEvents(
  handler: (payload: SourceWatcherEventPayload) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  return listen<SourceWatcherEventPayload>(SOURCE_WATCHER_EVENT_NAME, (event) => {
    handler(event.payload);
  });
}

function createUnavailableState(): SourceWatcherStatePayload {
  return {
    status: "UNAVAILABLE",
    source: null,
    watchedPaths: [],
    detail: "Source watcher is available only inside the Tauri desktop app.",
    lastEventAtMs: null,
  };
}
