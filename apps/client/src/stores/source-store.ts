import type { SourceType } from "@infinitas/shared";
import {
  getSourceWatcherState,
  isTauriRuntime,
  listenToSourceWatcherEvents,
  type ParsedSourceChangePayload,
  type ParsedSourceUnresolvedCasePayload,
  startSourceWatcher,
  stopSourceWatcher,
  type SourceWatcherEventKind,
  type SourceWatcherEventPayload,
  type SourceWatcherStatePayload,
  type SourceWatcherStatus,
} from "../services/tauri-bridge";
import {
  submitNotebookForcedRegistration,
  submitParsedSourceChange,
  type NotebookDialogChartInfo,
  type NotebookForcedRegistrationPayload,
} from "../services/source-submission";
import { roomStore } from "./room-store";
import { createExternalStore, useExternalStore } from "./create-store";
import { type ClientSettings, type SourcePaths } from "./settings-store";

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
  activeUnresolvedDialog: SourceUnresolvedDialog | null;
  unresolvedDialogQueue: SourceUnresolvedDialog[];
  runtimeReady: boolean;
}

type DialogAction = "accept" | "skip" | "close";

interface SourceDialogChartInfo {
  title: string;
  titleSearchKey: string | null;
  playStyle: "SP" | "DP";
  difficulty: string;
  metricLabel: "EXSCORE" | "MISSCOUNT";
  metricValue: number | null;
}

interface SourceUnresolvedDialogBase {
  id: string;
  source: SourceType;
  originLabel: string;
}

export interface SourceUnresolvedAliasDialog extends SourceUnresolvedDialogBase {
  kind: "unresolved_alias";
  expectedTarget: SourceDialogChartInfo;
  parsedResult: SourceDialogChartInfo;
  mismatchReason: string;
  forcePayload: NotebookForcedRegistrationPayload;
}

export interface SourceResolvedPartialDialog extends SourceUnresolvedDialogBase {
  kind: "resolved_partial";
  chart: SourceDialogChartInfo;
}

export interface SourceCatalogUnresolvedAliasDialog extends SourceUnresolvedDialogBase {
  kind: "unresolved_alias_catalog";
  chart: SourceDialogChartInfo;
  errorCode: "NB-UNRESOLVED-ALIAS";
}

export interface SourceAmbiguousRecentDialog extends SourceUnresolvedDialogBase {
  kind: "ambiguous_recent";
  chart: SourceDialogChartInfo;
  candidateCount: number;
  errorCode: "NB-AMBIGUOUS-RECENT";
}

export type SourceUnresolvedDialog =
  | SourceUnresolvedAliasDialog
  | SourceResolvedPartialDialog
  | SourceCatalogUnresolvedAliasDialog
  | SourceAmbiguousRecentDialog;

interface StartOptions {
  force?: boolean;
}

let attachedListener: (() => void) | null = null;
let attachPromise: Promise<void> | null = null;
let appliedConfigKey: string | null = null;
let unresolvedDialogSequence = 0;

