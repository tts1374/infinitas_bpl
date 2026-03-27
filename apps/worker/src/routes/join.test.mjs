import test from "node:test";
import assert from "node:assert/strict";
import { handleGetJoin } from "./join.ts";

function createEnv({ responseFactory, appDownloadUrl } = {}) {
  return {
    ROOM_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () =>
            responseFactory
              ? responseFactory()
              : new Response(
                  JSON.stringify({
                    room_name: "Public Room",
                    recruitment_status: "recruiting",
                    shareable: true,
                    updated_at: "2026-03-25T00:00:00.000Z",
                  }),
                  { status: 200 },
                ),
        };
      },
    },
    LOBBY_DIRECTORY_DO: {
      idFromName(name) {
        return { toString: () => name };
      },
      get() {
        return {
          fetch: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
        };
      },
    },
    FEEDBACK_KV: {
      get: async () => null,
      put: async () => {},
    },
    APP_DOWNLOAD_URL: appDownloadUrl,
    REPO_OWNER_GITHUB: "tts1374",
    REPO_NAME_GITHUB: "infinitas_arena",
    APP_ENV: "test",
    MIN_SUPPORTED_CLIENT_VERSION: "1.0.2",
    ISSUE_TOKEN: "",
    DISCORD_WEBHOOK_URL: "",
  };
}

test("handleGetJoin returns expired payload when r query is missing", async () => {
  const response = await handleGetJoin(
    new Request("https://example.com/api/join"),
    createEnv({ appDownloadUrl: "https://example.com/download" }),
  );
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.recruitment_status, "expired");
  assert.equal(payload.shareable, false);
  assert.equal(payload.download_url, "https://example.com/download");
});

test("handleGetJoin returns room payload when DO join-status is available", async () => {
  const response = await handleGetJoin(
    new Request("https://example.com/api/join?r=room-1"),
    createEnv(),
  );
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.room_name, "Public Room");
  assert.equal(payload.recruitment_status, "recruiting");
  assert.equal(payload.shareable, true);
});

test("handleGetJoin falls back to expired payload when DO returns not found", async () => {
  const response = await handleGetJoin(
    new Request("https://example.com/api/join?r=room-unknown"),
    createEnv({
      responseFactory: () => new Response(JSON.stringify({ error: "ROOM_STATE_LOST" }), { status: 404 }),
    }),
  );
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.recruitment_status, "expired");
  assert.equal(payload.shareable, false);
});
