import assert from "node:assert/strict";
import test from "node:test";
import { canApplyWaitingCountPollResult, resolveWaitingCountPollValue } from "./auto-match-waiting-count-polling";

test("canApplyWaitingCountPollResult returns true for active request", () => {
  assert.equal(
    canApplyWaitingCountPollResult({
      disposed: false,
      requestId: 3,
      latestRequestId: 3,
    }),
    true,
  );
});

test("canApplyWaitingCountPollResult returns false for stale request", () => {
  assert.equal(
    canApplyWaitingCountPollResult({
      disposed: false,
      requestId: 2,
      latestRequestId: 3,
    }),
    false,
  );
});

test("resolveWaitingCountPollValue keeps fetched value for active request", () => {
  assert.equal(
    resolveWaitingCountPollValue(
      {
        disposed: false,
        requestId: 5,
        latestRequestId: 5,
      },
      8,
    ),
    8,
  );
});

test("resolveWaitingCountPollValue applies fallback null for active request", () => {
  assert.equal(
    resolveWaitingCountPollValue(
      {
        disposed: false,
        requestId: 6,
        latestRequestId: 6,
      },
      null,
    ),
    null,
  );
});

test("resolveWaitingCountPollValue ignores disposed request", () => {
  assert.equal(
    resolveWaitingCountPollValue(
      {
        disposed: true,
        requestId: 6,
        latestRequestId: 6,
      },
      10,
    ),
    undefined,
  );
});
