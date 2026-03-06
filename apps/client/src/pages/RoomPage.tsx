import {
  CHART_DIFFICULTIES,
  CHART_SEARCH_PAGE_SIZE,
  HOST_SKIP_UNLOCK_SECONDS,
  ROUND_MUSIC_SELECT_SECONDS,
  ROUND_PLAY_BEGIN_AT_SECONDS,
  SKIP_REASONS,
  type ChartSearchEntry,
  type CurrentRoundSnapshot,
  type ResultReadyPayload,
} from "@infinitas/shared";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { DebugInjectionPanel } from "../components/DebugInjectionPanel";
import { useLocalResultArchiveStore } from "../services/result-archive";
import { listCharts } from "../services/worker-api-client";
import { useVoicePlaybackStore } from "../services/voice-announcer";
import { roomStore, useRoomStore } from "../stores/room-store";
import { useSettingsStore } from "../stores/settings-store";
import { formatDateTime, stringifyJson } from "../utils/format";

function formatExpectedKey(
  expectedKey:
    | {
        play_style: string;
        difficulty: string;
        title_search_key: string;
      }
    | null
    | undefined,
): string {
  if (!expectedKey) {
    return "-";
  }

  return `${expectedKey.play_style} / ${expectedKey.difficulty} / ${expectedKey.title_search_key}`;
}

function getArchiveTone(status: string): string {
  if (status === "READY") {
    return "ok";
  }
  if (status === "ERROR") {
    return "danger";
  }

  return "warning";
}

function getVoiceTone(phase: string): string {
  if (phase === "UNAVAILABLE") {
    return "danger";
  }
  if (phase === "DISABLED") {
    return "warning";
  }

  return phase === "IDLE" ? "warning" : "ok";
}

function getIsoTimeMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getRemainingSeconds(targetAtMs: number | null, nowMs: number): number | null {
  if (targetAtMs === null) {
    return null;
  }

  return Math.max(0, Math.ceil((targetAtMs - nowMs) / 1_000));
}

function getPlayingCountdown(round: CurrentRoundSnapshot, nowMs: number): {
  label: string;
  remainingSeconds: number;
  detail: string;
} | null {
  const startedAtMs = getIsoTimeMs(round.round_started_at);
  if (startedAtMs === null) {
    return null;
  }

  const musicSelectEndsAtMs = startedAtMs + ROUND_MUSIC_SELECT_SECONDS * 1_000;
  const playBeginAtMs = startedAtMs + ROUND_PLAY_BEGIN_AT_SECONDS * 1_000;
  const playDeadlineAtMs = playBeginAtMs + round.soft_ttl_seconds * 1_000;

  if (nowMs < musicSelectEndsAtMs) {
    return {
      label: "MUSIC SELECT",
      remainingSeconds: getRemainingSeconds(musicSelectEndsAtMs, nowMs) ?? 0,
      detail: "Chart select window.",
    };
  }

  if (nowMs < playBeginAtMs) {
    return {
      label: "PLAY START",
      remainingSeconds: getRemainingSeconds(playBeginAtMs, nowMs) ?? 0,
      detail: "Start buffer before gameplay begins.",
    };
  }

  return {
    label: "IN PLAY",
    remainingSeconds: getRemainingSeconds(playDeadlineAtMs, nowMs) ?? 0,
    detail: "Soft TTL remaining after Let's go.",
  };
}

function ResultSummaryView({ resultReady }: { resultReady: ResultReadyPayload | null }) {
  if (resultReady === null) {
    return <p className="empty-state">Awaiting RESULT_READY payload.</p>;
  }

  return (
    <div className="split-panel result-grid">
      <section>
        <h3>Summary</h3>
        <pre>{stringifyJson(resultReady.summary)}</pre>
      </section>
      <section>
        <h3>Per player</h3>
        <pre>{stringifyJson(resultReady.per_player)}</pre>
      </section>
      <section className="full-span">
        <h3>Per round</h3>
        <pre>{stringifyJson(resultReady.per_round)}</pre>
      </section>
    </div>
  );
}

