import test from "node:test";
import assert from "node:assert/strict";
import { RoomLobbyState } from "./room-state.ts";

function buildChart(chartKey, titleSearchKey, title) {
  return {
    chart_key: chartKey,
    expected_key: {
      play_style: "SP",
      difficulty: "HYPER",
      title_search_key: titleSearchKey,
    },
    display: {
      title,
      level: 12,
    },
  };
}

function createChartMaster() {
  const charts = [
    buildChart("chart-1", "chart-one", "Chart One"),
    buildChart("chart-2", "chart-two", "Chart Two"),
    buildChart("chart-3", "chart-three", "Chart Three"),
  ];
  const chartsByKey = new Map(charts.map((chart) => [chart.chart_key, chart]));

  return {
    resolvePickChartKey(pickChartKey) {
      return chartsByKey.get(pickChartKey) ?? null;
    },
    pickRandomUnusedChart({ used_chart_keys }) {
      return charts.find((chart) => !used_chart_keys.has(chart.chart_key)) ?? null;
    },
    searchCharts() {
      return { entries: [], next_cursor: null, previous_cursor: null };
    },
    getMetadata() {
      return {
        source_repo: "test",
        release_tag: "test",
        sqlite_file_name: "test.sqlite3",
        schema_version: "1",
        generated_at: "2026-03-08T00:00:00.000Z",
        sha256: "test",
        byte_size: 0,
      };
    },
  };
}

function createState(settingsOverride = {}) {
  const state = new RoomLobbyState(createChartMaster());
  state.initialize({
    room_id: "room-1",
    created_at: "2026-03-08T00:00:00.000Z",
    settings: {
      visibility: "PUBLIC",
      join_code: "ABCDEFGH",
      mode: "ARENA",
      win_metric: "SCORE",
      play_style: "SP",
      level_filter: "ANY",
      room_comment: "Rematch room",
      max_players: 4,
      ...settingsOverride,
    },
  });

  const joinedAt = new Date("2026-03-08T00:00:01.000Z");
  assert.equal(
    state.joinPlayer({
      player_id: "host",
      display_name: "Host",
      source: "inf-notebook",
      now: joinedAt,
    }).ok,
    true,
  );
  assert.equal(
    state.joinPlayer({
      player_id: "guest",
      display_name: "Guest",
      source: "inf_daken_counter",
      now: new Date("2026-03-08T00:00:02.000Z"),
    }).ok,
    true,
  );

  return state;
}

