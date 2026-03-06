import type { ExpectedKey, SourceType } from "@infinitas/shared";
import {
  getSourceWatcherState,
  isTauriRuntime,
  listenToSourceWatcherEvents,
  type ParsedSourceObservationPayload,
  startSourceWatcher,
  stopSourceWatcher,
  type ParsedSourceChangePayload,
  type SourceWatcherEventKind,
  type SourceWatcherEventPayload,
  type SourceWatcherStatePayload,
  type SourceWatcherStatus,
} from "../services/tauri-bridge";
import { roomStore } from "./room-store";
import { createExternalStore, useExternalStore } from "./create-store";
import { settingsStore, type ClientSettings, type SourcePaths } from "./settings-store";

export interface SourceWatcherState {
  status: SourceWatcherStatus;
  source: SourceType | null;
  watchedPaths: string[];
  detail: string;
  lastEventAt: string | null;
}

export interface SourceWatcherEventLogEntry {
  kind: SourceWatcherEventKind;
  filePath: string | null;
  detail: string;
  occurredAt: string;
  parserOutput: ParsedSourceChangePayload | null;
}

export interface SourceStoreState {
  watcherState: SourceWatcherState;
  lastEvent: SourceWatcherEventLogEntry | null;
  runtimeReady: boolean;
}

interface StartOptions {
  force?: boolean;
}

let attachedListener: (() => void) | null = null;
let attachPromise: Promise<void> | null = null;
let appliedConfigKey: string | null = null;

const initialState: SourceStoreState = {
  watcherState: {
    status: "IDLE",
    source: null,
    watchedPaths: [],
    detail: "Watcher not attached.",
    lastEventAt: null,
  },
  lastEvent: null,
  runtimeReady: false,
};

const internalStore = createExternalStore<SourceStoreState>(initialState);

function createConfigKey(settings: Pick<ClientSettings, "source" | "sourcePaths">): string {
  return JSON.stringify({
    source: settings.source,
    sourcePaths: settings.sourcePaths,
  });
}

function toIsoString(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return new Date(value).toISOString();
}

function mapWatcherState(payload: SourceWatcherStatePayload): SourceWatcherState {
  return {
    status: payload.status,
    source: payload.source,
    watchedPaths: payload.watchedPaths,
    detail: payload.detail,
    lastEventAt: toIsoString(payload.lastEventAtMs),
  };
}

function mapWatcherEvent(payload: SourceWatcherEventPayload): SourceWatcherEventLogEntry {
  return {
    kind: payload.kind,
    filePath: payload.filePath,
    detail: payload.detail,
    occurredAt: new Date(payload.occurredAtMs).toISOString(),
    parserOutput: payload.parserOutput,
  };
}

function observationMatchesExpected(
  observation: ParsedSourceObservationPayload,
  expectedKey: ExpectedKey,
): boolean {
  const observedPlayStyle = observation.playStyle ?? expectedKey.play_style;
  return (
    observedPlayStyle === expectedKey.play_style &&
    observation.difficulty === expectedKey.difficulty &&
    observation.titleSearchKey === expectedKey.title_search_key
  );
}

function handleWatcherError(payload: SourceWatcherEventPayload): void {
  if (payload.kind !== "ERROR") {
    return;
  }

  roomStore.reportSourceUnavailable(payload.detail);
}

function tryAutoSubmitParsedChange(parsedChange: ParsedSourceChangePayload): void {
  if (parsedChange.observations.length === 0) {
    return;
  }

  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;
  const currentRound = snapshot?.current_round ?? null;
  if (
    roomState.connectionStatus !== "CONNECTED" ||
    snapshot === null ||
    snapshot.room_state !== "PLAYING" ||
    currentRound === null
  ) {
    return;
  }

  const savedSettings = settingsStore.getState().saved;
  if (currentRound.confirmed.some((entry) => entry.player_id === savedSettings.playerId)) {
    return;
  }

  const matchedObservation = parsedChange.observations.find((observation) =>
    observationMatchesExpected(observation, currentRound.expected_key),
  );
  if (!matchedObservation) {
    return;
  }

  const metricValue =
    snapshot.settings.win_metric === "SCORE"
      ? matchedObservation.score
      : matchedObservation.misscount;
  const observedPlayStyle =
    matchedObservation.playStyle ?? currentRound.expected_key.play_style;
  if (!Number.isInteger(metricValue) || metricValue < 0) {
    return;
  }

  const sent = roomStore.send("RESULT_SUBMIT", {
    round_index: currentRound.round_index,
    observed_key: {
      play_style: observedPlayStyle,
      difficulty: matchedObservation.difficulty,
      title_search_key: matchedObservation.titleSearchKey,
    },
    metric_value: metricValue,
    source_meta: {
      source: parsedChange.source,
      timestamp: matchedObservation.timestamp,
      difficulty: matchedObservation.difficulty,
      title: matchedObservation.title,
      title_search_key: matchedObservation.titleSearchKey,
      score: matchedObservation.score,
      misscount: matchedObservation.misscount,
      file_path: parsedChange.filePath,
    },
  });

  if (!sent) {
    return;
  }

  const timestampLabel =
    matchedObservation.timestamp.trim().length > 0 ? ` (${matchedObservation.timestamp})` : "";
  roomStore.noteLocalEvent(
    `Auto-submitted ${snapshot.settings.win_metric} from ${parsedChange.source}${timestampLabel}.`,
  );
}

