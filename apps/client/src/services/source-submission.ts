import type { ExpectedKey, SkipReason } from "@infinitas/shared";
import type { ParsedSourceChangePayload, ParsedSourceObservationPayload } from "./tauri-bridge";
import type { DebugInjectionTemplate, DebugResultTemplate } from "../debug/types";
import { roomStore } from "../stores/room-store";
import { settingsStore } from "../stores/settings-store";

export interface SourceSubmitOutcome {
  ok: boolean;
  message: string;
  pendingUnresolvedAlias?: NotebookUnresolvedAliasDialogRequest;
}

interface InactiveRoundResult {
  ok: false;
  message: string;
}

interface ActiveRoundContextResult {
  ok: true;
  context: ActiveRoundContext;
}

interface ActiveRoundContext {
  currentRound: NonNullable<NonNullable<ReturnType<typeof roomStore.getState>["snapshot"]>["current_round"]>;
  snapshot: NonNullable<ReturnType<typeof roomStore.getState>["snapshot"]>;
  savedSettings: ReturnType<typeof settingsStore.getState>["saved"];
}

export type MetricLabel = "EXSCORE" | "MISSCOUNT";

export interface NotebookDialogChartInfo {
  title: string;
  titleSearchKey: string;
  playStyle: "SP" | "DP";
  difficulty: string;
  metricLabel: MetricLabel;
  metricValue: number;
}

export interface NotebookForcedRegistrationPayload {
  roundIndex: number;
  expectedKey: ExpectedKey;
  expectedTarget: NotebookDialogChartInfo;
  parsedResult: NotebookDialogChartInfo;
  mismatchReason: string;
  source: ParsedSourceChangePayload["source"];
  sourceMeta: {
    timestamp: string;
    difficulty: string;
    title: string;
    titleSearchKey: string;
    score: number;
    misscount: number;
    filePath: string;
  };
}

export interface NotebookUnresolvedAliasDialogRequest {
  kind: "unresolved_alias";
  expectedTarget: NotebookDialogChartInfo;
  parsedResult: NotebookDialogChartInfo;
  mismatchReason: string;
  forcePayload: NotebookForcedRegistrationPayload;
}

const NOTEBOOK_TIMESTAMP_PATTERN = /^\d{8}-\d{6}$/;
const NOTEBOOK_TIMESTAMP_CACHE_LIMIT = 64;
const lastSubmittedNotebookTimestampByRoomPlayer = new Map<string, string>();

function normalizeNotebookTimestamp(rawTimestamp: string): string | null {
  const trimmed = rawTimestamp.trim();
  return NOTEBOOK_TIMESTAMP_PATTERN.test(trimmed) ? trimmed : null;
}

function buildNotebookTimestampCacheKey(context: ActiveRoundContext): string {
  return `${context.snapshot.room_id}:${context.savedSettings.playerId}`;
}

function findNotebookTimestampReplay(
  context: ActiveRoundContext,
  rawTimestamp: string,
): { current: string; previous: string } | null {
  const current = normalizeNotebookTimestamp(rawTimestamp);
  if (current === null) {
    return null;
  }

  const previous = lastSubmittedNotebookTimestampByRoomPlayer.get(
    buildNotebookTimestampCacheKey(context),
  );
  if (previous === undefined || current > previous) {
    return null;
  }

  return { current, previous };
}

