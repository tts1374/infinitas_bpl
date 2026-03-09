import { notFound } from "./lib/response";
import { handleUpdateRequest } from "./routes/update";
import type { Env } from "./types/env";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/app/update") {
      return handleUpdateRequest(request, env);
    }

    return notFound();
  },
};
