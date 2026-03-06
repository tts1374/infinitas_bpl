import type { RoomSettings } from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";

const INTERNAL_ROOM_INIT_URL = "https://room.internal/internal/init";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

interface InitializeRoomRequest {
  room_id: string;
  settings: RoomSettings;
  created_at: string;
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
