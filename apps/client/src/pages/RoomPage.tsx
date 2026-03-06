import { HOST_SKIP_UNLOCK_SECONDS, SKIP_REASONS } from "@infinitas/shared";
import { useState } from "react";
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

export function RoomPage() {
  const snapshot = useRoomStore((state) => state.snapshot);
  const resultReady = useRoomStore((state) => state.resultReady);
  const connectionStatus = useRoomStore((state) => state.connectionStatus);
  const connectionDetail = useRoomStore((state) => state.connectionDetail);
  const eventLog = useRoomStore((state) => state.eventLog);
  const savedSettings = useSettingsStore((state) => state.saved);

  const [pickChartKey, setPickChartKey] = useState("");
  const [metricValue, setMetricValue] = useState("0");
  const [selfSkipReason, setSelfSkipReason] = useState<(typeof SKIP_REASONS)[number]>("TECH");
  const [hostSkipReason, setHostSkipReason] = useState<(typeof SKIP_REASONS)[number]>("UNOWNED");

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
            <span className="meta-label">Result deadline</span>
            <strong>{formatDateTime(snapshot.timers.result_deadline)}</strong>
          </div>
          <div>
            <span className="meta-label">Connection</span>
            <strong>{connectionStatus}</strong>
          </div>
        </div>

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
          <p>At least two connected players are required before START_MATCH.</p>
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
                disabled={snapshot.players.length < 2}
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
              <h2>Submit chart key</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field full-width">
              <span>pick_chart_key</span>
              <input
                type="text"
                value={pickChartKey}
                onChange={(event) => {
                  setPickChartKey(event.currentTarget.value);
                }}
                placeholder="song-id__SP_ANOTHER"
              />
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={pickChartKey.trim().length === 0}
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
                  <span className="meta-label">Expected</span>
                  <strong>{formatExpectedKey(currentRound.expected_key)}</strong>
                </div>
                <div>
                  <span className="meta-label">Started</span>
                  <strong>{formatDateTime(currentRound.round_started_at)}</strong>
                </div>
                <div>
                  <span className="meta-label">Soft TTL</span>
                  <strong>{currentRound.soft_ttl_seconds}s</strong>
                </div>
              </div>

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

          {resultReady ? (
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
          ) : (
            <p className="empty-state">Awaiting RESULT_READY payload.</p>
          )}
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
