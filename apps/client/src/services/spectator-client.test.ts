import assert from "node:assert/strict";
import test from "node:test";
import {
  applySpectatorSnapshotTransition,
  buildSpectatorJoinMessage,
  buildSpectatorStateGetMessage,
  buildSpectatorWebSocketUrl,
  getSpectatorConfirmationLabel,
  getSpectatorRoundDisplay,
  rankCurrentPlayers,
  rankFinalPlayers,
  resetSpectatorSnapshotState,
  resolveRetainedSpectatorSnapshot,
  upsertFinalResultHistory,
} from "./spectator-client";
import type { ResultReadyPayload, ResultReadyPlayer, RoomStateSnapshot } from "@infinitas/shared";

const originalRandomUUID = globalThis.crypto.randomUUID;

test.afterEach(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: originalRandomUUID,
  });
});

test("buildSpectatorJoinMessage sends spectator payload without player fields", () => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "00000000-0000-4000-8000-000000000000",
  });

  const message = buildSpectatorJoinMessage({
    roomId: "room-1",
    spectatorId: "spectator-1",
    joinCode: " ABCD1234 ",
  });

  assert.equal(message.type, "ROOM_JOIN");
  assert.equal(message.room_id, "room-1");
  assert.equal(message.player_id, "spectator-1");
  assert.equal(message.payload.session_kind, "SPECTATOR");
  assert.equal(message.payload.join_code, "ABCD1234");
  assert.equal("display_name" in message.payload, false);
  assert.equal("source" in message.payload, false);
  assert.equal("client_capabilities" in message.payload, false);
});

test("buildSpectatorJoinMessage omits empty join code", () => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "00000000-0000-4000-8000-000000000001",
  });

  const message = buildSpectatorJoinMessage({
    roomId: "room-1",
    spectatorId: "spectator-1",
    joinCode: " ",
  });

  assert.equal("join_code" in message.payload, false);
});

test("buildSpectatorStateGetMessage sends an empty state refresh payload", () => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => "00000000-0000-4000-8000-000000000002",
  });

  const message = buildSpectatorStateGetMessage({
    roomId: "room-1",
    spectatorId: "spectator-1",
  });

  assert.equal(message.type, "STATE_GET");
  assert.equal(message.room_id, "room-1");
  assert.equal(message.player_id, "spectator-1");
  assert.deepEqual(message.payload, {});
});

test("buildSpectatorWebSocketUrl maps http and https API URLs to ws URLs", () => {
  assert.equal(
    buildSpectatorWebSocketUrl("http://127.0.0.1:8787/", "room A"),
    "ws://127.0.0.1:8787/api/rooms/room%20A/ws",
  );
  assert.equal(
    buildSpectatorWebSocketUrl("https://example.com/api-base", "room-1"),
    "wss://example.com/api-base/api/rooms/room-1/ws",
  );
});

test("rankCurrentPlayers ranks only PLAYED confirmations and leaves sentinel statuses unranked", () => {
  const snapshot = createSnapshot(0, [
    createConfirmation("played-low", "PLAYED", 1000),
    createConfirmation("skipped", "SKIPPED", 0),
    createConfirmation("timeout", "TIMEOUT", 9999),
    createConfirmation("played-high", "PLAYED", 2000),
  ]);

  assert.deepEqual(
    rankCurrentPlayers(snapshot).map(({ player, confirmed, rank }) => [
      player.player_id,
      confirmed?.status ?? null,
      rank,
    ]),
    [
      ["played-high", "PLAYED", 1],
      ["played-low", "PLAYED", 2],
      ["skipped", "SKIPPED", null],
      ["timeout", "TIMEOUT", null],
    ],
  );
});

