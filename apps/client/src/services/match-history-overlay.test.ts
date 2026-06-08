import assert from "node:assert/strict";
import test from "node:test";
import {
  type MatchHistoryDocument,
  type MatchHistoryEntry,
} from "./match-history-overlay";
import {
  collectManualResetProcessedMatchIds,
  selectActiveMatchHistory,
} from "./match-history-view-model";
import {
  createEmptyMatchHistory,
  loadMatchHistoryDocument,
  MATCH_HISTORY_SCHEMA_VERSION,
  normalizeMatchHistoryMode,
} from "./match-history-document";

function createEntry(
  matchId: string,
  completedAt: string,
  mode: "ARENA" | "BPL",
  summary: MatchHistoryEntry["summary"],
): MatchHistoryEntry {
  return {
    match_id: matchId,
    completed_at: completedAt,
    mode,
    self_player_id: "me",
    players: [{ player_id: "me", display_name: "ME" }],
    summary,
    charts: [],
  };
}

test("selectActiveMatchHistory displays only the latest mode and caps it at three matches", () => {
  const history = {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    session_started_at: "2026-05-30T09:00:00.000Z",
    active_mode: null,
    matches: [
      createEntry("bpl-latest", "2026-05-30T09:05:00.000Z", "BPL", { bpl_result: "WIN", bpl_my_score: 3, bpl_opp_score: 0 }),
      createEntry("arena-new", "2026-05-30T09:04:00.000Z", "ARENA", { arena_rank: 1, arena_points: 10 }),
      createEntry("bpl-2", "2026-05-30T09:03:00.000Z", "BPL", { bpl_result: "LOSE", bpl_my_score: 1, bpl_opp_score: 2 }),
      createEntry("bpl-3", "2026-05-30T09:02:00.000Z", "BPL", { bpl_result: "DRAW", bpl_my_score: 1, bpl_opp_score: 1 }),
      createEntry("bpl-old", "2026-05-30T09:01:00.000Z", "BPL", { bpl_result: "WIN", bpl_my_score: 2, bpl_opp_score: 0 }),
    ],
  } satisfies MatchHistoryDocument;

  const active = selectActiveMatchHistory(history);
  assert.equal(active.mode, "BPL");
  assert.deepEqual(active.matches.map((match) => match.match_id), ["bpl-latest", "bpl-2", "bpl-3"]);
  assert.deepEqual(active.summary, { mode: "BPL", resultCounts: { WIN: 1, LOSE: 1, DRAW: 1 } });
});

test("selectActiveMatchHistory prefers active mode when another mode completed later", () => {
  const history = {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    session_started_at: "2026-05-30T09:00:00.000Z",
    active_mode: "BPL",
    matches: [
      createEntry("arena-latest", "2026-05-30T09:05:00.000Z", "ARENA", { arena_rank: 1, arena_points: 10 }),
      createEntry("bpl-visible", "2026-05-30T09:04:00.000Z", "BPL", { bpl_result: "WIN", bpl_my_score: 3, bpl_opp_score: 0 }),
    ],
  } satisfies MatchHistoryDocument;

  const active = selectActiveMatchHistory(history);
  assert.equal(active.mode, "BPL");
  assert.deepEqual(active.matches.map((match) => match.match_id), ["bpl-visible"]);
  assert.deepEqual(active.summary, { mode: "BPL", resultCounts: { WIN: 1, LOSE: 0, DRAW: 0 } });
});

test("normalizeMatchHistoryMode treats BPL4 as BPL history", () => {
  assert.equal(normalizeMatchHistoryMode("ARENA"), "ARENA");
  assert.equal(normalizeMatchHistoryMode("BPL"), "BPL");
  assert.equal(normalizeMatchHistoryMode("BPL4"), "BPL");
  assert.equal(normalizeMatchHistoryMode("PRIVATE"), null);
});

