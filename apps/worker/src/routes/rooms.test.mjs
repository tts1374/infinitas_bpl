import assert from "node:assert/strict";
import test from "node:test";
import { handlePostRooms } from "./rooms.ts";

function createEnv() {
  return {
    MATCHMAKING_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () => new Response("{}", { status: 200 }),
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
  const env = createEnv();

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

test("handlePostRooms does not upsert lobby when visibility is PUBLIC and auto_match is true", async () => {
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

test("handlePostRooms keeps lobby upsert when visibility is PUBLIC without auto_match", async () => {
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
