import { buildExpiredJoinStatus, fetchJoinRoomStatus } from "../services/join-status";
import type { WorkerEnv } from "../types/env";
import { ok } from "../utils/http";

export async function handleGetJoin(request: Request, env: WorkerEnv): Promise<Response> {
  const roomRef = new URL(request.url).searchParams.get("r")?.trim() ?? "";

  try {
    const response = await fetchJoinRoomStatus(env, roomRef);
    return ok(response);
  } catch {
    return ok(buildExpiredJoinStatus(env));
  }
}
