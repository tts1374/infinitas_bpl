export const MODES = ["ARENA", "BPL", "BPL4"] as const;

export type Mode = (typeof MODES)[number];

export const WIN_METRICS = ["SCORE", "MISSCOUNT"] as const;

export type WinMetric = (typeof WIN_METRICS)[number];

export const PLAY_STYLES = ["SP", "DP"] as const;

export type PlayStyle = (typeof PLAY_STYLES)[number];

export const LEVEL_FILTERS = ["ANY", "LV8_10", "LV10", "LV11", "LV12"] as const;

export type LevelFilter = (typeof LEVEL_FILTERS)[number];

export const CHART_DIFFICULTIES = [
  "BEGINNER",
  "NORMAL",
  "HYPER",
  "ANOTHER",
  "LEGGENDARIA",
] as const;

export type ChartDifficulty = (typeof CHART_DIFFICULTIES)[number];