test("rankCurrentPlayers preserves retained results while using live player metadata by player id", () => {
  const retainedSnapshot = createSnapshot(0, [
    createConfirmation("played-high", "PLAYED", 2000),
  ]);
  const liveSnapshot = {
    ...createSnapshot(1, []),
    players: createSnapshot(1, []).players.map((player) =>
      player.player_id === "played-high"
        ? {
            ...player,
            display_name: "Live Name",
            connected: false,
            ready: false,
            source: "reflux" as const,
          }
        : player),
  } satisfies RoomStateSnapshot;

  const retainedPlayer = rankCurrentPlayers(retainedSnapshot, liveSnapshot)
    .find(({ player }) => player.player_id === "played-high");

  assert.equal(retainedPlayer?.rank, 1);
  assert.equal(retainedPlayer?.confirmed?.metric_value, 2000);
  assert.equal(retainedPlayer?.player.display_name, "Live Name");
  assert.equal(retainedPlayer?.player.connected, false);
  assert.equal(retainedPlayer?.player.ready, false);
  assert.equal(retainedPlayer?.player.source, "reflux");
});

test("getSpectatorConfirmationLabel visibly distinguishes skipped and timed out confirmations", () => {
  assert.equal(getSpectatorConfirmationLabel(null), "結果待ち");
  assert.equal(getSpectatorConfirmationLabel(createConfirmation("played", "PLAYED", 2000)), "確定済み");
  assert.equal(getSpectatorConfirmationLabel(createConfirmation("skipped", "SKIPPED", 0)), "スキップ");
  assert.equal(getSpectatorConfirmationLabel(createConfirmation("timeout", "TIMEOUT", 9999)), "タイムアウト");
});

test("getSpectatorRoundDisplay uses frozen round title and level with expected-key fallback", () => {
  const officialSnapshot = createSnapshot(1, []);
  assert.deepEqual(getSpectatorRoundDisplay(officialSnapshot), {
    title: "Official Song 1",
    level: 11,
  });

  const fallbackSnapshot = {
    ...officialSnapshot,
    frozen_rounds: officialSnapshot.frozen_rounds.filter((round) => round.round_index !== 1),
  } satisfies RoomStateSnapshot;
  assert.deepEqual(getSpectatorRoundDisplay(fallbackSnapshot), {
    title: "search-song-1",
    level: null,
  });

  const blankTitleSnapshot = {
    ...officialSnapshot,
    frozen_rounds: officialSnapshot.frozen_rounds.map((round) =>
      round.round_index === 1
        ? { ...round, display: { ...round.display, title: " " } }
        : round),
  } satisfies RoomStateSnapshot;
  assert.equal(getSpectatorRoundDisplay(blankTitleSnapshot)?.title, "search-song-1");
});

test("resolveRetainedSpectatorSnapshot keeps completed round until next round receives a confirmation", () => {
  const completedRound = createSnapshot(0, [createConfirmation("played-high", "PLAYED", 2000)]);
  const nextRoundWaiting = createSnapshot(1, []);
  const retained = resolveRetainedSpectatorSnapshot(completedRound, null, nextRoundWaiting);

  assert.equal(retained, completedRound);
  assert.equal(
    resolveRetainedSpectatorSnapshot(
      nextRoundWaiting,
      retained,
      createSnapshot(1, [createConfirmation("skipped", "SKIPPED", 0)]),
    ),
    null,
  );
});

test("resolveRetainedSpectatorSnapshot clears retained result at authoritative lobby boundary", () => {
  const completedRound = createSnapshot(0, [createConfirmation("played-high", "PLAYED", 2000)]);
  const resultSnapshot = {
    ...completedRound,
    room_state: "RESULT",
    current_round: null,
  } satisfies RoomStateSnapshot;
  const retained = resolveRetainedSpectatorSnapshot(completedRound, null, resultSnapshot);
  const lobbySnapshot = {
    ...completedRound,
    room_state: "LOBBY",
    current_round: null,
    frozen_rounds: [],
  } satisfies RoomStateSnapshot;

  assert.equal(retained, completedRound);
  assert.equal(resolveRetainedSpectatorSnapshot(resultSnapshot, retained, lobbySnapshot), null);
});

