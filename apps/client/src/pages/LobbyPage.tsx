import {
  LEVEL_FILTERS,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  VISIBILITIES,
  WIN_METRICS,
  type RoomSettings,
} from "@infinitas/shared";
import { startTransition, useEffect, useState } from "react";
import { createRoom } from "../services/worker-api-client";
import { lobbyStore, useLobbyStore } from "../stores/lobby-store";
import { roomStore, useRoomStore } from "../stores/room-store";
import { useSettingsStore } from "../stores/settings-store";
import { formatDateTime } from "../utils/format";

interface LobbyPageProps {
  onEnterRoom: () => void;
}

const defaultCreateDraft: RoomSettings = {
  visibility: "PUBLIC",
  join_code: null,
  mode: "ARENA",
  win_metric: "SCORE",
  play_style: "SP",
  level_filter: "ANY",
  room_comment: "",
  max_players: 2,
};

export function LobbyPage({ onEnterRoom }: LobbyPageProps) {
  const savedSettings = useSettingsStore((state) => state.saved);
  const rooms = useLobbyStore((state) => state.rooms);
  const filters = useLobbyStore((state) => state.filters);
  const loading = useLobbyStore((state) => state.loading);
  const errorMessage = useLobbyStore((state) => state.errorMessage);
  const nextCursor = useLobbyStore((state) => state.nextCursor);
  const previousCursors = useLobbyStore((state) => state.previousCursors);
  const lastLoadedAt = useLobbyStore((state) => state.lastLoadedAt);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);

  const [createDraft, setCreateDraft] = useState<RoomSettings>(defaultCreateDraft);
  const [manualRoomId, setManualRoomId] = useState("");
  const [manualJoinCode, setManualJoinCode] = useState("");
  const [busyAction, setBusyAction] = useState<"create" | "join" | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  useEffect(() => {
    void lobbyStore.refresh(savedSettings.apiBaseUrl);
  }, [savedSettings.apiBaseUrl]);

  async function enterRoom(roomId: string, joinCode?: string | null): Promise<void> {
    const connected = roomStore.connect(
      joinCode === undefined
        ? {
            roomId,
          }
        : {
            roomId,
            joinCode,
          },
      {
        apiBaseUrl: savedSettings.apiBaseUrl,
        playerId: savedSettings.playerId,
        displayName: savedSettings.displayName,
        source: savedSettings.source,
      },
    );

    if (connected) {
      startTransition(() => {
        onEnterRoom();
      });
    }
  }

  return (
    <section className="page-grid lobby-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Lobby</p>
            <h2>Public rooms</h2>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={() => {
                void lobbyStore.refresh(savedSettings.apiBaseUrl);
              }}
            >
              Refresh
            </button>
            <span className={`status-pill ${roomConnectionStatus === "DISCONNECTED" ? "ok" : "warning"}`}>
              {roomConnectionStatus}
            </span>
          </div>
        </div>

        <div className="filter-grid">
          <label className="field">
            <span>Mode</span>
            <select
              value={filters.mode}
              onChange={(event) => {
                lobbyStore.updateFilter("mode", event.currentTarget.value as (typeof MODES)[number] | "");
              }}
            >
              <option value="">ALL</option>
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Play style</span>
            <select
              value={filters.playStyle}
              onChange={(event) => {
                lobbyStore.updateFilter(
                  "playStyle",
                  event.currentTarget.value as (typeof PLAY_STYLES)[number] | "",
                );
              }}
            >
              <option value="">ALL</option>
              {PLAY_STYLES.map((playStyle) => (
                <option key={playStyle} value={playStyle}>
                  {playStyle}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Level</span>
            <select
              value={filters.levelFilter}
              onChange={(event) => {
                lobbyStore.updateFilter(
                  "levelFilter",
                  event.currentTarget.value as (typeof LEVEL_FILTERS)[number] | "",
                );
              }}
            >
              <option value="">ALL</option>
              {LEVEL_FILTERS.map((levelFilter) => (
                <option key={levelFilter} value={levelFilter}>
                  {levelFilter}
                </option>
              ))}
            </select>
          </label>

          <label className="field full-width">
            <span>Comment contains</span>
            <input
              type="text"
              value={filters.roomComment}
              onChange={(event) => {
                lobbyStore.updateFilter("roomComment", event.currentTarget.value);
              }}
              placeholder="Filter by room comment"
            />
          </label>
        </div>

        {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}

        <div className="table-wrapper">
          <table className="room-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Style</th>
                <th>Metric</th>
                <th>Level</th>
                <th>Players</th>
                <th>Comment</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">{loading ? "Loading lobby..." : "No rooms found."}</div>
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.room_id}>
                    <td>{room.mode}</td>
                    <td>{room.play_style}</td>
                    <td>{room.win_metric}</td>
                    <td>{room.level_filter}</td>
                    <td>{room.max_players}</td>
                    <td>{room.room_comment || "-"}</td>
                    <td>{formatDateTime(room.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button small"
                        disabled={busyAction !== null}
                        onClick={() => {
                          setBusyAction("join");
                          void enterRoom(room.room_id).finally(() => {
                            setBusyAction(null);
                          });
                        }}
                      >
                        Join
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
            <span>Last loaded: {formatDateTime(lastLoadedAt)}</span>
            <span>{rooms.length} room(s)</span>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              disabled={previousCursors.length === 0 || loading}
              onClick={() => {
                void lobbyStore.previousPage(savedSettings.apiBaseUrl);
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={nextCursor === null || loading}
              onClick={() => {
                void lobbyStore.nextPage(savedSettings.apiBaseUrl);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Join</p>
            <h2>Manual room entry</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Room ID</span>
            <input
              type="text"
              value={manualRoomId}
              onChange={(event) => {
                setManualRoomId(event.currentTarget.value);
              }}
              placeholder="room_id"
            />
          </label>

          <label className="field">
            <span>Join code</span>
            <input
              type="text"
              value={manualJoinCode}
              onChange={(event) => {
                setManualJoinCode(event.currentTarget.value);
              }}
              placeholder="Optional for PRIVATE"
            />
          </label>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="primary-button"
            disabled={busyAction !== null || manualRoomId.trim().length === 0}
            onClick={() => {
              setBusyAction("join");
              void enterRoom(manualRoomId.trim(), manualJoinCode.trim() || null).finally(() => {
                setBusyAction(null);
              });
            }}
          >
            Join room
          </button>
        </div>
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Create</p>
            <h2>New room</h2>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Visibility</span>
            <select
              value={createDraft.visibility}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  visibility: event.currentTarget.value as (typeof VISIBILITIES)[number],
                }));
              }}
            >
              {VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {visibility}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Join code</span>
            <input
              type="text"
              value={createDraft.join_code ?? ""}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  join_code: event.currentTarget.value.trim().length > 0 ? event.currentTarget.value : null,
                }));
              }}
              placeholder="Auto-generate if blank"
            />
          </label>

          <label className="field">
            <span>Mode</span>
            <select
              value={createDraft.mode}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  mode: event.currentTarget.value as (typeof MODES)[number],
                }));
              }}
            >
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Metric</span>
            <select
              value={createDraft.win_metric}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  win_metric: event.currentTarget.value as (typeof WIN_METRICS)[number],
                }));
              }}
            >
              {WIN_METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Play style</span>
            <select
              value={createDraft.play_style}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  play_style: event.currentTarget.value as (typeof PLAY_STYLES)[number],
                }));
              }}
            >
              {PLAY_STYLES.map((playStyle) => (
                <option key={playStyle} value={playStyle}>
                  {playStyle}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Level</span>
            <select
              value={createDraft.level_filter}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  level_filter: event.currentTarget.value as (typeof LEVEL_FILTERS)[number],
                }));
              }}
            >
              {LEVEL_FILTERS.map((levelFilter) => (
                <option key={levelFilter} value={levelFilter}>
                  {levelFilter}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Max players</span>
            <select
              value={String(createDraft.max_players)}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  max_players: Number(event.currentTarget.value) as (typeof MAX_PLAYERS_OPTIONS)[number],
                }));
              }}
            >
              {MAX_PLAYERS_OPTIONS.map((maxPlayers) => (
                <option key={maxPlayers} value={String(maxPlayers)}>
                  {maxPlayers}
                </option>
              ))}
            </select>
          </label>

          <label className="field full-width">
            <span>Room comment</span>
            <textarea
              rows={3}
              value={createDraft.room_comment}
              onChange={(event) => {
                setCreateDraft((current) => ({
                  ...current,
                  room_comment: event.currentTarget.value,
                }));
              }}
              placeholder="Visible in lobby."
            />
          </label>
        </div>

        {localMessage ? <p className="inline-error">{localMessage}</p> : null}

        <div className="button-row">
          <button
            type="button"
            className="primary-button"
            disabled={busyAction !== null}
            onClick={() => {
              setBusyAction("create");
              setLocalMessage(null);

              void createRoom(savedSettings.apiBaseUrl, createDraft)
                .then(async (response) => {
                  await enterRoom(
                    response.room_id,
                    response.settings.visibility === "PRIVATE" ? response.settings.join_code : null,
                  );
                })
                .catch((error) => {
                  setLocalMessage(error instanceof Error ? error.message : "Failed to create room.");
                })
                .finally(() => {
                  setBusyAction(null);
                });
            }}
          >
            Create and join
          </button>
        </div>
      </article>
    </section>
  );
}
