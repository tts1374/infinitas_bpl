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

function createState() {
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
