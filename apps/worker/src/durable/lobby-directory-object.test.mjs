import test from "node:test";
import assert from "node:assert/strict";
import { LobbyDirectoryDO } from "./lobby-directory-object.ts";

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

function createSummary(roomId) {
  return {
    roomId,
    roomName: "Lobby Room",
    ownerUserId: "owner-1",
    ownerDisplayName: "Owner",
    mode: "ARENA",
    playStyle: "SP",
    levelFilter: "ANY",
    winMetric: "SCORE",
    hasJoinCode: false,
    isPublic: true,
    currentPlayers: 1,
    maxPlayers: 2,
    isFull: false,
    status: "LOBBY",
    ttlStartedAt: 1_000,
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

async function withMockedNow(now, callback) {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
}

async function upsertRoom(lobbyDirectory, now, roomId = "room-1") {
  return withMockedNow(now, async () =>
    lobbyDirectory.fetch(
      new Request("https://lobby-directory.internal/internal/upsert", {
        method: "POST",
        body: JSON.stringify(createSummary(roomId)),
      }),
    ),
  );
}

async function removeRoom(lobbyDirectory, now, payload) {
  return withMockedNow(now, async () =>
    lobbyDirectory.fetch(
      new Request("https://lobby-directory.internal/internal/remove", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    ),
  );
}

async function listRooms(lobbyDirectory, now) {
  return withMockedNow(now, async () =>
    lobbyDirectory.fetch(
      new Request("https://lobby-directory.internal/internal/list", {
        method: "GET",
      }),
    ),
  );
}

test("conditional remove does not delete a newer lobby summary from the same millisecond", async () => {
  const lobbyDirectory = new LobbyDirectoryDO(new TestDurableObjectState());

  await upsertRoom(lobbyDirectory, 1_000);
  await upsertRoom(lobbyDirectory, 1_000);

  const removeResponse = await removeRoom(lobbyDirectory, 2_000, {
    roomId: "room-1",
    expectedUpdatedAt: 1_000,
  });
  assert.equal(removeResponse.status, 200);

  const removePayload = await removeResponse.json();
  assert.equal(removePayload.removed, false);

  const listResponse = await listRooms(lobbyDirectory, 2_000);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.rooms.length, 1);
  assert.equal(listPayload.rooms[0].roomId, "room-1");
  assert.equal(listPayload.rooms[0].updatedAt, 1_001);
});

test("conditional remove deletes the matching lobby summary", async () => {
  const lobbyDirectory = new LobbyDirectoryDO(new TestDurableObjectState());

  await upsertRoom(lobbyDirectory, 1_000);

  const removeResponse = await removeRoom(lobbyDirectory, 2_000, {
    roomId: "room-1",
    expectedUpdatedAt: 1_000,
  });
  assert.equal(removeResponse.status, 200);

  const removePayload = await removeResponse.json();
  assert.equal(removePayload.removed, true);

  const listResponse = await listRooms(lobbyDirectory, 2_000);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.rooms.length, 0);
});

test("conditional remove does not delete a recreated summary from the same millisecond", async () => {
  const lobbyDirectory = new LobbyDirectoryDO(new TestDurableObjectState());

  await upsertRoom(lobbyDirectory, 1_000);

  const firstRemoveResponse = await removeRoom(lobbyDirectory, 1_000, {
    roomId: "room-1",
    expectedUpdatedAt: 1_000,
  });
  assert.equal(firstRemoveResponse.status, 200);
  assert.equal((await firstRemoveResponse.json()).removed, true);

  await upsertRoom(lobbyDirectory, 1_000);

  const delayedRemoveResponse = await removeRoom(lobbyDirectory, 1_001, {
    roomId: "room-1",
    expectedUpdatedAt: 1_000,
  });
  assert.equal(delayedRemoveResponse.status, 200);
  assert.equal((await delayedRemoveResponse.json()).removed, false);

  const listResponse = await listRooms(lobbyDirectory, 1_001);
  const listPayload = await listResponse.json();
  assert.equal(listPayload.rooms.length, 1);
  assert.equal(listPayload.rooms[0].roomId, "room-1");
  assert.equal(listPayload.rooms[0].updatedAt, 1_001);
});
