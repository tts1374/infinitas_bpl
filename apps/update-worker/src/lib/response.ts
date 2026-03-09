const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function json(status: number, payload: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": JSON_CONTENT_TYPE,
      ...headers,
    },
  });
}

export function ok(payload: unknown): Response {
  return json(200, payload);
}

export function badRequest(message: string): Response {
  return json(400, { error: message });
}

export function internalError(): Response {
  return json(500, { error: "internal error" });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json(
    405,
    { error: "method not allowed" },
    {
      Allow: allowed.join(", "),
    },
  );
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function notFound(): Response {
  return json(404, { error: "not found" });
}
