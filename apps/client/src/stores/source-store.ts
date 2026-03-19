import type { RoomStateSnapshot, SourceType } from "@infinitas/shared";
import {
  getSourceWatcherState,
  isTauriRuntime,
  listenToSourceWatcherEvents,
  type ParsedSourceChangePayload,
  type ParsedSourceObservationPayload,
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
import { isValidPortNumber, type ClientSettings, type SourcePaths } from "./settings-store";

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
let latestSettings: Pick<ClientSettings, "source" | "sourcePaths" | "dakenCounterV3Port"> | null = null;
let dakenCounterV3Socket: WebSocket | null = null;
let dakenCounterV3SocketPort: number | null = null;
let dakenCounterV3ReconnectTimer: number | null = null;
let dakenCounterV3MonitoringEnabled = false;
let dakenCounterV3LastRoomState: RoomStateSnapshot["room_state"] | null = null;
let dakenCounterV3HasSnapshotBaseline = false;
let dakenCounterV3SnapshotFingerprintCounts = new Map<string, number>();
const dakenCounterV3ProcessedFingerprints = new Set<string>();
const dakenCounterV3ProcessedFingerprintQueue: string[] = [];

const DAKEN_COUNTER_V3_SOURCE: SourceType = "daken_counter_v3";
const DAKEN_COUNTER_V3_ORIGIN_LABEL = "打鍵カウンタv3";
const DAKEN_COUNTER_V3_DEFAULT_PORT = 8767;
const DAKEN_COUNTER_V3_WARNING_MESSAGE =
  "打鍵カウンタv3 に接続できませんでした。ポート設定と起動状態を確認してください。";
const DAKEN_COUNTER_V3_HISTORY_LIMIT = 512;
const DAKEN_COUNTER_V3_RECONNECT_DELAY_MS = 2000;

function formatSourceOriginLabel(source: SourceType): string {
  if (source === "reflux") {
    return "Reflux";
  }
  return source;
}

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

function createConfigKey(settings: Pick<ClientSettings, "source" | "sourcePaths" | "dakenCounterV3Port">): string {
  return JSON.stringify({
    source: settings.source,
    sourcePaths: settings.sourcePaths,
    dakenCounterV3Port: settings.dakenCounterV3Port,
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

interface DakenCounterV3ObservationEntry {
  fingerprint: string;
  observation: ParsedSourceObservationPayload;
}

const DAKEN_COUNTER_V3_DIFFICULTY_MAP: Record<
  string,
  { playStyle: "SP" | "DP"; difficulty: ParsedSourceObservationPayload["difficulty"] }
> = {
  SPB: { playStyle: "SP", difficulty: "BEGINNER" },
  SPN: { playStyle: "SP", difficulty: "NORMAL" },
  SPH: { playStyle: "SP", difficulty: "HYPER" },
  SPA: { playStyle: "SP", difficulty: "ANOTHER" },
  SPL: { playStyle: "SP", difficulty: "LEGGENDARIA" },
  DPB: { playStyle: "DP", difficulty: "BEGINNER" },
  DPN: { playStyle: "DP", difficulty: "NORMAL" },
  DPH: { playStyle: "DP", difficulty: "HYPER" },
  DPA: { playStyle: "DP", difficulty: "ANOTHER" },
  DPL: { playStyle: "DP", difficulty: "LEGGENDARIA" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTitle(value: unknown): string | null {
  const rawTitle = normalizeText(value);
  if (rawTitle.length === 0) {
    return null;
  }

  const normalized = rawTitle
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .join(" ")
    .replace(/ \(/g, "(")
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return normalized >= 0 ? normalized : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDifficultyCode(rawDifficulty: unknown): {
  code: string;
  playStyle: "SP" | "DP";
  difficulty: ParsedSourceObservationPayload["difficulty"];
} | null {
  const normalized = normalizeText(rawDifficulty).normalize("NFKC").toUpperCase();
  if (normalized.length === 0) {
    return null;
  }

  const mapped = DAKEN_COUNTER_V3_DIFFICULTY_MAP[normalized];
  if (!mapped) {
    return null;
  }

  return {
    code: normalized,
    playStyle: mapped.playStyle,
    difficulty: mapped.difficulty,
  };
}

function fingerprintHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function rememberProcessedFingerprint(fingerprint: string): void {
  if (dakenCounterV3ProcessedFingerprints.has(fingerprint)) {
    return;
  }

  dakenCounterV3ProcessedFingerprints.add(fingerprint);
  dakenCounterV3ProcessedFingerprintQueue.push(fingerprint);
  while (dakenCounterV3ProcessedFingerprintQueue.length > DAKEN_COUNTER_V3_HISTORY_LIMIT) {
    const oldest = dakenCounterV3ProcessedFingerprintQueue.shift();
    if (oldest !== undefined) {
      dakenCounterV3ProcessedFingerprints.delete(oldest);
    }
  }
}

function resetDakenCounterV3SnapshotTracking(): void {
  dakenCounterV3MonitoringEnabled = false;
  dakenCounterV3LastRoomState = null;
  dakenCounterV3HasSnapshotBaseline = false;
  dakenCounterV3SnapshotFingerprintCounts = new Map<string, number>();
  dakenCounterV3ProcessedFingerprints.clear();
  dakenCounterV3ProcessedFingerprintQueue.splice(0, dakenCounterV3ProcessedFingerprintQueue.length);
}

function resetDakenCounterV3MatchTracking(): void {
  dakenCounterV3MonitoringEnabled = false;
  dakenCounterV3HasSnapshotBaseline = false;
  dakenCounterV3SnapshotFingerprintCounts = new Map<string, number>();
  dakenCounterV3ProcessedFingerprints.clear();
  dakenCounterV3ProcessedFingerprintQueue.splice(0, dakenCounterV3ProcessedFingerprintQueue.length);
}

function clearDakenCounterV3ReconnectTimer(): void {
  if (dakenCounterV3ReconnectTimer !== null) {
    window.clearTimeout(dakenCounterV3ReconnectTimer);
    dakenCounterV3ReconnectTimer = null;
  }
}

function buildDakenCounterV3Endpoint(port: number): string {
  return `ws://localhost:${port}`;
}

function currentDakenCounterV3Port(): number {
  const configuredPort = latestSettings?.dakenCounterV3Port ?? DAKEN_COUNTER_V3_DEFAULT_PORT;
  return isValidPortNumber(configuredPort) ? configuredPort : DAKEN_COUNTER_V3_DEFAULT_PORT;
}

function isDakenCounterV3SocketOpen(): boolean {
  return dakenCounterV3Socket !== null && dakenCounterV3Socket.readyState === WebSocket.OPEN;
}

function updateDakenCounterV3WatcherState(
  status: SourceWatcherStatus,
  detail: string,
  watchedPaths: string[] = [],
): void {
  internalStore.setState((state) => ({
    ...state,
    watcherState: {
      ...state.watcherState,
      status,
      source: DAKEN_COUNTER_V3_SOURCE,
      watchedPaths,
      detail,
      lastEventAt: new Date().toISOString(),
    },
  }));
}

function parseDakenCounterV3Item(
  rawItem: unknown,
  index: number,
): DakenCounterV3ObservationEntry | null {
  if (!isRecord(rawItem)) {
    console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded item[${index}] because it is not an object.`);
    return null;
  }

  const battle = parseNonNegativeInteger(rawItem.battle);
  if (battle === 1) {
    console.info(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded item[${index}] because battle == 1.`);
    return null;
  }

  const title = normalizeText(rawItem.title);
  const titleSearchKey = normalizeTitle(rawItem.title);
  if (title.length === 0 || titleSearchKey === null) {
    console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded item[${index}] because title is empty.`);
    return null;
  }

  const parsedDifficulty = parseDifficultyCode(rawItem.difficulty);
  if (parsedDifficulty === null) {
    console.warn(
      `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded item[${index}] because difficulty is unknown.`,
      rawItem.difficulty,
    );
    return null;
  }

  const score = parseNonNegativeInteger(rawItem.score);
  if (score === null) {
    console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded item[${index}] because score is invalid.`);
    return null;
  }

  const rawBp = parseNonNegativeInteger(rawItem.bp);
  const rawPreScore = parseNonNegativeInteger(rawItem.pre_score);
  const rawPreBp = parseNonNegativeInteger(rawItem.pre_bp);
  const bp = rawBp ?? 9999;
  const preBp = rawPreBp ?? 9999;
  const bestScore = rawPreScore === null ? score : Math.max(score, rawPreScore);
  const bestBp = Math.min(bp, preBp);

  const lamp = parseOptionalString(rawItem.lamp);
  const preLamp = parseOptionalString(rawItem.pre_lamp);
  const opt = parseOptionalString(rawItem.opt);
  const playSpeed = parseOptionalString(rawItem.playspeed);
  const notes = parseNonNegativeInteger(rawItem.notes);

  const fingerprintSeed = [
    titleSearchKey,
    parsedDifficulty.code,
    score,
    bp,
    rawPreScore ?? "",
    preBp,
    lamp ?? "",
    opt ?? "",
    playSpeed ?? "",
  ].join("|");

  return {
    fingerprint: fingerprintHash(fingerprintSeed),
    observation: {
      timestamp: new Date().toISOString(),
      playStyle: parsedDifficulty.playStyle,
      difficulty: parsedDifficulty.difficulty,
      title,
      titleSearchKey,
      score,
      misscount: bp,
      sourceMetaExtras: {
        best_score: bestScore,
        best_bp: bestBp,
        pre_score: rawPreScore ?? score,
        pre_bp: preBp,
        lamp,
        pre_lamp: preLamp,
        opt,
        playspeed: playSpeed,
        notes,
      },
    },
  };
}

function parseDakenCounterV3Message(rawMessage: string): {
  entries: DakenCounterV3ObservationEntry[];
  fingerprintCounts: Map<string, number>;
} | null {
  let parsedMessage: unknown;
  try {
    parsedMessage = JSON.parse(rawMessage);
  } catch (error) {
    console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded malformed JSON message.`, error);
    return null;
  }

  if (!isRecord(parsedMessage)) {
    console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded message because payload is not an object.`);
    return null;
  }

  if (parsedMessage.type !== "today_updates") {
    console.info(
      `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: ignored message because type is not today_updates.`,
      parsedMessage.type,
    );
    return null;
  }

  if (!isRecord(parsedMessage.data) || !Array.isArray(parsedMessage.data.items)) {
    console.warn(
      `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded today_updates because data.items is not an array.`,
    );
    return null;
  }

  const entries: DakenCounterV3ObservationEntry[] = [];
  for (let index = 0; index < parsedMessage.data.items.length; index += 1) {
    const nextEntry = parseDakenCounterV3Item(parsedMessage.data.items[index], index);
    if (nextEntry !== null) {
      entries.push(nextEntry);
    }
  }

  return {
    entries,
    fingerprintCounts: buildDakenCounterV3FingerprintCounts(entries),
  };
}

function buildDakenCounterV3FingerprintCounts(
  entries: DakenCounterV3ObservationEntry[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.fingerprint, (counts.get(entry.fingerprint) ?? 0) + 1);
  }

  return counts;
}

function diffDakenCounterV3SnapshotEntries(
  previousCounts: Map<string, number>,
  currentCounts: Map<string, number>,
  currentEntries: DakenCounterV3ObservationEntry[],
): DakenCounterV3ObservationEntry[] {
  const remaining = new Map<string, number>();
  for (const [fingerprint, currentCount] of currentCounts) {
    const previousCount = previousCounts.get(fingerprint) ?? 0;
    if (currentCount > previousCount) {
      remaining.set(fingerprint, currentCount - previousCount);
    }
  }

  if (remaining.size === 0) {
    return [];
  }

  const deltaEntries: DakenCounterV3ObservationEntry[] = [];
  for (const entry of currentEntries) {
    const rest = remaining.get(entry.fingerprint) ?? 0;
    if (rest <= 0) {
      continue;
    }

    deltaEntries.push(entry);
    if (rest === 1) {
      remaining.delete(entry.fingerprint);
    } else {
      remaining.set(entry.fingerprint, rest - 1);
    }
  }

  return deltaEntries;
}

function isRetryableDakenCounterV3SubmitFailure(message: string): boolean {
  return (
    message === "A connected PLAYING room is required before injecting source data." ||
    message === "Failed to send RESULT_SUBMIT for the injected payload."
  );
}

function shouldKeepDakenCounterV3Connection(snapshot: RoomStateSnapshot | null): boolean {
  return (
    latestSettings?.source === DAKEN_COUNTER_V3_SOURCE &&
    snapshot !== null &&
    snapshot.room_state !== "CLOSED"
  );
}

function disconnectDakenCounterV3Socket(options: { resetTracking: boolean }): void {
  clearDakenCounterV3ReconnectTimer();

  const activeSocket = dakenCounterV3Socket;
  dakenCounterV3Socket = null;
  dakenCounterV3SocketPort = null;
  if (activeSocket !== null) {
    activeSocket.onopen = null;
    activeSocket.onmessage = null;
    activeSocket.onerror = null;
    activeSocket.onclose = null;

    if (
      activeSocket.readyState === WebSocket.CONNECTING ||
      activeSocket.readyState === WebSocket.OPEN
    ) {
      activeSocket.close();
    }
  }

  if (options.resetTracking) {
    resetDakenCounterV3SnapshotTracking();
  }
}

function scheduleDakenCounterV3Reconnect(snapshot: RoomStateSnapshot | null): void {
  if (!shouldKeepDakenCounterV3Connection(snapshot) || dakenCounterV3ReconnectTimer !== null) {
    return;
  }

  dakenCounterV3ReconnectTimer = window.setTimeout(() => {
    dakenCounterV3ReconnectTimer = null;
    connectDakenCounterV3Socket(roomStore.getState().snapshot);
  }, DAKEN_COUNTER_V3_RECONNECT_DELAY_MS);
}

function handleDakenCounterV3SocketMessage(rawMessage: string): void {
  const parsedSnapshot = parseDakenCounterV3Message(rawMessage);
  if (parsedSnapshot === null) {
    return;
  }

  const previousCounts = dakenCounterV3SnapshotFingerprintCounts;
  const deltaEntries = dakenCounterV3HasSnapshotBaseline
    ? diffDakenCounterV3SnapshotEntries(
        previousCounts,
        parsedSnapshot.fingerprintCounts,
        parsedSnapshot.entries,
      )
    : [];

  if (!dakenCounterV3HasSnapshotBaseline) {
    dakenCounterV3SnapshotFingerprintCounts = parsedSnapshot.fingerprintCounts;
    dakenCounterV3HasSnapshotBaseline = true;
  }

  const roomSnapshot = roomStore.getState().snapshot;
  if (
    roomSnapshot === null ||
    roomSnapshot.room_state !== "PLAYING" ||
    !dakenCounterV3MonitoringEnabled
  ) {
    dakenCounterV3SnapshotFingerprintCounts = parsedSnapshot.fingerprintCounts;
    return;
  }

  const uniqueEntries = deltaEntries.filter(
    (entry) => !dakenCounterV3ProcessedFingerprints.has(entry.fingerprint),
  );
  if (uniqueEntries.length === 0) {
    dakenCounterV3SnapshotFingerprintCounts = parsedSnapshot.fingerprintCounts;
    return;
  }

  let hasRetryableFailure = false;
  for (const entry of uniqueEntries) {
    const parsedChange: ParsedSourceChangePayload = {
      source: DAKEN_COUNTER_V3_SOURCE,
      filePath: buildDakenCounterV3Endpoint(currentDakenCounterV3Port()),
      fileSizeBytes: 0,
      observations: [entry.observation],
      unresolvedCases: [],
    };

    const outcome = submitParsedSourceChange(parsedChange, DAKEN_COUNTER_V3_ORIGIN_LABEL);
    if (outcome.ok) {
      rememberProcessedFingerprint(entry.fingerprint);
      continue;
    }

    if (outcome.pendingUnresolvedAlias !== undefined) {
      continue;
    }

    if (isRetryableDakenCounterV3SubmitFailure(outcome.message)) {
      hasRetryableFailure = true;
      continue;
    }

    roomStore.noteLocalEvent(`Source auto-submit skipped: ${outcome.message}`);
  }

  if (!hasRetryableFailure) {
    dakenCounterV3SnapshotFingerprintCounts = parsedSnapshot.fingerprintCounts;
  }
}

function connectDakenCounterV3Socket(snapshot: RoomStateSnapshot | null): void {
  if (!shouldKeepDakenCounterV3Connection(snapshot)) {
    disconnectDakenCounterV3Socket({ resetTracking: false });
    return;
  }

  const port = currentDakenCounterV3Port();
  if (!isValidPortNumber(port)) {
    updateDakenCounterV3WatcherState(
      "ERROR",
      `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: invalid port ${String(port)}.`,
    );
    return;
  }

  if (
    dakenCounterV3Socket !== null &&
    dakenCounterV3SocketPort === port &&
    (dakenCounterV3Socket.readyState === WebSocket.CONNECTING ||
      dakenCounterV3Socket.readyState === WebSocket.OPEN)
  ) {
    return;
  }

  disconnectDakenCounterV3Socket({ resetTracking: false });

  const endpoint = buildDakenCounterV3Endpoint(port);
  try {
    const socket = new WebSocket(endpoint);
    dakenCounterV3Socket = socket;
    dakenCounterV3SocketPort = port;
    updateDakenCounterV3WatcherState("IDLE", `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: connecting...`, [endpoint]);

    socket.onopen = () => {
      if (dakenCounterV3Socket !== socket) {
        return;
      }
      updateDakenCounterV3WatcherState("RUNNING", `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: connected.`, [endpoint]);
      console.info(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: connected to ${endpoint}.`);
    };

    socket.onmessage = (event) => {
      if (dakenCounterV3Socket !== socket) {
        return;
      }

      if (typeof event.data !== "string") {
        console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: discarded non-text WebSocket payload.`);
        return;
      }

      handleDakenCounterV3SocketMessage(event.data);
    };

    socket.onerror = (event) => {
      if (dakenCounterV3Socket !== socket) {
        return;
      }
      console.error(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: WebSocket error.`, event);
    };

    socket.onclose = (event) => {
      if (dakenCounterV3Socket !== socket) {
        return;
      }

      dakenCounterV3Socket = null;
      dakenCounterV3SocketPort = null;
      const reason = event.reason.trim().length > 0 ? event.reason : `code=${event.code}`;
      console.warn(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: connection closed (${reason}).`);

      const latestSnapshot = roomStore.getState().snapshot;
      if (shouldKeepDakenCounterV3Connection(latestSnapshot)) {
        updateDakenCounterV3WatcherState(
          "ERROR",
          `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: connection closed (${reason}). retrying...`,
          [endpoint],
        );
        scheduleDakenCounterV3Reconnect(latestSnapshot);
        return;
      }

      updateDakenCounterV3WatcherState(
        "STOPPED",
        `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: disconnected.`,
      );
    };
  } catch (error) {
    updateDakenCounterV3WatcherState(
      "ERROR",
      error instanceof Error ? error.message : `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: failed to connect.`,
      [endpoint],
    );
    console.error(`${DAKEN_COUNTER_V3_ORIGIN_LABEL}: failed to open WebSocket.`, error);
    scheduleDakenCounterV3Reconnect(snapshot);
  }
}

function syncDakenCounterV3RoomLifecycle(snapshot: RoomStateSnapshot | null): void {
  const previousState = dakenCounterV3LastRoomState;
  const currentState = snapshot?.room_state ?? null;
  dakenCounterV3LastRoomState = currentState;

  if (latestSettings?.source !== DAKEN_COUNTER_V3_SOURCE) {
    disconnectDakenCounterV3Socket({ resetTracking: true });
    return;
  }

  if (!shouldKeepDakenCounterV3Connection(snapshot)) {
    disconnectDakenCounterV3Socket({ resetTracking: true });
    updateDakenCounterV3WatcherState(
      "IDLE",
      `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: join a room to start monitoring.`,
    );
    return;
  }

  if (currentState === "LOBBY" && previousState !== "LOBBY") {
    // Clear per-match dedupe state so rematches can submit identical result tuples.
    resetDakenCounterV3MatchTracking();
    connectDakenCounterV3Socket(snapshot);
  }

  if (currentState !== "PLAYING") {
    dakenCounterV3MonitoringEnabled = false;
    return;
  }

  if (previousState === "PLAYING") {
    return;
  }

  if (!isDakenCounterV3SocketOpen()) {
    dakenCounterV3MonitoringEnabled = false;
    roomStore.reportSourceUnavailable(DAKEN_COUNTER_V3_WARNING_MESSAGE);
    console.warn(
      `${DAKEN_COUNTER_V3_ORIGIN_LABEL}: monitoring is disabled because the connection was unavailable at PLAYING start.`,
    );
    return;
  }

  dakenCounterV3MonitoringEnabled = true;
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

  const originLabel = formatSourceOriginLabel(parserOutput.source);
  const unresolvedCases = parserOutput.unresolvedCases ?? [];
  const dialogs: SourceUnresolvedDialog[] = [];
  for (const unresolvedCase of unresolvedCases) {
    if (unresolvedCase.kind === "unresolved_alias") {
      dialogs.push({
        id: nextUnresolvedDialogId(),
        kind: "unresolved_alias_catalog",
        source: parserOutput.source,
        originLabel,
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
        originLabel,
        chart: buildDialogChartInfo(unresolvedCase, metricContext),
      });
      continue;
    }

    if (unresolvedCase.kind === "ambiguous_recent") {
      dialogs.push({
        id: nextUnresolvedDialogId(),
        kind: "ambiguous_recent",
        source: parserOutput.source,
        originLabel,
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
  originLabel: string,
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
    originLabel,
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

  const originLabel = formatSourceOriginLabel(payload.parserOutput.source);
  const unresolvedDialogs = buildUnresolvedDialogsFromParserOutput(payload.parserOutput);
  const outcome = submitParsedSourceChange(payload.parserOutput, originLabel);
  if (outcome.pendingUnresolvedAlias) {
    unresolvedDialogs.push(
      buildUnresolvedAliasDialog(
        payload.parserOutput.source,
        originLabel,
        outcome.pendingUnresolvedAlias,
      ),
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

  if (source === "reflux" && paths.refluxLatestJson.trim().length === 0) {
    return "Set Reflux / latest.json before starting the watcher.";
  }

  if (source === "reflux" && paths.refluxTrackerTsv.trim().length === 0) {
    return "Set Reflux / tracker.tsv before starting the watcher.";
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
        `Source auto-submit skipped: ${activeDialog.originLabel} resolved_partial requires re-registration.`,
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
    latestSettings = null;
    disconnectDakenCounterV3Socket({ resetTracking: true });
    internalStore.setState((state) => ({
      ...state,
      runtimeReady: false,
      activeUnresolvedDialog: null,
      unresolvedDialogQueue: [],
    }));
  },
  async start(
    settings: Pick<ClientSettings, "source" | "sourcePaths" | "dakenCounterV3Port">,
    options: StartOptions = {},
  ): Promise<void> {
    await ensureAttached();

    latestSettings = settings;

    if (settings.source === DAKEN_COUNTER_V3_SOURCE) {
      appliedConfigKey = createConfigKey(settings);
      if (isTauriRuntime()) {
        const currentWatcherState = internalStore.getState().watcherState;
        if (
          currentWatcherState.source !== null &&
          currentWatcherState.source !== DAKEN_COUNTER_V3_SOURCE &&
          currentWatcherState.status !== "IDLE"
        ) {
          try {
            const stoppedPayload = await stopSourceWatcher();
            internalStore.setState((state) => ({
              ...state,
              watcherState: mapWatcherState(stoppedPayload),
            }));
          } catch {
            // noop: legacy watcher may already be inactive
          }
        }
      }

      syncDakenCounterV3RoomLifecycle(roomStore.getState().snapshot);
      return;
    }

    disconnectDakenCounterV3Socket({ resetTracking: true });

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
    latestSettings = null;
    disconnectDakenCounterV3Socket({ resetTracking: true });
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
  syncRoomSnapshot(snapshot: RoomStateSnapshot | null): void {
    syncDakenCounterV3RoomLifecycle(snapshot);
  },
};

export function useSourceStore<TSelected>(
  selector: (state: SourceStoreState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
