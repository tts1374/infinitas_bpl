import assert from "node:assert/strict";
import test from "node:test";
import {
  handleDeleteMatchmakingQueueTicket,
  handleGetMatchmakingWaitingCount,
  handleGetMatchmakingQueueTicket,
  handlePostMatchmakingQueue,
  matchMatchmakingQueueTicketPath,
} from "./matchmaking.ts";
import { handlePostRooms } from "./rooms.ts";

function createEnv(doFetch) {
  return {
    MATCHMAKING_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: doFetch,
        };
      },
    },
    ROOM_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return { fetch: async () => new Response("{}", { status: 200 }) };
      },
    },
    LOBBY_DIRECTORY_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return { fetch: async () => new Response("{}", { status: 200 }) };
      },
    },
    FEEDBACK_KV: {
      get: async () => null,
      put: async () => {},
    },
    APP_DOWNLOAD_URL: "",
    REPO_OWNER_GITHUB: "tts1374",
    REPO_NAME_GITHUB: "infinitas_arena",
    APP_ENV: "test",
    MIN_SUPPORTED_CLIENT_VERSION: "1.2.0",
    ISSUE_TOKEN: "",
    DISCORD_WEBHOOK_URL: "",
  };
}

function createRoomsEnv() {
  const initPayloads = [];
  const lobbyUpserts = [];
  const env = createEnv(async () => new Response("{}", { status: 200 }));

  env.ROOM_DO.get = () => ({
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/internal/init" && request.method === "POST") {
        initPayloads.push(await request.json());
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected room request" }), { status: 400 });
    },
  });

  env.LOBBY_DIRECTORY_DO.get = () => ({
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/internal/upsert" && request.method === "POST") {
        lobbyUpserts.push(await request.json());
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  return {
    env,
    getInitPayloads: () => initPayloads,
    getLobbyUpserts: () => lobbyUpserts,
  };
}

test("matchMatchmakingQueueTicketPath decodes ticket id", () => {
  const matched = matchMatchmakingQueueTicketPath("/api/matchmaking/queue/ticket%2D1");
  assert.equal(matched, "ticket-1");
  assert.equal(matchMatchmakingQueueTicketPath("/api/lobby"), null);
  assert.equal(matchMatchmakingQueueTicketPath("/api/matchmaking/waiting-count"), null);
});

test("handlePostMatchmakingQueue forwards to matchmaking do", async () => {
  const response = await handlePostMatchmakingQueue(
    new Request("https://example.com/api/matchmaking/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "ARENA",
        play_style: "SP",
        win_metric: "SCORE",
        rating: 2450,
        player_id: "p1",
        display_name: "PLAYER1",
      }),
    }),
    createEnv(async (request) => {
      assert.equal(request.method, "POST");
      const payload = await request.json();
      assert.equal(payload.mode, "ARENA");
      return new Response(
        JSON.stringify({
          ticket_id: "ticket-1",
          status: "SEARCHING",
          mode: "ARENA",
          play_style: "SP",
          win_metric: "SCORE",
          rating: 2450,
          queued_at: "2026-04-06T00:00:00.000Z",
          updated_at: "2026-04-06T00:00:00.000Z",
          current_tolerance: 50,
          candidate_count: 0,
          room_id: null,
          matched_player_count: null,
        }),
        { status: 201 },
      );
    }),
  );

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.ticket_id, "ticket-1");
  assert.equal(payload.status, "SEARCHING");
});

test("handleGetMatchmakingQueueTicket and handleDeleteMatchmakingQueueTicket return do responses", async () => {
  let lastMethod = "";
  const env = createEnv(async (request) => {
    lastMethod = request.method;
    return new Response(
      JSON.stringify({
        ticket_id: "ticket-1",
        status: request.method === "DELETE" ? "CANCELLED" : "SEARCHING",
        mode: "ARENA",
        play_style: "SP",
        win_metric: "SCORE",
        rating: 2450,
        queued_at: "2026-04-06T00:00:00.000Z",
        updated_at: "2026-04-06T00:01:00.000Z",
        current_tolerance: 100,
        candidate_count: 1,
        room_id: null,
        matched_player_count: null,
      }),
      { status: 200 },
    );
  });

  const getResponse = await handleGetMatchmakingQueueTicket(
    new Request("https://example.com/api/matchmaking/queue/ticket-1"),
    env,
    "ticket-1",
  );
  assert.equal(getResponse.status, 200);
  assert.equal(lastMethod, "GET");

  const deleteResponse = await handleDeleteMatchmakingQueueTicket(
    new Request("https://example.com/api/matchmaking/queue/ticket-1", { method: "DELETE" }),
    env,
    "ticket-1",
  );
  assert.equal(deleteResponse.status, 200);
  assert.equal(lastMethod, "DELETE");
  const payload = await deleteResponse.json();
  assert.equal(payload.status, "CANCELLED");
});

test("handleGetMatchmakingWaitingCount returns waiting_count from matchmaking do", async () => {
  let forwardedPath = "";
  const env = createEnv(async (request) => {
    const url = new URL(request.url);
    forwardedPath = `${url.pathname}?${url.searchParams.toString()}`;
    return new Response(JSON.stringify({ waiting_count: 4 }), { status: 200 });
  });

  const response = await handleGetMatchmakingWaitingCount(
    new Request("https://example.com/api/matchmaking/waiting-count?mode=ARENA&play_style=SP&win_metric=SCORE"),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardedPath, "/internal/waiting-count?mode=ARENA&play_style=SP&win_metric=SCORE");
  const payload = await response.json();
  assert.equal(payload.waiting_count, 4);
});

test("handleGetMatchmakingWaitingCount rejects invalid query", async () => {
  let called = false;
  const env = createEnv(async () => {
    called = true;
    return new Response(JSON.stringify({ waiting_count: 0 }), { status: 200 });
  });

  const response = await handleGetMatchmakingWaitingCount(
    new Request("https://example.com/api/matchmaking/waiting-count?mode=ARENA&play_style=SP"),
    env,
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
  const payload = await response.json();
  assert.equal(payload.error?.code, "BAD_REQUEST");
});

test("handlePostRooms does not upsert lobby for PUBLIC auto-match rooms", async () => {
  const { env, getInitPayloads, getLobbyUpserts } = createRoomsEnv();
  const response = await handlePostRooms(
    new Request("https://example.com/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visibility: "PUBLIC",
        auto_match: true,
        mode: "ARENA",
        win_metric: "SCORE",
        play_style: "SP",
        level_filter: "ANY",
        max_players: 2,
        room_comment: "Auto match room",
      }),
    }),
    env,
  );

  assert.equal(response.status, 201);
  assert.equal(getInitPayloads().length, 1);
  assert.equal(getInitPayloads()[0]?.settings.auto_match, true);
  assert.equal(getLobbyUpserts().length, 0);
});

test("handlePostRooms keeps lobby upsert for normal PUBLIC rooms", async () => {
  const { env, getLobbyUpserts } = createRoomsEnv();
  const response = await handlePostRooms(
    new Request("https://example.com/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visibility: "PUBLIC",
        mode: "ARENA",
        win_metric: "SCORE",
        play_style: "SP",
        level_filter: "ANY",
        max_players: 2,
        room_comment: "Public room",
      }),
    }),
    env,
  );

  assert.equal(response.status, 201);
  assert.equal(getLobbyUpserts().length, 1);
  assert.equal(getLobbyUpserts()[0]?.isPublic, true);
});
