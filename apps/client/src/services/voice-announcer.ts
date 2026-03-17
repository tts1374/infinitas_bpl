import {
  MATCH_FOUND_MIN_INTERVAL_MS,
  ROUND_MUSIC_SELECT_SECONDS,
  ROUND_PLAY_BEGIN_AT_SECONDS,
  ROUND_STAGE_COUNTDOWN_AT_SECONDS,
  ROUND_START_CALL_AT_SECONDS,
  SOUND_CLEAR_QUEUE_ON_STATE_CHANGE,
  SOUND_STOP_CURRENT_ON_STATE_CHANGE,
  type CloseReason,
  type CurrentRoundSnapshot,
  type SoundEffectKey,
} from "@infinitas/shared";
import { createExternalStore, useExternalStore } from "../stores/create-store";
import { roomStore, type RoomAudioEvent } from "../stores/room-store";
import { getVoicePlaybackVolume, isVoicePlaybackEnabled, settingsStore } from "../stores/settings-store";

const RECENT_CUE_GRACE_MS = 3_000;
const LOBBY_NOTIFICATION_SOUND_KEYS = ["room_join", "all_ready"] as const;

export type LobbyNotificationSoundEffectKey = (typeof LOBBY_NOTIFICATION_SOUND_KEYS)[number];

const LOBBY_NOTIFICATION_SOUND_PROFILES: Record<
  LobbyNotificationSoundEffectKey,
  {
    url: string;
    volumeMultiplier: number;
  }
> = {
  room_join: {
    url: "/se/room_join.mp3",
    volumeMultiplier: 0.5,
  },
  all_ready: {
    url: "/se/all_ready.mp3",
    volumeMultiplier: 0.7,
  },
};

const SOUND_EFFECT_URLS: Record<SoundEffectKey, string> = {
  round_intro: "/se/round_intro.mp3",
  count_beep: "/se/count_beep.mp3",
  match_found: "/se/match_found.mp3",
  phase_locked: "/se/phase_locked.mp3",
  count_go: "/se/count_go.mp3",
  cancel: "/se/cancel.mp3",
  error: "/se/error.mp3",
};

interface ScheduledCue {
  kind: SoundEffectKey;
  eventId: string;
  dueAtMs: number;
  closeReason?: CloseReason | null;
}

interface ActiveBufferSource {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

type AudioContextConstructor = new () => AudioContext;

export type VoicePlaybackPhase = "IDLE" | "DISABLED" | "ARMED" | "PLAYING" | "ERROR";

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
  detail: "Sound cues idle.",
  lastUpdatedAt: null,
});

let unsubscribeRoomStore: (() => void) | null = null;
let unsubscribeSettingsStore: (() => void) | null = null;
let activeRoomId: string | null = null;
let activeRoundToken: string | null = null;
let activeTimeoutIds: number[] = [];

const playedEventIds = new Set<string>();
const queuedEventIds = new Set<string>();
const activeAudios = new Set<HTMLAudioElement>();
const activeBufferSources = new Set<ActiveBufferSource>();
const lastPlayedAtByKind = new Map<SoundEffectKey, number>();
const decodedBuffers = new Map<SoundEffectKey, AudioBuffer>();
const loadingBuffers = new Map<SoundEffectKey, Promise<AudioBuffer>>();
const preloadedLobbyAudios = new Map<LobbyNotificationSoundEffectKey, HTMLAudioElement>();
let sharedAudioContext: AudioContext | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function getMasterVolume(): number {
  return getVoicePlaybackVolume(settingsStore.getState().saved);
}

function getEffectiveVolume(volumeMultiplier: number): number {
  return Math.max(0, Math.min(1, getMasterVolume() * volumeMultiplier));
}

function setVoiceState(partialState: Partial<VoicePlaybackState>): void {
  internalStore.setState((state) => ({
    ...state,
    ...partialState,
    lastUpdatedAt: partialState.lastUpdatedAt ?? nowIso(),
  }));
}

function stopAllAudio(): void {
  for (const audio of activeAudios) {
    audio.pause();
    audio.currentTime = 0;
  }
  activeAudios.clear();

  for (const audio of preloadedLobbyAudios.values()) {
    audio.pause();
    audio.currentTime = 0;
  }

  for (const activeSource of [...activeBufferSources]) {
    activeBufferSources.delete(activeSource);
    activeSource.source.onended = null;
    try {
      activeSource.source.stop();
    } catch {
      // no-op: source may already be stopped/ended
    }
    activeSource.source.disconnect();
    activeSource.gainNode.disconnect();
  }
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeWindow = window as Window & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };

  return maybeWindow.AudioContext ?? maybeWindow.webkitAudioContext ?? null;
}

