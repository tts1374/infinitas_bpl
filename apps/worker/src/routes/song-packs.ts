import { listSongPacks } from "../services/song-pack";
import { methodNotAllowed, ok } from "../utils/http";

export async function handleGetSongPacks(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  return ok(listSongPacks());
}
