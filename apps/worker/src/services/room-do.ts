import type { RoomSettings, RoomState } from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";

const INTERNAL_ROOM_INIT_URL = "https://room.internal/internal/init";
const INTERNAL_ROOM_LOBBY_SUMMARY_URL = "https://room.internal/internal/lobby-summary";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

interface InitializeRoomRequest {
  room_id: string;
  settings: RoomSettings;
  created_at: string;
}

export interface LobbyRoomSummary {
  room_state: RoomState;
  current_members: number;
  max_players: RoomSettings["max_players"];
}

export async function initializeRoomDurableObject(
  env: WorkerEnv,
  roomId: string,
  settings: RoomSettings,
  createdAtIso: string,
): Promise<void> {
  const doId = env.ROOM_DO.idFromName(roomId);
  const stub = env.ROOM_DO.get(doId);

  const payload: InitializeRoomRequest = {
    room_id: roomId,
    settings,
    created_at: createdAtIso,
  };

  const response = await stub.fetch(
    new Request(INTERNAL_ROOM_INIT_URL, {
      method: "POST",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(payload),
    }),
  );

  if (!response.ok) {
    throw new Error("Failed to initialize room state.");
  }
}

export async function getLobbyRoomSummary(env: WorkerEnv, roomId: string): Promise<LobbyRoomSummary> {
  const doId = env.ROOM_DO.idFromName(roomId);
  const stub = env.ROOM_DO.get(doId);

  const response = await stub.fetch(
    new Request(INTERNAL_ROOM_LOBBY_SUMMARY_URL, {
      method: "GET",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
    }),
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch lobby room summary (${response.status}).`);
  }

  return (await response.json()) as LobbyRoomSummary;
}
