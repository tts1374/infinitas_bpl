import type { StatsMatchResult } from "../features/stats/models";
import type { MatchRecord } from "../features/stats/models";
import type {
  MatchHistoryDocument,
  MatchHistoryEntry,
  MatchHistoryMode,
} from "./match-history-document";

const MAX_MATCHES_PER_MODE = 3;

export interface ArenaMatchHistorySummary {
  mode: "ARENA";
  rankCounts: Record<1 | 2 | 3 | 4, number>;
  pointsTotal: number;
}

export interface BplMatchHistorySummary {
  mode: "BPL";
  resultCounts: Record<StatsMatchResult, number>;
}

export type ActiveMatchHistorySummary = ArenaMatchHistorySummary | BplMatchHistorySummary;

export interface ActiveMatchHistory {
  mode: MatchHistoryMode | null;
  matches: MatchHistoryEntry[];
  summary: ActiveMatchHistorySummary | null;
}

export function collectManualResetProcessedMatchIds(
  matches: Array<Pick<MatchRecord, "match_id">>,
): Set<string> {
  return new Set(matches.map((match) => match.match_id));
}

function compareByCompletedAtDescending(left: MatchHistoryEntry, right: MatchHistoryEntry): number {
  return Date.parse(right.completed_at) - Date.parse(left.completed_at);
}

export function selectActiveMatchHistory(
  history: MatchHistoryDocument,
  preferredMode = history.active_mode,
): ActiveMatchHistory {
  const latestPreferredMatch =
    preferredMode === null
      ? undefined
      : history.matches
          .filter((match) => match.mode === preferredMode)
          .sort(compareByCompletedAtDescending)[0];
  const latestMatch = [...history.matches].sort(compareByCompletedAtDescending)[0];
  const activeMode = latestPreferredMatch?.mode ?? latestMatch?.mode;
  if (activeMode === undefined) {
    return { mode: null, matches: [], summary: null };
  }

  const matches = history.matches
    .filter((match) => match.mode === activeMode)
    .sort(compareByCompletedAtDescending)
    .slice(0, MAX_MATCHES_PER_MODE);

  if (activeMode === "ARENA") {
    const rankCounts: ArenaMatchHistorySummary["rankCounts"] = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let pointsTotal = 0;
    for (const match of matches) {
      if ("arena_rank" in match.summary) {
        rankCounts[match.summary.arena_rank as 1 | 2 | 3 | 4] += 1;
        pointsTotal += match.summary.arena_points;
      }
    }
    return { mode: "ARENA", matches, summary: { mode: "ARENA", rankCounts, pointsTotal } };
  }

  const resultCounts: BplMatchHistorySummary["resultCounts"] = { WIN: 0, LOSE: 0, DRAW: 0 };
  for (const match of matches) {
    if ("bpl_result" in match.summary) {
      resultCounts[match.summary.bpl_result] += 1;
    }
  }
  return { mode: "BPL", matches, summary: { mode: "BPL", resultCounts } };
}
