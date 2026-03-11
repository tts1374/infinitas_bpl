import type { LobbyListResponse, LobbyRoomSummary } from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";

const LOBBY_DIRECTORY_NAME = "global-lobby-directory";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const INTERNAL_LOBBY_LIST_URL = "https://lobby-directory.internal/internal/list";
const INTERNAL_LOBBY_UPSERT_URL = "https://lobby-directory.internal/internal/upsert";
const INTERNAL_LOBBY_REMOVE_URL = "https://lobby-directory.internal/internal/remove";

interface LobbyRemovePayload {
  roomId: string;
}

function getLobbyDirectoryStub(env: WorkerEnv) {
  const doId = env.LOBBY_DIRECTORY_DO.idFromName(LOBBY_DIRECTORY_NAME);
  return env.LOBBY_DIRECTORY_DO.get(doId);
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

export async function removeLobbyDirectoryRoom(env: WorkerEnv, roomId: string): Promise<void> {
  const payload: LobbyRemovePayload = { roomId };

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
