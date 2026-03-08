import type {
  CurrentRoundConfirmedPlayer,
  ExpectedKey,
  JsonObject,
  PlayStyle,
  RoomPlayerSnapshot,
  RoomSettings,
  SubmissionReason,
  SubmissionStatus,
  SubmittedBy,
} from "@infinitas/shared";

export const STATS_SCHEMA_VERSION = 1;
export const STATS_STORAGE_KEY = "infinitas.client.stats.v1";
export const INITIAL_ELO_RATING = 1500;
export const ELO_K_FACTOR = 24;
export const RECENT_HISTORY_LIMIT = 10;
export const RECENT_STABILITY_LIMIT = 20;
export const MIN_RANKING_MATCH_COUNT = 3;

export type StatsBattleType = "ARENA" | "BPL" | "PRIVATE";
export type StatsMatchResult = "WIN" | "LOSE" | "DRAW";
export type RatingSeries = "ARENA_SP" | "ARENA_DP" | "BPL_SP" | "BPL_DP";

export interface StatsSourceMeta {
  source?: string;
  timestamp?: string;
  title?: string;
  title_search_key?: string;
  score?: number;
  misscount?: number;
  file_path?: string;
  [key: string]: JsonObject[keyof JsonObject];
}

export interface SessionPlayerResult {
  player_id: string;
  display_name: string;
  status: SubmissionStatus | null;
  metric_value: number | null;
  reason: SubmissionReason;
  submitted_at: string | null;
  submitted_by: SubmittedBy | null;
  source_meta: JsonObject | null;
}

export interface SessionRound {
  round_index: number;
  expected_key: ExpectedKey;
  display: {
    title: string;
    level: number | null;
  };
  round_started_at: string | null;
  results: SessionPlayerResult[];
}

export interface RoomStatsSession {
  room_id: string;
  settings: RoomSettings;
  players: RoomPlayerSnapshot[];
  rounds: SessionRound[];
}

export interface MatchRecord {
  match_id: string;
  started_at: string;
  ended_at: string;
  battle_type: StatsBattleType;
  play_mode: PlayStyle;
  opponent_count: number;
  opponent_id: string | null;
  opponent_name: string | null;
  is_rated: boolean;
  is_complete: boolean;
  match_result: StatsMatchResult;
  match_point_total: number;
  rating_score: number | null;
  rating_before: number | null;
  rating_after: number | null;
  rating_delta: number | null;
  invalid_reason: string | null;
  final_rank: number | null;
  participant_count: number;
}

export interface MatchGame {
  match_game_id: string;
  match_id: string;
  played_at: string;
  game_index: number;
  chart_id: string;
  chart_title: string;
  chart_difficulty: string;
  chart_level: number | null;
  battle_type: StatsBattleType;
  play_mode: PlayStyle;
  game_result: StatsMatchResult;
  round_point: number;
  my_ex_score: number | null;
  opponent_ex_score: number | null;
  my_bp: number | null;
  opponent_bp: number | null;
  result_confirmed_at: string;
}

export interface PlayResult {
  play_result_id: string;
  played_at: string;
  battle_type: StatsBattleType;
  play_mode: PlayStyle;
  chart_id: string;
  chart_title: string;
  chart_difficulty: string;
  chart_level: number | null;
  my_ex_score: number | null;
  my_bp: number | null;
  source_match_id: string | null;
}

export interface PersonalBest {
  chart_id: string;
  play_mode: PlayStyle;
  chart_title: string;
  chart_difficulty: string;
  chart_level: number | null;
  best_ex_score: number | null;
  best_bp: number | null;
  best_played_at: string;
  source_play_result_id: string | null;
}

export interface StatsArchive {
  schema_version: 1;
  updated_at: string | null;
  matches: MatchRecord[];
  match_games: MatchGame[];
  play_results: PlayResult[];
  personal_bests: PersonalBest[];
  rating_series_state: Partial<Record<RatingSeries, number>>;
}

export interface StatsArchiveState {
  status: "IDLE" | "READY";
  updatedAt: string | null;
  archive: StatsArchive;
}

export interface MatchHistoryEntry {
  match_id: string;
  ended_at: string;
  match_result: StatsMatchResult;
  rating_delta: number | null;
  rating_after: number | null;
  detail: string;
}

export interface DetailedMatchHistoryGameEntry {
  match_game_id: string;
  game_index: number;
  chart_title: string;
  round_point: number;
  game_result: StatsMatchResult;
  my_ex_score: number | null;
  my_bp: number | null;
}

export interface DetailedMatchHistoryEntry {
  match_id: string;
  ended_at: string;
  match_result: StatsMatchResult;
  rating_delta: number | null;
  rating_after: number | null;
  final_rank: number | null;
  match_point_total: number;
  opponent_point_total: number | null;
  total_ex_score: number | null;
  games: DetailedMatchHistoryGameEntry[];
}

export interface ChartRankingEntry {
  chart_id: string;
  chart_title: string;
  chart_difficulty: string;
  chart_level: number | null;
  win_rate: number;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  average_ex_diff: number | null;
}

export interface StabilitySummary {
  recentCount: number;
  comparedCount: number;
  scoreStability: number | null;
  missStability: number | null;
}

export function createEmptyStatsArchive(): StatsArchive {
  return {
    schema_version: STATS_SCHEMA_VERSION,
    updated_at: null,
    matches: [],
    match_games: [],
    play_results: [],
    personal_bests: [],
    rating_series_state: {},
  };
}

export function buildSessionPlayerResult(
  player: RoomPlayerSnapshot,
  confirmation: CurrentRoundConfirmedPlayer,
): SessionPlayerResult {
  return {
    player_id: confirmation.player_id,
    display_name: player.display_name,
    status: confirmation.status,
    metric_value: confirmation.metric_value,
    reason: confirmation.reason,
    submitted_at: confirmation.submitted_at,
    submitted_by: confirmation.submitted_by,
    source_meta: confirmation.source_meta,
  };
}
