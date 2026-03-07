import type { ExpectedKey, SkipReason } from "@infinitas/shared";
import type { ParsedSourceChangePayload, ParsedSourceObservationPayload } from "./tauri-bridge";
import type { DebugInjectionTemplate, DebugResultTemplate } from "../debug/types";
import { roomStore } from "../stores/room-store";
import { settingsStore } from "../stores/settings-store";

export interface SourceSubmitOutcome {
  ok: boolean;
  message: string;
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
    return {
      ok: false,
      message: "No observation matched the current round expected key.",
    };
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
