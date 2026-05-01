import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_MUSIC_SELECT_SECONDS } from "@infinitas/shared";
import { getAuthoritativePickingCountdownSeconds } from "./picking-countdown";

test("getAuthoritativePickingCountdownSeconds derives the same countdown from the same deadline", () => {
  const nowMs = Date.parse("2026-03-08T00:00:50.000Z");
  const deadline = "2026-03-08T00:02:00.000Z";

  const selfCountdown = getAuthoritativePickingCountdownSeconds(deadline, nowMs);
  const opponentCountdown = getAuthoritativePickingCountdownSeconds(deadline, nowMs);

  assert.equal(selfCountdown, 70);
  assert.equal(opponentCountdown, 70);
});

test("getAuthoritativePickingCountdownSeconds does not synthesize a fallback countdown", () => {
  const nowMs = Date.parse("2026-03-08T00:00:50.000Z");

  assert.equal(getAuthoritativePickingCountdownSeconds(null, nowMs), null);
  assert.equal(getAuthoritativePickingCountdownSeconds(undefined, nowMs), null);
  assert.equal(getAuthoritativePickingCountdownSeconds("not-a-date", nowMs), null);
});

test("getAuthoritativePickingCountdownSeconds clamps expired deadlines to zero", () => {
  const nowMs = Date.parse("2026-03-08T00:02:01.000Z");
  const deadline = "2026-03-08T00:02:00.000Z";

  assert.equal(getAuthoritativePickingCountdownSeconds(deadline, nowMs), 0);
});

test("getAuthoritativePickingCountdownSeconds keeps PLAYING music select duration separate", () => {
  const nowMs = Date.parse("2026-03-08T00:00:00.000Z");

  assert.equal(ROUND_MUSIC_SELECT_SECONDS, 45);
  assert.equal(getAuthoritativePickingCountdownSeconds(null, nowMs), null);
});
