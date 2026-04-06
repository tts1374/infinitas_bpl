import assert from "node:assert/strict";
import test from "node:test";
import { MatchmakingDurableObject } from "./matchmaking-object.ts";

class TestStorage {
  #records = new Map();

  async get(key) {
    return this.#records.get(key);
  }

  async put(key, value) {
    this.#records.set(key, value);
  }
}

class TestDurableObjectState {
  storage = new TestStorage();

  async blockConcurrencyWhile(callback) {
    return callback();
  }
}

function createEnv({ createRoomResponse = new Response(JSON.stringify({ room_id: "room-1" }), { status: 201 }) } = {}) {
  let createRoomCalls = 0;
  const env = {
    ROOM_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () => new Response("{}", { status: 200 }),
        };
      },
    },
    LOBBY_DIRECTORY_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () => new Response("{}", { status: 200 }),
        };
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

  env.ROOM_DO.get = () => ({
    fetch: async () => {
      createRoomCalls += 1;
      return createRoomResponse;
    },
  });

  return { env, getCreateRoomCalls: () => createRoomCalls };
}

async function createMatchmakingObject(initialTickets = null) {
  const state = new TestDurableObjectState();
  if (initialTickets !== null) {
    await state.storage.put("matchmaking-tickets", initialTickets);
  }
  const { env, getCreateRoomCalls } = createEnv();
  const matchmakingObject = new MatchmakingDurableObject(state, env);
  await matchmakingObject.readyPromise;
  return { matchmakingObject, state, getCreateRoomCalls };
}

async function enqueue(matchmakingObject, payload) {
  return matchmakingObject.fetch(
    new Request("https://example.com/internal/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

async function getTicket(matchmakingObject, ticketId) {
  return matchmakingObject.fetch(new Request(`https://example.com/internal/queue/${ticketId}`));
}

test("enqueue reuses the active searching ticket for the same player", async () => {
  const { matchmakingObject, state } = await createMatchmakingObject();

  const firstResponse = await enqueue(matchmakingObject, {
    mode: "ARENA",
    play_style: "SP",
    win_metric: "SCORE",
    rating: 2400,
    player_id: "player-1",
    display_name: "P1",
  });
  assert.equal(firstResponse.status, 201);
  const firstTicket = await firstResponse.json();

  const secondResponse = await enqueue(matchmakingObject, {
    mode: "BPL4",
    play_style: "DP",
    win_metric: "MISSCOUNT",
    rating: 1800,
    player_id: "player-1",
    display_name: "P1-NEW",
  });
  assert.equal(secondResponse.status, 200);
  const secondTicket = await secondResponse.json();

  assert.equal(secondTicket.ticket_id, firstTicket.ticket_id);
  assert.equal(secondTicket.mode, "BPL4");
  assert.equal(secondTicket.play_style, "DP");
  assert.equal(secondTicket.win_metric, "MISSCOUNT");

  const stored = await state.storage.get("matchmaking-tickets");
  assert.equal(Object.keys(stored).length, 1);
  assert.equal(stored[firstTicket.ticket_id].player_id, "player-1");
  assert.equal(stored[firstTicket.ticket_id].display_name, "P1-NEW");
});

test("matcher does not pair duplicate tickets from the same player", async () => {
  const nowIso = new Date().toISOString();
  const initialTickets = {
    ticket_a: {
      ticket_id: "ticket_a",
      status: "SEARCHING",
      mode: "ARENA",
      play_style: "SP",
      win_metric: "SCORE",
      rating: 2400,
      player_id: "player-1",
      display_name: "P1",
      queued_at: nowIso,
      updated_at: nowIso,
      room_id: null,
      matched_player_count: null,
    },
    ticket_b: {
      ticket_id: "ticket_b",
      status: "SEARCHING",
      mode: "ARENA",
      play_style: "SP",
      win_metric: "SCORE",
      rating: 2410,
      player_id: "player-1",
      display_name: "P1-DUP",
      queued_at: nowIso,
      updated_at: nowIso,
      room_id: null,
      matched_player_count: null,
    },
  };
  const { matchmakingObject, getCreateRoomCalls } = await createMatchmakingObject(initialTickets);

  const response = await getTicket(matchmakingObject, "ticket_a");
  assert.equal(response.status, 200);
  assert.equal(getCreateRoomCalls(), 0);

  const payload = await response.json();
  assert.equal(payload.status, "SEARCHING");
  assert.equal(payload.candidate_count, 0);
});

test("stale searching tickets are evicted before matching", async () => {
  const initialTickets = {
    stale_ticket: {
      ticket_id: "stale_ticket",
      status: "SEARCHING",
      mode: "ARENA",
      play_style: "SP",
      win_metric: "SCORE",
      rating: 2200,
      player_id: "stale-player",
      display_name: "STALE",
      queued_at: "2026-04-06T00:00:00.000Z",
      updated_at: "2026-04-06T00:00:00.000Z",
      room_id: null,
      matched_player_count: null,
    },
  };

  const { matchmakingObject, state, getCreateRoomCalls } = await createMatchmakingObject(initialTickets);
  const enqueueResponse = await enqueue(matchmakingObject, {
    mode: "ARENA",
    play_style: "SP",
    win_metric: "SCORE",
    rating: 2210,
    player_id: "active-player",
    display_name: "ACTIVE",
  });
  assert.equal(enqueueResponse.status, 201);

  const payload = await enqueueResponse.json();
  assert.equal(payload.status, "SEARCHING");
  assert.equal(payload.candidate_count, 0);
  assert.equal(getCreateRoomCalls(), 0);

  const stored = await state.storage.get("matchmaking-tickets");
  const tickets = Object.values(stored);
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0]?.player_id, "active-player");
});
