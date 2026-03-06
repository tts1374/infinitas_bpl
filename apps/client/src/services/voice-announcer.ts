import {
  ROUND_STAGE_COUNTDOWN_AT_SECONDS,
  ROUND_START_CALL_AT_SECONDS,
  type CurrentRoundSnapshot,
} from "@infinitas/shared";
import { createExternalStore, useExternalStore } from "../stores/create-store";
import { roomStore } from "../stores/room-store";
import { settingsStore } from "../stores/settings-store";
import { isTauriRuntime, speakNativeTts, stopNativeTts } from "./tauri-bridge";

const ROUND_STAGE_COUNTDOWN_AT_MS = ROUND_STAGE_COUNTDOWN_AT_SECONDS * 1_000;
const ROUND_START_CALL_AT_MS = ROUND_START_CALL_AT_SECONDS * 1_000;
const RECENT_CUE_GRACE_MS = 3_000;
const VOICE_CUE_INTERVAL_MS = 1_000;

type VoiceCuePhase = "STAGE" | "COUNTDOWN" | "START";

interface VoiceCue {
  phase: VoiceCuePhase;
  dueAtMs: number;
  text: string;
  detail: string;
  rate?: number;
}

const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/;

export type VoicePlaybackPhase =
  | "IDLE"
  | "DISABLED"
  | "UNAVAILABLE"
  | "STAGE"
  | "COUNTDOWN"
  | "START";

export interface VoicePlaybackState {
  phase: VoicePlaybackPhase;
  enabled: boolean;
  roundToken: string | null;
  pendingCues: number;
  detail: string;
  lastUpdatedAt: string | null;
}

const internalStore = createExternalStore<VoicePlaybackState>({
  phase: "IDLE",
  enabled: true,
  roundToken: null,
  pendingCues: 0,
  detail: "Voice cues idle.",
  lastUpdatedAt: null,
});

let unsubscribeRoomStore: (() => void) | null = null;
let unsubscribeSettingsStore: (() => void) | null = null;
let activeRoundToken: string | null = null;
let activeTimeoutIds: number[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function setVoiceState(partialState: Partial<VoicePlaybackState>): void {
  internalStore.setState((state) => ({
    ...state,
    ...partialState,
    lastUpdatedAt: partialState.lastUpdatedAt ?? nowIso(),
  }));
}

function clearPlayback(nextPhase: VoicePlaybackPhase, detail: string, enabled: boolean): void {
  for (const timeoutId of activeTimeoutIds) {
    window.clearTimeout(timeoutId);
  }
  activeTimeoutIds = [];

  void stopNativeTts();
  if (nextPhase === "IDLE" || nextPhase === "DISABLED" || nextPhase === "UNAVAILABLE") {
    activeRoundToken = null;
  }

  setVoiceState({
    phase: nextPhase,
    enabled,
    pendingCues: 0,
    detail,
    roundToken: activeRoundToken,
  });
}

function buildRoundToken(roomId: string, round: CurrentRoundSnapshot): string {
  return `${roomId}:${round.round_index}:${round.round_started_at}`;
}

function detectCueLanguage(text: string): "ja-JP" | "en-US" {
  return JAPANESE_TEXT_PATTERN.test(text) ? "ja-JP" : "en-US";
}

function getStageLabel(roundIndex: number): string {
  const stageNumber = roundIndex + 1;
  switch (stageNumber) {
    case 1:
      return "First stage.";
    case 2:
      return "Second stage.";
    case 3:
      return "Final stage.";
    default:
      return `Stage ${stageNumber}.`;
  }
}

function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case "BEGINNER":
      return "Beginner.";
    case "NORMAL":
      return "Normal.";
    case "HYPER":
      return "Hyper.";
    case "ANOTHER":
      return "Another.";
    case "LEGGENDARIA":
      return "Leggendaria.";
    default:
      return `${difficulty}.`;
  }
}

function createSequentialVoiceCues(
  phase: VoiceCuePhase,
  startAtMs: number,
  texts: readonly string[],
  roundIndex: number,
): VoiceCue[] {
  return texts.map((text, index) => ({
    phase,
    dueAtMs: startAtMs + index * VOICE_CUE_INTERVAL_MS,
    text,
    detail: `${phase} cue ${index + 1}/${texts.length} for round ${roundIndex + 1}: ${text}`,
  }));
}

function createVoiceCues(round: CurrentRoundSnapshot): VoiceCue[] {
  const startedAtMs = Date.parse(round.round_started_at);
  if (Number.isNaN(startedAtMs)) {
    return [];
  }

  const snapshot = roomStore.getState().snapshot;
  const roundDisplay =
    snapshot?.frozen_rounds.find((entry) => entry.round_index === round.round_index)?.display ?? null;
  const titleCueText = roundDisplay?.title?.trim() || round.expected_key.title_search_key;
  const stageTexts = [
    getStageLabel(round.round_index),
    titleCueText,
    `${round.expected_key.play_style}. ${getDifficultyLabel(round.expected_key.difficulty)}`,
  ].filter((value) => value.length > 0);

  return [
    ...createSequentialVoiceCues("STAGE", startedAtMs, stageTexts, round.round_index),
    {
      phase: "COUNTDOWN",
      dueAtMs: startedAtMs + ROUND_STAGE_COUNTDOWN_AT_MS,
      text: "Ten. Nine. Eight. Seven. Six. Five. Four. Three. Two. One. Music selected.",
      detail: `COUNTDOWN cue for round ${round.round_index + 1}.`,
      rate: 0.9,
    },
    {
      phase: "START",
      dueAtMs: startedAtMs + ROUND_START_CALL_AT_MS,
      text: "Three. Two. One. Let's go.",
      detail: `START cue for round ${round.round_index + 1}.`,
      rate: 1,
    },
  ];
}

