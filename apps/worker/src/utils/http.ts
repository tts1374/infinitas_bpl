import type { ApiErrorResponse } from "../types/api";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const DEFAULT_CORS_ALLOWED_HEADERS = "content-type";
const DEFAULT_CORS_MAX_AGE_SECONDS = "86400";

function makeJsonResponse(status: number, payload: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": JSON_CONTENT_TYPE,
      ...headers,
    },
  });
}

function appendVary(headers: Headers, value: string): void {
  const current = headers.get("vary");
  if (current === null) {
    headers.set("vary", value);
    return;
  }

  const values = current
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  if (values.includes(value.toLowerCase())) {
    return;
  }

  headers.set("vary", `${current}, ${value}`);
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

export function noContent(headers?: HeadersInit): Response {
  if (headers === undefined) {
    return new Response(null, { status: 204 });
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

export function withCors(response: Response, request: Request, allowedMethods: string[]): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  const requestedHeaders = request.headers.get("access-control-request-headers");

  headers.set("access-control-allow-origin", origin ?? "*");
  headers.set("access-control-allow-methods", [...allowedMethods, "OPTIONS"].join(", "));
  headers.set("access-control-allow-headers", requestedHeaders ?? DEFAULT_CORS_ALLOWED_HEADERS);
  headers.set("access-control-max-age", DEFAULT_CORS_MAX_AGE_SECONDS);

  if (origin !== null) {
    appendVary(headers, "Origin");
  }
  if (requestedHeaders !== null) {
    appendVary(headers, "Access-Control-Request-Headers");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    throw new Error("Request body must be JSON.");
  }

  return request.json();
}
