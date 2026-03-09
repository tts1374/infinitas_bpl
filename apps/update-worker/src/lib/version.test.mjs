import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, normalizeVersion } from "./version.ts";

test("compareVersions handles numeric patch ordering", () => {
  assert.equal(compareVersions("1.0.9", "1.0.10") < 0, true);
});

test("normalizeVersion accepts a leading v", () => {
  assert.equal(normalizeVersion("v1.0.0"), "1.0.0");
});

test("normalizeVersion rejects invalid semver", () => {
  assert.throws(() => normalizeVersion("1.0"), /invalid version/);
});
