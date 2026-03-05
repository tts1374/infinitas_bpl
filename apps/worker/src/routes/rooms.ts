import { createRoom } from "../services/room-create";
import { listRooms } from "../services/room-list";
import type { WorkerEnv } from "../types/env";
import { badRequest, created, ok, parseJsonBody } from "../utils/http";

export async function handlePostRooms(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    const response = await createRoom(env, body);
    return created(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return badRequest(message);
  }
}

export async function handleGetRooms(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const response = await listRooms(env, url);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return badRequest(message);
  }
}