function prepareMatch(state, input = {}) {
  const startAt = input.startAt ?? "2026-03-08T00:01:00.000Z";
  const hostPick = input.hostPick ?? "chart-1";
  const guestPick = input.guestPick ?? "chart-2";

  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date(startAt)), { ok: true });
  assert.equal(state.submitPick("host", hostPick, new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.equal(state.submitPick("guest", guestPick, new Date("2026-03-08T00:01:11.000Z")).ok, true);
  assert.equal(state.getRoomState(), "PLAYING");
}

function submitCurrentRoundResult(state, playerId, roundIndex, metricValue, nowAt) {
  const snapshot = state.toSnapshot();
  assert.ok(snapshot.current_round, "current round should exist");
  assert.equal(snapshot.current_round.round_index, roundIndex);
  return state.submitResult(
    playerId,
    roundIndex,
    snapshot.current_round.expected_key,
    metricValue,
    null,
    new Date(nowAt),
  );
}

function getResultSummary(state) {
  const payload = state.getResultReadyPayload();
  assert.ok(payload, "result ready payload should exist");
  return payload.summary;
}

function playCurrentRound(state, roundIndex, hostMetric, guestMetric, nowBase) {
  const snapshot = state.toSnapshot();
  assert.ok(snapshot.current_round, "current round should exist");
  assert.equal(snapshot.current_round.round_index, roundIndex);

  const expectedKey = snapshot.current_round.expected_key;
  const hostResult = state.submitResult(
    "host",
    roundIndex,
    expectedKey,
    hostMetric,
    null,
    new Date(`${nowBase}:00.000Z`),
  );
  assert.equal(hostResult.ok, true);

  const guestResult = state.submitResult(
    "guest",
    roundIndex,
    expectedKey,
    guestMetric,
    null,
    new Date(`${nowBase}:01.000Z`),
  );
  assert.equal(guestResult.ok, true);
}

test("RESULT -> LOBBY clears ready and match transient state without auto-start", () => {
  const state = createState();

  assert.equal(state.getRoomState(), "LOBBY");
  assert.equal(state.getHostPlayerId(), "host");

  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);

  const startResult = state.startMatch("host", new Date("2026-03-08T00:01:00.000Z"));
  assert.equal(startResult.ok, true);
  assert.equal(state.getRoomState(), "PICKING");

  assert.equal(state.submitPick("host", "chart-1", new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.equal(state.submitPick("guest", "chart-2", new Date("2026-03-08T00:01:11.000Z")).ok, true);
  assert.equal(state.getRoomState(), "PLAYING");

  playCurrentRound(state, 0, 2000, 1500, "2026-03-08T00:02");
  assert.equal(state.getRoomState(), "PLAYING");

  playCurrentRound(state, 1, 2500, 2400, "2026-03-08T00:03");
  assert.equal(state.getRoomState(), "RESULT");

  const resultSnapshot = state.toSnapshot();
  assert.equal(resultSnapshot.result_ready, true);
  assert.equal(resultSnapshot.players.every((player) => player.ready === false), true);
  assert.equal(resultSnapshot.picks.length, 2);
  assert.equal(resultSnapshot.frozen_rounds.length, 2);
  assert.equal(resultSnapshot.current_round, null);

  const guestReturnResult = state.returnToLobby("guest", new Date("2026-03-08T00:04:00.000Z"));
  assert.deepEqual(guestReturnResult, { ok: false, reason: "NOT_HOST" });

  const returnResult = state.returnToLobby("host", new Date("2026-03-08T00:04:00.000Z"));
  assert.deepEqual(returnResult, { ok: true });
  assert.equal(state.getRoomState(), "LOBBY");

  const lobbySnapshot = state.toSnapshot();
  assert.equal(lobbySnapshot.room_id, "room-1");
  assert.equal(lobbySnapshot.host_player_id, "host");
  assert.equal(lobbySnapshot.settings.mode, "ARENA");
  assert.equal(lobbySnapshot.players.map((player) => player.player_id).join(","), "host,guest");
  assert.equal(lobbySnapshot.players.every((player) => player.ready === false), true);
  assert.equal(lobbySnapshot.picks.length, 0);
  assert.equal(lobbySnapshot.frozen_rounds.length, 0);
  assert.equal(lobbySnapshot.current_round, null);
  assert.equal(lobbySnapshot.result_ready, false);
  assert.equal(lobbySnapshot.timers.match_deadline, null);
  assert.equal(lobbySnapshot.timers.picking_deadline, null);

  const restartWithoutReady = state.startMatch("host", new Date("2026-03-08T00:04:10.000Z"));
  assert.deepEqual(restartWithoutReady, { ok: false, reason: "NOT_ALL_PLAYERS_READY" });

  const guestStartAttempt = state.startMatch("guest", new Date("2026-03-08T00:04:11.000Z"));
  assert.deepEqual(guestStartAttempt, { ok: false, reason: "NOT_HOST" });

  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:04:20.000Z")), { ok: true });
});

test("HOST_ABORTED closes room immediately", () => {
  const state = createState();
  const leaveResult = state.leavePlayer(
    "host",
    new Date("2026-03-08T00:05:00.000Z"),
    "HOST_ABORTED",
  );

  assert.deepEqual(leaveResult, { changed: true, was_host: true, room_was_closed: false });

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.room_state, "CLOSED");
  assert.equal(snapshot.close_reason, "HOST_ABORTED");
});

test("HOST_DISCONNECTED does not close immediately and can recover within cooldown", () => {
  const state = createState();
  const disconnectedAt = new Date("2026-03-08T00:05:00.000Z");
  const leaveResult = state.leavePlayer("host", disconnectedAt, "HOST_DISCONNECTED");

  assert.deepEqual(leaveResult, { changed: true, was_host: true, room_was_closed: false });
  assert.equal(state.getRoomState(), "LOBBY");
  assert.equal(state.closeHostDisconnectIfExpired(new Date("2026-03-08T00:05:09.000Z")), false);

  const snapshotAfterDisconnect = state.toSnapshot();
  const disconnectedHost = snapshotAfterDisconnect.players.find((player) => player.player_id === "host");
  assert.ok(disconnectedHost);
  assert.equal(disconnectedHost.connected, false);
  assert.notEqual(disconnectedHost.rejoin_until, null);

  assert.equal(
    state.joinPlayer({
      player_id: "host",
      display_name: "Host",
      source: "inf-notebook",
      now: new Date("2026-03-08T00:05:06.000Z"),
    }).ok,
    true,
  );
  assert.equal(state.closeHostDisconnectIfExpired(new Date("2026-03-08T00:05:20.000Z")), false);
  assert.equal(state.getRoomState(), "LOBBY");
});

test("HOST_DISCONNECTED closes room when cooldown expires", () => {
  const state = createState();
  const disconnectedAt = new Date("2026-03-08T00:05:00.000Z");
  state.leavePlayer("host", disconnectedAt, "HOST_DISCONNECTED");

  assert.equal(state.closeHostDisconnectIfExpired(new Date("2026-03-08T00:05:11.000Z")), true);

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.room_state, "CLOSED");
  assert.equal(snapshot.close_reason, "HOST_DISCONNECTED");
  assert.equal(state.getNextAlarmAt(), null);
});

