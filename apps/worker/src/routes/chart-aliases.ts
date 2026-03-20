import { resolveChartAlias } from "../services/chart-alias-resolver";
import { badRequest, methodNotAllowed, ok } from "../utils/http";

export async function handleGetChartAliasResolve(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    const url = new URL(request.url);
    const response = resolveChartAlias(url);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return badRequest(message);
  }
}
