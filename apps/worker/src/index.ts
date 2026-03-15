import { handleGetCharts } from "./routes/charts";
import { handlePostFeedback } from "./routes/feedback";
import { handleGetLobby } from "./routes/lobby";
import { handlePostRooms, handleRoomWebSocket, matchRoomWebSocketPath } from "./routes/rooms";
import { LobbyDirectoryDO } from "./durable/lobby-directory-object";
import { RoomDurableObject } from "./durable/room-object";
import type { WorkerEnv } from "./types/env";
import { methodNotAllowed, noContent, notFound, withCors } from "./utils/http";

const CHARTS_ALLOWED_METHODS = ["GET"];
const ROOMS_ALLOWED_METHODS = ["POST"];
const LOBBY_ALLOWED_METHODS = ["GET"];
const FEEDBACK_ALLOWED_METHODS = ["POST"];

export { RoomDurableObject, LobbyDirectoryDO };

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

      return withCors(methodNotAllowed([...ROOMS_ALLOWED_METHODS, "OPTIONS"]), request, ROOMS_ALLOWED_METHODS);
    }

    if (url.pathname === "/api/lobby") {
      if (request.method === "OPTIONS") {
        return withCors(noContent(), request, LOBBY_ALLOWED_METHODS);
      }
      if (request.method === "GET") {
        return withCors(await handleGetLobby(request, env), request, LOBBY_ALLOWED_METHODS);
      }

      return withCors(methodNotAllowed([...LOBBY_ALLOWED_METHODS, "OPTIONS"]), request, LOBBY_ALLOWED_METHODS);
    }

    if (url.pathname === "/api/charts") {
      if (request.method === "OPTIONS") {
        return withCors(noContent(), request, CHARTS_ALLOWED_METHODS);
      }
      if (request.method === "GET") {
        return withCors(await handleGetCharts(request), request, CHARTS_ALLOWED_METHODS);
      }

      return withCors(methodNotAllowed([...CHARTS_ALLOWED_METHODS, "OPTIONS"]), request, CHARTS_ALLOWED_METHODS);
    }

    if (url.pathname === "/api/feedback") {
      if (request.method === "OPTIONS") {
        return withCors(noContent(), request, FEEDBACK_ALLOWED_METHODS);
      }
      if (request.method === "POST") {
        return withCors(await handlePostFeedback(request, env), request, FEEDBACK_ALLOWED_METHODS);
      }

      return withCors(methodNotAllowed([...FEEDBACK_ALLOWED_METHODS, "OPTIONS"]), request, FEEDBACK_ALLOWED_METHODS);
    }

    return notFound();
  },
};
