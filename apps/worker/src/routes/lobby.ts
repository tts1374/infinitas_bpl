import {
  fetchRoomLobbyEligibility,
  listLobbyDirectoryRooms,
  removeLobbyDirectoryRoom,
} from "../services/lobby-directory";
import type { WorkerEnv } from "../types/env";
import { badRequest, ok } from "../utils/http";

export async function handleGetLobby(_request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const response = await listLobbyDirectoryRooms(env);
    const probeResults = await Promise.all(
      response.rooms.map(async (room) => {
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
      }),
    );

    const filteredRooms = new Array(response.rooms.length).fill(null);
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

    const rooms = filteredRooms.filter((room): room is (typeof response.rooms)[number] => room !== null);
    return ok({
      ...response,
      rooms,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch lobby list.";
    return badRequest(message);
  }
}