export function RoomPage() {
  const snapshot = useRoomStore((state) => state.snapshot);
  const resultReady = useRoomStore((state) => state.resultReady);
  const connectionStatus = useRoomStore((state) => state.connectionStatus);
  const connectionDetail = useRoomStore((state) => state.connectionDetail);
  const eventLog = useRoomStore((state) => state.eventLog);
  const savedSettings = useSettingsStore((state) => state.saved);
  const archiveStatus = useLocalResultArchiveStore((state) => state.status);
  const archiveStorage = useLocalResultArchiveStore((state) => state.storage);
  const archivePath = useLocalResultArchiveStore((state) => state.filePath);
  const archiveStorageKey = useLocalResultArchiveStore((state) => state.storageKey);
  const archiveLastSavedAt = useLocalResultArchiveStore((state) => state.lastSavedAt);
  const archiveSaveCount = useLocalResultArchiveStore((state) => state.saveCount);
  const archiveLastError = useLocalResultArchiveStore((state) => state.lastError);
  const archiveLatest = useLocalResultArchiveStore((state) => state.latestArchive);
  const voicePhase = useVoicePlaybackStore((state) => state.phase);
  const voiceDetail = useVoicePlaybackStore((state) => state.detail);
  const voiceLastUpdatedAt = useVoicePlaybackStore((state) => state.lastUpdatedAt);
  const voicePendingCues = useVoicePlaybackStore((state) => state.pendingCues);

  const [pickChartKey, setPickChartKey] = useState("");
  const [metricValue, setMetricValue] = useState("0");
  const [selfSkipReason, setSelfSkipReason] = useState<(typeof SKIP_REASONS)[number]>("TECH");
  const [hostSkipReason, setHostSkipReason] = useState<(typeof SKIP_REASONS)[number]>("UNOWNED");
  const [chartDifficulty, setChartDifficulty] = useState<(typeof CHART_DIFFICULTIES)[number] | "">("");
  const [chartLevel, setChartLevel] = useState("");
  const [chartKeyword, setChartKeyword] = useState("");
  const deferredChartKeyword = useDeferredValue(chartKeyword);
  const [chartResults, setChartResults] = useState<ChartSearchEntry[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartCursor, setChartCursor] = useState<string | null>(null);
  const [chartNextCursor, setChartNextCursor] = useState<string | null>(null);
  const [chartPreviousCursors, setChartPreviousCursors] = useState<Array<string | null>>([]);
  const [chartLastLoadedAt, setChartLastLoadedAt] = useState<string | null>(null);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const chartRequestIdRef = useRef(0);

  async function loadChartCandidates(targetCursor: string | null, historyMode: "reset" | "next" | "previous"): Promise<void> {
    if (snapshot === null || snapshot.room_state !== "PICKING") {
      return;
    }

    const trimmedLevel = chartLevel.trim();
    const parsedLevel = trimmedLevel.length === 0 ? undefined : Number(trimmedLevel);
    if (
      parsedLevel !== undefined &&
      (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 12)
    ) {
      chartRequestIdRef.current += 1;
      setChartLoading(false);
      setChartError("Level search must be between 1 and 12.");
      setChartResults([]);
      setChartCursor(null);
      setChartNextCursor(null);
      setChartPreviousCursors([]);
      setChartLastLoadedAt(null);
      return;
    }

    const requestId = chartRequestIdRef.current + 1;
    chartRequestIdRef.current = requestId;
    setChartLoading(true);
    setChartError(null);

    try {
      const response = await listCharts(savedSettings.apiBaseUrl, {
        play_style: snapshot.settings.play_style,
        level_filter: snapshot.settings.level_filter,
        ...(chartDifficulty === "" ? {} : { difficulty: chartDifficulty }),
        ...(parsedLevel === undefined ? {} : { level: parsedLevel }),
        ...(deferredChartKeyword.trim().length === 0 ? {} : { keyword: deferredChartKeyword.trim() }),
        ...(targetCursor === null ? {} : { cursor: targetCursor }),
        limit: CHART_SEARCH_PAGE_SIZE,
      });
      if (chartRequestIdRef.current !== requestId) {
        return;
      }

      setChartResults(response.charts);
      setChartCursor(targetCursor);
      setChartNextCursor(response.next_cursor);
      setChartLastLoadedAt(new Date().toISOString());
      setChartPreviousCursors((current) => {
        if (historyMode === "reset") {
          return [];
        }
        if (historyMode === "next") {
          return [...current, chartCursor];
        }

        return current.slice(0, -1);
      });
    } catch (error) {
      if (chartRequestIdRef.current !== requestId) {
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to load chart candidates.";
      setChartError(message);
      if (historyMode === "reset") {
        setChartResults([]);
        setChartCursor(null);
        setChartNextCursor(null);
        setChartPreviousCursors([]);
        setChartLastLoadedAt(null);
      }
    } finally {
      if (chartRequestIdRef.current === requestId) {
        setChartLoading(false);
      }
    }
  }

  useEffect(() => {
    if (snapshot?.room_state !== "PICKING") {
      chartRequestIdRef.current += 1;
      setChartLoading(false);
      setChartError(null);
      setChartResults([]);
      setChartCursor(null);
      setChartNextCursor(null);
      setChartPreviousCursors([]);
      setChartLastLoadedAt(null);
      return;
    }

    const trimmedLevel = chartLevel.trim();
    if (trimmedLevel.length > 0) {
      const parsedLevel = Number(trimmedLevel);
      if (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 12) {
        chartRequestIdRef.current += 1;
        setChartLoading(false);
        setChartError("Level search must be between 1 and 12.");
        setChartResults([]);
        setChartCursor(null);
        setChartNextCursor(null);
        setChartPreviousCursors([]);
        setChartLastLoadedAt(null);
        return;
      }
    }

    void loadChartCandidates(null, "reset");
  }, [
    chartDifficulty,
    chartLevel,
    deferredChartKeyword,
    savedSettings.apiBaseUrl,
    snapshot?.room_id,
    snapshot?.room_state,
    snapshot?.settings.level_filter,
    snapshot?.settings.play_style,
  ]);

  useEffect(() => {
    if (snapshot?.room_state !== "PICKING" && snapshot?.room_state !== "PLAYING") {
      setClockNowMs(Date.now());
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 1_000);

    setClockNowMs(Date.now());
    return () => {
      window.clearInterval(intervalId);
    };
  }, [snapshot?.room_state, snapshot?.current_round?.round_started_at, snapshot?.timers.picking_deadline]);

  if (snapshot === null) {
    return (
      <section className="page-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Room</p>
              <h2>No active room</h2>
            </div>
            <span className={`status-pill ${connectionStatus === "ERROR" ? "danger" : "warning"}`}>
              {connectionStatus}
            </span>
          </div>
          <p>{connectionDetail}</p>
        </article>
      </section>
    );
  }

  const me = snapshot.players.find((player) => player.player_id === savedSettings.playerId) ?? null;
  const isHost = snapshot.host_player_id === savedSettings.playerId || me?.role === "HOST";
  const currentRound = snapshot.current_round;
  const confirmedPlayers = new Set(currentRound?.confirmed.map((entry) => entry.player_id) ?? []);
  const pendingPlayers = currentRound
    ? snapshot.players.filter((player) => !confirmedPlayers.has(player.player_id))
    : [];
  const readyPlayersCount = snapshot.players.filter((player) => player.ready).length;
  const allPlayersReady = snapshot.players.length >= 2 && snapshot.players.every((player) => player.ready);
  const mySubmittedPick = snapshot.picks.find((pick) => pick.player_id === savedSettings.playerId) ?? null;
  const currentRoundDisplay =
    currentRound === null ? null : snapshot.frozen_rounds.find((round) => round.round_index === currentRound.round_index) ?? null;
  const pickingCountdown = getRemainingSeconds(getIsoTimeMs(snapshot.timers.picking_deadline), clockNowMs);
  const playingCountdown = currentRound === null ? null : getPlayingCountdown(currentRound, clockNowMs);

  return (
    <section className="page-grid room-grid">
      <article className="panel room-summary-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Room</p>
            <h2>{snapshot.room_state}</h2>
          </div>
          <div className="button-row">
            <span className={`status-pill ${isHost ? "warning" : "ok"}`}>{isHost ? "HOST" : "GUEST"}</span>
            <button type="button" className="secondary-button" onClick={() => roomStore.leaveRoom()}>
              Leave room
            </button>
          </div>
        </div>

        <div className="meta-grid">
          <div>
            <span className="meta-label">Room ID</span>
            <strong>{snapshot.room_id}</strong>
          </div>
          <div>
            <span className="meta-label">Join code</span>
            <strong>{snapshot.settings.join_code ?? "-"}</strong>
          </div>
          <div>
            <span className="meta-label">Mode</span>
            <strong>{snapshot.settings.mode}</strong>
          </div>
          <div>
            <span className="meta-label">Metric</span>
            <strong>{snapshot.settings.win_metric}</strong>
          </div>
          <div>
            <span className="meta-label">Play style</span>
            <strong>{snapshot.settings.play_style}</strong>
          </div>
          <div>
            <span className="meta-label">Level filter</span>
            <strong>{snapshot.settings.level_filter}</strong>
          </div>
          <div>
            <span className="meta-label">Players</span>
            <strong>
              {snapshot.players.length} / {snapshot.settings.max_players}
            </strong>
          </div>
          <div>
            <span className="meta-label">Comment</span>
            <strong>{snapshot.settings.room_comment || "-"}</strong>
          </div>
          <div>
            <span className="meta-label">Ready deadline</span>
            <strong>{formatDateTime(snapshot.timers.ready_check_deadline)}</strong>
          </div>
          <div>
            <span className="meta-label">Match deadline</span>
            <strong>{formatDateTime(snapshot.timers.match_deadline)}</strong>
          </div>
          <div>
            <span className="meta-label">Picking deadline</span>
            <strong>{formatDateTime(snapshot.timers.picking_deadline)}</strong>
          </div>
          <div>
            <span className="meta-label">Connection</span>
            <strong>{connectionStatus}</strong>
          </div>
        </div>

        {snapshot.timers.result_deadline ? (
          <p className="status-muted">Result deadline: {formatDateTime(snapshot.timers.result_deadline)}</p>
        ) : null}

        <div className="player-list">
          {snapshot.players.map((player) => (
            <article key={player.player_id} className={`player-card ${player.player_id === snapshot.host_player_id ? "host" : ""}`}>
              <div className="player-heading">
                <strong>{player.display_name}</strong>
                <span>{player.role ?? (player.player_id === snapshot.host_player_id ? "HOST" : "GUEST")}</span>
              </div>
              <dl>
                <div>
                  <dt>ID</dt>
                  <dd>{player.player_id}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{player.source}</dd>
                </div>
                <div>
                  <dt>Connected</dt>
                  <dd>{player.connected ? "YES" : "NO"}</dd>
                </div>
                <div>
                  <dt>Ready</dt>
                  <dd>{player.ready ? "YES" : "NO"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2>Voice and local archive</h2>
          </div>
        </div>

        <div className="split-panel">
          <section className="status-stack support-card">
            <div className="inline-field">
              <span className="status-label">Voice playback</span>
              <span className={`status-pill ${getVoiceTone(voicePhase)}`}>{voicePhase}</span>
            </div>
            <strong>{savedSettings.voiceEnabled ? "Voice enabled" : "Voice disabled"}</strong>
            <span className="status-muted">{voiceDetail}</span>
            <span className="status-muted">Pending cues: {voicePendingCues}</span>
            <span className="status-muted">Updated: {formatDateTime(voiceLastUpdatedAt)}</span>
          </section>

          <section className="status-stack support-card">
            <div className="inline-field">
              <span className="status-label">Local archive</span>
              <span className={`status-pill ${getArchiveTone(archiveStatus)}`}>{archiveStatus}</span>
            </div>
            <strong>
              {archiveStorage === "TAURI_FILE"
                ? "JSON file output"
                : archiveStorage === "LOCAL_STORAGE"
                  ? "localStorage fallback"
                  : "Awaiting first save"}
            </strong>
            <span className="status-muted">Entries saved: {archiveSaveCount}</span>
            <span className="status-muted">Last saved: {formatDateTime(archiveLastSavedAt)}</span>
            <span className="status-muted">
              Latest snapshot state: {archiveLatest?.latest_snapshot.room_state ?? "-"}
            </span>
            {archivePath ? <code className="path-chip">{archivePath}</code> : null}
            {!archivePath && archiveStorageKey ? <code className="path-chip">{archiveStorageKey}</code> : null}
            {archiveLastError ? <p className="inline-error">{archiveLastError}</p> : null}
          </section>
        </div>
      </article>

      {snapshot.room_state === "LOBBY" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Lobby</p>
              <h2>Gather players</h2>
            </div>
          </div>
          <p>Share the room ID and join code, then move to READY_CHECK once everyone is in.</p>
          <div className="button-row">
            {isHost ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  roomStore.send("READY_CHECK_OPEN", {});
                }}
              >
                Open READY_CHECK
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={() => roomStore.leaveRoom()}>
              Leave
            </button>
          </div>
        </article>
      ) : null}

      {snapshot.room_state === "READY_CHECK" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">READY_CHECK</p>
              <h2>Confirm entrants</h2>
            </div>
          </div>
          <p>
            {readyPlayersCount} / {snapshot.players.length} players are READY. START_MATCH requires at least two
            players and every current entrant to be READY.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                roomStore.send("READY_SET", {
                  ready: !(me?.ready ?? false),
                });
              }}
            >
              {me?.ready ? "Unset ready" : "Set ready"}
            </button>
            {isHost ? (
              <button
                type="button"
                className="primary-button"
                disabled={!allPlayersReady}
                onClick={() => {
                  roomStore.send("START_MATCH", {});
                }}
              >
                Start match
              </button>
            ) : null}
          </div>
        </article>
      ) : null}

      {snapshot.room_state === "PICKING" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">PICKING</p>
              <h2>Select a chart</h2>
            </div>
          </div>

          <div className="split-panel">
            <section>
              <div className="form-grid">
                <label className="field full-width">
                  <span>pick_chart_key</span>
                  <input
                    type="text"
                    value={pickChartKey}
                    onChange={(event) => {
                      setPickChartKey(event.currentTarget.value);
                    }}
                    placeholder="SP::ANOTHER::title_search_key"
                  />
                </label>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  disabled={pickChartKey.trim().length === 0 || mySubmittedPick !== null}
                  onClick={() => {
                    if (
                      roomStore.send("PICK_SUBMIT", {
                        pick_chart_key: pickChartKey.trim(),
                      })
                    ) {
                      setPickChartKey("");
                    }
                  }}
                >
                  Submit pick
                </button>
              </div>
            </section>

            <section className="status-stack support-card">
              <strong>Room preset filter</strong>
              <span className="status-pill warning">
                {pickingCountdown === null ? "PICKING" : `AUTO PICK:${pickingCountdown}`}
              </span>
              <span className="status-muted">Play style: {snapshot.settings.play_style}</span>
              <span className="status-muted">Level filter: {snapshot.settings.level_filter}</span>
              <span className="status-muted">Timeout auto-picks missing charts after 120 seconds.</span>
              <span className="status-muted">
                {mySubmittedPick === null
                  ? "You can submit one chart from the list below."
                  : `Submitted: ${mySubmittedPick.pick_chart_key}`}
              </span>
            </section>
          </div>

          <div className="filter-grid">
            <label className="field">
              <span>Difficulty</span>
              <select
                value={chartDifficulty}
                onChange={(event) => {
                  setChartDifficulty(event.currentTarget.value as (typeof CHART_DIFFICULTIES)[number] | "");
                }}
              >
                <option value="">ALL</option>
                {CHART_DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Level</span>
              <input
                type="number"
                min={1}
                max={12}
                value={chartLevel}
                onChange={(event) => {
                  setChartLevel(event.currentTarget.value);
                }}
                placeholder="Exact level"
              />
            </label>

            <label className="field full-width">
              <span>Keyword</span>
              <input
                type="text"
                value={chartKeyword}
                onChange={(event) => {
                  setChartKeyword(event.currentTarget.value);
                }}
                placeholder="Search by title qualifier / artist / genre"
              />
            </label>
          </div>

          {chartError ? <p className="inline-error">{chartError}</p> : null}

          <div className="table-wrapper">
            <table className="room-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Artist</th>
                  <th>Genre</th>
                  <th>Diff</th>
                  <th>Lv</th>
                  <th>Key</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {chartResults.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">{chartLoading ? "Loading charts..." : "No charts found."}</div>
                    </td>
                  </tr>
                ) : (
                  chartResults.map((chart) => (
                    <tr key={chart.chart_key}>
                      <td>{chart.title}</td>
                      <td>{chart.artist || "-"}</td>
                      <td>{chart.genre || "-"}</td>
                      <td>{chart.difficulty}</td>
                      <td>{chart.level}</td>
                      <td>
                        <code>{chart.chart_key}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button small"
                          disabled={mySubmittedPick !== null}
                          onClick={() => {
                            setPickChartKey(chart.chart_key);
                            roomStore.send("PICK_SUBMIT", {
                              pick_chart_key: chart.chart_key,
                            });
                          }}
                        >
                          Pick
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel-footer">
            <div className="meta-strip">
              <span>Last loaded: {formatDateTime(chartLastLoadedAt)}</span>
              <span>{chartResults.length} chart(s)</span>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={chartPreviousCursors.length === 0 || chartLoading}
                onClick={() => {
                  const previousCursor = chartPreviousCursors[chartPreviousCursors.length - 1] ?? null;
                  void loadChartCandidates(previousCursor, "previous");
                }}
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={chartNextCursor === null || chartLoading}
                onClick={() => {
                  if (chartNextCursor === null) {
                    return;
                  }

                  void loadChartCandidates(chartNextCursor, "next");
                }}
              >
                Next
              </button>
            </div>
          </div>

          <div className="split-panel">
            <section>
              <h3>Picks</h3>
              {snapshot.picks.length === 0 ? (
                <p className="empty-state">No picks submitted yet.</p>
              ) : (
                <ul className="plain-list">
                  {snapshot.picks.map((pick) => (
                    <li key={`${pick.player_id}-${pick.pick_chart_key}`}>
                      {pick.player_id}: {pick.pick_chart_key}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3>Frozen rounds</h3>
              {snapshot.frozen_rounds.length === 0 ? (
                <p className="empty-state">Awaiting freeze.</p>
              ) : (
                <ul className="plain-list">
                  {snapshot.frozen_rounds.map((round) => (
                    <li key={round.round_index}>
                      #{round.round_index + 1}: {round.display.title} / {formatExpectedKey(round.expected_key)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </article>
      ) : null}

      {snapshot.room_state === "PLAYING" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">PLAYING</p>
              <h2>Current round</h2>
            </div>
          </div>

          {currentRound ? (
            <>
              <div className="meta-grid compact">
                <div>
                  <span className="meta-label">Round</span>
                  <strong>{currentRound.round_index + 1}</strong>
                </div>
                <div>
                  <span className="meta-label">Title</span>
                  <strong>{currentRoundDisplay?.display.title ?? currentRound.expected_key.title_search_key}</strong>
                </div>
                <div>
                  <span className="meta-label">Expected</span>
                  <strong>{formatExpectedKey(currentRound.expected_key)}</strong>
                </div>
                <div>
                  <span className="meta-label">Level</span>
                  <strong>{currentRoundDisplay?.display.level ?? "-"}</strong>
                </div>
                <div>
                  <span className="meta-label">Started</span>
                  <strong>{formatDateTime(currentRound.round_started_at)}</strong>
                </div>
                <div>
                  <span className="meta-label">Soft TTL</span>
                  <strong>{currentRound.soft_ttl_seconds}s</strong>
                </div>
                <div>
                  <span className="meta-label">Timeline</span>
                  <strong>
                    {playingCountdown === null
                      ? "-"
                      : `${playingCountdown.label}:${playingCountdown.remainingSeconds}`}
                  </strong>
                </div>
              </div>

              <section className="status-stack support-card">
                <strong>
                  {playingCountdown === null
                    ? "Timeline unavailable"
                    : `${playingCountdown.label}:${playingCountdown.remainingSeconds}`}
                </strong>
                <span className="status-muted">
                  {playingCountdown?.detail ?? "Countdown becomes available after ROUND_BEGIN."}
                </span>
                <span className="status-muted">
                  MUSIC SELECT runs for {ROUND_MUSIC_SELECT_SECONDS}s, then PLAY START until {ROUND_PLAY_BEGIN_AT_SECONDS}s.
                </span>
              </section>

              <div className="split-panel">
                <section>
                  <h3>Manual result submit</h3>
                  <label className="field">
                    <span>Metric value</span>
                    <input
                      type="number"
                      min={0}
                      value={metricValue}
                      onChange={(event) => {
                        setMetricValue(event.currentTarget.value);
                      }}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        const parsedMetricValue = Number(metricValue);
                        if (!Number.isInteger(parsedMetricValue) || parsedMetricValue < 0) {
                          return;
                        }

                        roomStore.send("RESULT_SUBMIT", {
                          round_index: currentRound.round_index,
                          observed_key: currentRound.expected_key,
                          metric_value: parsedMetricValue,
                        });
                      }}
                    >
                      Submit RESULT_SUBMIT
                    </button>
                  </div>
                </section>

                <section>
                  <h3>Skip controls</h3>
                  <label className="field">
                    <span>Self skip reason</span>
                    <select
                      value={selfSkipReason}
                      onChange={(event) => {
                        setSelfSkipReason(event.currentTarget.value as (typeof SKIP_REASONS)[number]);
                      }}
                    >
                      {SKIP_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        roomStore.skipSelf(currentRound.round_index, selfSkipReason);
                      }}
                    >
                      SKIP_SELF
                    </button>
                    {isHost ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          roomStore.send("FORCE_ADVANCE", {});
                        }}
                      >
                        FORCE_ADVANCE
                      </button>
                    ) : null}
                  </div>
                  <p className="status-muted">
                    Host proxy skip unlock target: {HOST_SKIP_UNLOCK_SECONDS}s after ROUND_BEGIN.
                  </p>
                </section>
              </div>

              <DebugInjectionPanel />

              <section className="panel-subsection">
                <h3>Confirmed players</h3>
                {currentRound.confirmed.length === 0 ? (
                  <p className="empty-state">No player has confirmed yet.</p>
                ) : (
                  <ul className="plain-list">
                    {currentRound.confirmed.map((confirmed) => (
                      <li key={confirmed.player_id}>
                        {confirmed.player_id}: {confirmed.status} / {confirmed.metric_value} / {confirmed.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {isHost ? (
                <section className="panel-subsection">
                  <h3>Host proxy skip</h3>
                  <label className="field">
                    <span>Proxy reason</span>
                    <select
                      value={hostSkipReason}
                      onChange={(event) => {
                        setHostSkipReason(event.currentTarget.value as (typeof SKIP_REASONS)[number]);
                      }}
                    >
                      {SKIP_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>

                  {pendingPlayers.length === 0 ? (
                    <p className="empty-state">No pending players.</p>
                  ) : (
                    <div className="pending-grid">
                      {pendingPlayers.map((player) => (
                        <button
                          key={player.player_id}
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            roomStore.send("SKIP_HOST_ASSIGN", {
                              round_index: currentRound.round_index,
                              target_player_id: player.player_id,
                              reason: hostSkipReason,
                            });
                          }}
                        >
                          Skip {player.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
            </>
          ) : (
            <p className="empty-state">Current round snapshot is unavailable.</p>
          )}
        </article>
      ) : null}

      {snapshot.room_state === "RESULT" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">RESULT</p>
              <h2>Summary</h2>
            </div>
          </div>
          <ResultSummaryView resultReady={resultReady} />
        </article>
      ) : null}

      {snapshot.room_state === "CLOSED" ? (
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">CLOSED</p>
              <h2>Room closed</h2>
            </div>
          </div>
          <p>Reason: {snapshot.close_reason ?? "-"}</p>
          <p>Closed at: {formatDateTime(snapshot.closed_at)}</p>
          <ResultSummaryView resultReady={resultReady} />
          <div className="button-row">
            <button type="button" className="primary-button" onClick={() => roomStore.leaveRoom()}>
              Return to lobby
            </button>
          </div>
        </article>
      ) : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Events</p>
            <h2>Recent messages</h2>
          </div>
        </div>
        {eventLog.length === 0 ? (
          <p className="empty-state">No server events yet.</p>
        ) : (
          <ul className="plain-list">
            {eventLog.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