const initialState: SourceStoreState = {
  watcherState: {
    status: "IDLE",
    source: null,
    watchedPaths: [],
    detail: "Watcher not attached.",
    lastEventAt: null,
  },
  lastEvent: null,
  activeUnresolvedDialog: null,
  unresolvedDialogQueue: [],
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

function nextUnresolvedDialogId(): string {
  unresolvedDialogSequence += 1;
  return `source-unresolved-${Date.now()}-${unresolvedDialogSequence}`;
}

function getActiveRoundMetricContext():
  | { winMetric: "SCORE" | "MISSCOUNT"; metricLabel: "EXSCORE" | "MISSCOUNT" }
  | null {
  const snapshot = roomStore.getState().snapshot;
  if (snapshot === null || snapshot.room_state !== "PLAYING" || snapshot.current_round === null) {
    return null;
  }

  return {
    winMetric: snapshot.settings.win_metric,
    metricLabel: snapshot.settings.win_metric === "SCORE" ? "EXSCORE" : "MISSCOUNT",
  };
}

function normalizePlayStyle(value: string): "SP" | "DP" {
  return value === "DP" ? "DP" : "SP";
}

function buildDialogChartInfo(
  unresolvedCase: ParsedSourceUnresolvedCasePayload,
  metricContext: { winMetric: "SCORE" | "MISSCOUNT"; metricLabel: "EXSCORE" | "MISSCOUNT" },
): SourceDialogChartInfo {
  const metricValue =
    metricContext.winMetric === "SCORE" ? unresolvedCase.score : unresolvedCase.misscount;
  return {
    title:
      unresolvedCase.title.trim().length > 0
        ? unresolvedCase.title
        : (unresolvedCase.titleSearchKey ?? "(unknown)"),
    titleSearchKey: unresolvedCase.titleSearchKey,
    playStyle: normalizePlayStyle(unresolvedCase.playStyle),
    difficulty: unresolvedCase.difficulty,
    metricLabel: metricContext.metricLabel,
    metricValue,
  };
}

function buildUnresolvedDialogsFromParserOutput(
  parserOutput: ParsedSourceChangePayload,
): SourceUnresolvedDialog[] {
  const metricContext = getActiveRoundMetricContext();
  if (metricContext === null) {
    return [];
  }

  const unresolvedCases = parserOutput.unresolvedCases ?? [];
  const dialogs: SourceUnresolvedDialog[] = [];
  for (const unresolvedCase of unresolvedCases) {
    if (unresolvedCase.kind === "unresolved_alias") {
      dialogs.push({
        id: nextUnresolvedDialogId(),
        kind: "unresolved_alias_catalog",
        source: parserOutput.source,
        originLabel: parserOutput.source,
        chart: buildDialogChartInfo(unresolvedCase, metricContext),
        errorCode: "NB-UNRESOLVED-ALIAS",
      });
      continue;
    }

    if (unresolvedCase.kind === "resolved_partial") {
      dialogs.push({
        id: nextUnresolvedDialogId(),
        kind: "resolved_partial",
        source: parserOutput.source,
        originLabel: parserOutput.source,
        chart: buildDialogChartInfo(unresolvedCase, metricContext),
      });
      continue;
    }

    if (unresolvedCase.kind === "ambiguous_recent") {
      dialogs.push({
        id: nextUnresolvedDialogId(),
        kind: "ambiguous_recent",
        source: parserOutput.source,
        originLabel: parserOutput.source,
        chart: buildDialogChartInfo(unresolvedCase, metricContext),
        candidateCount: Math.max(2, unresolvedCase.recentCandidateCount ?? 2),
        errorCode: "NB-AMBIGUOUS-RECENT",
      });
    }
  }

  return dialogs;
}

function buildUnresolvedAliasDialog(
  source: SourceType,
  pending: {
    expectedTarget: NotebookDialogChartInfo;
    parsedResult: NotebookDialogChartInfo;
    mismatchReason: string;
    forcePayload: NotebookForcedRegistrationPayload;
  },
): SourceUnresolvedAliasDialog {
  return {
    id: nextUnresolvedDialogId(),
    kind: "unresolved_alias",
    source,
    originLabel: source,
    expectedTarget: pending.expectedTarget,
    parsedResult: pending.parsedResult,
    mismatchReason: pending.mismatchReason,
    forcePayload: pending.forcePayload,
  };
}

function enqueueUnresolvedDialogs(newDialogs: SourceUnresolvedDialog[]): void {
  if (newDialogs.length === 0) {
    return;
  }

  internalStore.setState((state) => {
    const queue = [...state.unresolvedDialogQueue, ...newDialogs];
    if (state.activeUnresolvedDialog !== null) {
      return {
        ...state,
        unresolvedDialogQueue: queue,
      };
    }

    const [nextDialog, ...remainingQueue] = queue;
    return {
      ...state,
      activeUnresolvedDialog: nextDialog ?? null,
      unresolvedDialogQueue: remainingQueue,
    };
  });
}

function advanceUnresolvedDialogQueue(): void {
  internalStore.setState((state) => {
    if (state.unresolvedDialogQueue.length === 0) {
      return {
        ...state,
        activeUnresolvedDialog: null,
      };
    }

    const [nextDialog, ...remainingQueue] = state.unresolvedDialogQueue;
    return {
      ...state,
      activeUnresolvedDialog: nextDialog ?? null,
      unresolvedDialogQueue: remainingQueue,
    };
  });
}

function handleWatcherError(payload: SourceWatcherEventPayload): void {
  if (payload.kind !== "ERROR") {
    return;
  }

  roomStore.reportSourceUnavailable(payload.detail);
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

  const unresolvedDialogs = buildUnresolvedDialogsFromParserOutput(payload.parserOutput);
  const outcome = submitParsedSourceChange(payload.parserOutput, payload.parserOutput.source);
  if (outcome.pendingUnresolvedAlias) {
    unresolvedDialogs.push(
      buildUnresolvedAliasDialog(payload.parserOutput.source, outcome.pendingUnresolvedAlias),
    );
  }

  enqueueUnresolvedDialogs(unresolvedDialogs);

  if (!outcome.ok && outcome.pendingUnresolvedAlias === undefined && unresolvedDialogs.length === 0) {
    roomStore.noteLocalEvent(`Source auto-submit skipped: ${outcome.message}`);
  }
}

function getMissingPathMessage(source: SourceType, paths: SourcePaths): string | null {
  if (source === "inf_daken_counter" && paths.dakenTodayUpdateXml.trim().length === 0) {
    return "Set inf_daken_counter / today_update.xml before starting the watcher.";
  }

  if (source === "inf-notebook" && paths.notebookExportRecentJson.trim().length === 0) {
    return "Set inf-notebook / export/recent.json before starting the watcher.";
  }

  if (source === "inf-notebook" && paths.notebookRecordsRecentJson.trim().length === 0) {
    return "Set inf-notebook / records/summary.json before starting the watcher.";
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

function logUnresolvedAliasDecision(
  dialog: SourceUnresolvedAliasDialog,
  userAccepted: boolean,
): void {
  const logPayload: {
    expected_target: SourceUnresolvedAliasDialog["expectedTarget"];
    parsed_result: SourceUnresolvedAliasDialog["parsedResult"];
    mismatch_reason: string;
    user_accepted: boolean;
    user_skipped?: boolean;
  } = {
    expected_target: dialog.expectedTarget,
    parsed_result: dialog.parsedResult,
    mismatch_reason: dialog.mismatchReason,
    user_accepted: userAccepted,
  };
  if (!userAccepted) {
    logPayload.user_skipped = true;
  }
  console.info("inf-notebook unresolved_alias decision", logPayload);
}

export const sourceStore = {
  ...internalStore,
  async attach(): Promise<void> {
    await ensureAttached();
  },
  resolveActiveUnresolvedDialog(action: DialogAction): void {
    const activeDialog = internalStore.getState().activeUnresolvedDialog;
    if (activeDialog === null) {
      return;
    }

    if (activeDialog.kind === "unresolved_alias") {
      const userAccepted = action === "accept";
      logUnresolvedAliasDecision(activeDialog, userAccepted);
      if (userAccepted) {
        const outcome = submitNotebookForcedRegistration(
          activeDialog.forcePayload,
          activeDialog.originLabel,
        );
        if (!outcome.ok) {
          roomStore.noteLocalEvent(`Source auto-submit skipped: ${outcome.message}`);
        }
      } else {
        roomStore.noteLocalEvent("Source auto-submit skipped: unresolved_alias was not approved.");
      }
    } else if (activeDialog.kind === "resolved_partial") {
      roomStore.noteLocalEvent(
        "Source auto-submit skipped: inf-notebook resolved_partial requires re-registration.",
      );
    } else if (activeDialog.kind === "unresolved_alias_catalog") {
      roomStore.noteLocalEvent(
        `Source auto-submit skipped: ${activeDialog.errorCode} (unresolved alias).`,
      );
    } else {
      roomStore.noteLocalEvent(
        `Source auto-submit skipped: ${activeDialog.errorCode} (candidates=${activeDialog.candidateCount}).`,
      );
    }

    advanceUnresolvedDialogQueue();
  },
  detach(): void {
    attachedListener?.();
    attachedListener = null;
    attachPromise = null;
    internalStore.setState((state) => ({
      ...state,
      runtimeReady: false,
      activeUnresolvedDialog: null,
      unresolvedDialogQueue: [],
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
