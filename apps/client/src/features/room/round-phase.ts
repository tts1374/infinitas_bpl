import {
  ROUND_MUSIC_SELECT_SECONDS,
  ROUND_PLAY_BEGIN_AT_SECONDS,
  type CurrentRoundSnapshot,
  type RoomStateSnapshot,
} from "@infinitas/shared";
import type { RoomArenaControlledState } from "../../components/RoomArena";

export type PlayingCountdown = {
  label: "MUSIC SELECT" | "PLAY START" | "IN PLAY";
  remainingSeconds: number;
  detail: string;
};

type PlayingRoomStatus = Extract<RoomArenaControlledState["roomStatus"], "RESULT" | "PLAYING">;
type PlayingPhase = RoomArenaControlledState["playingPhase"];

export type PlayingRoundPresentation = {
  roomStatus: PlayingRoomStatus;
  resultTimer: number | null;
  playElapsedSeconds: number;
  playingPhase: PlayingPhase;
  playingCountdownSeconds: number | null;
};

export type PlayingRoundPresentationInput = {
  roomState: RoomStateSnapshot["room_state"];
  currentRound: CurrentRoundSnapshot | null;
  nowMs: number;
  hasPreviousResultRound: boolean;
  resultPhaseSeconds: number;
};

function getIsoTimeMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getRemainingSeconds(targetMs: number | null, nowMs: number): number | null {
  if (targetMs === null) {
    return null;
  }
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1_000));
}

export function getPlayingCountdown(round: CurrentRoundSnapshot, nowMs: number): PlayingCountdown | null {
  const startedAtMs = getIsoTimeMs(round.round_started_at);
  if (startedAtMs === null) {
    return null;
  }

  const musicSelectEndsAtMs = startedAtMs + ROUND_MUSIC_SELECT_SECONDS * 1_000;
  const playBeginAtMs = startedAtMs + ROUND_PLAY_BEGIN_AT_SECONDS * 1_000;
  const playDeadlineAtMs = playBeginAtMs + round.soft_ttl_seconds * 1_000;

  if (nowMs < musicSelectEndsAtMs) {
    return {
      label: "MUSIC SELECT",
      remainingSeconds: getRemainingSeconds(musicSelectEndsAtMs, nowMs) ?? 0,
      detail: "Chart select window.",
    };
  }

  if (nowMs < playBeginAtMs) {
    return {
      label: "PLAY START",
      remainingSeconds: getRemainingSeconds(playBeginAtMs, nowMs) ?? 0,
      detail: "Start buffer before gameplay begins.",
    };
  }

  return {
    label: "IN PLAY",
    remainingSeconds: getRemainingSeconds(playDeadlineAtMs, nowMs) ?? 0,
    detail: "Soft TTL remaining after Let's go.",
  };
}

export function resolvePlayingRoundPresentation(input: PlayingRoundPresentationInput): PlayingRoundPresentation {
  const currentRoundStartAtMs = getIsoTimeMs(input.currentRound?.round_started_at);
  const leadInSeconds =
    currentRoundStartAtMs !== null && currentRoundStartAtMs > input.nowMs
      ? Math.max(0, Math.ceil((currentRoundStartAtMs - input.nowMs) / 1_000))
      : 0;
  const isInterRoundResultVisible =
    input.roomState === "PLAYING" &&
    input.currentRound !== null &&
    input.currentRound.round_index > 0 &&
    input.hasPreviousResultRound &&
    leadInSeconds > 0 &&
    leadInSeconds <= input.resultPhaseSeconds;
  const playingCountdown = input.currentRound === null ? null : getPlayingCountdown(input.currentRound, input.nowMs);

  return {
    roomStatus: isInterRoundResultVisible ? "RESULT" : "PLAYING",
    resultTimer: isInterRoundResultVisible ? Math.min(leadInSeconds, input.resultPhaseSeconds) : null,
    playElapsedSeconds:
      currentRoundStartAtMs === null ? 0 : Math.max(0, Math.floor((input.nowMs - currentRoundStartAtMs) / 1_000)),
    playingPhase:
      playingCountdown?.label === "PLAY START"
        ? "PLAY_START"
        : playingCountdown?.label === "IN PLAY"
          ? "IN_PLAY"
          : "MUSIC_SELECT",
    playingCountdownSeconds: playingCountdown?.remainingSeconds ?? null,
  };
}