function getSharedAudioContext(): AudioContext | null {
  if (sharedAudioContext?.state === "closed") {
    sharedAudioContext = null;
    decodedBuffers.clear();
    loadingBuffers.clear();
  }

  if (sharedAudioContext !== null) {
    return sharedAudioContext;
  }

  const AudioContextCtor = getAudioContextConstructor();
  if (AudioContextCtor === null) {
    return null;
  }

  sharedAudioContext = new AudioContextCtor();
  return sharedAudioContext;
}

async function getDecodedBuffer(kind: SoundEffectKey): Promise<AudioBuffer> {
  const cached = decodedBuffers.get(kind);
  if (cached !== undefined) {
    return cached;
  }

  const inFlight = loadingBuffers.get(kind);
  if (inFlight !== undefined) {
    return inFlight;
  }

  const context = getSharedAudioContext();
  if (context === null) {
    throw new Error("Web Audio API is unavailable.");
  }

  const loading = fetch(SOUND_EFFECT_URLS[kind])
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${kind} (${response.status}).`);
      }
      return response.arrayBuffer();
    })
    .then((audioData) => context.decodeAudioData(audioData))
    .then((buffer) => {
      decodedBuffers.set(kind, buffer);
      loadingBuffers.delete(kind);
      return buffer;
    })
    .catch((error) => {
      loadingBuffers.delete(kind);
      throw error;
    });

  loadingBuffers.set(kind, loading);
  return loading;
}

async function playCueWithWebAudio(cue: ScheduledCue): Promise<boolean> {
  const context = getSharedAudioContext();
  if (context === null) {
    return false;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }

  if (context.state !== "running") {
    return false;
  }

  const buffer = await getDecodedBuffer(cue.kind);
  const source = context.createBufferSource();
  const gainNode = context.createGain();
  gainNode.gain.value = getMasterVolume();

  source.buffer = buffer;
  source.connect(gainNode);
  gainNode.connect(context.destination);

  const activeSource: ActiveBufferSource = { source, gainNode };
  activeBufferSources.add(activeSource);
  source.onended = () => {
    activeBufferSources.delete(activeSource);
    source.disconnect();
    gainNode.disconnect();
  };

  source.start();
  return true;
}

async function playCueWithHtmlAudio(cue: ScheduledCue): Promise<void> {
  const audio = new Audio(SOUND_EFFECT_URLS[cue.kind]);
  audio.volume = getMasterVolume();
  activeAudios.add(audio);
  const cleanup = () => {
    activeAudios.delete(audio);
  };
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("pause", cleanup, { once: true });

  await audio.play();
}

function ensurePreloadedLobbyAudio(kind: LobbyNotificationSoundEffectKey): HTMLAudioElement {
  const cachedAudio = preloadedLobbyAudios.get(kind);
  if (cachedAudio !== undefined) {
    return cachedAudio;
  }

  const audio = new Audio(LOBBY_NOTIFICATION_SOUND_PROFILES[kind].url);
  audio.preload = "auto";
  audio.load();
  preloadedLobbyAudios.set(kind, audio);
  return audio;
}

function preloadLobbyNotificationSounds(): void {
  for (const kind of LOBBY_NOTIFICATION_SOUND_KEYS) {
    try {
      ensurePreloadedLobbyAudio(kind);
    } catch {
      // no-op: browser environment may block eager preload
    }
  }
}

export async function playLobbyNotificationSound(kind: LobbyNotificationSoundEffectKey): Promise<void> {
  if (!isVoicePlaybackEnabled(settingsStore.getState().saved)) {
    return;
  }

  const profile = LOBBY_NOTIFICATION_SOUND_PROFILES[kind];
  const volume = getEffectiveVolume(profile.volumeMultiplier);
  if (volume <= 0) {
    return;
  }

  try {
    const audio = ensurePreloadedLobbyAudio(kind);
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    await audio.play();
  } catch (error) {
    console.debug("[voice-announcer] Failed to play lobby notification sound.", {
      kind,
      error,
    });
  }
}

function clearPlayback(nextPhase: VoicePlaybackPhase, detail: string, enabled: boolean): void {
  if (SOUND_CLEAR_QUEUE_ON_STATE_CHANGE) {
    for (const timeoutId of activeTimeoutIds) {
      window.clearTimeout(timeoutId);
    }
    activeTimeoutIds = [];
    queuedEventIds.clear();
  }

  if (SOUND_STOP_CURRENT_ON_STATE_CHANGE) {
    stopAllAudio();
  }

  if (nextPhase === "IDLE" || nextPhase === "DISABLED") {
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

function resetRoomPlayback(roomId: string | null): void {
  if (roomId === activeRoomId) {
    return;
  }

  clearPlayback("IDLE", "Sound cues idle.", isVoicePlaybackEnabled(settingsStore.getState().saved));
  activeRoomId = roomId;
  playedEventIds.clear();
  lastPlayedAtByKind.clear();
  setVoiceState({
    phase: "IDLE",
    enabled: isVoicePlaybackEnabled(settingsStore.getState().saved),
    pendingCues: 0,
    detail: roomId === null ? "Sound cues idle." : `Sound cues reset for room ${roomId}.`,
    roundToken: null,
  });
}

function buildRoundToken(roomId: string, round: CurrentRoundSnapshot): string {
  return `${roomId}:${round.round_index}:${round.round_started_at}`;
}

function createRoundCues(roomId: string, round: CurrentRoundSnapshot): ScheduledCue[] {
  const startedAtMs = Date.parse(round.round_started_at);
  if (Number.isNaN(startedAtMs)) {
    return [];
  }

  const cues: ScheduledCue[] = [];

  cues.push({
    kind: "round_intro",
    eventId: `round_intro:${roomId}:${round.round_index}`,
    dueAtMs: startedAtMs,
  });

  for (let offset = 0; offset < 10; offset += 1) {
    const secondRemaining = 10 - offset;
    cues.push({
      kind: "count_beep",
      eventId: `count_beep:${roomId}:${round.round_index}:music_select:${secondRemaining}`,
      dueAtMs: startedAtMs + (ROUND_STAGE_COUNTDOWN_AT_SECONDS + offset) * 1_000,
    });
  }

  cues.push({
    kind: "phase_locked",
    eventId: `phase_locked:${roomId}:${round.round_index}`,
    dueAtMs: startedAtMs + ROUND_MUSIC_SELECT_SECONDS * 1_000,
  });

  for (let offset = 0; offset < 3; offset += 1) {
    const secondRemaining = 3 - offset;
    cues.push({
      kind: "count_beep",
      eventId: `count_beep:${roomId}:${round.round_index}:play_start:${secondRemaining}`,
      dueAtMs: startedAtMs + (ROUND_START_CALL_AT_SECONDS + offset) * 1_000,
    });
  }

  cues.push({
    kind: "count_go",
    eventId: `count_go:${roomId}:${round.round_index}`,
    dueAtMs: startedAtMs + ROUND_PLAY_BEGIN_AT_SECONDS * 1_000,
  });

  return cues;
}

function shouldSuppressCue(cue: ScheduledCue): boolean {
  if (playedEventIds.has(cue.eventId)) {
    return true;
  }

  if (cue.kind === "cancel" && cue.closeReason === "ALL_ROUNDS_COMPLETED") {
    playedEventIds.add(cue.eventId);
    return true;
  }

  if (cue.kind === "match_found") {
    const lastPlayedAt = lastPlayedAtByKind.get(cue.kind) ?? 0;
    if (Date.now() - lastPlayedAt < MATCH_FOUND_MIN_INTERVAL_MS) {
      playedEventIds.add(cue.eventId);
      return true;
    }
  }

  return false;
}

async function playCue(cue: ScheduledCue): Promise<void> {
  if (shouldSuppressCue(cue) || !isVoicePlaybackEnabled(settingsStore.getState().saved)) {
    return;
  }

  playedEventIds.add(cue.eventId);
  lastPlayedAtByKind.set(cue.kind, Date.now());

  setVoiceState({
    phase: "PLAYING",
    enabled: true,
    pendingCues: activeTimeoutIds.length,
    detail: `Playing ${cue.kind}.`,
    roundToken: activeRoundToken,
  });

  try {
    const playedWithWebAudio = await playCueWithWebAudio(cue);
    if (!playedWithWebAudio) {
      await playCueWithHtmlAudio(cue);
    }
  } catch (primaryError) {
    try {
      await playCueWithHtmlAudio(cue);
      return;
    } catch (fallbackError) {
      const finalError = fallbackError instanceof Error ? fallbackError : primaryError;
      setVoiceState({
        phase: "ERROR",
        enabled: true,
        pendingCues: activeTimeoutIds.length,
        detail: finalError instanceof Error ? finalError.message : `Failed to play ${cue.kind}.`,
        roundToken: activeRoundToken,
      });
      return;
    }
  }
}

function scheduleCue(cue: ScheduledCue): boolean {
  if (playedEventIds.has(cue.eventId) || queuedEventIds.has(cue.eventId)) {
    return false;
  }

  const delayMs = cue.dueAtMs - Date.now();
  if (delayMs < -RECENT_CUE_GRACE_MS) {
    playedEventIds.add(cue.eventId);
    return false;
  }

  if (delayMs <= 0) {
    void playCue(cue);
    return true;
  }

  queuedEventIds.add(cue.eventId);
  const timeoutId = window.setTimeout(() => {
    activeTimeoutIds = activeTimeoutIds.filter((value) => value !== timeoutId);
    queuedEventIds.delete(cue.eventId);
    void playCue(cue);
  }, delayMs);
  activeTimeoutIds.push(timeoutId);
  return true;
}

function scheduleRoundPlayback(roomId: string, round: CurrentRoundSnapshot): void {
  const roundToken = buildRoundToken(roomId, round);
  const cues = createRoundCues(roomId, round);
  let scheduledCount = 0;

  for (const cue of cues) {
    if (scheduleCue(cue)) {
      scheduledCount += 1;
    }
  }

  setVoiceState({
    phase: scheduledCount > 0 ? "ARMED" : "IDLE",
    enabled: true,
    pendingCues: scheduledCount,
    detail:
      scheduledCount > 0
        ? `Queued ${scheduledCount} sound cue(s) for round ${round.round_index + 1}.`
        : `Sound cues already elapsed for round ${round.round_index + 1}.`,
    roundToken,
  });
}

function processAudioEvents(audioEvents: RoomAudioEvent[]): void {
  for (const event of [...audioEvents].reverse()) {
    if (playedEventIds.has(event.eventId) || queuedEventIds.has(event.eventId)) {
      continue;
    }

    const dueAtMs = Date.parse(event.scheduledAt);
    scheduleCue({
      kind: event.kind,
      eventId: event.eventId,
      dueAtMs: Number.isNaN(dueAtMs) ? Date.now() : dueAtMs,
      closeReason: event.closeReason ?? null,
    });
  }
}

function syncVoicePlayback(): void {
  const savedSettings = settingsStore.getState().saved;
  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;

  resetRoomPlayback(snapshot?.room_id ?? null);

  if (!isVoicePlaybackEnabled(savedSettings)) {
    clearPlayback("DISABLED", "Sound notifications are turned off.", false);
    return;
  }

  if (snapshot === null || snapshot.room_state !== "PLAYING" || snapshot.current_round === null) {
    if (activeRoundToken !== null) {
      clearPlayback("IDLE", "Sound cues idle.", true);
    }
    processAudioEvents(roomState.audioEvents);
    return;
  }

  const nextRoundToken = buildRoundToken(snapshot.room_id, snapshot.current_round);
  if (nextRoundToken !== activeRoundToken) {
    clearPlayback("IDLE", `Arming sound cues for round ${snapshot.current_round.round_index + 1}.`, true);
    activeRoundToken = nextRoundToken;
    scheduleRoundPlayback(snapshot.room_id, snapshot.current_round);
  }

  processAudioEvents(roomState.audioEvents);
}

export const voiceAnnouncerService = {
  ...internalStore,
  start(): void {
    if (unsubscribeRoomStore !== null || unsubscribeSettingsStore !== null) {
      return;
    }

    preloadLobbyNotificationSounds();
    unsubscribeRoomStore = roomStore.subscribe(syncVoicePlayback);
    unsubscribeSettingsStore = settingsStore.subscribe(syncVoicePlayback);
    syncVoicePlayback();
  },
  stop(): void {
    unsubscribeRoomStore?.();
    unsubscribeSettingsStore?.();
    unsubscribeRoomStore = null;
    unsubscribeSettingsStore = null;
    clearPlayback("IDLE", "Sound cues idle.", isVoicePlaybackEnabled(settingsStore.getState().saved));
  },
};

export function useVoicePlaybackStore<TSelected>(
  selector: (state: VoicePlaybackState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
