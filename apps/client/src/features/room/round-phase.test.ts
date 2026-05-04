import assert from "node:assert/strict";
import test from "node:test";
import { ROUND_PLAY_BEGIN_AT_SECONDS, type CurrentRoundSnapshot } from "@infinitas/shared";
import { resolvePlayingRoundPresentation } from "./round-phase";

const baseRoundStartedAtMs = Date.parse("2026-03-08T00:00:10.000Z");

function buildCurrentRound(roundStartedAtMs: number): CurrentRoundSnapshot {
  return {
    round_index: 1,
    expected_key: {
      play_style: "SP",
      difficulty: "ANOTHER",
      title_search_key: "test song",
    },
    round_started_at: new Date(roundStartedAtMs).toISOString(),
    soft_ttl_seconds: 300,
    confirmed: [],
  } satisfies CurrentRoundSnapshot;
}

test("resolvePlayingRoundPresentation keeps inter-round result visible before the lead-in boundary", () => {
  const presentation = resolvePlayingRoundPresentation({
    roomState: "PLAYING",
    currentRound: buildCurrentRound(baseRoundStartedAtMs),
    nowMs: baseRoundStartedAtMs - 1,
    hasPreviousResultRound: true,
    resultPhaseSeconds: 10,
  });

  assert.equal(presentation.roomStatus, "RESULT");
  assert.equal(presentation.resultTimer, 1);
  assert.equal(presentation.playingPhase, "MUSIC_SELECT");
});

test("resolvePlayingRoundPresentation does not show result before the expected lead-in window", () => {
  const presentation = resolvePlayingRoundPresentation({
    roomState: "PLAYING",
    currentRound: buildCurrentRound(baseRoundStartedAtMs),
    nowMs: baseRoundStartedAtMs - 11_000,
    hasPreviousResultRound: true,
    resultPhaseSeconds: 10,
  });

  assert.equal(presentation.roomStatus, "PLAYING");
  assert.equal(presentation.resultTimer, null);
  assert.equal(presentation.playingPhase, "MUSIC_SELECT");
});

test("resolvePlayingRoundPresentation switches to MUSIC_SELECT at the lead-in boundary", () => {
  const presentation = resolvePlayingRoundPresentation({
    roomState: "PLAYING",
    currentRound: buildCurrentRound(baseRoundStartedAtMs),
    nowMs: baseRoundStartedAtMs,
    hasPreviousResultRound: true,
    resultPhaseSeconds: 10,
  });

  assert.equal(presentation.roomStatus, "PLAYING");
  assert.equal(presentation.resultTimer, null);
  assert.equal(presentation.playingPhase, "MUSIC_SELECT");
  assert.equal(presentation.playingCountdownSeconds, 45);
});

test("resolvePlayingRoundPresentation does not keep result visible until IN_PLAY timing", () => {
  const presentation = resolvePlayingRoundPresentation({
    roomState: "PLAYING",
    currentRound: buildCurrentRound(baseRoundStartedAtMs),
    nowMs: baseRoundStartedAtMs + ROUND_PLAY_BEGIN_AT_SECONDS * 1_000,
    hasPreviousResultRound: true,
    resultPhaseSeconds: 10,
  });

  assert.equal(presentation.roomStatus, "PLAYING");
  assert.equal(presentation.resultTimer, null);
  assert.equal(presentation.playingPhase, "IN_PLAY");
});
