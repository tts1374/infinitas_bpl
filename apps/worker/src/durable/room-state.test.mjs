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
      difficulty: "HYPER",
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
    buildChart("chart-bit", "chart-bit", "Chart Bit", 10, { inf_unlock_type: "bit" }),
    buildChart("chart-djp", "chart-djp", "Chart Djp", 10, { inf_unlock_type: "djp" }),
    buildChart("chart-pack-2", "chart-pack-2", "Chart Pack 2", 10, { inf_unlock_type: "pack", inf_pack_id: 2 }),
  ];
  const chartsByKey = new Map(charts.map((chart) => [chart.chart_key, chart]));

  const canUseByUnlockFilter = (chart, unlockFilter) => {
    if (!unlockFilter) {
      return true;
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

test("START_MATCH snapshot filter allows only shared unlock conditions", () => {
  const state = createState({}, {
    host: {
      bit_unlocked: true,
      djp_unlocked: false,
      owned_pack_ids: [2, 3],
    },
    guest: {
      bit_unlocked: true,
      djp_unlocked: true,
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
    common_pack_ids: [2],
  });

  assert.equal(state.submitPick("host", "chart-bit", new Date("2026-03-08T00:01:10.000Z")).ok, true);
  assert.deepEqual(
    state.submitPick("guest", "chart-djp", new Date("2026-03-08T00:01:11.000Z")),
    { ok: false, reason: "INVALID_PICK_CHART_KEY" },
  );
  assert.equal(state.submitPick("guest", "chart-pack-2", new Date("2026-03-08T00:01:12.000Z")).ok, true);
});

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

test("reconnect is rejected after rejoin window expires", () => {
  const state = createState();
  state.leavePlayer("host", new Date("2026-03-08T00:05:00.000Z"), "HOST_DISCONNECTED");

  const joinResult = state.joinPlayer({
    player_id: "host",
    display_name: "Host",
    source: "inf-notebook",
    now: new Date("2026-03-08T00:05:11.000Z"),
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

test("BPL random third stage level stays within first two picks range", () => {
  const state = createState({ mode: "BPL", max_players: 2 });
  prepareMatch(state, { hostPick: "chart-1", guestPick: "chart-2" });

  const snapshot = state.toSnapshot();
  assert.equal(snapshot.frozen_rounds.length, 3);

  const firstLevel = snapshot.frozen_rounds[0]?.display.level;
  const secondLevel = snapshot.frozen_rounds[1]?.display.level;
  const randomLevel = snapshot.frozen_rounds[2]?.display.level;

  assert.equal(typeof firstLevel, "number");
  assert.equal(typeof secondLevel, "number");
  assert.equal(typeof randomLevel, "number");

  const minLevel = Math.min(firstLevel, secondLevel);
  const maxLevel = Math.max(firstLevel, secondLevel);
  assert.ok(randomLevel >= minLevel && randomLevel <= maxLevel);
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
