import assert from "node:assert/strict";
import test from "node:test";
import {
  handleDeleteMatchmakingQueueTicket,
  handleGetMatchmakingQueueTicket,
  handlePostMatchmakingQueue,
  matchMatchmakingQueueTicketPath,
} from "./matchmaking.ts";

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

test("matchMatchmakingQueueTicketPath decodes ticket id", () => {
  const matched = matchMatchmakingQueueTicketPath("/api/matchmaking/queue/ticket%2D1");
  assert.equal(matched, "ticket-1");
  assert.equal(matchMatchmakingQueueTicketPath("/api/lobby"), null);
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
