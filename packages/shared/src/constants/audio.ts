export const SOUND_EFFECT_KEYS = [
  "round_intro",
  "count_beep",
  "match_found",
  "phase_locked",
  "count_go",
  "cancel",
  "error",
] as const;

export type SoundEffectKey = (typeof SOUND_EFFECT_KEYS)[number];

export const MATCH_FOUND_MIN_INTERVAL_MS = 400;

export const SOUND_CLEAR_QUEUE_ON_STATE_CHANGE = true;
export const SOUND_STOP_CURRENT_ON_STATE_CHANGE = true;