test("resolveRetainedSpectatorSnapshot clears old final result when auto-rematch changes match id", () => {
  const completedRound = createSnapshot(1, [createConfirmation("played-high", "PLAYED", 2000)]);
  const resultSnapshot = {
    ...completedRound,
    room_state: "RESULT",
    current_round: null,
  } satisfies RoomStateSnapshot;
  const retained = resolveRetainedSpectatorSnapshot(completedRound, null, resultSnapshot);

  for (const nextSnapshot of [
    {
      ...createSnapshot(0, []),
      current_match_id: "match-2",
      room_state: "PICKING" as const,
      current_round: null,
    },
    {
      ...createSnapshot(0, []),
      current_match_id: "match-2",
      room_state: "PLAYING" as const,
    },
  ] satisfies RoomStateSnapshot[]) {
    assert.equal(resolveRetainedSpectatorSnapshot(resultSnapshot, retained, nextSnapshot), null);
  }
});

test("applySpectatorSnapshotTransition retains and releases results for STATE_SNAPSHOT-equivalent updates", () => {
  const completedRound = createSnapshot(0, [createConfirmation("played-high", "PLAYED", 2000)]);
  const nextRoundWaiting = createSnapshot(1, []);
  const retainedState = applySpectatorSnapshotTransition(
    { snapshot: completedRound, retainedSnapshot: null },
    nextRoundWaiting,
  );

  assert.equal(retainedState.snapshot, nextRoundWaiting);
  assert.equal(retainedState.retainedSnapshot, completedRound);

  const nextRoundConfirmed = createSnapshot(1, [createConfirmation("played-low", "PLAYED", 1000)]);
  const releasedState = applySpectatorSnapshotTransition(retainedState, nextRoundConfirmed);
  assert.equal(releasedState.snapshot, nextRoundConfirmed);
  assert.equal(releasedState.retainedSnapshot, null);
});

test("resetSpectatorSnapshotState clears live and retained snapshots for reconnect", () => {
  assert.deepEqual(resetSpectatorSnapshotState(), {
    snapshot: null,
    retainedSnapshot: null,
  });
});

test("upsertFinalResultHistory deduplicates by match id", () => {
  const first = createResult("match-1");
  const second = createResult("match-2");
  const updatedFirst = createResult("match-1");

  const history = upsertFinalResultHistory(
    upsertFinalResultHistory(
      upsertFinalResultHistory([], first, "2026-06-01T00:00:00.000Z", 20),
      second,
      "2026-06-01T00:01:00.000Z",
      20,
    ),
    updatedFirst,
    "2026-06-01T00:02:00.000Z",
    20,
  );

  assert.deepEqual(history.map((item) => item.payload.summary.match_id), ["match-1", "match-2"]);
  assert.equal(history[0]?.receivedAtIso, "2026-06-01T00:02:00.000Z");
});

test("rankFinalPlayers gives tied BPL round wins the same competition rank", () => {
  const players = [
    createBplPlayer("third", 1),
    createBplPlayer("first-a", 2),
    createBplPlayer("first-b", 2),
  ] satisfies ResultReadyPlayer[];

  assert.deepEqual(
    rankFinalPlayers(players).map(({ player, rank }) => [player.player_id, rank]),
    [
      ["first-a", 1],
      ["first-b", 1],
      ["third", 3],
    ],
  );
});

test("rankFinalPlayers preserves ARENA tie-break order and shared ranks", () => {
  const players = [
    createArenaPlayer("fourth", 2, 2000, "2026-06-01T00:00:00.000Z"),
    createArenaPlayer("third", 4, 1000, "2026-06-01T00:03:00.000Z"),
    createArenaPlayer("first-a", 4, 1000, "2026-06-01T00:02:00.000Z"),
    createArenaPlayer("first-b", 4, 1000, "2026-06-01T00:02:00.000Z"),
  ] satisfies ResultReadyPlayer[];

  assert.deepEqual(
    rankFinalPlayers(players).map(({ player, rank }) => [player.player_id, rank]),
    [
      ["first-a", 1],
      ["first-b", 1],
      ["third", 3],
      ["fourth", 4],
    ],
  );
});

test("rankFinalPlayers skips ARENA EX SCORE tie-break when any tied player lacks it", () => {
  const players = [
    createArenaPlayer("first-a", 4, 2000, "2026-06-01T00:02:00.000Z"),
    createArenaPlayer("first-b", 4, null, "2026-06-01T00:02:00.000Z"),
    createArenaPlayer("third", 2, 3000, "2026-06-01T00:01:00.000Z"),
  ] satisfies ResultReadyPlayer[];

  assert.deepEqual(
    rankFinalPlayers(players).map(({ player, rank }) => [player.player_id, rank]),
    [
      ["first-a", 1],
      ["first-b", 1],
      ["third", 3],
    ],
  );
});

