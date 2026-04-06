import test from "node:test";
import assert from "node:assert/strict";
import { RoomLobbyState } from "./room-state.ts";

function buildChart(chartKey, titleSearchKey, title, level, options = {}) {
  return {
    chart_key: chartKey,
    inf_unlock_type: options.inf_unlock_type ?? "initial",
    inf_pack_id: options.inf_pack_id ?? null,
    expected_key: {
      play_style: "SP",
      difficulty: options.difficulty ?? "HYPER",
      title_search_key: titleSearchKey,
    },
    display: {
      title,
      level,
    },
  };
}

function createChartMaster() {
  const charts = [
    buildChart("chart-1", "chart-one", "Chart One", 11),
    buildChart("chart-2", "chart-two", "Chart Two", 8),
    buildChart("chart-3", "chart-three", "Chart Three", 10),
    buildChart("chart-4", "chart-four", "Chart Four", 9),
    buildChart("chart-bit", "chart-bit", "Chart Bit", 10, { inf_unlock_type: "bit" }),
    buildChart("chart-djp", "chart-djp", "Chart Djp", 10, { inf_unlock_type: "djp" }),
    buildChart("chart-pack-2", "chart-pack-2", "Chart Pack 2", 10, { inf_unlock_type: "pack", inf_pack_id: 2 }),
    buildChart("chart-leg", "chart-leg", "Chart Leg", 12, { difficulty: "LEGGENDARIA" }),
  ];
  const chartsByKey = new Map(charts.map((chart) => [chart.chart_key, chart]));

  const canUseByUnlockFilter = (chart, unlockFilter) => {
    if (!unlockFilter) {
      return true;
    }

    if (!unlockFilter.include_leggendaria && chart.expected_key.difficulty === "LEGGENDARIA") {
      return false;
    }

    switch (chart.inf_unlock_type) {
      case "initial":
        return true;
      case "bit":
        return unlockFilter.include_bit;
      case "djp":
        return unlockFilter.include_djp;
      case "pack":
        return Number.isInteger(chart.inf_pack_id) && unlockFilter.common_pack_ids.includes(chart.inf_pack_id);
      default:
        return false;
    }
  };

  return {
    resolvePickChartKey(pickChartKey, _playStyle, _levelFilter, unlockFilter) {
      const chart = chartsByKey.get(pickChartKey) ?? null;
      return chart && canUseByUnlockFilter(chart, unlockFilter) ? chart : null;
    },
    pickRandomUnusedChart({
      used_chart_keys,
      unlock_filter,
      preferred_level_min,
      preferred_level_max,
      enforce_level_range,
    }) {
      const unusedCharts = charts.filter(
        (chart) => !used_chart_keys.has(chart.chart_key) && canUseByUnlockFilter(chart, unlock_filter),
      );
      const hasLevelRange =
        typeof preferred_level_min === "number" && typeof preferred_level_max === "number";
      if (!hasLevelRange) {
        return unusedCharts[0] ?? null;
      }

      const levelMin = Math.min(preferred_level_min, preferred_level_max);
      const levelMax = Math.max(preferred_level_min, preferred_level_max);
      const rangedUnusedCharts = unusedCharts.filter(
        (chart) => chart.display.level >= levelMin && chart.display.level <= levelMax,
      );
      if (rangedUnusedCharts.length > 0) {
        return rangedUnusedCharts[0] ?? null;
      }

      if (enforce_level_range) {
        return null;
      }

      return unusedCharts[0] ?? null;
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

function createState(settingsOverride = {}, playerUnlocks = {}) {
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
      song_unlocks: playerUnlocks.host,
      now: joinedAt,
    }).ok,
    true,
  );
  assert.equal(
    state.joinPlayer({
      player_id: "guest",
      display_name: "Guest",
      source: "inf_daken_counter",
      song_unlocks: playerUnlocks.guest,
      now: new Date("2026-03-08T00:00:02.000Z"),
    }).ok,
    true,
  );

  return state;
}

