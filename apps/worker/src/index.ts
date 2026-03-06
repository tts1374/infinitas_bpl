import { handleGetRooms, handlePostRooms, handleRoomWebSocket, matchRoomWebSocketPath } from "./routes/rooms";
import { RoomDurableObject } from "./durable/room-object";
import type { WorkerEnv } from "./types/env";
import { methodNotAllowed, noContent, notFound, withCors } from "./utils/http";

const ROOMS_ALLOWED_METHODS = ["GET", "POST"];

export { RoomDurableObject };

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const webSocketRoomId = matchRoomWebSocketPath(url.pathname);

    if (webSocketRoomId !== null) {
      return handleRoomWebSocket(request, env, webSocketRoomId);
    }

    if (url.pathname === "/api/rooms") {
      if (request.method === "OPTIONS") {
        return withCors(noContent(), request, ROOMS_ALLOWED_METHODS);
      }
      if (request.method === "POST") {
        return withCors(await handlePostRooms(request, env), request, ROOMS_ALLOWED_METHODS);
      }
      if (request.method === "GET") {
        return withCors(await handleGetRooms(request, env), request, ROOMS_ALLOWED_METHODS);
      }

      return withCors(methodNotAllowed([...ROOMS_ALLOWED_METHODS, "OPTIONS"]), request, ROOMS_ALLOWED_METHODS);
    }

    return notFound();
  },
};