function rememberNotebookTimestamp(context: ActiveRoundContext, rawTimestamp: string): void {
  const normalized = normalizeNotebookTimestamp(rawTimestamp);
  if (normalized === null) {
    return;
  }

  const key = buildNotebookTimestampCacheKey(context);
  if (lastSubmittedNotebookTimestampByRoomPlayer.has(key)) {
    lastSubmittedNotebookTimestampByRoomPlayer.delete(key);
  }
  lastSubmittedNotebookTimestampByRoomPlayer.set(key, normalized);

  while (lastSubmittedNotebookTimestampByRoomPlayer.size > NOTEBOOK_TIMESTAMP_CACHE_LIMIT) {
    const oldestKey = lastSubmittedNotebookTimestampByRoomPlayer.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    lastSubmittedNotebookTimestampByRoomPlayer.delete(oldestKey);
  }
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

function metricLabelFromWinMetric(winMetric: "SCORE" | "MISSCOUNT"): MetricLabel {
  return winMetric === "SCORE" ? "EXSCORE" : "MISSCOUNT";
}

function getExpectedRoundTitle(context: ActiveRoundContext): string {
  const expectedRound = context.snapshot.frozen_rounds.find(
    (round) => round.round_index === context.currentRound.round_index,
  );
  return expectedRound?.display.title ?? context.currentRound.expected_key.title_search_key;
}

function buildMismatchReason(
  expectedKey: ExpectedKey,
  observation: ParsedSourceObservationPayload,
): string | null {
  const observedPlayStyle = observation.playStyle ?? expectedKey.play_style;
  const observedTitleSearchKey = observation.titleSearchKey.trim();
  const mismatchedItems: string[] = [];
  if (observedTitleSearchKey !== expectedKey.title_search_key) {
    mismatchedItems.push("曲名");
  }
  if (observedPlayStyle !== expectedKey.play_style) {
    mismatchedItems.push("プレイスタイル");
  }
  if (observation.difficulty !== expectedKey.difficulty) {
    mismatchedItems.push("難易度");
  }

  return mismatchedItems.length > 0 ? `不一致: ${mismatchedItems.join(" / ")}` : null;
}

function buildNotebookUnresolvedAliasDialogRequest(
  parsedChange: ParsedSourceChangePayload,
  context: ActiveRoundContext,
): NotebookUnresolvedAliasDialogRequest | null {
  if (parsedChange.source !== "inf-notebook" || parsedChange.observations.length !== 1) {
    return null;
  }

  const candidate = parsedChange.observations[0]!;
  const expectedKey = context.currentRound.expected_key;
  const mismatchReason = buildMismatchReason(expectedKey, candidate);
  if (mismatchReason === null) {
    return null;
  }

  const metricLabel = metricLabelFromWinMetric(context.snapshot.settings.win_metric);
  const metricValue =
    context.snapshot.settings.win_metric === "SCORE" ? candidate.score : candidate.misscount;

  const expectedTarget: NotebookDialogChartInfo = {
    title: getExpectedRoundTitle(context),
    titleSearchKey: expectedKey.title_search_key,
    playStyle: expectedKey.play_style,
    difficulty: expectedKey.difficulty,
    metricLabel,
    metricValue,
  };
  const parsedResult: NotebookDialogChartInfo = {
    title: candidate.title.trim().length > 0 ? candidate.title : candidate.titleSearchKey,
    titleSearchKey: candidate.titleSearchKey,
    playStyle: candidate.playStyle ?? expectedKey.play_style,
    difficulty: candidate.difficulty,
    metricLabel,
    metricValue,
  };

  return {
    kind: "unresolved_alias",
    expectedTarget,
    parsedResult,
    mismatchReason,
    forcePayload: {
      roundIndex: context.currentRound.round_index,
      expectedKey,
      expectedTarget,
      parsedResult,
      mismatchReason,
      source: parsedChange.source,
      sourceMeta: {
        timestamp: candidate.timestamp,
        difficulty: candidate.difficulty,
        title: candidate.title,
        titleSearchKey: candidate.titleSearchKey,
        score: candidate.score,
        misscount: candidate.misscount,
        filePath: parsedChange.filePath,
      },
    },
  };
}

function getActiveRoundContext(): ActiveRoundContextResult | InactiveRoundResult {
  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;
  const currentRound = snapshot?.current_round ?? null;

  if (
    roomState.connectionStatus !== "CONNECTED" ||
    snapshot === null ||
    snapshot.room_state !== "PLAYING" ||
    currentRound === null
  ) {
    return {
      ok: false,
      message: "A connected PLAYING room is required before injecting source data.",
    };
  }

  return {
    ok: true,
    context: {
      snapshot,
      currentRound,
      savedSettings: settingsStore.getState().saved,
    },
  };
}

function ensureRoomMatchesTemplate(
  template: DebugInjectionTemplate,
  context: ActiveRoundContext,
): SourceSubmitOutcome | null {
  const { mode, win_metric: winMetric, play_style: playStyle } = context.snapshot.settings;
  if (
    template.target_room.mode === mode &&
    template.target_room.win_metric === winMetric &&
    template.target_room.play_style === playStyle
  ) {
    return null;
  }

  return {
    ok: false,
    message:
      `Case ${template.case_name} expects ${template.target_room.mode} / ` +
      `${template.target_room.win_metric} / ${template.target_room.play_style}, ` +
      `but the current room is ${mode} / ${winMetric} / ${playStyle}.`,
  };
}

function ensureMetricValue(value: number, fieldName: string): SourceSubmitOutcome | null {
  if (Number.isInteger(value) && value >= 0) {
    return null;
  }

  return {
    ok: false,
    message: `${fieldName} must be a non-negative integer.`,
  };
}

function buildDebugObservation(
  template: DebugResultTemplate,
  expectedKey: ExpectedKey,
): ParsedSourceObservationPayload {
  const score = template.source_meta?.score ?? (template.target_room.win_metric === "SCORE" ? template.metric_value : 0);
  const misscount =
    template.source_meta?.misscount ??
    (template.target_room.win_metric === "MISSCOUNT" ? template.metric_value : 0);

  return {
    timestamp: template.source_meta?.timestamp ?? "",
    playStyle: template.source === "inf_daken_counter" ? expectedKey.play_style : null,
    difficulty: expectedKey.difficulty,
    title: template.source_meta?.title ?? expectedKey.title_search_key,
    titleSearchKey: expectedKey.title_search_key,
    score,
    misscount,
  };
}

function buildDebugParsedChange(
  template: DebugResultTemplate,
  context: ActiveRoundContext,
): ParsedSourceChangePayload | SourceSubmitOutcome {
  const metricValidation = ensureMetricValue(template.metric_value, "Template metric_value");
  if (metricValidation !== null) {
    return metricValidation;
  }

  const observation = buildDebugObservation(template, context.currentRound.expected_key);
  const scoreValidation = ensureMetricValue(observation.score, "Observation score");
  if (scoreValidation !== null) {
    return scoreValidation;
  }

  const misscountValidation = ensureMetricValue(observation.misscount, "Observation misscount");
  if (misscountValidation !== null) {
    return misscountValidation;
  }

  return {
    source: template.source,
    filePath: `debug://${template.case_name}.json`,
    fileSizeBytes: 0,
    observations: [observation],
    unresolvedCases: [],
  };
}

export function submitParsedSourceChange(
  parsedChange: ParsedSourceChangePayload,
  originLabel: string,
): SourceSubmitOutcome {
  if (parsedChange.observations.length === 0) {
    return {
      ok: false,
      message: `${originLabel} does not contain any observations to submit.`,
    };
  }

  const activeRoundContext = getActiveRoundContext();
  if (!activeRoundContext.ok) {
    return activeRoundContext;
  }

  const { context } = activeRoundContext;
  if (
    context.currentRound.confirmed.some(
      (entry) => entry.player_id === context.savedSettings.playerId,
    )
  ) {
    return {
      ok: false,
      message: "This player has already been confirmed for the current round.",
    };
  }

  const matchedObservation = parsedChange.observations.find((observation) =>
    observationMatchesExpected(observation, context.currentRound.expected_key),
  );
  if (!matchedObservation) {
    const unresolvedAliasDialog = buildNotebookUnresolvedAliasDialogRequest(
      parsedChange,
      context,
    );
    if (unresolvedAliasDialog !== null) {
      return {
        ok: false,
        message:
          "inf-notebook observation is pending because the parsed chart does not match the current round.",
        pendingUnresolvedAlias: unresolvedAliasDialog,
      };
    }

    return {
      ok: false,
      message: "No observation matched the current round expected key.",
    };
  }

  if (parsedChange.source === "inf-notebook") {
    const replay = findNotebookTimestampReplay(context, matchedObservation.timestamp);
    if (replay !== null) {
      return {
        ok: false,
        message:
          `Skipped inf-notebook auto-submit because timestamp ${replay.current} ` +
          `is not newer than the previous submission (${replay.previous}).`,
      };
    }
  }

  const metricValue =
    context.snapshot.settings.win_metric === "SCORE"
      ? matchedObservation.score
      : matchedObservation.misscount;
  const metricValidation = ensureMetricValue(metricValue, "Derived metric");
  if (metricValidation !== null) {
    return metricValidation;
  }

  const observedPlayStyle =
    matchedObservation.playStyle ?? context.currentRound.expected_key.play_style;
  const sent = roomStore.submitResult({
    round_index: context.currentRound.round_index,
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
    return {
      ok: false,
      message: "Failed to send RESULT_SUBMIT for the injected payload.",
    };
  }
  if (parsedChange.source === "inf-notebook") {
    rememberNotebookTimestamp(context, matchedObservation.timestamp);
  }

  const timestampLabel =
    matchedObservation.timestamp.trim().length > 0 ? ` (${matchedObservation.timestamp})` : "";
  const message =
    `Auto-submitted ${context.snapshot.settings.win_metric} from ${originLabel}${timestampLabel}.`;
  roomStore.noteLocalEvent(message);

  return {
    ok: true,
    message,
  };
}

function expectedKeyMatches(left: ExpectedKey, right: ExpectedKey): boolean {
  return (
    left.play_style === right.play_style &&
    left.difficulty === right.difficulty &&
    left.title_search_key === right.title_search_key
  );
}

export function submitNotebookForcedRegistration(
  payload: NotebookForcedRegistrationPayload,
  originLabel: string,
): SourceSubmitOutcome {
  const activeRoundContext = getActiveRoundContext();
  if (!activeRoundContext.ok) {
    return activeRoundContext;
  }

  const { context } = activeRoundContext;
  if (
    context.currentRound.round_index !== payload.roundIndex ||
    !expectedKeyMatches(context.currentRound.expected_key, payload.expectedKey)
  ) {
    return {
      ok: false,
      message: "The current round changed before confirmation. Registration was cancelled.",
    };
  }

  if (
    context.currentRound.confirmed.some(
      (entry) => entry.player_id === context.savedSettings.playerId,
    )
  ) {
    return {
      ok: false,
      message: "This player has already been confirmed for the current round.",
    };
  }

  const metricValidation = ensureMetricValue(payload.expectedTarget.metricValue, "Forced metric");
  if (metricValidation !== null) {
    return metricValidation;
  }

  if (payload.source === "inf-notebook") {
    const replay = findNotebookTimestampReplay(context, payload.sourceMeta.timestamp);
    if (replay !== null) {
      return {
        ok: false,
        message:
          `Skipped inf-notebook auto-submit because timestamp ${replay.current} ` +
          `is not newer than the previous submission (${replay.previous}).`,
      };
    }
  }

  const sent = roomStore.submitResult({
    round_index: payload.roundIndex,
    observed_key: payload.expectedKey,
    metric_value: payload.expectedTarget.metricValue,
    source_meta: {
      source: payload.source,
      timestamp: payload.sourceMeta.timestamp,
      difficulty: payload.sourceMeta.difficulty,
      title: payload.sourceMeta.title,
      title_search_key: payload.sourceMeta.titleSearchKey,
      score: payload.sourceMeta.score,
      misscount: payload.sourceMeta.misscount,
      file_path: payload.sourceMeta.filePath,
    },
  });
  if (!sent) {
    return {
      ok: false,
      message: "Failed to send RESULT_SUBMIT for the unresolved_alias confirmation.",
    };
  }
  if (payload.source === "inf-notebook") {
    rememberNotebookTimestamp(context, payload.sourceMeta.timestamp);
  }

  const timestampLabel =
    payload.sourceMeta.timestamp.trim().length > 0 ? ` (${payload.sourceMeta.timestamp})` : "";
  const message = `Auto-submitted ${payload.expectedTarget.metricLabel} from ${originLabel}${timestampLabel}.`;
  roomStore.noteLocalEvent(message);
  return {
    ok: true,
    message,
  };
}

export function submitSkipReason(skipReason: SkipReason, originLabel: string): SourceSubmitOutcome {
  const activeRoundContext = getActiveRoundContext();
  if (!activeRoundContext.ok) {
    return activeRoundContext;
  }

  const { context } = activeRoundContext;
  if (
    context.currentRound.confirmed.some(
      (entry) => entry.player_id === context.savedSettings.playerId,
    )
  ) {
    return {
      ok: false,
      message: "This player has already been confirmed for the current round.",
    };
  }

  if (!roomStore.skipSelf(context.currentRound.round_index, skipReason)) {
    return {
      ok: false,
      message: `Failed to send SKIP_SELF (${skipReason}).`,
    };
  }

  const message = `Submitted SKIP_SELF (${skipReason}) from ${originLabel}.`;
  roomStore.noteLocalEvent(message);
  return {
    ok: true,
    message,
  };
}

export function injectDebugTemplate(
  template: DebugInjectionTemplate,
  fileName: string,
): SourceSubmitOutcome {
  const activeRoundContext = getActiveRoundContext();
  if (!activeRoundContext.ok) {
    return activeRoundContext;
  }

  const { context } = activeRoundContext;
  const roomMismatch = ensureRoomMatchesTemplate(template, context);
  if (roomMismatch !== null) {
    return roomMismatch;
  }

  const originLabel = `${fileName} / ${template.case_name}`;
  if (template.kind === "skip-template") {
    return submitSkipReason(template.skip_reason, originLabel);
  }

  const parsedChange = buildDebugParsedChange(template, context);
  if ("ok" in parsedChange) {
    return parsedChange;
  }

  return submitParsedSourceChange(parsedChange, originLabel);
}