test("rankFinalPlayers skips ARENA timestamp tie-break when any remaining tied player lacks it", () => {
  const players = [
    createArenaPlayer("first-a", 4, 2000, "2026-06-01T00:02:00.000Z"),
    createArenaPlayer("first-b", 4, 2000, null),
    createArenaPlayer("third", 2, 3000, "2026-06-01T00:01:00.000Z"),
  ] satisfies ResultReadyPlayer[];

  assert.deepEqual(
    rankFinalPlayers(players).map(({ player, rank }) => [player.player_id, rank]),
    [
      ["first-a", 1],
      ["first-b", 1],
      ["third", 3],
    ],
  );
});

function createBplPlayer(playerId: string, roundWins: number): ResultReadyPlayer {
  return {
    player_id: playerId,
    display_name: playerId,
    round_wins: roundWins,
    rounds: [],
  };
}

function createArenaPlayer(
  playerId: string,
  totalPoints: number,
  totalExScore: number | null,
  lastConfirmedAt: string | null,
): ResultReadyPlayer {
  return {
    player_id: playerId,
    display_name: playerId,
    total_points: totalPoints,
    total_ex_score: totalExScore,
    last_confirmed_at: lastConfirmedAt,
    rounds: [],
  };
}

function createResult(matchId: string): ResultReadyPayload {
  return {
    summary: {
      match_id: matchId,
      mode: "ARENA",
      win_metric: "SCORE",
      total_rounds: 1,
      completed_rounds: 1,
      winner_player_ids: [],
      is_draw: true,
      is_rated: false,
      rated_block_reason: "private_room",
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

function createConfirmation(
  playerId: string,
  status: "PLAYED" | "SKIPPED" | "TIMEOUT",
  metricValue: number,
): NonNullable<RoomStateSnapshot["current_round"]>["confirmed"][number] {
  return {
    player_id: playerId,
    status,
    metric_value: metricValue,
    reason: status === "PLAYED" ? null : "OTHER",
    submitted_by: "SELF",
    submitted_at: "2026-06-01T00:00:00.000Z",
    source_meta: null,
  };
}

function createSnapshot(
  roundIndex: number,
  confirmed: NonNullable<RoomStateSnapshot["current_round"]>["confirmed"],
): RoomStateSnapshot {
  const playerIds = ["played-low", "skipped", "timeout", "played-high"];
  return {
    room_id: "room-1",
    current_match_id: "match-1",
    room_state: "PLAYING",
    settings: {
      visibility: "PRIVATE",
      join_code: null,
      mode: "ARENA",
      win_metric: "SCORE",
      play_style: "SP",
      level_filter: "ANY",
      room_comment: "",
      max_players: 4,
      auto_match: false,
    },
    host_player_id: "played-high",
    players: playerIds.map((playerId) => ({
      player_id: playerId,
      display_name: playerId,
      source: "inf-notebook",
      connected: true,
      ready: true,
    })),
    picks: [],
    frozen_rounds: [0, 1].map((index) => ({
      round_index: index,
      expected_key: {
        play_style: "SP",
        difficulty: "ANOTHER",
        title_search_key: `search-song-${index}`,
      },
      display: {
        title: `Official Song ${index}`,
        level: 10 + index,
      },
      started_at: "2026-06-01T00:00:00.000Z",
      soft_ttl_seconds: 300,
    })),
    current_round: {
      round_index: roundIndex,
      expected_key: {
        play_style: "SP",
        difficulty: "ANOTHER",
        title_search_key: `search-song-${roundIndex}`,
      },
      round_started_at: "2026-06-01T00:00:00.000Z",
      soft_ttl_seconds: 300,
      confirmed,
    },
    timers: {
      ready_check_deadline: null,
      picking_deadline: null,
      match_deadline: null,
      result_deadline: null,
    },
    result_ready: false,
  };
}