async function speakCue(roundToken: string, cue: VoiceCue): Promise<void> {
  if (roundToken !== activeRoundToken) {
    return;
  }

  if (!isTauriRuntime()) {
    setVoiceState({
      phase: "UNAVAILABLE",
      enabled: settingsStore.getState().saved.voiceEnabled,
      pendingCues: 0,
      detail: "Native TTS is available only inside the Tauri desktop app.",
      roundToken,
    });
    return;
  }

  setVoiceState({
    phase: cue.phase,
    enabled: settingsStore.getState().saved.voiceEnabled,
    pendingCues: activeTimeoutIds.length,
    detail: cue.detail,
    roundToken,
  });

  try {
    const cueLanguage = detectCueLanguage(cue.text);
    await speakNativeTts({
      text: cue.text,
      language: cueLanguage,
      rate: cue.rate ?? 1,
      pitch: 1,
      volume: 1,
      queueMode: "add",
    });
    setVoiceState({
      phase: cue.phase,
      enabled: settingsStore.getState().saved.voiceEnabled,
      pendingCues: activeTimeoutIds.length,
      detail: `Speaking (${cueLanguage}): ${cue.text}`,
      roundToken,
    });
  } catch (error) {
    setVoiceState({
      phase: "UNAVAILABLE",
      enabled: settingsStore.getState().saved.voiceEnabled,
      pendingCues: activeTimeoutIds.length,
      detail:
        error instanceof Error
          ? error.message
          : `Voice playback failed during ${cue.phase.toLowerCase()} cue.`,
      roundToken,
    });
  }
}

function scheduleRoundPlayback(roomId: string, round: CurrentRoundSnapshot): void {
  const roundToken = buildRoundToken(roomId, round);
  const cues = createVoiceCues(round);
  const nowMs = Date.now();

  let scheduledCount = 0;
  let nextCue: VoiceCue | null = null;

  for (const cue of cues) {
    const delayMs = cue.dueAtMs - nowMs;
    if (delayMs < -RECENT_CUE_GRACE_MS) {
      continue;
    }

    nextCue ??= cue;
    scheduledCount += 1;
    const timeoutId = window.setTimeout(() => {
      activeTimeoutIds = activeTimeoutIds.filter((value) => value !== timeoutId);
      void speakCue(roundToken, cue);
    }, Math.max(0, delayMs));
    activeTimeoutIds.push(timeoutId);
  }

  setVoiceState({
    phase: scheduledCount > 0 ? (nextCue?.phase ?? "START") : "START",
    enabled: true,
    pendingCues: scheduledCount,
    detail:
      scheduledCount > 0 && nextCue !== null
        ? `Queued ${scheduledCount} voice cue(s). Next ${nextCue.phase.toLowerCase()} cue: ${nextCue.text}`
        : `Voice cues already elapsed for round ${round.round_index + 1}.`,
    roundToken,
  });
}

function syncVoicePlayback(): void {
  const savedSettings = settingsStore.getState().saved;
  if (!savedSettings.voiceEnabled) {
    clearPlayback("DISABLED", "Voice notifications are turned off.", false);
    return;
  }

  if (!isTauriRuntime()) {
    clearPlayback("UNAVAILABLE", "Native TTS is available only inside the Tauri desktop app.", true);
    return;
  }

  const snapshot = roomStore.getState().snapshot;
  if (snapshot === null || snapshot.room_state !== "PLAYING" || snapshot.current_round === null) {
    clearPlayback("IDLE", "Voice cues idle.", true);
    return;
  }

  const nextRoundToken = buildRoundToken(snapshot.room_id, snapshot.current_round);
  if (nextRoundToken === activeRoundToken) {
    return;
  }

  clearPlayback("IDLE", `Arming voice cues for round ${snapshot.current_round.round_index + 1}.`, true);
  activeRoundToken = nextRoundToken;
  scheduleRoundPlayback(snapshot.room_id, snapshot.current_round);
}

export const voiceAnnouncerService = {
  ...internalStore,
  start(): void {
    if (unsubscribeRoomStore !== null || unsubscribeSettingsStore !== null) {
      return;
    }

    unsubscribeRoomStore = roomStore.subscribe(syncVoicePlayback);
    unsubscribeSettingsStore = settingsStore.subscribe(syncVoicePlayback);
    syncVoicePlayback();
  },
  stop(): void {
    unsubscribeRoomStore?.();
    unsubscribeSettingsStore?.();
    unsubscribeRoomStore = null;
    unsubscribeSettingsStore = null;
    clearPlayback("IDLE", "Voice cues idle.", settingsStore.getState().saved.voiceEnabled);
  },
};

export function useVoicePlaybackStore<TSelected>(
  selector: (state: VoicePlaybackState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
