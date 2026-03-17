import test from "node:test";
import assert from "node:assert/strict";
import { RoomDurableObject } from "./room-object.ts";

class TestStorage {
  #records = new Map();
  #alarm = null;

  async get(key) {
    return this.#records.get(key);
  }

  async put(key, value) {
    this.#records.set(key, value);
  }

  async deleteAlarm() {
    this.#alarm = null;
  }

  async setAlarm(value) {
    this.#alarm = value instanceof Date ? value.getTime() : value;
  }
}

class TestDurableObjectState {
  storage = new TestStorage();
  #sockets = [];

  async blockConcurrencyWhile(callback) {
    return callback();
  }

  acceptWebSocket(socket) {
    this.#sockets.push(socket);
  }

  getWebSockets() {
    return [...this.#sockets];
  }
}

class TestSocket {
  readyState = 1;
  sent = [];
  closeCalls = [];
  #attachment = null;

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;
  }

  serializeAttachment(attachment) {
    this.#attachment = structuredClone(attachment);
  }

  deserializeAttachment() {
    return this.#attachment;
  }
}

function buildSettings() {
  return {
    visibility: "PUBLIC",
    join_code: "ABCDEFGH",
    mode: "ARENA",
    win_metric: "SCORE",
    play_style: "SP",
    level_filter: "ANY",
    room_comment: "room object test",
    max_players: 4,
  };
}

function createEnv() {
  const okResponse = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  return {
    ROOM_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () => okResponse(),
        };
      },
    },
    LOBBY_DIRECTORY_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () => okResponse(),
        };
      },
    },
  };
}

async function createRoomObject() {
  const state = new TestDurableObjectState();
  const roomObject = new RoomDurableObject(state, createEnv());
  await roomObject.readyPromise;

  roomObject.roomState.initialize({
    room_id: "room-1",
    created_at: "2026-03-08T00:00:00.000Z",
    settings: buildSettings(),
  });

  return roomObject;
}

function createJoinMessage(playerId, clientMessageId) {
  return {
    type: "ROOM_JOIN",
    client_msg_id: clientMessageId,
    room_id: "room-1",
    player_id: playerId,
    payload: {
      display_name: playerId.toUpperCase(),
      source: "inf-notebook",
      client_version: "1.0.1",
    },
  };
}

async function joinPlayer(roomObject, socket, playerId, clientMessageId) {
  const session = roomObject.registerSocketSession(socket);
  await roomObject.handleRoomJoin(session, createJoinMessage(playerId, clientMessageId));
  return session;
}

test("webSocketClose marks player as temporarily disconnected", async () => {
  const roomObject = await createRoomObject();
  const hostSocket = new TestSocket();
  const guestSocket = new TestSocket();

  await joinPlayer(roomObject, hostSocket, "host", "msg-1");
  await joinPlayer(roomObject, guestSocket, "guest", "msg-2");

  await roomObject.webSocketClose(guestSocket, 1006, "abnormal close", false);

  const guest = roomObject.roomState.toSnapshot().players.find((player) => player.player_id === "guest");
  assert.ok(guest);
  assert.equal(guest.connected, false);
  assert.notEqual(guest.left_at, null);
  assert.notEqual(guest.rejoin_until, null);
});

test("reconnect replaces old socket and stale close does not mark player disconnected again", async () => {
  const roomObject = await createRoomObject();
  const oldSocket = new TestSocket();

  await joinPlayer(roomObject, oldSocket, "host", "msg-1");
  roomObject.roomState.markPlayerDisconnected("host", new Date());

  const reconnectSocket = new TestSocket();
  await joinPlayer(roomObject, reconnectSocket, "host", "msg-2");

  assert.equal(oldSocket.closeCalls.length, 1);
  assert.equal(oldSocket.closeCalls[0]?.code, 4002);

  let host = roomObject.roomState.toSnapshot().players.find((player) => player.player_id === "host");
  assert.ok(host);
  assert.equal(host.connected, true);
  assert.equal(host.left_at, null);
  assert.equal(host.rejoin_until, null);

  await roomObject.webSocketClose(oldSocket, 1000, "replaced", true);

  host = roomObject.roomState.toSnapshot().players.find((player) => player.player_id === "host");
  assert.ok(host);
  assert.equal(host.connected, true);
});

test("MATCH_TTL_EXPIRED closes sockets and clears sessions", async () => {
  const roomObject = await createRoomObject();
  const hostSocket = new TestSocket();
  const guestSocket = new TestSocket();

  await joinPlayer(roomObject, hostSocket, "host", "msg-1");
  await joinPlayer(roomObject, guestSocket, "guest", "msg-2");

  roomObject.roomState.enterResult(new Date("2026-03-08T00:20:00.000Z"));
  roomObject.roomState.matchDeadline = new Date("2026-03-08T00:19:59.000Z");

  await roomObject.processDueTransitions(new Date("2026-03-08T00:20:01.000Z"));

  assert.equal(roomObject.roomState.getRoomState(), "CLOSED");
  assert.equal(roomObject.sessionsBySocket.size, 0);
  assert.equal(hostSocket.closeCalls.length, 1);
  assert.equal(guestSocket.closeCalls.length, 1);
  assert.equal(hostSocket.closeCalls[0]?.code, 4000);
  assert.equal(guestSocket.closeCalls[0]?.code, 4000);
});
