import { createRoom } from "../services/room-create";
import type { WorkerEnv } from "../types/env";
import { badRequest, created, methodNotAllowed, parseJsonBody } from "../utils/http";

const ROOM_WS_PATH_PATTERN = /^\/api\/rooms\/([^/]+)\/ws$/;
const DO_WS_PROXY_URL = "https://room.internal/ws";

function isWebSocketUpgradeRequest(request: Request): boolean {
  const upgrade = request.headers.get("upgrade");
  return typeof upgrade === "string" && upgrade.toLowerCase() === "websocket";
}

export function matchRoomWebSocketPath(pathname: string): string | null {
  const match = ROOM_WS_PATH_PATTERN.exec(pathname);
  if (!match) {
    return null;
  }

  const [, encodedRoomId] = match;
  if (!encodedRoomId) {
    return null;
  }

  return decodeURIComponent(encodedRoomId);
}

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

export async function handleRoomWebSocket(
  request: Request,
  env: WorkerEnv,
  roomId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }
  if (!isWebSocketUpgradeRequest(request)) {
    return new Response("Expected websocket upgrade request.", { status: 426 });
  }

  const roomDoId = env.ROOM_DO.idFromName(roomId);
  const roomDoStub = env.ROOM_DO.get(roomDoId);

  const requestUrl = new URL(request.url);
  const proxyUrl = new URL(DO_WS_PROXY_URL);
  proxyUrl.search = requestUrl.search;

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set("x-room-id", roomId);
  proxyHeaders.set("x-room-path", requestUrl.pathname);

  return roomDoStub.fetch(
    new Request(proxyUrl.toString(), {
      method: "GET",
      headers: proxyHeaders,
    }),
  );
}