function handleWatcherEvent(payload: SourceWatcherEventPayload): void {
  internalStore.setState((state) => ({
    ...state,
    runtimeReady: true,
    watcherState: mapWatcherState(payload.state),
    lastEvent: mapWatcherEvent(payload),
  }));

  handleWatcherError(payload);

  if (payload.kind !== "FILE_CHANGED" || payload.parserOutput === null) {
    return;
  }

  tryAutoSubmitParsedChange(payload.parserOutput);
}

function getMissingPathMessage(source: SourceType, paths: SourcePaths): string | null {
  if (source === "inf_daken_counter" && paths.dakenTodayUpdateXml.trim().length === 0) {
    return "Set inf_daken_counter / today_update.xml before starting the watcher.";
  }

  if (source === "inf-notebook" && paths.notebookExportRecentJson.trim().length === 0) {
    return "Set inf-notebook / export/recent.json before starting the watcher.";
  }

  return null;
}

async function ensureAttached(): Promise<void> {
  if (attachedListener !== null) {
    return;
  }

  if (attachPromise !== null) {
    await attachPromise;
    return;
  }

  attachPromise = (async () => {
    if (!isTauriRuntime()) {
      internalStore.setState((state) => ({
        ...state,
        runtimeReady: false,
        watcherState: {
          status: "UNAVAILABLE",
          source: null,
          watchedPaths: [],
          detail: "Source watcher is available only inside the Tauri desktop app.",
          lastEventAt: null,
        },
      }));
      return;
    }

    attachedListener = await listenToSourceWatcherEvents(handleWatcherEvent);

    const statePayload = await getSourceWatcherState();
    internalStore.setState((state) => ({
      ...state,
      runtimeReady: true,
      watcherState: mapWatcherState(statePayload),
    }));
  })().finally(() => {
    attachPromise = null;
  });

  await attachPromise;
}

export const sourceStore = {
  ...internalStore,
  async attach(): Promise<void> {
    await ensureAttached();
  },
  detach(): void {
    attachedListener?.();
    attachedListener = null;
    attachPromise = null;
    internalStore.setState((state) => ({
      ...state,
      runtimeReady: false,
    }));
  },
  async start(
    settings: Pick<ClientSettings, "source" | "sourcePaths">,
    options: StartOptions = {},
  ): Promise<void> {
    await ensureAttached();

    if (!isTauriRuntime()) {
      return;
    }

    const missingPathMessage = getMissingPathMessage(settings.source, settings.sourcePaths);
    if (missingPathMessage) {
      appliedConfigKey = null;
      const currentWatcherState = internalStore.getState().watcherState;
      if (currentWatcherState.source !== null && currentWatcherState.status !== "IDLE") {
        try {
          const stoppedPayload = await stopSourceWatcher();
          internalStore.setState((state) => ({
            ...state,
            watcherState: mapWatcherState(stoppedPayload),
          }));
        } catch {
          // Keep the UI actionable even if the previous watcher has already exited.
        }
      }

      internalStore.setState((state) => ({
        ...state,
        watcherState: {
          ...state.watcherState,
          status: "IDLE",
          source: settings.source,
          watchedPaths: [],
          detail: missingPathMessage,
          lastEventAt: null,
        },
      }));
      roomStore.reportSourceUnavailable(missingPathMessage);
      return;
    }

    const nextConfigKey = createConfigKey(settings);
    const currentState = internalStore.getState().watcherState;
    if (!options.force && appliedConfigKey === nextConfigKey && currentState.status === "RUNNING") {
      return;
    }

    try {
      const payload = await startSourceWatcher({
        source: settings.source,
        sourcePaths: settings.sourcePaths,
      });

      appliedConfigKey = nextConfigKey;
      internalStore.setState((state) => ({
        ...state,
        watcherState: mapWatcherState(payload),
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start watcher.";
      internalStore.setState((state) => ({
        ...state,
        watcherState: {
          ...state.watcherState,
          status: "ERROR",
          source: settings.source,
          detail: errorMessage,
          watchedPaths: [],
          lastEventAt: new Date().toISOString(),
        },
      }));
      roomStore.reportSourceUnavailable(errorMessage);
    }
  },
  async stop(): Promise<void> {
    await ensureAttached();

    if (!isTauriRuntime()) {
      return;
    }

    try {
      const payload = await stopSourceWatcher();
      appliedConfigKey = null;
      internalStore.setState((state) => ({
        ...state,
        watcherState: mapWatcherState(payload),
      }));
    } catch (error) {
      internalStore.setState((state) => ({
        ...state,
        watcherState: {
          ...state.watcherState,
          status: "ERROR",
          detail: error instanceof Error ? error.message : "Failed to stop watcher.",
          lastEventAt: new Date().toISOString(),
        },
      }));
    }
  },
};

export function useSourceStore<TSelected>(
  selector: (state: SourceStoreState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
