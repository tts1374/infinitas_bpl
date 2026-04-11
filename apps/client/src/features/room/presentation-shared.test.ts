import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPresentationPlayerMaps,
  formatCountdown,
  formatOrdinal,
  formatRankLabel,
  getDifficultyBadgeClass,
  getDifficultyBadgeLabel,
  maskJoinCode,
  normalizeRoomPlayerStatus,
} from "./presentation-shared";

test("maskJoinCode preserves length", () => {
  assert.equal(maskJoinCode("ARENA123"), "********");
});

test("formatCountdown renders placeholder for null", () => {
  assert.equal(formatCountdown(null), "--:--");
});

test("formatCountdown renders mm:ss", () => {
  assert.equal(formatCountdown(125), "2:05");
});

test("formatOrdinal handles ordinal suffixes", () => {
  assert.equal(formatOrdinal(1), "1st");
  assert.equal(formatOrdinal(2), "2nd");
  assert.equal(formatOrdinal(3), "3rd");
  assert.equal(formatOrdinal(11), "11th");
  assert.equal(formatOrdinal(23), "23rd");
});

test("formatRankLabel supports null ranks", () => {
  assert.equal(formatRankLabel(null), "-");
  assert.equal(formatRankLabel(4), "4th");
});

test("difficulty badge helpers map known labels", () => {
  assert.equal(getDifficultyBadgeLabel("A"), "ANOTHER");
  assert.match(getDifficultyBadgeClass("A"), /bg-red-600/);
});

test("normalizeRoomPlayerStatus falls back to UNCONFIRMED", () => {
  assert.equal(normalizeRoomPlayerStatus("PLAYED"), "PLAYED");
  assert.equal(normalizeRoomPlayerStatus("UNKNOWN"), "UNCONFIRMED");
  assert.equal(normalizeRoomPlayerStatus(null), "UNCONFIRMED");
});

test("buildPresentationPlayerMaps derives status and metrics together", () => {
  const maps = buildPresentationPlayerMaps(
    [{ id: "left" }, { id: "right" }, { id: "bench" }],
    ["p1", "p2", null],
    (playerId) =>
      playerId === "p1"
        ? { label: "PLAYED", metric: 1800 }
        : { label: "TIMEOUT", metric: null },
  );

  assert.deepEqual(maps.playerStatus, {
    left: "PLAYED",
    right: "TIMEOUT",
    bench: "UNCONFIRMED",
  });
  assert.deepEqual(maps.playerMetrics, {
    left: 1800,
    right: null,
    bench: null,
  });
});
