import assert from "node:assert/strict";
import test from "node:test";
import { getMatchmakingWaitingCount, WorkerApiError } from "./worker-api-client";

test("getMatchmakingWaitingCount builds waiting-count query from mode/play_style/win_metric", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: URL | RequestInfo; init: RequestInit | undefined }> = [];
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ waiting_count: 4 }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }) as typeof fetch;

  try {
    const response = await getMatchmakingWaitingCount(" https://example.com/ ", {
      mode: "ARENA",
      play_style: "SP",
      win_metric: "SCORE",
    });

    assert.equal(response.waiting_count, 4);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init?.method, "GET");

    const requestUrl = new URL(String(calls[0]?.input));
    assert.equal(requestUrl.origin, "https://example.com");
    assert.equal(requestUrl.pathname, "/api/matchmaking/waiting-count");
    assert.equal(requestUrl.searchParams.get("mode"), "ARENA");
    assert.equal(requestUrl.searchParams.get("play_style"), "SP");
    assert.equal(requestUrl.searchParams.get("win_metric"), "SCORE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getMatchmakingWaitingCount rejects empty base URL", async () => {
  await assert.rejects(
    () =>
      getMatchmakingWaitingCount("   ", {
        mode: "ARENA",
        play_style: "SP",
        win_metric: "SCORE",
      }),
    (error: unknown) =>
      error instanceof WorkerApiError &&
      error.status === 0 &&
      error.message === "Worker API URL is required.",
  );
});