function createAutoMatchState(settingsOverride = {}) {
  const state = new RoomLobbyState(createChartMaster());
  state.initialize({
    room_id: "room-auto",
    created_at: "2026-03-08T00:00:00.000Z",
    settings: {
      visibility: "PUBLIC",
      join_code: null,
      auto_match: true,
      mode: "ARENA",
      win_metric: "SCORE",
      play_style: "SP",
      level_filter: "ANY",
      room_comment: "Auto Match Room",
      max_players: 2,
      ...settingsOverride,
    },
  });

  return state;
}

function prepareMatch(state, input = {}) {
  const startAt = input.startAt ?? "2026-03-08T00:01:00.000Z";
  const hostPick = input.hostPick ?? "chart-1";
  const guestPick = input.guestPick ?? "chart-2";
  const hostSecondPick = input.hostSecondPick ?? "chart-3";
  const guestSecondPick = input.guestSecondPick ?? "chart-4";

  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date(startAt)), { ok: true });
  assert.equal(state.submitPick("host", hostPick, new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.equal(state.submitPick("guest", guestPick, new Date("2026-03-08T00:01:11.000Z")).ok, true);
  if (state.toSnapshot().settings.mode === "BPL4") {
    assert.equal(state.submitPick("host", hostSecondPick, new Date("2026-03-08T00:01:12.000Z")).ok, true);
    assert.equal(state.submitPick("guest", guestSecondPick, new Date("2026-03-08T00:01:13.000Z")).ok, true);
  }
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
  assert.equal(typeof payload.summary.match_id, "string");
  assert.ok(payload.summary.match_id.length > 0);
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

function finishMatchToResult(state, baseAt = "2026-03-08T00:02:00.000Z") {
  const baseMs = Date.parse(baseAt);
  assert.equal(Number.isFinite(baseMs), true);
  let step = 0;
  while (state.getRoomState() === "PLAYING") {
    const snapshot = state.toSnapshot();
    assert.ok(snapshot.current_round, "current round should exist");
    const round = snapshot.current_round;
    const hostAt = new Date(baseMs + step * 10_000);
    const guestAt = new Date(baseMs + step * 10_000 + 1_000);
    assert.equal(state.submitResult("host", round.round_index, round.expected_key, 2000 - step, null, hostAt).ok, true);
    assert.equal(state.submitResult("guest", round.round_index, round.expected_key, 1500 - step, null, guestAt).ok, true);
    step += 1;
  }
  assert.equal(state.getRoomState(), "RESULT");
}

test("START_MATCH snapshot filter allows only shared unlock conditions", () => {
  const state = createState({}, {
    host: {
      bit_unlocked: true,
      djp_unlocked: false,
      allow_leggendaria: true,
      owned_pack_ids: [2, 3],
    },
    guest: {
      bit_unlocked: true,
      djp_unlocked: true,
      allow_leggendaria: false,
      owned_pack_ids: [2],
    },
  });

  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:01:00.000Z")), { ok: true });

  const pickingSnapshot = state.toSnapshot();
  assert.deepEqual(pickingSnapshot.match_song_unlock_filter, {
    include_bit: true,
    include_djp: false,
    include_leggendaria: false,
    common_pack_ids: [2],
  });

  assert.equal(state.submitPick("host", "chart-bit", new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.deepEqual(
    state.submitPick("guest", "chart-djp", new Date("2026-03-08T00:01:11.000Z")),
    { ok: false, reason: "INVALID_PICK_CHART_KEY" },
  );
  assert.deepEqual(
    state.submitPick("guest", "chart-leg", new Date("2026-03-08T00:01:11.500Z")),
    { ok: false, reason: "INVALID_PICK_CHART_KEY" },
  );
  assert.equal(state.submitPick("guest", "chart-pack-2", new Date("2026-03-08T00:01:12.000Z")).ok, true);
});

test("START_MATCH filter stays fixed after reconnect capability change", () => {
  const state = createState({}, {
    host: {
      bit_unlocked: true,
      djp_unlocked: true,
      allow_leggendaria: false,
      owned_pack_ids: [2],
    },
    guest: {
      bit_unlocked: true,
      djp_unlocked: true,
      allow_leggendaria: false,
      owned_pack_ids: [2],
    },
  });

  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:01:00.000Z")), { ok: true });

  const startSnapshot = state.toSnapshot();
  assert.equal(startSnapshot.match_song_unlock_filter?.include_leggendaria, false);

  const disconnected = state.markPlayerDisconnected("guest", new Date("2026-03-08T00:01:10.000Z"));
  assert.equal(disconnected.changed, true);

  const reconnect = state.joinPlayer({
    player_id: "guest",
    display_name: "Guest",
    source: "inf_daken_counter",
    song_unlocks: {
      bit_unlocked: true,
      djp_unlocked: true,
      allow_leggendaria: true,
      owned_pack_ids: [2],
    },
    now: new Date("2026-03-08T00:01:12.000Z"),
  });
  assert.deepEqual(reconnect, { ok: true, join_type: "RECONNECT" });

  assert.equal(state.submitPick("host", "chart-1", new Date("2026-03-08T00:01:20.000Z")).ok, true);
  assert.deepEqual(
    state.submitPick("guest", "chart-leg", new Date("2026-03-08T00:01:21.000Z")),
    { ok: false, reason: "INVALID_PICK_CHART_KEY" },
  );
  assert.equal(state.submitPick("guest", "chart-2", new Date("2026-03-08T00:01:22.000Z")).ok, true);
});

test("RESULT -> LOBBY clears ready and match transient state without auto-start", () => {
  const state = createState();
  const initialSnapshot = state.toSnapshot();
  assert.equal(initialSnapshot.current_match_id, "room-1");
  assert.equal(initialSnapshot.generation, 1);

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
  const firstPlayingSnapshot = state.toSnapshot();
  const firstMatchId = firstPlayingSnapshot.current_match_id;
  assert.equal(typeof firstMatchId, "string");
  assert.notEqual(firstMatchId, "room-1");

  playCurrentRound(state, 0, 2000, 1500, "2026-03-08T00:02");
  assert.equal(state.getRoomState(), "PLAYING");

  playCurrentRound(state, 1, 2500, 2400, "2026-03-08T00:03");
  assert.equal(state.getRoomState(), "RESULT");

  const resultSnapshot = state.toSnapshot();
  assert.equal(resultSnapshot.result_ready, true);
  assert.equal(resultSnapshot.current_match_id, firstMatchId);
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
  assert.equal(lobbySnapshot.current_match_id, "room-1");
  assert.equal(lobbySnapshot.generation, 1);
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
  const secondStartSnapshot = state.toSnapshot();
  assert.equal(typeof secondStartSnapshot.current_match_id, "string");
  assert.notEqual(secondStartSnapshot.current_match_id, "room-1");
  assert.notEqual(secondStartSnapshot.current_match_id, firstMatchId);
});

test("auto-match room starts automatically when the final player joins", () => {
  const state = createAutoMatchState();

  const hostJoin = state.joinPlayer({
    player_id: "host",
    display_name: "Host",
    source: "inf-notebook",
    now: new Date("2026-03-08T00:00:01.000Z"),
  });
  assert.deepEqual(hostJoin, { ok: true, join_type: "NEW" });
  assert.equal(state.getRoomState(), "LOBBY");

  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:00:02.000Z")), {
    ok: false,
    reason: "AUTO_MATCH_ROOM_LOCKED",
  });

  const guestJoin = state.joinPlayer({
    player_id: "guest",
    display_name: "Guest",
    source: "inf_daken_counter",
    now: new Date("2026-03-08T00:00:03.000Z"),
  });
  assert.deepEqual(guestJoin, { ok: true, join_type: "NEW" });
  assert.equal(state.getRoomState(), "PICKING");

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.settings.auto_match, true);
  assert.equal(snapshot.players.length, 2);
  assert.equal(snapshot.players.every((player) => player.ready === false), true);
  assert.equal(snapshot.timers.result_deadline, null);
});

test("auto-match room closes after result deadline and blocks rematch/recreate", () => {
  const state = createAutoMatchState();

  assert.equal(
    state.joinPlayer({
      player_id: "host",
      display_name: "Host",
      source: "inf-notebook",
      now: new Date("2026-03-08T00:00:01.000Z"),
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
  assert.equal(state.getRoomState(), "PICKING");

  assert.equal(state.submitPick("host", "chart-1", new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.equal(state.submitPick("guest", "chart-2", new Date("2026-03-08T00:01:11.000Z")).ok, true);
  assert.equal(state.getRoomState(), "PLAYING");

  playCurrentRound(state, 0, 2000, 1500, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2400, 1500, "2026-03-08T00:03");
  assert.equal(state.getRoomState(), "RESULT");

  const resultSnapshot = state.toSnapshot();
  assert.equal(resultSnapshot.timers.result_deadline, "2026-03-08T00:03:21.000Z");
  assert.deepEqual(state.returnToLobby("host", new Date("2026-03-08T00:03:05.000Z")), {
    ok: false,
    reason: "AUTO_MATCH_ROOM_LOCKED",
  });

  assert.equal(state.expireAutoMatchResultIfNeeded(new Date("2026-03-08T00:03:21.000Z")), true);
  assert.equal(state.getRoomState(), "CLOSED");
  assert.equal(state.toSnapshot().close_reason, "ALL_ROUNDS_COMPLETED");

  assert.deepEqual(
    state.recreateAsLastHost("host", new Date("2026-03-08T00:03:25.000Z"), 30 * 60_000),
    { ok: false, reason: "AUTO_MATCH_ROOM_LOCKED" },
  );
});

test("BPL(3) keeps PICKING TTL at 120 seconds", () => {
  const state = createState({ mode: "BPL", max_players: 2 });
  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:01:00.000Z")), { ok: true });

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.room_state, "PICKING");
  assert.equal(snapshot.timers.picking_deadline, "2026-03-08T00:03:00.000Z");
});

test("BPL4 extends PICKING TTL to 180 seconds", () => {
  const state = createState({ mode: "BPL4", max_players: 2 });
  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:01:00.000Z")), { ok: true });

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.room_state, "PICKING");
  assert.equal(snapshot.timers.picking_deadline, "2026-03-08T00:04:00.000Z");
});

test("PRIVATE auto_rematch starts next match from RESULT after countdown", () => {
  const state = createState({ visibility: "PRIVATE", auto_rematch: true, max_players: 2 });
  prepareMatch(state, { startAt: "2026-03-08T00:01:00.000Z" });
  finishMatchToResult(state, "2026-03-08T00:02:00.000Z");

  const resultSnapshot = state.toSnapshot();
  assert.equal(resultSnapshot.auto_rematch_enabled, true);
  assert.equal(resultSnapshot.auto_rematch_cancelled, false);
  assert.notEqual(resultSnapshot.auto_rematch_due_at, null);

  const dueAtMs = Date.parse(resultSnapshot.auto_rematch_due_at ?? "");
  assert.equal(Number.isFinite(dueAtMs), true);
  assert.equal(state.expireAutoRematchIfNeeded(new Date(dueAtMs - 1_000)), null);

  const transition = state.expireAutoRematchIfNeeded(new Date(dueAtMs + 1));
  assert.ok(transition);
  assert.equal(transition.kind, "STARTED");
  assert.equal(state.getRoomState(), "PICKING");

  const restartedSnapshot = state.toSnapshot();
  assert.equal(restartedSnapshot.auto_rematch_due_at, null);
  assert.equal(restartedSnapshot.auto_rematch_cancelled, false);
});

test("opt-out cancels auto_rematch when remaining participants become less than two", () => {
  const state = createState({ visibility: "PRIVATE", auto_rematch: true, max_players: 2 });
  prepareMatch(state, { startAt: "2026-03-08T00:01:00.000Z" });
  finishMatchToResult(state, "2026-03-08T00:02:00.000Z");

  assert.deepEqual(state.optOutNextMatch("guest"), { ok: true });
  const snapshot = state.toSnapshot();
  assert.equal(snapshot.auto_rematch_cancelled, true);
  assert.equal(snapshot.auto_rematch_block_reason, "INSUFFICIENT_PLAYERS");
  assert.deepEqual(snapshot.next_match_opt_out_player_ids, ["guest"]);
  assert.equal(state.expireAutoRematchIfNeeded(new Date("2026-03-08T00:03:00.000Z")), null);
  assert.equal(state.getRoomState(), "RESULT");
});

test("SOURCE_STATUS unavailable during RESULT cancels auto_rematch", () => {
  const state = createState({ visibility: "PRIVATE", auto_rematch: true, max_players: 2 });
  prepareMatch(state, { startAt: "2026-03-08T00:01:00.000Z" });
  finishMatchToResult(state, "2026-03-08T00:02:00.000Z");

  assert.deepEqual(state.setPlayerSourceAvailability("guest", false), { ok: true, changed: true });
  const snapshot = state.toSnapshot();
  assert.equal(snapshot.auto_rematch_cancelled, true);
  assert.equal(snapshot.auto_rematch_block_reason, "SOURCE_UNAVAILABLE");
  assert.equal(state.expireAutoRematchIfNeeded(new Date("2026-03-08T00:03:00.000Z")), null);
  assert.equal(state.getRoomState(), "RESULT");
});

test("host can stop auto_rematch during RESULT", () => {
  const state = createState({ visibility: "PRIVATE", auto_rematch: true, max_players: 2 });
  prepareMatch(state, { startAt: "2026-03-08T00:01:00.000Z" });
  finishMatchToResult(state, "2026-03-08T00:02:00.000Z");

  assert.deepEqual(state.stopAutoRematch("guest"), { ok: false, reason: "NOT_HOST" });
  assert.deepEqual(state.stopAutoRematch("host"), { ok: true });
  const snapshot = state.toSnapshot();
  assert.equal(snapshot.auto_rematch_cancelled, true);
  assert.equal(snapshot.auto_rematch_block_reason, "AUTO_REMATCH_STOPPED");
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

test("reconnect is rejected after rejoin window expires", () => {
  const state = createState();
  state.leavePlayer("host", new Date("2026-03-08T00:05:00.000Z"), "HOST_DISCONNECTED");

  const joinResult = state.joinPlayer({
    player_id: "host",
    display_name: "Host",
    source: "inf-notebook",
    now: new Date("2026-03-08T00:05:41.000Z"),
  });

  assert.deepEqual(joinResult, { ok: false, reason: "REJOIN_WINDOW_EXPIRED" });
});

test("markPlayerDisconnected keeps slot and allows reconnect within grace", () => {
  const state = createState();
  const disconnectedAt = new Date("2026-03-08T00:05:00.000Z");
  const disconnectResult = state.markPlayerDisconnected("guest", disconnectedAt);

  assert.deepEqual(disconnectResult, { changed: true, was_host: false, room_was_closed: false });

  const disconnectedGuest = state.toSnapshot().players.find((player) => player.player_id === "guest");
  assert.ok(disconnectedGuest);
  assert.equal(disconnectedGuest.connected, false);
  assert.notEqual(disconnectedGuest.left_at, null);
  assert.notEqual(disconnectedGuest.rejoin_until, null);

  const reconnectResult = state.joinPlayer({
    player_id: "guest",
    display_name: "Guest",
    source: "inf_daken_counter",
    now: new Date("2026-03-08T00:05:05.000Z"),
  });
  assert.deepEqual(reconnectResult, { ok: true, join_type: "RECONNECT" });

  const reconnectedGuest = state.toSnapshot().players.find((player) => player.player_id === "guest");
  assert.ok(reconnectedGuest);
  assert.equal(reconnectedGuest.connected, true);
  assert.equal(reconnectedGuest.left_at, null);
  assert.equal(reconnectedGuest.rejoin_until, null);
});

test("HOST_DISCONNECTED closes room when cooldown expires", () => {
  const state = createState();
  const disconnectedAt = new Date("2026-03-08T00:05:00.000Z");
  state.leavePlayer("host", disconnectedAt, "HOST_DISCONNECTED");

  assert.equal(state.closeHostDisconnectIfExpired(new Date("2026-03-08T00:05:41.000Z")), true);

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.room_state, "CLOSED");
  assert.equal(snapshot.close_reason, "HOST_DISCONNECTED");
  assert.equal(state.getNextAlarmAt(), null);
});

test("recreateAsLastHost increments generation and resets to empty LOBBY", () => {
  const state = createState();
  state.close("MATCH_TTL_EXPIRED", new Date("2026-03-08T00:20:00.000Z"));

  const recreateResult = state.recreateAsLastHost(
    "host",
    new Date("2026-03-08T00:30:00.000Z"),
    30 * 60_000,
  );
  assert.deepEqual(recreateResult, { ok: true, generation: 2 });
  assert.equal(state.getGeneration(), 2);
  assert.equal(state.getRoomState(), "LOBBY");

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.generation, 2);
  assert.equal(snapshot.room_state, "LOBBY");
  assert.equal(snapshot.players.length, 0);
  assert.equal(snapshot.close_reason, null);
  assert.equal(snapshot.closed_at, null);
});

test("recreateAsLastHost rejects when active generation exists", () => {
  const state = createState();
  const recreateResult = state.recreateAsLastHost("host", new Date("2026-03-08T00:10:00.000Z"), 30 * 60_000);
  assert.deepEqual(recreateResult, { ok: false, reason: "ACTIVE_GENERATION_EXISTS" });
  assert.equal(state.getGeneration(), 1);
});

test("recreateAsLastHost rejects after recreate window expires", () => {
  const state = createState();
  state.close("READY_CHECK_TTL_EXPIRED", new Date("2026-03-08T00:20:00.000Z"));
  const recreateResult = state.recreateAsLastHost(
    "host",
    new Date("2026-03-08T00:50:01.000Z"),
    30 * 60_000,
  );
  assert.deepEqual(recreateResult, { ok: false, reason: "RECREATE_WINDOW_EXPIRED" });
  assert.equal(state.getGeneration(), 1);
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

test("BPL(3) always plays 3 stages before entering RESULT", () => {
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

test("BPL(3) freezes two picks plus one random stage", () => {
  const state = createState({ mode: "BPL", max_players: 2 });
  prepareMatch(state, {
    hostPick: "chart-1",
    guestPick: "chart-2",
  });

  const snapshot = state.toSnapshot();
  const titles = snapshot.frozen_rounds.map((round) => round.display.title);
  assert.equal(snapshot.frozen_rounds.length, 3);
  assert.deepEqual(titles.slice(0, 2), ["Chart One", "Chart Two"]);
  assert.equal(new Set(titles).size, 3);
  assert.equal(["Chart Three", "Chart Four"].includes(titles[2] ?? ""), true);
});

test("BPL4 always plays 4 stages before entering RESULT", () => {
  const state = createState({ mode: "BPL4", max_players: 2 });
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");
  assert.equal(state.getRoomState(), "PLAYING");
  assert.equal(state.toSnapshot().current_round?.round_index, 2);

  playCurrentRound(state, 2, 2400, 2300, "2026-03-08T00:04");
  assert.equal(state.getRoomState(), "PLAYING");
  assert.equal(state.toSnapshot().current_round?.round_index, 3);
  playCurrentRound(state, 3, 2500, 2400, "2026-03-08T00:05");

  const summary = getResultSummary(state);
  assert.equal(state.getRoomState(), "RESULT");
  assert.equal(summary.is_rated, true);
  assert.equal(summary.rated_block_reason, null);
  assert.deepEqual(summary.winner_player_ids, ["host"]);
});

test("BPL4 freezes four stages from player picks in accepted order", () => {
  const state = createState({ mode: "BPL4", max_players: 2 });
  prepareMatch(state, {
    hostPick: "chart-1",
    guestPick: "chart-2",
    hostSecondPick: "chart-3",
    guestSecondPick: "chart-4",
  });

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.frozen_rounds.length, 4);
  assert.deepEqual(
    snapshot.frozen_rounds.map((round) => round.display.title),
    ["Chart One", "Chart Two", "Chart Three", "Chart Four"],
  );
});

test("BPL4 allows two picks per player and rejects a third pick", () => {
  const state = createState({ mode: "BPL4", max_players: 2 });
  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:01:00.000Z")), { ok: true });

  assert.equal(state.submitPick("host", "chart-1", new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.equal(state.submitPick("guest", "chart-2", new Date("2026-03-08T00:01:11.000Z")).ok, true);
  assert.equal(state.submitPick("host", "chart-3", new Date("2026-03-08T00:01:12.000Z")).ok, true);
  assert.deepEqual(
    state.submitPick("host", "chart-4", new Date("2026-03-08T00:01:13.000Z")),
    { ok: false, reason: "PLAYER_ALREADY_PICKED" },
  );
  assert.equal(state.submitPick("guest", "chart-4", new Date("2026-03-08T00:01:14.000Z")).ok, true);
  assert.equal(state.getRoomState(), "PLAYING");
});

test("conflicting final result blocks rating", () => {
  const state = createState({ mode: "BPL4", max_players: 2 });
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2000, 2300, "2026-03-08T00:03");
  playCurrentRound(state, 2, 2100, 2100, "2026-03-08T00:04");
  playCurrentRound(state, 3, 2200, 2200, "2026-03-08T00:05");

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

test("RESULT_READY summary uses server-authoritative match_id and rematch rotates it", () => {
  const state = createState();
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  const firstSummary = getResultSummary(state);
  assert.notEqual(firstSummary.match_id, "room-1");

  assert.deepEqual(state.returnToLobby("host", new Date("2026-03-08T00:04:00.000Z")), { ok: true });
  assert.equal(state.setPlayerReady("host", true).ok, true);
  assert.equal(state.setPlayerReady("guest", true).ok, true);
  assert.deepEqual(state.startMatch("host", new Date("2026-03-08T00:05:00.000Z")), { ok: true });
  assert.equal(state.submitPick("host", "chart-1", new Date("2026-03-08T00:05:10.000Z")).ok, true);
  assert.equal(state.submitPick("guest", "chart-2", new Date("2026-03-08T00:05:11.000Z")).ok, true);

  playCurrentRound(state, 0, 2400, 2300, "2026-03-08T00:06");
  playCurrentRound(state, 1, 2500, 2400, "2026-03-08T00:07");

  const secondSummary = getResultSummary(state);
  assert.notEqual(secondSummary.match_id, firstSummary.match_id);
});

test("hydrate legacy RESULT_READY payload without match_id falls back to room_id", () => {
  const state = createState();
  prepareMatch(state);

  playCurrentRound(state, 0, 2200, 2100, "2026-03-08T00:02");
  playCurrentRound(state, 1, 2300, 2000, "2026-03-08T00:03");

  const record = state.toPersistenceRecord();
  const legacyRecord = JSON.parse(JSON.stringify(record));
  delete legacyRecord.current_match_id;
  delete legacyRecord.result_ready_payload.summary.match_id;

  const restored = new RoomLobbyState(createChartMaster());
  restored.hydrate(legacyRecord);

  const restoredSummary = getResultSummary(restored);
  assert.equal(restoredSummary.match_id, "room-1");
});
