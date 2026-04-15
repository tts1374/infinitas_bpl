import type { LobbyListResponse, LobbyRoomSummary } from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";

const LOBBY_DIRECTORY_NAME = "global-lobby-directory";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const INTERNAL_LOBBY_LIST_URL = "https://lobby-directory.internal/internal/list";
const INTERNAL_LOBBY_UPSERT_URL = "https://lobby-directory.internal/internal/upsert";
const INTERNAL_LOBBY_REMOVE_URL = "https://lobby-directory.internal/internal/remove";
const INTERNAL_ROOM_LOBBY_ELIGIBILITY_URL = "https://room.internal/internal/lobby-eligibility";

interface LobbyRemovePayload {
  roomId: string;
  expectedUpdatedAt?: number;
}

function getLobbyDirectoryStub(env: WorkerEnv) {
  const doId = env.LOBBY_DIRECTORY_DO.idFromName(LOBBY_DIRECTORY_NAME);
  return env.LOBBY_DIRECTORY_DO.get(doId);
}

function getRoomStub(env: WorkerEnv, roomId: string) {
  const doId = env.ROOM_DO.idFromName(roomId);
  return env.ROOM_DO.get(doId);
}

async function fetchLobbyDirectoryJson<TResponse>(
  env: WorkerEnv,
  request: Request,
  errorPrefix: string,
): Promise<TResponse> {
  const response = await getLobbyDirectoryStub(env).fetch(request);
  if (!response.ok) {
    throw new Error(`${errorPrefix} (${response.status}).`);
  }

  return (await response.json()) as TResponse;
}

export async function listLobbyDirectoryRooms(env: WorkerEnv): Promise<LobbyListResponse> {
  return fetchLobbyDirectoryJson<LobbyListResponse>(
    env,
    new Request(INTERNAL_LOBBY_LIST_URL, {
      method: "GET",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
    }),
    "Failed to fetch lobby list",
  );
}

export async function upsertLobbyDirectoryRoom(
  env: WorkerEnv,
  summary: LobbyRoomSummary,
): Promise<void> {
  await fetchLobbyDirectoryJson<{ ok: true }>(
    env,
    new Request(INTERNAL_LOBBY_UPSERT_URL, {
      method: "POST",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(summary),
    }),
    "Failed to upsert lobby room",
  );
}

export async function removeLobbyDirectoryRoom(
  env: WorkerEnv,
  roomId: string,
  expectedUpdatedAt?: number,
): Promise<void> {
  const payload: LobbyRemovePayload =
    expectedUpdatedAt === undefined
      ? { roomId }
      : { roomId, expectedUpdatedAt };

  await fetchLobbyDirectoryJson<{ ok: true }>(
    env,
    new Request(INTERNAL_LOBBY_REMOVE_URL, {
      method: "POST",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(payload),
    }),
    "Failed to remove lobby room",
  );
}

export async function fetchRoomLobbyEligibility(
  env: WorkerEnv,
  roomId: string,
): Promise<Response> {
  return getRoomStub(env, roomId).fetch(
    new Request(INTERNAL_ROOM_LOBBY_ELIGIBILITY_URL, {
      method: "GET",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
    }),
  );
}