test("strict rated match is true only on fully completed clean match", () => {
  const state = createState();
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, true);
  assert.equal(summary.rated_block_reason, null);
  assert.equal(summary.rating_before, null);
  assert.equal(summary.rating_after, null);
  assert.equal(summary.rating_delta, null);
  assert.deepEqual(summary.winner_player_ids, ["host"]);
});

test("missing submission still generates RESULT_READY and marks the match unrated", () => {
  const state = createState();
  prepareMatch(state);

  assert.equal(
    submitCurrentRoundResult(state, "host", 0, 2200, "2026-03-08T00:02:00.000Z").ok,
    true,
  );

  state["enterResult"](new Date("2026-03-08T00:02:30.000Z"));

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, false);
  assert.equal(summary.rated_block_reason, "missing_submission");
  assert.equal(summary.rating_before, null);
  assert.equal(summary.rating_after, null);
  assert.equal(summary.rating_delta, null);
});

test("SKIPPED blocks rating", () => {
  const state = createState();
  prepareMatch(state);

  const firstRound = state.skipSelf("host", 0, "TECH", new Date("2026-03-08T00:02:00.000Z"));
  assert.equal(firstRound.ok, true);
  assert.equal(
    submitCurrentRoundResult(state, "guest", 0, 2100, "2026-03-08T00:02:01.000Z").ok,
    true,
  );

  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, false);
  assert.equal(summary.rated_block_reason, "skip_occurred");
});

test("TIMEOUT blocks rating", () => {
  const state = createState();
  prepareMatch(state);

  assert.equal(
    submitCurrentRoundResult(state, "host", 0, 2200, "2026-03-08T00:02:00.000Z").ok,
    true,
  );
  const transition = state.expireCurrentRoundIfNeeded(new Date("2026-03-08T00:08:00.000Z"));
  assert.ok(transition);
  assert.equal(transition.confirmations.some((entry) => entry.status === "TIMEOUT"), true);

  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:09");

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, false);
  assert.equal(summary.rated_block_reason, "timeout_occurred");
});

test("FORCE_ADVANCE blocks rating", () => {
  const state = createState();
  prepareMatch(state);

  assert.equal(
    submitCurrentRoundResult(state, "host", 0, 2200, "2026-03-08T00:02:00.000Z").ok,
    true,
  );
  const result = state.forceAdvance("host", new Date("2026-03-08T00:02:10.000Z"));
  assert.equal(result.ok, true);
  assert.ok(result.force_advance_applied);

  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, false);
  assert.equal(summary.rated_block_reason, "force_advanced");
});

test("mismatched observed_key poisons the match even if the player later submits a correct result", () => {
  const state = createState();
  prepareMatch(state);

  const snapshot = state.toSnapshot();
  assert.ok(snapshot.current_round);
  const mismatch = state.submitResult(
    "host",
    0,
    {
      ...snapshot.current_round.expected_key,
      title_search_key: `${snapshot.current_round.expected_key.title_search_key}-wrong`,
    },
    2200,
    null,
    new Date("2026-03-08T00:02:00.000Z"),
  );
  assert.deepEqual(mismatch, { ok: false, reason: "RESULT_KEY_MISMATCH", confirmations: [] });

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, false);
  assert.equal(summary.rated_block_reason, "mismatch_observed_key");
});

test("BPL always plays 3 stages before entering RESULT", () => {
  const state = createState({ mode: "BPL", max_players: 2 });
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");
  assert.equal(state.getRoomState(), "PLAYING");
  assert.equal(state.toSnapshot().current_round?.round_index, 2);

  playCurrentRound(state, 2, 2400, 2300, "2026-03-08T00:04");

  const summary = getResultSummary(state);
  assert.equal(state.getRoomState(), "RESULT");
  assert.equal(summary.is_rated, true);
  assert.equal(summary.rated_block_reason, null);
  assert.deepEqual(summary.winner_player_ids, ["host"]);
});

test("conflicting final result blocks rating", () => {
  const state = createState({ mode: "BPL", max_players: 2 });
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2000, 2300, "2026-03-08T00:03");
  playCurrentRound(state, 2, 2100, 2100, "2026-03-08T00:04");

  const summary = getResultSummary(state);
  assert.equal(summary.is_rated, false);
  assert.equal(summary.rated_block_reason, "result_conflict");
  assert.deepEqual(summary.winner_player_ids.sort(), ["guest", "host"]);
});

test("MATCH_TTL expires in RESULT and closes room", () => {
  const state = createState();
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  assert.equal(state.getRoomState(), "RESULT");

  const transition = state.expireMatchIfNeeded(new Date("2026-03-08T00:31:01.000Z"));
  assert.ok(transition);
  assert.equal(state.getRoomState(), "CLOSED");
  assert.equal(state.toSnapshot().close_reason, "MATCH_TTL_EXPIRED");
});
