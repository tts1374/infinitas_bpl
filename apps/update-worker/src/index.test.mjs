import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.ts";

const DOWNLOAD_BASE_URL = "https://pub-f873923a35b944bbb316013ecc7e3805.r2.dev";

function createEnv({
  latest = "1.0.1",
  disabled = "false",
  signature = "BASE64_SIGNATURE",
} = {}) {
  return {
    APP_KV: {
      async get(key, type) {
        assert.equal(type, "text");
        if (key === "app:stable:latest") {
          return latest;
        }
        if (key === "app:update:disabled") {
          return disabled;
        }
        return null;
      },
    },
    APP_BUCKET: {
      async get(key) {
        if (key !== "bpl-app/stable/1.0.1/windows-x86_64/app.msi.sig") {
          return null;
        }
        if (signature === null) {
          return null;
        }
        return {
          async text() {
            return signature;
          },
        };
      },
    },
    DOWNLOAD_BASE_URL,
  };
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("returns 200 updater JSON when a newer version exists", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.0&target=windows-x86_64"),
    createEnv(),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");

  const payload = await readJson(response);
  assert.equal(payload.version, "1.0.1");
  assert.equal(
    payload.url,
    `${DOWNLOAD_BASE_URL}/bpl-app/stable/1.0.1/windows-x86_64/app.msi`,
  );
  assert.equal(payload.signature, "BASE64_SIGNATURE");
  assert.equal(payload.notes, "不具合修正");
  assert.equal(payload.pub_date, "2026-03-09T00:00:00.000Z");
});

test("returns 204 when current version is already latest", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.1&target=windows-x86_64"),
    createEnv(),
  );

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("returns 204 when updates are disabled", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.0&target=windows-x86_64"),
    createEnv({ disabled: "true" }),
  );

  assert.equal(response.status, 204);
});

test("returns 400 when target is missing", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.0"),
    createEnv(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: "target is required" });
});

test("returns 400 when version is missing", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?target=windows-x86_64"),
    createEnv(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: "version is required" });
});

test("returns 400 when target is unsupported", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.0&target=darwin-x86_64"),
    createEnv(),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), { error: "invalid target" });
});

test("returns 500 when latest version is not configured", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.0&target=windows-x86_64"),
    createEnv({ latest: null }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await readJson(response), { error: "internal error" });
});

test("returns 500 when signature object is missing", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/app/update?version=1.0.0&target=windows-x86_64"),
    createEnv({ signature: null }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await readJson(response), { error: "internal error" });
});
