import type { StatsMatchResult } from "../features/stats/models";

export const MATCH_HISTORY_SCHEMA_VERSION = 1 as const;

export type MatchHistoryMode = "ARENA" | "BPL";

export interface MatchHistoryPlayer {
  player_id: string;
  display_name: string;
}

export interface MatchHistoryChart {
  order: number;
  title: string;
  play_style: string;
  difficulty: string;
  self_score: number;
  self_miss_count: number;
  self_point: number;
}

export interface ArenaSummary {
  arena_rank: number;
  arena_points: number;
}

export interface BplSummary {
  bpl_result: StatsMatchResult;
  bpl_my_score: number;
  bpl_opp_score: number;
}

export type MatchHistorySummary = ArenaSummary | BplSummary;

export interface MatchHistoryEntry {
  match_id: string;
  completed_at: string;
  mode: MatchHistoryMode;
  self_player_id: string;
  players: MatchHistoryPlayer[];
  summary: MatchHistorySummary;
  charts: MatchHistoryChart[];
}

export interface MatchHistoryDocument {
  schema_version: typeof MATCH_HISTORY_SCHEMA_VERSION;
  session_started_at: string;
  active_mode: MatchHistoryMode | null;
  matches: MatchHistoryEntry[];
}

interface LegacyMatchHistoryDocument {
  session_started_at: string;
  active_mode?: MatchHistoryMode | null;
  matches: MatchHistoryEntry[];
}

type WarnLogger = (message: string) => void;

export function createEmptyMatchHistory(
  sessionStartedAt = new Date().toISOString(),
): MatchHistoryDocument {
  return {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    session_started_at: sessionStartedAt,
    active_mode: null,
    matches: [],
  };
}

export function normalizeMatchHistoryMode(value: string): MatchHistoryMode | null {
  if (value === "ARENA") {
    return "ARENA";
  }
  if (value === "BPL" || value === "BPL4") {
    return "BPL";
  }
  return null;
}

export function loadMatchHistoryDocument(
  rawValue: unknown,
  warn: WarnLogger = console.warn,
): MatchHistoryDocument {
  if (isMatchHistoryDocument(rawValue)) {
    return rawValue;
  }

  if (isLegacyMatchHistoryDocument(rawValue)) {
    return {
      schema_version: MATCH_HISTORY_SCHEMA_VERSION,
      session_started_at: rawValue.session_started_at,
      active_mode: rawValue.active_mode ?? null,
      matches: rawValue.matches,
    };
  }

  const schemaVersion = readSchemaVersion(rawValue);
  warn(
    schemaVersion === null || schemaVersion === MATCH_HISTORY_SCHEMA_VERSION
      ? "[match-history] Failed to load malformed local history. Falling back to an empty session."
      : `[match-history] Unsupported local history schema_version: ${schemaVersion}. Falling back to an empty session.`,
  );
  return createEmptyMatchHistory();
}

function readSchemaVersion(value: unknown): unknown | null {
  if (!isRecord(value) || !("schema_version" in value)) {
    return null;
  }
  return value.schema_version;
}

function isMatchHistoryDocument(value: unknown): value is MatchHistoryDocument {
  return isRecord(value)
    && value.schema_version === MATCH_HISTORY_SCHEMA_VERSION
    && isDocumentBody(value);
}

function isLegacyMatchHistoryDocument(value: unknown): value is LegacyMatchHistoryDocument {
  return isRecord(value)
    && !("schema_version" in value)
    && isDocumentBody(value);
}

function isDocumentBody(value: Record<string, unknown>): boolean {
  return typeof value.session_started_at === "string"
    && (!("active_mode" in value) || value.active_mode === null || isMatchHistoryMode(value.active_mode))
    && Array.isArray(value.matches)
    && value.matches.every(isMatchHistoryEntry);
}

function isMatchHistoryEntry(value: unknown): value is MatchHistoryEntry {
  if (!isRecord(value)
    || typeof value.match_id !== "string"
    || typeof value.completed_at !== "string"
    || !isMatchHistoryMode(value.mode)
    || typeof value.self_player_id !== "string"
    || !Array.isArray(value.players)
    || !value.players.every(isMatchHistoryPlayer)
    || !Array.isArray(value.charts)
    || !value.charts.every(isMatchHistoryChart)) {
    return false;
  }

  return value.mode === "ARENA"
    ? isArenaSummary(value.summary)
    : isBplSummary(value.summary);
}

function isMatchHistoryMode(value: unknown): value is MatchHistoryMode {
  return value === "ARENA" || value === "BPL";
}

function isMatchHistoryPlayer(value: unknown): value is MatchHistoryPlayer {
  return isRecord(value)
    && typeof value.player_id === "string"
    && typeof value.display_name === "string";
}

function isMatchHistoryChart(value: unknown): value is MatchHistoryChart {
  return isRecord(value)
    && typeof value.order === "number"
    && typeof value.title === "string"
    && typeof value.play_style === "string"
    && typeof value.difficulty === "string"
    && typeof value.self_score === "number"
    && typeof value.self_miss_count === "number"
    && typeof value.self_point === "number";
}

function isArenaSummary(value: unknown): value is ArenaSummary {
  return isRecord(value)
    && typeof value.arena_rank === "number"
    && Number.isInteger(value.arena_rank)
    && value.arena_rank >= 1
    && value.arena_rank <= 4
    && typeof value.arena_points === "number"
    && Number.isFinite(value.arena_points);
}

function isBplSummary(value: unknown): value is BplSummary {
  return isRecord(value)
    && (value.bpl_result === "WIN" || value.bpl_result === "LOSE" || value.bpl_result === "DRAW")
    && typeof value.bpl_my_score === "number"
    && typeof value.bpl_opp_score === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
