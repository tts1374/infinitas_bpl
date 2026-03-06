import { handleGetRooms, handlePostRooms, handleRoomWebSocket, matchRoomWebSocketPath } from "./routes/rooms";
import { RoomDurableObject } from "./durable/room-object";
import type { WorkerEnv } from "./types/env";
import { methodNotAllowed, notFound } from "./utils/http";

export { RoomDurableObject };

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const webSocketRoomId = matchRoomWebSocketPath(url.pathname);

    if (webSocketRoomId !== null) {
      return handleRoomWebSocket(request, env, webSocketRoomId);
    }

    if (url.pathname === "/api/rooms") {
      if (request.method === "POST") {
        return handlePostRooms(request, env);
      }
      if (request.method === "GET") {
        return handleGetRooms(request, env);
      }

      return methodNotAllowed(["GET", "POST"]);
    }

    return notFound();
  },
};
