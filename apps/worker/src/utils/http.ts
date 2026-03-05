import type { ApiErrorResponse } from "../types/api";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function makeJsonResponse(status: number, payload: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": JSON_CONTENT_TYPE,
      ...headers,
    },
  });
}

export function ok(payload: unknown): Response {
  return makeJsonResponse(200, payload);
}

export function created(payload: unknown): Response {
  return makeJsonResponse(201, payload);
}

export function badRequest(message: string, code = "BAD_REQUEST"): Response {
  const payload: ApiErrorResponse = {
    error: {
      code,
      message,
    },
  };

  return makeJsonResponse(400, payload);
}

export function notFound(): Response {
  const payload: ApiErrorResponse = {
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  };

  return makeJsonResponse(404, payload);
}

export function methodNotAllowed(allowed: string[]): Response {
  const payload: ApiErrorResponse = {
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed for this route.",
    },
  };

  return makeJsonResponse(405, payload, {
    Allow: allowed.join(", "),
  });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    throw new Error("Request body must be JSON.");
  }

  return request.json();
}
