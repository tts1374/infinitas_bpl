import type { PlayStyle, SourceType } from "@infinitas/shared";
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
  playStyle: PlayStyle | null;
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

export interface SaveLocalResultJsonRequest {
  roomId: string;
  createdAt: string | null;
  jsonText: string;
}

export interface SaveLocalResultJsonResponse {
  filePath: string;
}

export interface NativeTtsSpeakRequest {
  text: string;
  voiceId?: string | null;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  queueMode?: "flush" | "add";
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

export async function saveLocalResultJson(
  request: SaveLocalResultJsonRequest,
): Promise<SaveLocalResultJsonResponse> {
  if (!isTauriRuntime()) {
    throw new Error("Local result save is available only inside the Tauri desktop app.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SaveLocalResultJsonResponse>("save_local_result_json", { request });
}

export async function speakNativeTts(request: NativeTtsSpeakRequest): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Native TTS is available only inside the Tauri desktop app.");
  }

  const { speak } = await import("tauri-plugin-tts-api");
  await speak({
    language: null,
    voiceId: null,
    rate: null,
    pitch: null,
    volume: null,
    queueMode: null,
    ...request,
  });
}

export async function stopNativeTts(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const { stop } = await import("tauri-plugin-tts-api");
  await stop();
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