test("selectActiveMatchHistory aggregates ARENA ranks and points for the active mode", () => {
  const history = {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    session_started_at: "2026-05-30T09:00:00.000Z",
    active_mode: null,
    matches: [
      createEntry("arena-latest", "2026-05-30T09:03:00.000Z", "ARENA", { arena_rank: 1, arena_points: 12.5 }),
      createEntry("arena-2", "2026-05-30T09:02:00.000Z", "ARENA", { arena_rank: 3, arena_points: 7 }),
      createEntry("bpl-old", "2026-05-30T09:01:00.000Z", "BPL", { bpl_result: "WIN", bpl_my_score: 3, bpl_opp_score: 0 }),
    ],
  } satisfies MatchHistoryDocument;

  assert.deepEqual(selectActiveMatchHistory(history).summary, {
    mode: "ARENA",
    rankCounts: { 1: 1, 2: 0, 3: 1, 4: 0 },
    pointsTotal: 19.5,
  });
});

test("loadMatchHistoryDocument accepts current v1", () => {
  const history = {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    session_started_at: "2026-05-30T09:00:00.000Z",
    active_mode: null,
    matches: [
      createEntry("arena-v1", "2026-05-30T09:01:00.000Z", "ARENA", { arena_rank: 1, arena_points: 10 }),
    ],
  } satisfies MatchHistoryDocument;

  assert.equal(loadMatchHistoryDocument(history), history);
});

test("createEmptyMatchHistory creates the v1 document persisted by start and reset", () => {
  assert.deepEqual(createEmptyMatchHistory("2026-05-30T09:00:00.000Z"), {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    session_started_at: "2026-05-30T09:00:00.000Z",
    active_mode: null,
    matches: [],
  });
});

test("loadMatchHistoryDocument migrates the immediately previous unversioned shape to v1", () => {
  const legacy = {
    session_started_at: "2026-05-30T09:00:00.000Z",
    matches: [
      createEntry("bpl-legacy", "2026-05-30T09:01:00.000Z", "BPL", { bpl_result: "WIN", bpl_my_score: 3, bpl_opp_score: 0 }),
    ],
  };

  assert.deepEqual(loadMatchHistoryDocument(legacy), {
    schema_version: MATCH_HISTORY_SCHEMA_VERSION,
    ...legacy,
    active_mode: null,
  });
});

test("loadMatchHistoryDocument warns and falls back for unsupported schema versions", () => {
  const warnings: string[] = [];
  const history = loadMatchHistoryDocument(
    { schema_version: 2, session_started_at: "2026-05-30T09:00:00.000Z", matches: [] },
    (message) => warnings.push(message),
  );

  assert.equal(history.schema_version, MATCH_HISTORY_SCHEMA_VERSION);
  assert.equal(history.active_mode, null);
  assert.deepEqual(history.matches, []);
  assert.match(warnings[0] ?? "", /Unsupported local history schema_version: 2/);
});

test("loadMatchHistoryDocument warns and falls back for malformed documents", () => {
  const warnings: string[] = [];
  const history = loadMatchHistoryDocument(
    { schema_version: 1, session_started_at: "2026-05-30T09:00:00.000Z", matches: [{}] },
    (message) => warnings.push(message),
  );

  assert.equal(history.schema_version, MATCH_HISTORY_SCHEMA_VERSION);
  assert.deepEqual(history.matches, []);
  assert.match(warnings[0] ?? "", /Failed to load malformed local history/);
});

test("loadMatchHistoryDocument rejects out-of-range ARENA ranks", () => {
  const warnings: string[] = [];
  const history = loadMatchHistoryDocument(
    {
      schema_version: 1,
      session_started_at: "2026-05-30T09:00:00.000Z",
      matches: [
        createEntry("arena-invalid", "2026-05-30T09:01:00.000Z", "ARENA", { arena_rank: 9, arena_points: 10 }),
      ],
    },
    (message) => warnings.push(message),
  );

  assert.deepEqual(history.matches, []);
  assert.match(warnings[0] ?? "", /Failed to load malformed local history/);
});

test("manual reset marks current archive matches as processed so they are not reinserted", () => {
  assert.deepEqual(
    [...collectManualResetProcessedMatchIds([{ match_id: "before-reset" }, { match_id: "before-reset-2" }])],
    ["before-reset", "before-reset-2"],
  );
});
