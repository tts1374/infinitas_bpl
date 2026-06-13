import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSpectatorJoinMessage,
  buildSpectatorStateGetMessage,
  buildSpectatorWebSocketUrl,
  rankFinalPlayers,
  upsertFinalResultHistory,
} from "./spectator-client";
import type { ResultReadyPayload, ResultReadyPlayer } from "@infinitas/shared";

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
