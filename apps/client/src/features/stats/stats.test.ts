declare function require(moduleName: string): any;

const assert = require("node:assert/strict");

function runCase(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok: ${name}`);
  } catch (error) {
    console.error(`failed: ${name}`);
    throw error;
  }
}
import type { PlayStyle, ResultReadyPayload, RoomStateSnapshot } from "@infinitas/shared";
import {
  createEmptyStatsArchive,
  type MatchGame,
  type PersonalBest,
  type PlayResult,
  type RoomStatsSession,
  type SessionPlayerResult,
  type SessionRound,
  type StatsArchive,
  type StatsBattleType,
} from "./models";
import {
  getChartRankings,
  getCurrentRating,
  getDetailedMatchHistory,
  getRecentMatchHistory,
  getStabilitySummary,
  reduceArchiveWithClosedMatch,
  reduceArchiveWithSession,
} from "./stats";

const MY_PLAYER_ID = "me";

function iso(second: number): string {
  return `2026-03-08T00:00:${String(second).padStart(2, "0")}Z`;
}

function makeResult(input: {
  playerId: string;
  displayName?: string;
  metricValue: number;
  submittedAt: string;
  exScore?: number;
  bp?: number;
}): SessionPlayerResult {
  const sourceMeta: Record<string, number> = {
    score: input.exScore ?? input.metricValue,
  };
  if (input.bp !== undefined) {
    sourceMeta.misscount = input.bp;
  }

  return {
    player_id: input.playerId,
    display_name: input.displayName ?? input.playerId,
    status: "PLAYED",
    metric_value: input.metricValue,
    reason: null,
    submitted_at: input.submittedAt,
    submitted_by: input.playerId === MY_PLAYER_ID ? "SELF" : "HOST",
    source_meta: sourceMeta,
  };
}

function makeRound(
  roundIndex: number,
  playMode: PlayStyle,
  results: SessionPlayerResult[],
  title = `Song ${roundIndex + 1}`,
  titleSearchKey = `song-${roundIndex + 1}`,
): SessionRound {
  return {
    round_index: roundIndex,
    expected_key: {
      play_style: playMode,
      difficulty: "ANOTHER",
      title_search_key: titleSearchKey,
    },
    display: {
      title,
      level: 12,
    },
    round_started_at: iso(roundIndex + 1),
    results,
  };
}

function makeSession(input: {
  roomId: string;
  battleType: StatsBattleType;
  playMode: PlayStyle;
  playerIds: string[];
  rounds: SessionRound[];
  mode?: "ARENA" | "BPL";
}): RoomStatsSession {
  return {
    room_id: input.roomId,
    settings: {
      visibility: input.battleType === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      join_code: null,
      mode: input.mode ?? (input.playerIds.length === 2 ? "BPL" : "ARENA"),
      win_metric: "SCORE",
      play_style: input.playMode,
      level_filter: "ANY",
      room_comment: "",
      max_players: input.playerIds.length as 2 | 3 | 4,
    },
    players: input.playerIds.map((playerId, index) => ({
      player_id: playerId,
      display_name: playerId.toUpperCase(),
      source: "inf-notebook",
      connected: true,
      ready: true,
      role: index === 0 ? "HOST" : "GUEST",
      joined_at: iso(index),
      left_at: null,
      rejoin_until: null,
    })),
    rounds: input.rounds,
  };
}

function makeSnapshot(session: RoomStatsSession, closeReason: "ALL_ROUNDS_COMPLETED" | "FORCE_CLOSED" = "ALL_ROUNDS_COMPLETED"): RoomStateSnapshot {
  const closedAt =
    session.rounds
      .flatMap((round) => round.results.map((result) => result.submitted_at))
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? iso(59);

  return {
    room_id: session.room_id,
    room_state: "CLOSED",
    settings: session.settings,
    host_player_id: session.players[0]?.player_id ?? MY_PLAYER_ID,
    players: session.players,
    picks: [],
    frozen_rounds: session.rounds.map((round) => ({
      round_index: round.round_index,
      expected_key: round.expected_key,
      display: round.display,
      started_at: round.round_started_at,
      soft_ttl_seconds: 120,
    })),
    current_round: null,
    timers: {
      ready_check_deadline: null,
      picking_deadline: null,
      match_deadline: null,
      result_deadline: null,
    },
    result_ready: true,
    created_at: session.rounds[0]?.round_started_at ?? iso(0),
    closed_at: closedAt,
    close_reason: closeReason,
  };
}

function makeResultReady(input: {
  session: RoomStatsSession;
  isRated: boolean;
  ratedBlockReason: ResultReadyPayload["summary"]["rated_block_reason"];
  winnerPlayerIds?: string[];
  completedRounds?: number;
  totalRounds?: number;
}): ResultReadyPayload {
  const winnerPlayerIds = input.winnerPlayerIds ?? [MY_PLAYER_ID];

  return {
    summary: {
      mode: input.session.settings.mode,
      win_metric: input.session.settings.win_metric,
      total_rounds: input.totalRounds ?? input.session.rounds.length,
      completed_rounds: input.completedRounds ?? input.session.rounds.length,
      winner_player_ids: winnerPlayerIds,
      is_draw: winnerPlayerIds.length !== 1,
      is_rated: input.isRated,
      rated_block_reason: input.ratedBlockReason,
      rating_before: null,
      rating_after: null,
      rating_delta: null,
    },
    per_round: {
      rounds: [],
    },
    per_player: {
      players: [],
    },
  };
}

function recordClosedMatch(
  archive: StatsArchive,
  session: RoomStatsSession,
  resultReady: ResultReadyPayload | null = null,
): StatsArchive {
  const processedAt = iso(58);
  const withSession = reduceArchiveWithSession(archive, {
    session,
    myPlayerId: MY_PLAYER_ID,
    processedAt,
  });

  return reduceArchiveWithClosedMatch(withSession, {
    session,
    snapshot: makeSnapshot(session),
    resultReady,
    myPlayerId: MY_PLAYER_ID,
    processedAt: iso(59),
  });
}

function makeMatchGame(input: {
  id: string;
  matchId: string;
  chartId: string;
  chartTitle: string;
  battleType: "ARENA" | "BPL" | "PRIVATE";
  playMode: PlayStyle;
  result: "WIN" | "LOSE" | "DRAW";
  exDiff: number;
  gameIndex: number;
}): MatchGame {
  return {
    match_game_id: input.id,
    match_id: input.matchId,
    played_at: iso(10 + input.gameIndex),
    game_index: input.gameIndex,
    chart_id: input.chartId,
    chart_title: input.chartTitle,
    chart_difficulty: "ANOTHER",
    chart_level: 12,
    battle_type: input.battleType,
    play_mode: input.playMode,
    game_result: input.result,
    round_point: input.result === "WIN" ? 1 : input.result === "LOSE" ? 0 : 0.5,
    my_ex_score: 2000,
    opponent_ex_score: 2000 - input.exDiff,
    my_bp: null,
    opponent_bp: null,
    result_confirmed_at: iso(10 + input.gameIndex),
  };
}

function makePlayResult(input: {
  id: string;
  playedAt: string;
  battleType: StatsBattleType;
  chartId: string;
  chartTitle: string;
  exScore: number;
  bp: number;
}): PlayResult {
  return {
    play_result_id: input.id,
    played_at: input.playedAt,
    battle_type: input.battleType,
    play_mode: "SP",
    chart_id: input.chartId,
    chart_title: input.chartTitle,
    chart_difficulty: "ANOTHER",
    chart_level: 12,
    my_ex_score: input.exScore,
    my_bp: input.bp,
    source_match_id: null,
  };
}

runCase("BPL rating is updated once per match from initial 1500 and history keeps round detail", () => {
  const session = makeSession({
    roomId: "bpl-match-1",
    battleType: "BPL",
    playMode: "SP",
    playerIds: [MY_PLAYER_ID, "opponent"],
    mode: "BPL",
    rounds: [
      makeRound(0, "SP", [
        makeResult({ playerId: MY_PLAYER_ID, metricValue: 2100, submittedAt: iso(10), bp: 12 }),
        makeResult({ playerId: "opponent", metricValue: 2000, submittedAt: iso(11), bp: 18 }),
      ]),
      makeRound(1, "SP", [
        makeResult({ playerId: MY_PLAYER_ID, metricValue: 2050, submittedAt: iso(12), bp: 15 }),
        makeResult({ playerId: "opponent", metricValue: 1980, submittedAt: iso(13), bp: 19 }),
      ]),
      makeRound(2, "SP", [
        makeResult({ playerId: MY_PLAYER_ID, metricValue: 1900, submittedAt: iso(14), bp: 22 }),
        makeResult({ playerId: "opponent", metricValue: 1975, submittedAt: iso(15), bp: 17 }),
      ]),
    ],
  });

  const archive = recordClosedMatch(createEmptyStatsArchive(), session);
  const match = archive.matches[0];
  const detailedHistory = getDetailedMatchHistory(archive, "BPL", "SP");
  const history = getRecentMatchHistory(archive, "BPL", "SP");

  assert.ok(match);
  assert.equal(match!.rating_before, 1500);
  assert.equal(match!.rating_after, 1512);
  assert.equal(match!.rating_delta, 12);
  assert.equal(match!.match_result, "WIN");
  assert.equal(archive.matches.length, 1);
  assert.equal(getCurrentRating(archive, "BPL", "SP"), 1512);
  assert.equal(detailedHistory.length, 1);
  assert.equal(detailedHistory[0]?.opponent_point_total, 1);
  assert.equal(detailedHistory[0]?.total_ex_score, 6050);
  assert.equal(detailedHistory[0]?.games.length, 3);
  assert.equal(detailedHistory[0]?.games[0]?.chart_title, "Song 1");
  assert.equal(history.length, 1);
  assert.equal(history[0]?.detail, "2-1");
});

runCase("rating series stay separated and PRIVATE matches do not affect rating", () => {
  let archive = createEmptyStatsArchive();

  archive = recordClosedMatch(
    archive,
    makeSession({
      roomId: "arena-sp-1",
      battleType: "ARENA",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "rival"],
      mode: "ARENA",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 2000, submittedAt: iso(20), bp: 10 }),
          makeResult({ playerId: "rival", metricValue: 1900, submittedAt: iso(21), bp: 12 }),
        ]),
      ],
    }),
  );

  const arenaAfterRatedMatch = getCurrentRating(archive, "ARENA", "SP");
  assert.equal(arenaAfterRatedMatch, 1512);
  assert.equal(getCurrentRating(archive, "ARENA", "DP"), null);
  assert.equal(getCurrentRating(archive, "BPL", "SP"), null);

  archive = recordClosedMatch(
    archive,
    makeSession({
      roomId: "private-sp-1",
      battleType: "PRIVATE",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "friend"],
      mode: "ARENA",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 2100, submittedAt: iso(22), bp: 8 }),
          makeResult({ playerId: "friend", metricValue: 1800, submittedAt: iso(23), bp: 20 }),
        ]),
      ],
    }),
  );

  assert.equal(getCurrentRating(archive, "ARENA", "SP"), arenaAfterRatedMatch);
  assert.equal(archive.matches.find((entry) => entry.match_id === "private-sp-1")?.is_rated, false);

  archive = recordClosedMatch(
    archive,
    makeSession({
      roomId: "bpl-sp-2",
      battleType: "BPL",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "opponent"],
      mode: "BPL",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 2200, submittedAt: iso(24), bp: 9 }),
          makeResult({ playerId: "opponent", metricValue: 2100, submittedAt: iso(25), bp: 14 }),
        ]),
        makeRound(1, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 2210, submittedAt: iso(26), bp: 11 }),
          makeResult({ playerId: "opponent", metricValue: 2150, submittedAt: iso(27), bp: 13 }),
        ]),
        makeRound(2, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 2000, submittedAt: iso(28), bp: 14 }),
          makeResult({ playerId: "opponent", metricValue: 1900, submittedAt: iso(29), bp: 18 }),
        ]),
      ],
    }),
  );

  assert.equal(getCurrentRating(archive, "ARENA", "SP"), 1512);
  assert.equal(getCurrentRating(archive, "BPL", "SP"), 1512);
  assert.equal(getCurrentRating(archive, "BPL", "DP"), null);
});

runCase("ARENA match rating uses pairwise pseudo matches from final standing", () => {
  const archive = recordClosedMatch(
    createEmptyStatsArchive(),
    makeSession({
      roomId: "arena-4p-1",
      battleType: "ARENA",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "p1", "p2", "p3"],
      mode: "ARENA",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: "p1", metricValue: 2500, submittedAt: iso(30), bp: 5 }),
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 2400, submittedAt: iso(31), bp: 8 }),
          makeResult({ playerId: "p2", metricValue: 2200, submittedAt: iso(32), bp: 11 }),
          makeResult({ playerId: "p3", metricValue: 2100, submittedAt: iso(33), bp: 13 }),
        ]),
      ],
    }),
  );

  const match = archive.matches[0];

  assert.ok(match);
  assert.equal(match!.final_rank, 2);
  assert.equal(match!.match_result, "WIN");
  assert.equal(match!.match_point_total, 2 / 3);
  assert.equal(match!.rating_after, 1504);
  assert.equal(match!.rating_delta, 4);
});

runCase("ARENA final standing resolves ties by EX total, then confirmation time, then shared rank", () => {
  const exTieBreakArchive = recordClosedMatch(
    createEmptyStatsArchive(),
    makeSession({
      roomId: "arena-ex-tiebreak",
      battleType: "ARENA",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "opponent"],
      mode: "ARENA",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 1000, submittedAt: iso(40), bp: 15 }),
          makeResult({ playerId: "opponent", metricValue: 900, submittedAt: iso(41), bp: 17 }),
        ]),
        makeRound(1, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 860, submittedAt: iso(42), bp: 18 }),
          makeResult({ playerId: "opponent", metricValue: 950, submittedAt: iso(43), bp: 16 }),
        ]),
      ],
    }),
  );

  assert.equal(exTieBreakArchive.matches[0]?.final_rank, 1);
  assert.equal(exTieBreakArchive.matches[0]?.rating_after, 1512);

  const timeTieBreakArchive = recordClosedMatch(
    createEmptyStatsArchive(),
    makeSession({
      roomId: "arena-time-tiebreak",
      battleType: "ARENA",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "opponent"],
      mode: "ARENA",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 1000, submittedAt: iso(44), bp: 15 }),
          makeResult({ playerId: "opponent", metricValue: 900, submittedAt: iso(45), bp: 17 }),
        ]),
        makeRound(1, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 850, submittedAt: iso(46), bp: 18 }),
          makeResult({ playerId: "opponent", metricValue: 950, submittedAt: iso(47), bp: 16 }),
        ]),
      ],
    }),
  );

  assert.equal(timeTieBreakArchive.matches[0]?.final_rank, 1);
  assert.equal(timeTieBreakArchive.matches[0]?.rating_after, 1512);

  const sharedRankArchive = recordClosedMatch(
    createEmptyStatsArchive(),
    makeSession({
      roomId: "arena-shared-rank",
      battleType: "ARENA",
      playMode: "SP",
      playerIds: [MY_PLAYER_ID, "opponent"],
      mode: "ARENA",
      rounds: [
        makeRound(0, "SP", [
          makeResult({ playerId: MY_PLAYER_ID, metricValue: 1000, submittedAt: iso(48), bp: 12 }),
          makeResult({ playerId: "opponent", metricValue: 1000, submittedAt: iso(48), bp: 12 }),
        ]),
      ],
    }),
  );

  assert.equal(sharedRankArchive.matches[0]?.final_rank, 1);
  assert.equal(sharedRankArchive.matches[0]?.match_result, "DRAW");
  assert.equal(sharedRankArchive.matches[0]?.rating_after, 1500);
});

runCase("DO-provided unrated decision blocks local rating updates", () => {
  const session = makeSession({
    roomId: "bpl-mismatch-unrated",
    battleType: "BPL",
    playMode: "SP",
    playerIds: [MY_PLAYER_ID, "opponent"],
    mode: "BPL",
    rounds: [
      makeRound(0, "SP", [
        makeResult({ playerId: MY_PLAYER_ID, metricValue: 2200, submittedAt: iso(50), bp: 10 }),
        makeResult({ playerId: "opponent", metricValue: 2100, submittedAt: iso(51), bp: 13 }),
      ]),
      makeRound(1, "SP", [
        makeResult({ playerId: MY_PLAYER_ID, metricValue: 2000, submittedAt: iso(52), bp: 16 }),
        makeResult({ playerId: "opponent", metricValue: 2150, submittedAt: iso(53), bp: 12 }),
      ]),
      makeRound(2, "SP", [
        makeResult({ playerId: MY_PLAYER_ID, metricValue: 2300, submittedAt: iso(54), bp: 9 }),
        makeResult({ playerId: "opponent", metricValue: 1900, submittedAt: iso(55), bp: 17 }),
      ]),
    ],
  });

  const archive = recordClosedMatch(
    createEmptyStatsArchive(),
    session,
    makeResultReady({
      session,
      isRated: false,
      ratedBlockReason: "mismatch_observed_key",
      winnerPlayerIds: [MY_PLAYER_ID],
    }),
  );

  assert.equal(archive.matches[0]?.is_rated, false);
  assert.equal(archive.matches[0]?.invalid_reason, "mismatch_observed_key");
  assert.equal(archive.matches[0]?.rating_after, null);
  assert.equal(getCurrentRating(archive, "BPL", "SP"), null);
});

runCase("chart rankings require three matches and stay separated by chart id, rule, and mode", () => {
  const archive = {
    ...createEmptyStatsArchive(),
    match_games: [
      makeMatchGame({
        id: "a-1",
        matchId: "m-a-1",
        chartId: "SP::ANOTHER::twin-1",
        chartTitle: "Twin Song",
        battleType: "ARENA",
        playMode: "SP",
        result: "WIN",
        exDiff: 120,
        gameIndex: 0,
      }),
      makeMatchGame({
        id: "a-2",
        matchId: "m-a-2",
        chartId: "SP::ANOTHER::twin-1",
        chartTitle: "Twin Song",
        battleType: "ARENA",
        playMode: "SP",
        result: "WIN",
        exDiff: 80,
        gameIndex: 1,
      }),
      makeMatchGame({
        id: "a-3",
        matchId: "m-a-3",
        chartId: "SP::ANOTHER::twin-1",
        chartTitle: "Twin Song",
        battleType: "ARENA",
        playMode: "SP",
        result: "DRAW",
        exDiff: 0,
        gameIndex: 2,
      }),
      makeMatchGame({
        id: "b-1",
        matchId: "m-b-1",
        chartId: "SP::ANOTHER::twin-2",
        chartTitle: "Twin Song",
        battleType: "ARENA",
        playMode: "SP",
        result: "LOSE",
        exDiff: -120,
        gameIndex: 3,
      }),
      makeMatchGame({
        id: "b-2",
        matchId: "m-b-2",
        chartId: "SP::ANOTHER::twin-2",
        chartTitle: "Twin Song",
        battleType: "ARENA",
        playMode: "SP",
        result: "LOSE",
        exDiff: -80,
        gameIndex: 4,
      }),
      makeMatchGame({
        id: "b-3",
        matchId: "m-b-3",
        chartId: "SP::ANOTHER::twin-2",
        chartTitle: "Twin Song",
        battleType: "ARENA",
        playMode: "SP",
        result: "LOSE",
        exDiff: -30,
        gameIndex: 5,
      }),
      makeMatchGame({
        id: "c-1",
        matchId: "m-c-1",
        chartId: "SP::ANOTHER::short",
        chartTitle: "Short Set",
        battleType: "ARENA",
        playMode: "SP",
        result: "WIN",
        exDiff: 50,
        gameIndex: 6,
      }),
      makeMatchGame({
        id: "c-2",
        matchId: "m-c-2",
        chartId: "SP::ANOTHER::short",
        chartTitle: "Short Set",
        battleType: "ARENA",
        playMode: "SP",
        result: "WIN",
        exDiff: 70,
        gameIndex: 7,
      }),
      makeMatchGame({
        id: "d-1",
        matchId: "m-d-1",
        chartId: "SP::ANOTHER::other-rule",
        chartTitle: "Other Rule",
        battleType: "BPL",
        playMode: "SP",
        result: "WIN",
        exDiff: 100,
        gameIndex: 8,
      }),
      makeMatchGame({
        id: "d-2",
        matchId: "m-d-2",
        chartId: "SP::ANOTHER::other-rule",
        chartTitle: "Other Rule",
        battleType: "BPL",
        playMode: "SP",
        result: "WIN",
        exDiff: 100,
        gameIndex: 9,
      }),
      makeMatchGame({
        id: "d-3",
        matchId: "m-d-3",
        chartId: "SP::ANOTHER::other-rule",
        chartTitle: "Other Rule",
        battleType: "BPL",
        playMode: "SP",
        result: "WIN",
        exDiff: 100,
        gameIndex: 10,
      }),
    ],
  } satisfies StatsArchive;

  const rankings = getChartRankings(archive, "ARENA", "SP");

  assert.equal(rankings.highest.length, 2);
  assert.equal(rankings.highest[0]?.chart_id, "SP::ANOTHER::twin-1");
  assert.equal(rankings.lowest[0]?.chart_id, "SP::ANOTHER::twin-2");
  assert.ok(rankings.highest.every((entry) => entry.chart_id !== "SP::ANOTHER::short"));
  assert.ok(rankings.highest.every((entry) => entry.chart_id !== "SP::ANOTHER::other-rule"));
});

runCase("stability uses the most recent twenty play results, keeps duplicates, includes PRIVATE, and excludes charts without bests", () => {
  const primaryBest: PersonalBest = {
    chart_id: "SP::ANOTHER::stable",
    play_mode: "SP",
    chart_title: "Stable Song",
    chart_difficulty: "ANOTHER",
    chart_level: 12,
    best_ex_score: 1000,
    best_bp: 10,
    best_played_at: iso(1),
    source_play_result_id: "best-1",
  };

  const recentPrivateResults = Array.from({ length: 10 }, (_, index) =>
    makePlayResult({
      id: `private-${index}`,
      playedAt: iso(50 - index),
      battleType: "PRIVATE",
      chartId: "SP::ANOTHER::stable",
      chartTitle: "Stable Song",
      exScore: 900,
      bp: 15,
    }),
  );
  const recentArenaResults = Array.from({ length: 9 }, (_, index) =>
    makePlayResult({
      id: `arena-${index}`,
      playedAt: iso(39 - index),
      battleType: "ARENA",
      chartId: "SP::ANOTHER::stable",
      chartTitle: "Stable Song",
      exScore: 900,
      bp: 15,
    }),
  );
  const noBestResult = makePlayResult({
    id: "no-best",
    playedAt: iso(20),
    battleType: "ARENA",
    chartId: "SP::ANOTHER::no-best",
    chartTitle: "No Best Song",
    exScore: 700,
    bp: 25,
  });
  const olderIgnoredResult = makePlayResult({
    id: "older",
    playedAt: iso(19),
    battleType: "ARENA",
    chartId: "SP::ANOTHER::stable",
    chartTitle: "Stable Song",
    exScore: 1000,
    bp: 10,
  });

  const archive = {
    ...createEmptyStatsArchive(),
    play_results: [...recentPrivateResults, ...recentArenaResults, noBestResult, olderIgnoredResult],
    personal_bests: [primaryBest],
  } satisfies StatsArchive;

  const summary = getStabilitySummary(archive, "SP");

  assert.equal(summary.recentCount, 20);
  assert.equal(summary.comparedCount, 19);
  assert.equal(summary.scoreStability, 90);
  assert.equal(summary.missStability, 5);
});
