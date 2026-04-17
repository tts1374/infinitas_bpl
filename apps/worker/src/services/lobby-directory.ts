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

interface LobbyReadCleanupProbeResult {
  room: LobbyRoomSummary;
  keep: boolean;
  stale: boolean;
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

async function probeLobbyRoomReadCleanup(
  env: WorkerEnv,
  room: LobbyRoomSummary,
): Promise<LobbyReadCleanupProbeResult> {
  try {
    const eligibilityResponse = await fetchRoomLobbyEligibility(env, room.roomId);

    if (eligibilityResponse.status === 404) {
      const body = (await eligibilityResponse.json().catch(() => null)) as { error?: unknown } | null;
      if (body?.error === "ROOM_STATE_LOST") {
        return { room, keep: false, stale: true };
      }
      return { room, keep: true, stale: false };
    }

    if (!eligibilityResponse.ok) {
      return { room, keep: true, stale: false };
    }

    const eligibility = (await eligibilityResponse.json()) as { eligible?: unknown };
    if (eligibility.eligible === false) {
      return { room, keep: false, stale: true };
    }

    return { room, keep: true, stale: false };
  } catch {
    return { room, keep: true, stale: false };
  }
}

export async function listLobbyDirectoryRoomsWithReadCleanup(
  env: WorkerEnv,
): Promise<LobbyListResponse> {
  const response = await listLobbyDirectoryRooms(env);
  const probeResults = await Promise.all(
    response.rooms.map((room) => probeLobbyRoomReadCleanup(env, room)),
  );

  const filteredRooms: Array<LobbyRoomSummary | null> = new Array(response.rooms.length).fill(null);
  await Promise.all(
    probeResults.map(async (result, index) => {
      if (result.keep) {
        filteredRooms[index] = result.room;
        return;
      }

      if (result.stale) {
        try {
          await removeLobbyDirectoryRoom(env, result.room.roomId, result.room.updatedAt);
        } catch {
          // Best effort only: stale rooms must stay excluded from this response even if cleanup fails.
        }
      }
    }),
  );

  return {
    ...response,
    rooms: filteredRooms.filter((room): room is LobbyRoomSummary => room !== null),
  };
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
