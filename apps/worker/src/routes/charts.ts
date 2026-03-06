import { searchCharts } from "../services/chart-search";
import { badRequest, methodNotAllowed, ok } from "../utils/http";

export async function handleGetCharts(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    const url = new URL(request.url);
    const response = searchCharts(url);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return badRequest(message);
  }
}
