import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSpectatorJoinMessage,
  buildSpectatorStateGetMessage,
  buildSpectatorWebSocketUrl,
  upsertFinalResultHistory,
} from "./spectator-client";
import type { ResultReadyPayload } from "@infinitas/shared";

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
