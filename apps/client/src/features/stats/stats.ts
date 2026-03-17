import type {
  JsonObject,
  PlayStyle,
  ResultReadyPayload,
  RoomSettings,
  RoomStateSnapshot,
  SubmissionReason,
  SubmissionStatus,
  SubmittedBy,
  WinMetric,
} from "@infinitas/shared";
import { applyMatchRating, getResultScore } from "./rating";
import {
  buildSessionPlayerResult,
  createEmptyStatsArchive,
  MIN_RANKING_MATCH_COUNT,
  RECENT_HISTORY_LIMIT,
  RECENT_STABILITY_LIMIT,
  type ChartRankingEntry,
  type DetailedMatchHistoryEntry,
  type DetailedMatchHistoryGameEntry,
  type MatchGame,
  type MatchHistoryEntry,
  type MatchRecord,
  type PersonalBest,
  type PlayResult,
  type RatingSeries,
  type RoomStatsSession,
  type SessionPlayerResult,
  type SessionRound,
  type StabilitySummary,
  type StatsArchive,
  type StatsBattleType,
  type StatsMatchResult,
  type StatsSourceMeta,
} from "./models";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableString(value: unknown): string | null {
  return value === null ? null : asString(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return value === null ? null : asNumber(value);
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asSubmissionStatus(value: unknown): SubmissionStatus | null {
  return value === "PLAYED" || value === "SKIPPED" || value === "TIMEOUT" ? value : null;
}

function asSubmissionReason(value: unknown): SubmissionReason {
  return value === null || value === "UNOWNED" || value === "TECH" || value === "OTHER" || value === "UNMAPPED_TIMEOUT"
    ? value
    : null;
}

function asSubmittedBy(value: unknown): SubmittedBy | null {
  return value === "SELF" || value === "HOST" || value === "SYSTEM" ? value : null;
}

function toSourceMeta(value: unknown): JsonObject | null {
  return asRecord(value) as JsonObject | null;
}

function getSourceMetric(sourceMeta: JsonObject | null, key: "score" | "misscount"): number | null {
  if (sourceMeta === null) {
    return null;
  }

  const value = (sourceMeta as StatsSourceMeta)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDecimal(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function compareMetricValues(left: number, right: number, winMetric: WinMetric): number {
  if (left === right) {
    return 0;
  }

  if (winMetric === "SCORE") {
    return left > right ? 1 : -1;
  }

  return left < right ? 1 : -1;
}

function getArenaPointsForRank(rank: number): number {
  if (rank === 1) {
    return 2;
  }

  if (rank === 2) {
    return 1;
  }

  return 0;
}

function getArenaRankByPlayerId(results: SessionPlayerResult[], winMetric: WinMetric): Map<string, number> {
  const rankedPlayers = results
    .filter((entry): entry is SessionPlayerResult & { metric_value: number } => entry.metric_value !== null)
    .sort((left, right) => {
      const comparison = compareMetricValues(left.metric_value, right.metric_value, winMetric);
      if (comparison !== 0) {
        return comparison > 0 ? -1 : 1;
      }

      return left.player_id.localeCompare(right.player_id);
    });

  const rankByPlayerId = new Map<string, number>();
  let previousMetricValue: number | null = null;
  let previousRank = 0;
  rankedPlayers.forEach((entry, index) => {
    if (previousMetricValue !== null && entry.metric_value === previousMetricValue) {
      rankByPlayerId.set(entry.player_id, previousRank);
      return;
    }

    const rank = index + 1;
    previousMetricValue = entry.metric_value;
    previousRank = rank;
    rankByPlayerId.set(entry.player_id, rank);
  });

  return rankByPlayerId;
}

function getBattleType(settings: RoomSettings): StatsBattleType {
  return settings.visibility === "PRIVATE" ? "PRIVATE" : settings.mode;
}

export function buildChartId(expectedKey: {
  play_style: PlayStyle;
  difficulty: string;
  title_search_key: string;
}): string {
  return `${expectedKey.play_style}::${expectedKey.difficulty}::${expectedKey.title_search_key}`;
}

export function buildRatingSeries(
  battleType: StatsBattleType,
  playMode: PlayStyle,
): RatingSeries | null {
  if (battleType === "PRIVATE") {
    return null;
  }

  return `${battleType}_${playMode}` as RatingSeries;
}

function sortByTimeAscending<TEntry extends { ended_at?: string; played_at?: string; match_id?: string; match_game_id?: string; play_result_id?: string }>(
  entries: TEntry[],
): TEntry[] {
  return [...entries].sort((left, right) => {
    const leftTime = left.ended_at ?? left.played_at ?? "";
    const rightTime = right.ended_at ?? right.played_at ?? "";
    const timeOrder = leftTime.localeCompare(rightTime);
    if (timeOrder !== 0) {
      return timeOrder;
    }

    const leftId = left.match_id ?? left.match_game_id ?? left.play_result_id ?? "";
    const rightId = right.match_id ?? right.match_game_id ?? right.play_result_id ?? "";
    return leftId.localeCompare(rightId);
  });
}

function sortByTimeDescending<TEntry extends { ended_at?: string; played_at?: string; match_id?: string; match_game_id?: string; play_result_id?: string }>(
  entries: TEntry[],
): TEntry[] {
  return sortByTimeAscending(entries).reverse();
}

function getRoundComplete(round: SessionRound, playerCount: number): boolean {
  return (
    round.results.length === playerCount &&
    round.results.every(
      (entry) =>
        entry.status !== null &&
        entry.metric_value !== null &&
        entry.submitted_at !== null,
    )
  );
}

function toMetrics(
  sourceMeta: JsonObject | null,
  metricValue: number | null,
  winMetric: WinMetric,
): { exScore: number | null; bp: number | null } {
  const score = getSourceMetric(sourceMeta, "score");
  const misscount = getSourceMetric(sourceMeta, "misscount");

  return {
    exScore: score ?? (winMetric === "SCORE" ? metricValue : null),
    bp: misscount ?? (winMetric === "MISSCOUNT" ? metricValue : null),
  };
}

function getPairwiseScore(
  me: SessionPlayerResult,
  others: SessionPlayerResult[],
  winMetric: WinMetric,
): number {
  if (others.length === 0 || me.metric_value === null) {
    return 0;
  }
  const myMetric = me.metric_value;

  const total = others.reduce((sum, opponent) => {
    if (opponent.metric_value === null) {
      return sum;
    }

    const comparison = compareMetricValues(myMetric, opponent.metric_value, winMetric);
    if (comparison > 0) {
      return sum + 1;
    }
    if (comparison < 0) {
      return sum;
    }
    return sum + 0.5;
  }, 0);

  return total / others.length;
}

function getGameResultFromScore(score: number): StatsMatchResult {
  if (score > 0.5) {
    return "WIN";
  }
  if (score < 0.5) {
    return "LOSE";
  }
  return "DRAW";
}

function buildSessionRoundFromResultReady(resultReady: ResultReadyPayload): SessionRound[] {
  const perRoundRecord = asRecord(resultReady.per_round);
  const roundsValue = perRoundRecord?.rounds;
  if (!Array.isArray(roundsValue)) {
    return [];
  }

  const rounds: SessionRound[] = [];
  for (const roundValue of roundsValue) {
    const roundRecord = asRecord(roundValue);
    const expectedKeyRecord = asRecord(roundRecord?.expected_key);
    const displayRecord = asRecord(roundRecord?.display);
    const resultsValue = roundRecord?.results;
    if (roundRecord === null || expectedKeyRecord === null || displayRecord === null || !Array.isArray(resultsValue)) {
      continue;
    }

    const roundIndex = asNumber(roundRecord.round_index);
    const playStyle = expectedKeyRecord.play_style;
    const difficulty = asString(expectedKeyRecord.difficulty);
    const titleSearchKey = asString(expectedKeyRecord.title_search_key);
    const title = asString(displayRecord.title);
    if (
      roundIndex === null ||
      (playStyle !== "SP" && playStyle !== "DP") ||
      difficulty === null ||
      titleSearchKey === null ||
      title === null
    ) {
      continue;
    }

    const results: SessionPlayerResult[] = [];
    for (const resultValue of resultsValue) {
      const resultRecord = asRecord(resultValue);
      const playerId = asString(resultRecord?.player_id);
      const displayName = asString(resultRecord?.display_name);
      if (resultRecord === null || playerId === null || displayName === null) {
        continue;
      }

      results.push({
        player_id: playerId,
        display_name: displayName,
        status: asSubmissionStatus(resultRecord.status),
        metric_value: asNullableNumber(resultRecord.metric_value),
        reason: asSubmissionReason(resultRecord.reason),
        submitted_at: asNullableString(resultRecord.submitted_at),
        submitted_by: asSubmittedBy(resultRecord.submitted_by),
        source_meta: toSourceMeta(resultRecord.source_meta),
      });
    }

    rounds.push({
      round_index: roundIndex,
      expected_key: {
        play_style: playStyle,
        difficulty,
        title_search_key: titleSearchKey,
      },
      display: {
        title,
        level: asNullableNumber(displayRecord.level),
      },
      round_started_at: asNullableString(roundRecord.round_started_at),
      results,
    });
  }

  return rounds.sort((left, right) => left.round_index - right.round_index);
}

function readResultReadyDecision(resultReady: ResultReadyPayload | null): {
  isRated: boolean | null;
  ratedBlockReason: string | null;
} {
  if (resultReady === null) {
    return {
      isRated: null,
      ratedBlockReason: null,
    };
  }

  const summaryRecord = asRecord(resultReady.summary);
  return {
    isRated: asBoolean(summaryRecord?.is_rated),
    ratedBlockReason: asNullableString(summaryRecord?.rated_block_reason),
  };
}

function resolveMatchRatingDecision(input: {
  resultReady: ResultReadyPayload | null;
  canRate: boolean;
  fallbackInvalidReason: string | null;
}): {
  isRated: boolean;
  invalidReason: string | null;
} {
  const summaryDecision = readResultReadyDecision(input.resultReady);
  if (summaryDecision.isRated !== null) {
    return {
      isRated: summaryDecision.isRated && input.canRate,
      invalidReason:
        summaryDecision.isRated && input.canRate
          ? null
          : summaryDecision.ratedBlockReason ?? input.fallbackInvalidReason,
    };
  }

  return {
    isRated: input.canRate && input.fallbackInvalidReason === null,
    invalidReason: input.fallbackInvalidReason,
  };
}

function resolveSessionMatchId(input: {
  previousSession: RoomStatsSession | null;
  snapshot: RoomStateSnapshot;
  resultReady: ResultReadyPayload | null;
}): string {
  const summaryRecord = input.resultReady === null ? null : asRecord(input.resultReady.summary);
  const resultReadyMatchId = asString(summaryRecord?.match_id);
  if (resultReadyMatchId !== null) {
    return resultReadyMatchId;
  }

  if (input.previousSession !== null && input.previousSession.room_id === input.snapshot.room_id) {
    return input.previousSession.match_id;
  }

  return input.snapshot.room_id;
}

export function captureRoomStatsSession(
  previousSession: RoomStatsSession | null,
  snapshot: RoomStateSnapshot,
  resultReady: ResultReadyPayload | null,
): RoomStatsSession {
  const sessionMatchId = resolveSessionMatchId({
    previousSession,
    snapshot,
    resultReady,
  });
  const frozenRoundByIndex = new Map(snapshot.frozen_rounds.map((round) => [round.round_index, round]));
  const roundsByIndex = new Map(
    previousSession?.room_id === snapshot.room_id && previousSession.match_id === sessionMatchId
      ? previousSession.rounds.map((round) => [round.round_index, round])
      : [],
  );

  if (snapshot.current_round !== null) {
    const currentRoundDisplay = frozenRoundByIndex.get(snapshot.current_round.round_index);
    const playerById = new Map(snapshot.players.map((player) => [player.player_id, player]));
    const existingRound = roundsByIndex.get(snapshot.current_round.round_index);
    const resultsByPlayerId = new Map<string, SessionPlayerResult>(
      existingRound?.results.map((entry) => [entry.player_id, entry]) ?? [],
    );

    for (const confirmation of snapshot.current_round.confirmed) {
      const player = playerById.get(confirmation.player_id);
      if (!player) {
        continue;
      }

      resultsByPlayerId.set(confirmation.player_id, buildSessionPlayerResult(player, confirmation));
    }

    roundsByIndex.set(snapshot.current_round.round_index, {
      round_index: snapshot.current_round.round_index,
      expected_key: snapshot.current_round.expected_key,
      display: {
        title: currentRoundDisplay?.display.title ?? snapshot.current_round.expected_key.title_search_key,
        level: currentRoundDisplay?.display.level ?? null,
      },
      round_started_at: snapshot.current_round.round_started_at,
      results: Array.from(resultsByPlayerId.values()).sort((left, right) => left.player_id.localeCompare(right.player_id)),
    });
  }

  if (resultReady !== null) {
    for (const round of buildSessionRoundFromResultReady(resultReady)) {
      roundsByIndex.set(round.round_index, round);
    }
  }

  return {
    room_id: snapshot.room_id,
    match_id: sessionMatchId,
    settings: snapshot.settings,
    players: snapshot.players,
    rounds: Array.from(roundsByIndex.values()).sort((left, right) => left.round_index - right.round_index),
  };
}

interface ArenaPlayerStanding {
  player_id: string;
  display_name: string;
  total_points: number;
  total_ex_score: number | null;
  last_confirmed_at: string | null;
  final_rank: number;
  display_rank: number;
}

function mergeMatchGame(existing: MatchGame, incoming: MatchGame): MatchGame {
  return existing.result_confirmed_at >= incoming.result_confirmed_at ? existing : incoming;
}

function mergePlayResult(existing: PlayResult, incoming: PlayResult): PlayResult {
  const existingCount = [existing.my_ex_score, existing.my_bp].filter((value) => value !== null).length;
  const incomingCount = [incoming.my_ex_score, incoming.my_bp].filter((value) => value !== null).length;
  return existingCount >= incomingCount ? existing : incoming;
}

function upsertMatchGames(existing: MatchGame[], incoming: MatchGame[]): MatchGame[] {
  const byId = new Map(existing.map((entry) => [entry.match_game_id, entry]));
  let changed = false;

  for (const game of incoming) {
    const current = byId.get(game.match_game_id);
    if (current === undefined) {
      byId.set(game.match_game_id, game);
      changed = true;
      continue;
    }

    const merged = mergeMatchGame(current, game);
    if (merged !== current) {
      byId.set(game.match_game_id, merged);
      changed = true;
    }
  }

  return changed ? sortByTimeDescending(Array.from(byId.values())) : existing;
}

function upsertPlayResults(existing: PlayResult[], incoming: PlayResult[]): PlayResult[] {
  const byId = new Map(existing.map((entry) => [entry.play_result_id, entry]));
  let changed = false;

  for (const result of incoming) {
    const current = byId.get(result.play_result_id);
    if (current === undefined) {
      byId.set(result.play_result_id, result);
      changed = true;
      continue;
    }

    const merged = mergePlayResult(current, result);
    if (merged !== current) {
      byId.set(result.play_result_id, merged);
      changed = true;
    }
  }

  return changed ? sortByTimeDescending(Array.from(byId.values())) : existing;
}

function upsertMatchRecord(existing: MatchRecord[], incoming: MatchRecord): MatchRecord[] {
  const index = existing.findIndex((entry) => entry.match_id === incoming.match_id);
  if (index < 0) {
    return sortByTimeDescending([...existing, incoming]);
  }

  const current = existing[index];
  if (JSON.stringify(current) === JSON.stringify(incoming)) {
    return existing;
  }

  const next = [...existing];
  next[index] = incoming;
  return sortByTimeDescending(next);
}

function buildPersonalBests(playResults: PlayResult[]): PersonalBest[] {
  const bestByKey = new Map<string, PersonalBest>();

  for (const result of sortByTimeAscending(playResults)) {
    const key = `${result.play_mode}:${result.chart_id}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, {
        chart_id: result.chart_id,
        play_mode: result.play_mode,
        chart_title: result.chart_title,
        chart_difficulty: result.chart_difficulty,
        chart_level: result.chart_level,
        best_ex_score: result.my_ex_score,
        best_bp: result.my_bp,
        best_played_at: result.played_at,
        source_play_result_id: result.play_result_id,
      });
      continue;
    }

    let changed = false;
    if (result.my_ex_score !== null && (existing.best_ex_score === null || result.my_ex_score > existing.best_ex_score)) {
      existing.best_ex_score = result.my_ex_score;
      changed = true;
    }
    if (result.my_bp !== null && (existing.best_bp === null || result.my_bp < existing.best_bp)) {
      existing.best_bp = result.my_bp;
      changed = true;
    }
    if (changed) {
      existing.best_played_at = result.played_at;
      existing.source_play_result_id = result.play_result_id;
      existing.chart_title = result.chart_title;
      existing.chart_difficulty = result.chart_difficulty;
      existing.chart_level = result.chart_level;
    }
  }

  return Array.from(bestByKey.values()).sort((left, right) =>
    `${left.play_mode}:${left.chart_id}`.localeCompare(`${right.play_mode}:${right.chart_id}`),
  );
}

function derivePlayResult(
  session: RoomStatsSession,
  round: SessionRound,
  myPlayerId: string,
): PlayResult | null {
  const myResult = round.results.find((entry) => entry.player_id === myPlayerId);
  if (!myResult || myResult.submitted_at === null) {
    return null;
  }

  const metrics = toMetrics(myResult.source_meta, myResult.metric_value, session.settings.win_metric);
  if (metrics.exScore === null && metrics.bp === null) {
    return null;
  }

  return {
    play_result_id: `${session.match_id}:${round.round_index}:${myPlayerId}`,
    played_at: myResult.submitted_at,
    battle_type: getBattleType(session.settings),
    play_mode: session.settings.play_style,
    chart_id: buildChartId(round.expected_key),
    chart_title: round.display.title,
    chart_difficulty: round.expected_key.difficulty,
    chart_level: round.display.level,
    my_ex_score: metrics.exScore,
    my_bp: metrics.bp,
    source_match_id: session.match_id,
  };
}

function deriveMatchGame(
  session: RoomStatsSession,
  round: SessionRound,
  myPlayerId: string,
): MatchGame | null {
  if (!getRoundComplete(round, session.players.length)) {
    return null;
  }

  const myResult = round.results.find((entry) => entry.player_id === myPlayerId);
  if (!myResult) {
    return null;
  }

  const others = round.results.filter((entry) => entry.player_id !== myPlayerId);
  const pairwiseScore = getPairwiseScore(myResult, others, session.settings.win_metric);
  const arenaRankByPlayerId =
    session.settings.mode === "ARENA"
      ? getArenaRankByPlayerId(round.results, session.settings.win_metric)
      : null;
  const arenaRank = arenaRankByPlayerId?.get(myPlayerId) ?? null;
  const arenaPoints = arenaRank === null ? 0 : getArenaPointsForRank(arenaRank);
  const bestOpponent = [...others].sort((left, right) => {
    if (left.metric_value === null && right.metric_value === null) {
      return left.player_id.localeCompare(right.player_id);
    }
    if (left.metric_value === null) {
      return 1;
    }
    if (right.metric_value === null) {
      return -1;
    }

    const comparison = compareMetricValues(left.metric_value, right.metric_value, session.settings.win_metric);
    if (comparison !== 0) {
      return comparison > 0 ? -1 : 1;
    }

    return left.player_id.localeCompare(right.player_id);
  })[0] ?? null;
  const myMetrics = toMetrics(myResult.source_meta, myResult.metric_value, session.settings.win_metric);
  const opponentMetrics = toMetrics(bestOpponent?.source_meta ?? null, bestOpponent?.metric_value ?? null, session.settings.win_metric);
  const confirmedAt = round.results
    .map((entry) => entry.submitted_at)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);
  if (!confirmedAt) {
    return null;
  }

  return {
    match_game_id: `${session.match_id}:${round.round_index}`,
    match_id: session.match_id,
    played_at: round.round_started_at ?? confirmedAt,
    game_index: round.round_index,
    chart_id: buildChartId(round.expected_key),
    chart_title: round.display.title,
    chart_difficulty: round.expected_key.difficulty,
    chart_level: round.display.level,
    battle_type: getBattleType(session.settings),
    play_mode: session.settings.play_style,
    game_result:
      session.settings.mode === "ARENA"
        ? arenaPoints === 2
          ? "WIN"
          : arenaPoints === 1
            ? "DRAW"
            : "LOSE"
        : getGameResultFromScore(pairwiseScore),
    round_point: session.settings.mode === "ARENA" ? arenaPoints : pairwiseScore,
    my_ex_score: myMetrics.exScore,
    opponent_ex_score: opponentMetrics.exScore,
    my_bp: myMetrics.bp,
    opponent_bp: opponentMetrics.bp,
    result_confirmed_at: confirmedAt,
  };
}

function recalculateRatings(matches: MatchRecord[]): {
  matches: MatchRecord[];
  ratings: Partial<Record<RatingSeries, number>>;
} {
  const ratings: Partial<Record<RatingSeries, number>> = {};

  const recalculated = sortByTimeAscending(matches).map((match) => {
    const series = buildRatingSeries(match.battle_type, match.play_mode);
    if (!match.is_rated || series === null || match.rating_score === null) {
      return {
        ...match,
        rating_before: null,
        rating_after: null,
        rating_delta: null,
      };
    }

    const currentRating = ratings[series] ?? 1500;
    const nextRating = applyMatchRating(currentRating, match.rating_score);
    ratings[series] = nextRating;

    return {
      ...match,
      rating_before: currentRating,
      rating_after: nextRating,
      rating_delta: nextRating - currentRating,
    };
  });

  return {
    matches: recalculated,
    ratings,
  };
}

function buildArenaStandings(
  session: RoomStatsSession,
  rounds: SessionRound[],
): { standings: ArenaPlayerStanding[]; tieBreakMissingEx: boolean } {
  const winMetric = session.settings.win_metric;
  const standingByPlayerId = new Map(
    session.players.map((player) => [
      player.player_id,
      {
        player_id: player.player_id,
        display_name: player.display_name,
        total_points: 0,
        total_ex_score: 0,
        last_confirmed_at: null as string | null,
      },
    ]),
  );
  let tieBreakMissingEx = false;

  for (const round of rounds) {
    if (!getRoundComplete(round, session.players.length)) {
      continue;
    }

    const rankByPlayerId = getArenaRankByPlayerId(round.results, winMetric);
    for (const playerResult of round.results) {
      const standing = standingByPlayerId.get(playerResult.player_id);
      if (!standing) {
        continue;
      }

      const rank = rankByPlayerId.get(playerResult.player_id) ?? null;
      standing.total_points += rank === null ? 0 : getArenaPointsForRank(rank);
      const exScore = toMetrics(playerResult.source_meta, playerResult.metric_value, winMetric).exScore;
      if (exScore === null) {
        tieBreakMissingEx = true;
      } else {
        standing.total_ex_score += exScore;
      }

      if (playerResult.submitted_at !== null) {
        standing.last_confirmed_at =
          standing.last_confirmed_at === null || standing.last_confirmed_at < playerResult.submitted_at
            ? playerResult.submitted_at
            : standing.last_confirmed_at;
      }
    }
  }

  const ordered = Array.from(standingByPlayerId.values()).sort((left, right) => {
    if (left.total_points !== right.total_points) {
      return right.total_points - left.total_points;
    }
    if (left.total_ex_score !== right.total_ex_score) {
      return right.total_ex_score - left.total_ex_score;
    }

    const leftTime = left.last_confirmed_at ?? "";
    const rightTime = right.last_confirmed_at ?? "";
    if (leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime);
    }

    return left.player_id.localeCompare(right.player_id);
  });

  let previousRank = 0;
  let previousStanding: (typeof ordered)[number] | null = null;
  let previousDisplayRank = 0;
  let previousDisplayStanding: (typeof ordered)[number] | null = null;
  const standings = ordered.map((standing, index) => {
    const sameRank =
      previousStanding !== null &&
      previousStanding.total_points === standing.total_points &&
      previousStanding.total_ex_score === standing.total_ex_score &&
      (previousStanding.last_confirmed_at ?? "") === (standing.last_confirmed_at ?? "");
    const finalRank = sameRank ? previousRank : index + 1;
    const sameDisplayRank =
      previousDisplayStanding !== null &&
      previousDisplayStanding.total_points === standing.total_points;
    const displayRank = sameDisplayRank ? previousDisplayRank : index + 1;
    previousRank = finalRank;
    previousStanding = standing;
    previousDisplayRank = displayRank;
    previousDisplayStanding = standing;

    return {
      ...standing,
      total_ex_score: tieBreakMissingEx ? null : standing.total_ex_score,
      final_rank: finalRank,
      display_rank: displayRank,
    };
  });

  return {
    standings,
    tieBreakMissingEx,
  };
}

function deriveArenaMatchRecord(
  session: RoomStatsSession,
  snapshot: RoomStateSnapshot,
  resultReady: ResultReadyPayload | null,
  myPlayerId: string,
): MatchRecord {
  const completeRounds = session.rounds.filter((round) => getRoundComplete(round, session.players.length));
  const { standings, tieBreakMissingEx } = buildArenaStandings(session, completeRounds);
  const myStanding = standings.find((entry) => entry.player_id === myPlayerId) ?? null;
  const opponentCount = Math.max(0, session.players.length - 1);
  const plannedRounds = snapshot.frozen_rounds.length;
  const isComplete =
    snapshot.close_reason === "ALL_ROUNDS_COMPLETED" &&
    plannedRounds > 0 &&
    completeRounds.length === plannedRounds;
  const startedAt =
    sortByTimeAscending(
      completeRounds
        .map((round) => ({
          played_at: round.round_started_at ?? "",
        }))
        .filter((entry) => entry.played_at.length > 0),
    )[0]?.played_at ?? snapshot.created_at ?? new Date().toISOString();
  const ratingScore =
    myStanding === null || opponentCount === 0
      ? null
      : standings
          .filter((entry) => entry.player_id !== myPlayerId)
          .reduce((sum, standing) => {
            if (myStanding.final_rank < standing.final_rank) {
              return sum + 1;
            }
            if (myStanding.final_rank > standing.final_rank) {
              return sum;
            }
            return sum + 0.5;
          }, 0) / opponentCount;
  const invalidReason =
    getBattleType(session.settings) === "PRIVATE"
      ? "PRIVATE_NOT_RATED"
      : !isComplete
        ? "INCOMPLETE_MATCH"
        : tieBreakMissingEx
          ? "MISSING_EX_TIEBREAK"
          : null;
  const ratingDecision = resolveMatchRatingDecision({
    resultReady,
    canRate: ratingScore !== null,
    fallbackInvalidReason: invalidReason,
  });

  return {
    match_id: session.match_id,
    started_at: startedAt,
    ended_at:
      snapshot.closed_at ??
      completeRounds
        .flatMap((round) => round.results.map((entry) => entry.submitted_at))
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ??
      startedAt,
    battle_type: getBattleType(session.settings),
    play_mode: session.settings.play_style,
    opponent_count: opponentCount,
    opponent_id: null,
    opponent_name: null,
    is_rated: ratingDecision.isRated,
    is_complete: isComplete,
    match_result: ratingScore === null ? "DRAW" : getGameResultFromScore(ratingScore),
    match_point_total: myStanding?.total_points ?? 0,
    rating_score: ratingDecision.isRated ? ratingScore : null,
    rating_before: null,
    rating_after: null,
    rating_delta: null,
    invalid_reason: ratingDecision.invalidReason,
    final_rank: myStanding?.final_rank ?? null,
    display_rank: myStanding?.display_rank ?? myStanding?.final_rank ?? null,
    participant_count: session.players.length,
    win_metric: session.settings.win_metric,
  };
}

function deriveBplMatchRecord(
  session: RoomStatsSession,
  matchGames: MatchGame[],
  snapshot: RoomStateSnapshot,
  resultReady: ResultReadyPayload | null,
  myPlayerId: string,
): MatchRecord {
  const startedAt = sortByTimeAscending(matchGames)[0]?.played_at ?? snapshot.created_at ?? new Date().toISOString();
  const opponent = snapshot.players.find((player) => player.player_id !== myPlayerId) ?? null;
  const selfTotal = matchGames.reduce((sum, game) => sum + game.round_point, 0);
  const opponentTotal = matchGames.length - selfTotal;
  const isComplete =
    snapshot.close_reason === "ALL_ROUNDS_COMPLETED" &&
    snapshot.frozen_rounds.length === 3 &&
    matchGames.length === 3;
  const matchResult =
    selfTotal > opponentTotal ? "WIN" : selfTotal < opponentTotal ? "LOSE" : "DRAW";
  const invalidReason =
    getBattleType(session.settings) === "PRIVATE"
      ? "PRIVATE_NOT_RATED"
      : !isComplete
        ? "INCOMPLETE_MATCH"
        : null;
  const ratingDecision = resolveMatchRatingDecision({
    resultReady,
    canRate: true,
    fallbackInvalidReason: invalidReason,
  });

  return {
    match_id: session.match_id,
    started_at: startedAt,
    ended_at: snapshot.closed_at ?? sortByTimeAscending(matchGames).at(-1)?.result_confirmed_at ?? startedAt,
    battle_type: getBattleType(session.settings),
    play_mode: session.settings.play_style,
    opponent_count: opponent ? 1 : 0,
    opponent_id: opponent?.player_id ?? null,
    opponent_name: opponent?.display_name ?? null,
    is_rated: ratingDecision.isRated,
    is_complete: isComplete,
    match_result: matchResult,
    match_point_total: selfTotal,
    rating_score: ratingDecision.isRated ? getResultScore(matchResult) : null,
    rating_before: null,
    rating_after: null,
    rating_delta: null,
    invalid_reason: ratingDecision.invalidReason,
    final_rank: matchResult === "WIN" ? 1 : matchResult === "LOSE" ? 2 : 1,
    display_rank: matchResult === "WIN" ? 1 : matchResult === "LOSE" ? 2 : 1,
    participant_count: snapshot.players.length,
    win_metric: session.settings.win_metric,
  };
}

export function reduceArchiveWithSession(
  archive: StatsArchive,
  input: {
    session: RoomStatsSession | null;
    myPlayerId: string;
    processedAt: string;
  },
): StatsArchive {
  if (input.session === null) {
    return archive;
  }

  const session = input.session;
  const nextPlayResults = session.rounds
    .map((round) => derivePlayResult(session, round, input.myPlayerId))
    .filter((entry): entry is PlayResult => entry !== null);
  const nextMatchGames = session.rounds
    .map((round) => deriveMatchGame(session, round, input.myPlayerId))
    .filter((entry): entry is MatchGame => entry !== null);
  const hasAuthoritativeMatchId = session.match_id !== session.room_id;
  const provisionalPlayResultIdPrefix = `${session.room_id}:`;
  const provisionalPlayResultIdSuffix = `:${input.myPlayerId}`;
  const provisionalMatchGameIdPrefix = `${session.room_id}:`;
  const basePlayResults = hasAuthoritativeMatchId
    ? archive.play_results.filter(
        (entry) =>
          !(
            entry.source_match_id === session.room_id &&
            entry.play_result_id.startsWith(provisionalPlayResultIdPrefix) &&
            entry.play_result_id.endsWith(provisionalPlayResultIdSuffix)
          ),
      )
    : archive.play_results;
  const baseMatchGames = hasAuthoritativeMatchId
    ? archive.match_games.filter(
        (entry) =>
          !(
            entry.match_id === session.room_id &&
            entry.match_game_id.startsWith(provisionalMatchGameIdPrefix)
          ),
      )
    : archive.match_games;
  const playResults = upsertPlayResults(basePlayResults, nextPlayResults);
  const matchGames = upsertMatchGames(baseMatchGames, nextMatchGames);

  if (playResults === archive.play_results && matchGames === archive.match_games) {
    return archive;
  }

  return {
    ...archive,
    updated_at: input.processedAt,
    match_games: matchGames,
    play_results: playResults,
    personal_bests: buildPersonalBests(playResults),
  };
}

export function reduceArchiveWithClosedMatch(
  archive: StatsArchive,
  input: {
    session: RoomStatsSession | null;
    snapshot: RoomStateSnapshot;
    resultReady: ResultReadyPayload | null;
    myPlayerId: string;
    processedAt: string;
  },
): StatsArchive {
  if (input.session === null || input.snapshot.room_id !== input.session.room_id) {
    return archive;
  }
  const session = input.session;

  const matchGames = archive.match_games
    .filter((entry) => entry.match_id === session.match_id)
    .sort((left, right) => left.game_index - right.game_index);
  const nextMatch =
    session.settings.mode === "ARENA"
      ? deriveArenaMatchRecord(session, input.snapshot, input.resultReady, input.myPlayerId)
      : deriveBplMatchRecord(session, matchGames, input.snapshot, input.resultReady, input.myPlayerId);
  const matches = upsertMatchRecord(archive.matches, nextMatch);
  const ratingResult = recalculateRatings(matches);

  return {
    ...archive,
    updated_at: input.processedAt,
    matches: sortByTimeDescending(ratingResult.matches),
    rating_series_state: ratingResult.ratings,
  };
}

export function createArchiveFromStorage(rawArchive: unknown): StatsArchive {
  const archive = asRecord(rawArchive);
  if (
    archive === null ||
    archive.schema_version !== 1 ||
    !Array.isArray(archive.matches) ||
    !Array.isArray(archive.match_games) ||
    !Array.isArray(archive.play_results) ||
    !Array.isArray(archive.personal_bests)
  ) {
    return createEmptyStatsArchive();
  }

  return archive as unknown as StatsArchive;
}

export function getCurrentRating(
  archive: StatsArchive,
  battleType: "ARENA" | "BPL",
  playMode: PlayStyle,
): number | null {
  const series = buildRatingSeries(battleType, playMode);
  return series === null ? null : archive.rating_series_state[series] ?? null;
}

function getBplDisplayPointTotals<TGame extends { game_result: StatsMatchResult }>(
  games: TGame[],
): { self: number; opponent: number } {
  return games.reduce(
    (totals, game) => ({
      self: totals.self + (game.game_result === "LOSE" ? 0 : 1),
      opponent: totals.opponent + (game.game_result === "WIN" ? 0 : 1),
    }),
    { self: 0, opponent: 0 },
  );
}

export function getDetailedMatchHistory(
  archive: StatsArchive,
  battleType: "ARENA" | "BPL",
  playMode: PlayStyle,
): DetailedMatchHistoryEntry[] {
  const groupedGames = new Map<string, DetailedMatchHistoryGameEntry[]>();

  for (const game of archive.match_games) {
    if (game.battle_type !== battleType || game.play_mode !== playMode) {
      continue;
    }

    const entry: DetailedMatchHistoryGameEntry = {
      match_game_id: game.match_game_id,
      game_index: game.game_index,
      chart_title: game.chart_title,
      round_point: game.round_point,
      game_result: game.game_result,
      my_ex_score: game.my_ex_score,
      my_bp: game.my_bp,
    };
    const current = groupedGames.get(game.match_id);
    if (current) {
      current.push(entry);
    } else {
      groupedGames.set(game.match_id, [entry]);
    }
  }

  return archive.matches
    .filter((entry) => entry.battle_type === battleType && entry.play_mode === playMode)
    .map((match) => {
      const games = [...(groupedGames.get(match.match_id) ?? [])].sort((left, right) => left.game_index - right.game_index);
      const hasCompleteExScore = games.length > 0 && games.every((game) => game.my_ex_score !== null);
      const hasCompleteBp = games.length > 0 && games.every((game) => game.my_bp !== null);
      const opponentPointTotal = battleType === "BPL" ? Math.max(0, games.length - match.match_point_total) : null;
      const displayPointTotals =
        battleType === "BPL"
          ? getBplDisplayPointTotals(games)
          : { self: match.match_point_total, opponent: null };

      return {
        match_id: match.match_id,
        ended_at: match.ended_at,
        match_result: match.match_result,
        rating_delta: match.rating_delta,
        rating_after: match.rating_after,
        final_rank: match.final_rank,
        display_rank: match.display_rank ?? match.final_rank,
        match_point_total: match.match_point_total,
        opponent_point_total: opponentPointTotal,
        display_match_point_total: displayPointTotals.self,
        display_opponent_point_total: displayPointTotals.opponent,
        total_ex_score: hasCompleteExScore
          ? games.reduce((sum, game) => sum + (game.my_ex_score ?? 0), 0)
          : null,
        total_bp: hasCompleteBp ? games.reduce((sum, game) => sum + (game.my_bp ?? 0), 0) : null,
        win_metric: match.win_metric ?? "SCORE",
        games,
      };
    });
}

export function getRecentMatchHistory(
  archive: StatsArchive,
  battleType: "ARENA" | "BPL",
  playMode: PlayStyle,
): MatchHistoryEntry[] {
  const groupedGames = new Map<string, MatchGame[]>();
  for (const game of archive.match_games) {
    const current = groupedGames.get(game.match_id);
    if (current) {
      current.push(game);
    } else {
      groupedGames.set(game.match_id, [game]);
    }
  }

  return archive.matches
    .filter((entry) => entry.battle_type === battleType && entry.play_mode === playMode)
    .slice(0, RECENT_HISTORY_LIMIT)
    .map((match) => {
      const games = (groupedGames.get(match.match_id) ?? []).sort((left, right) => left.game_index - right.game_index);
      const displayPointTotals = battleType === "BPL" ? getBplDisplayPointTotals(games) : null;
      const detail =
        battleType === "BPL"
          ? `${formatDecimal(displayPointTotals?.self ?? 0)}-${formatDecimal(displayPointTotals?.opponent ?? 0)}`
          : games.map((game) => formatDecimal(game.round_point)).join("-");

      return {
        match_id: match.match_id,
        ended_at: match.ended_at,
        match_result: match.match_result,
        rating_delta: match.rating_delta,
        rating_after: match.rating_after,
        detail,
      };
    });
}

export function getChartRankings(
  archive: StatsArchive,
  battleType: "ARENA" | "BPL",
  playMode: PlayStyle,
): { highest: ChartRankingEntry[]; lowest: ChartRankingEntry[] } {
  const grouped = new Map<string, MatchGame[]>();
  for (const game of archive.match_games) {
    if (game.battle_type !== battleType || game.play_mode !== playMode) {
      continue;
    }

    const current = grouped.get(game.chart_id);
    if (current) {
      current.push(game);
    } else {
      grouped.set(game.chart_id, [game]);
    }
  }

  const entries = Array.from(grouped.values())
    .filter((games) => games.length >= MIN_RANKING_MATCH_COUNT)
    .map<ChartRankingEntry>((games) => {
      const wins = games.filter((game) => game.game_result === "WIN").length;
      const losses = games.filter((game) => game.game_result === "LOSE").length;
      const draws = games.filter((game) => game.game_result === "DRAW").length;
      const scoreGames = games.filter((game) => game.my_ex_score !== null && game.opponent_ex_score !== null);
      const averageExDiff =
        scoreGames.length === 0
          ? null
          : scoreGames.reduce((sum, game) => sum + ((game.my_ex_score ?? 0) - (game.opponent_ex_score ?? 0)), 0) / scoreGames.length;
      const latest = sortByTimeDescending(games)[0];
      if (!latest) {
        throw new Error("Chart ranking group is unexpectedly empty.");
      }

      return {
        chart_id: latest.chart_id,
        chart_title: latest.chart_title,
        chart_difficulty: latest.chart_difficulty,
        chart_level: latest.chart_level,
        win_rate: ((wins + draws * 0.5) / games.length) * 100,
        wins,
        losses,
        draws,
        matches: games.length,
        average_ex_diff: averageExDiff,
      };
    });

  const highest = [...entries].sort((left, right) => {
    if (left.win_rate !== right.win_rate) {
      return right.win_rate - left.win_rate;
    }
    if (left.matches !== right.matches) {
      return right.matches - left.matches;
    }
    if ((left.average_ex_diff ?? Number.NEGATIVE_INFINITY) !== (right.average_ex_diff ?? Number.NEGATIVE_INFINITY)) {
      return (right.average_ex_diff ?? Number.NEGATIVE_INFINITY) - (left.average_ex_diff ?? Number.NEGATIVE_INFINITY);
    }

    return left.chart_id.localeCompare(right.chart_id);
  });
  const lowest = [...entries].sort((left, right) => {
    if (left.win_rate !== right.win_rate) {
      return left.win_rate - right.win_rate;
    }
    if (left.matches !== right.matches) {
      return right.matches - left.matches;
    }
    if ((left.average_ex_diff ?? Number.POSITIVE_INFINITY) !== (right.average_ex_diff ?? Number.POSITIVE_INFINITY)) {
      return (left.average_ex_diff ?? Number.POSITIVE_INFINITY) - (right.average_ex_diff ?? Number.POSITIVE_INFINITY);
    }

    return left.chart_id.localeCompare(right.chart_id);
  });

  return {
    highest: highest.slice(0, 5),
    lowest: lowest.slice(0, 5),
  };
}

export function getStabilitySummary(
  archive: StatsArchive,
  playMode: PlayStyle,
): StabilitySummary {
  const recentResults = archive.play_results.filter((entry) => entry.play_mode === playMode).slice(0, RECENT_STABILITY_LIMIT);
  const bestByChartId = new Map(
    archive.personal_bests.filter((entry) => entry.play_mode === playMode).map((entry) => [entry.chart_id, entry]),
  );
  const eligibleResults = recentResults.filter((result) => {
    const best = bestByChartId.get(result.chart_id);
    return best !== undefined && best.best_ex_score !== null && best.best_bp !== null && result.my_ex_score !== null && result.my_bp !== null;
  });

  if (eligibleResults.length === 0) {
    return {
      recentCount: recentResults.length,
      comparedCount: 0,
      scoreStability: null,
      missStability: null,
    };
  }

  const scoreStability =
    eligibleResults.reduce((sum, result) => {
      const best = bestByChartId.get(result.chart_id);
      if (!best || best.best_ex_score === null || result.my_ex_score === null || best.best_ex_score <= 0) {
        return sum;
      }

      return sum + (result.my_ex_score / best.best_ex_score) * 100;
    }, 0) / eligibleResults.length;
  const missStability =
    eligibleResults.reduce((sum, result) => {
      const best = bestByChartId.get(result.chart_id);
      if (!best || best.best_bp === null || result.my_bp === null) {
        return sum;
      }

      return sum + (result.my_bp - best.best_bp);
    }, 0) / eligibleResults.length;

  return {
    recentCount: recentResults.length,
    comparedCount: eligibleResults.length,
    scoreStability,
    missStability,
  };
}
