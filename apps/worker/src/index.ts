import { handleGetRooms, handlePostRooms } from "./routes/rooms";
import type { WorkerEnv } from "./types/env";
import { methodNotAllowed, notFound } from "./utils/http";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

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
