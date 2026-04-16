import { listLobbyDirectoryRoomsWithReadCleanup } from "../services/lobby-directory";
import type { WorkerEnv } from "../types/env";
import { badRequest, ok } from "../utils/http";

export async function handleGetLobby(_request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const response = await listLobbyDirectoryRoomsWithReadCleanup(env);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch lobby list.";
    return badRequest(message);
  }
}
