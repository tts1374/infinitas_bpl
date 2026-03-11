import {
  JOIN_CODE_CHARSET,
  JOIN_CODE_LENGTH,
  LEVEL_FILTERS,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  ROOM_COMMENT_MAX_LENGTH,
  VISIBILITIES,
  WIN_METRICS,
  type LevelFilter,
  type LobbyRoomSummary,
  type RoomSettings,
} from "@infinitas/shared";
import { AlertCircle, Key, Plus, RefreshCcw, Search, Users, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoom } from "../services/worker-api-client";
import { lobbyStore, useLobbyStore } from "../stores/lobby-store";
import { roomStore, useRoomStore } from "../stores/room-store";
import { isRoomEntryReady, useSettingsStore } from "../stores/settings-store";

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

const levelLabels: Record<LevelFilter, string> = {
  ANY: "制限なし",
  LV8_10: "Lv8～10",
  LV10: "Lv10",
  LV11: "Lv11",
  LV12: "Lv12",
};

const statusLabels: Record<LobbyRoomSummary["status"], string> = {
  LOBBY: "募集中",
  READY_CHECK: "準備中",
  PICKING: "選曲中",
  PLAYING: "対戦中",
  RESULT: "結果表示中",
};

function normalizeJoinCodeInput(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "");
}

function validateJoinCode(value: string): string | null {
  if (value.length === 0) {
    return null;
  }
  if (value.length !== JOIN_CODE_LENGTH) {
    return `${JOIN_CODE_LENGTH} 文字で入力してください`;
  }
  for (const character of value) {
    if (!JOIN_CODE_CHARSET.includes(character)) {
      return "A-Z / 2-9 を使用してください（I/O/0/1 を除く）";
    }
  }
  return null;
}

function roomTitle(room: LobbyRoomSummary): string {
  const title = room.roomName.trim();
  return title.length > 0 ? title : room.roomId;
}

function formatCreatedAt(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(children, document.body);
}

export function LobbyPage() {
  const savedSettings = useSettingsStore((state) => state.saved);
  const rooms = useLobbyStore((state) => state.rooms);
  const loading = useLobbyStore((state) => state.loading);
  const errorMessage = useLobbyStore((state) => state.errorMessage);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);

  const [createDraft, setCreateDraft] = useState<RoomSettings>(defaultCreateDraft);
  const [manualRoomId, setManualRoomId] = useState("");
  const [manualJoinCode, setManualJoinCode] = useState("");
  const [busyAction, setBusyAction] = useState<"create" | "join" | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const roomEntryReady = isRoomEntryReady(savedSettings);
  const roomEntryRequiredMessage = "DJ NAME と DATA SOURCE を設定してからルーム作成・参加を行ってください。";

  const manualJoinCodeError = validateJoinCode(manualJoinCode);
  const createJoinCodeError = validateJoinCode(createDraft.join_code ?? "");
  const createBusy = busyAction === "create";

  const visibleRooms = useMemo(() => {
    const keyword = searchDraft.trim().toLowerCase();
    if (keyword.length === 0) {
      return rooms;
    }

    return rooms.filter((room) => {
      const name = room.roomName.toLowerCase();
      const owner = room.ownerDisplayName.toLowerCase();
      const roomId = room.roomId.toLowerCase();
      return name.includes(keyword) || owner.includes(keyword) || roomId.includes(keyword);
    });
  }, [rooms, searchDraft]);

  function closeManualJoinModal(): void {
    setShowManualJoin(false);
    setManualRoomId("");
    setManualJoinCode("");
  }

  function closeCreateRoomModal(): void {
    setShowCreateRoom(false);
    setCreateDraft({ ...defaultCreateDraft });
    setLocalMessage(null);
  }

  async function enterRoom(roomId: string, joinCode?: string | null): Promise<void> {
    roomStore.connect(
      joinCode === undefined ? { roomId } : { roomId, joinCode },
      {
        apiBaseUrl: savedSettings.apiBaseUrl,
        playerId: savedSettings.playerId,
        displayName: savedSettings.displayName,
        source: savedSettings.source,
      },
    );
  }

  async function joinRoomFromList(room: LobbyRoomSummary): Promise<void> {
    setBusyAction("join");
    try {
      await enterRoom(room.roomId);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="relative flex min-h-full flex-col text-white">
      <header className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <h1 className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            対戦ロビーを探す
          </h1>
          <p className="mt-1 font-medium text-gray-500">{rooms.length} 個のロビーがアクティブです</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            disabled={!roomEntryReady}
            onClick={() => {
              setShowManualJoin(true);
            }}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2d2d30] px-5 py-2.5 text-sm font-bold transition-all hover:bg-[#353538] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Key size={18} className="text-gray-400" /> IDを手動入力
          </button>
          <button
            type="button"
            disabled={!roomEntryReady}
            onClick={() => setShowCreateRoom(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2.5 font-black text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:bg-cyan-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 disabled:shadow-none"
          >
            <Plus size={22} /> ルーム作成
          </button>
        </div>
      </header>

      <section className="mb-8 flex flex-col gap-4 rounded-xl border border-white/5 bg-[#252526] p-4 shadow-2xl xl:flex-row xl:items-center xl:gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={searchDraft}
            placeholder="ルーム名 / オーナー名 / roomId で検索..."
            className="w-full rounded-lg border border-white/10 bg-[#1e1e1e] py-2 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-gray-700 focus:border-cyan-500/50"
            onChange={(event) => setSearchDraft(event.currentTarget.value)}
          />
        </div>
        <button
          type="button"
          disabled={loading}
          title={`ロビー一覧を更新 (${roomConnectionStatus})`}
          onClick={() => {
            void lobbyStore.refresh(savedSettings.apiBaseUrl);
          }}
          className="group/refresh shrink-0 rounded-lg border border-white/10 bg-[#1e1e1e] px-4 py-2 text-[10px] font-black tracking-widest text-gray-400 transition-all hover:bg-[#2d2d30] hover:text-cyan-400 active:scale-95 disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            <RefreshCcw
              size={14}
              className={`text-cyan-500/50 transition-colors group-hover/refresh:text-cyan-400 ${loading ? "animate-spin text-cyan-400" : ""}`}
            />
            RELOAD
          </span>
        </button>
      </section>

      {errorMessage ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}
      {!roomEntryReady ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
          <AlertCircle size={16} />
          <span>{roomEntryRequiredMessage}</span>
        </div>
      ) : null}
      {localMessage ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-300">
          <Users size={16} />
          <span>{localMessage}</span>
        </div>
      ) : null}

      <div className="flex-1">
        <div className="mb-8 grid gap-4">
          {visibleRooms.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#2d2d30] p-8 text-center text-sm font-medium text-gray-500">
              {loading ? "ロビー一覧を更新中..." : "公開中のロビーがありません。"}
            </div>
          ) : (
            visibleRooms.map((room) => (
              <div
                key={room.roomId}
                onClick={() => {
                  if (roomEntryReady) {
                    void joinRoomFromList(room);
                  }
                }}
                className={`group relative flex items-center justify-between overflow-hidden rounded-xl border border-white/5 bg-[#2d2d30] p-5 transition-all ${
                  roomEntryReady
                    ? "cursor-pointer hover:translate-x-1 hover:border-cyan-500/40 hover:bg-[#353538]"
                    : "cursor-not-allowed opacity-60"
                }`}
              >
                <div className="relative z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold transition-colors group-hover:text-cyan-400">{roomTitle(room)}</h3>
                    <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black text-cyan-400">
                      {statusLabels[room.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-5 font-mono text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-cyan-500" />
                      owner: {room.ownerDisplayName || "-"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-cyan-500" />
                      roomId: {room.roomId.slice(0, 8)}...
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-cyan-500" />
                      created: {formatCreatedAt(room.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 flex items-center gap-10">
                  <div className="text-right">
                    <div className="text-2xl font-black italic tracking-tighter text-white">
                      {room.currentPlayers}
                      <span className="text-sm not-italic text-gray-500"> / {room.maxPlayers}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction !== null || !roomEntryReady}
                    onClick={(event) => {
                      event.stopPropagation();
                      void joinRoomFromList(room);
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-8 py-2.5 font-bold transition-all hover:border-cyan-400 hover:bg-cyan-500 hover:text-black disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-transparent disabled:text-gray-600"
                  >
                    参加
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showManualJoin ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f1f22] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">Manual Join</p>
                  <h2 className="mt-1 text-xl font-black text-white">ルームIDで参加</h2>
                </div>
                <button
                  type="button"
                  onClick={closeManualJoinModal}
                  className="rounded-lg border border-white/10 p-2 text-gray-400 transition hover:border-white/30 hover:text-white"
                  aria-label="モーダルを閉じる"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-500">Room ID</label>
                  <input
                    type="text"
                    value={manualRoomId}
                    onChange={(event) => setManualRoomId(event.currentTarget.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60"
                    placeholder="room_id を入力"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-500">Join Code (任意)</label>
                  <input
                    type="text"
                    value={manualJoinCode}
                    onChange={(event) => {
                      const normalized = normalizeJoinCodeInput(event.currentTarget.value);
                      setManualJoinCode(normalized.slice(0, JOIN_CODE_LENGTH));
                    }}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase tracking-widest text-white outline-none transition focus:border-cyan-500/60"
                    placeholder="不要なら空欄"
                  />
                  {manualJoinCodeError ? <p className="mt-1 text-xs text-rose-400">{manualJoinCodeError}</p> : null}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeManualJoinModal}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 transition hover:bg-white/5"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null || manualRoomId.trim().length === 0 || manualJoinCodeError !== null || !roomEntryReady}
                  onClick={() => {
                    setBusyAction("join");
                    void (async () => {
                      try {
                        await enterRoom(
                          manualRoomId.trim(),
                          manualJoinCode.trim().length > 0 ? manualJoinCode.trim() : undefined,
                        );
                        closeManualJoinModal();
                      } finally {
                        setBusyAction(null);
                      }
                    })();
                  }}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-black text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-300"
                >
                  参加する
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {showCreateRoom ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#1f1f22] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">Create Room</p>
                  <h2 className="mt-1 text-xl font-black text-white">新規ルームを作成</h2>
                </div>
                <button
                  type="button"
                  onClick={closeCreateRoomModal}
                  className="rounded-lg border border-white/10 p-2 text-gray-400 transition hover:border-white/30 hover:text-white"
                  aria-label="モーダルを閉じる"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-gray-400">
                  公開設定
                  <select
                    value={createDraft.visibility}
                    onChange={(event) =>
                      setCreateDraft((state) => ({
                        ...state,
                        visibility: event.currentTarget.value as RoomSettings["visibility"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  >
                    {VISIBILITIES.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {visibility}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-gray-400">
                  モード
                  <select
                    value={createDraft.mode}
                    onChange={(event) =>
                      setCreateDraft((state) => ({
                        ...state,
                        mode: event.currentTarget.value as RoomSettings["mode"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  >
                    {MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-gray-400">
                  指標
                  <select
                    value={createDraft.win_metric}
                    onChange={(event) =>
                      setCreateDraft((state) => ({
                        ...state,
                        win_metric: event.currentTarget.value as RoomSettings["win_metric"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  >
                    {WIN_METRICS.map((metric) => (
                      <option key={metric} value={metric}>
                        {metric}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-gray-400">
                  PLAY STYLE
                  <select
                    value={createDraft.play_style}
                    onChange={(event) =>
                      setCreateDraft((state) => ({
                        ...state,
                        play_style: event.currentTarget.value as RoomSettings["play_style"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  >
                    {PLAY_STYLES.map((playStyle) => (
                      <option key={playStyle} value={playStyle}>
                        {playStyle}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-gray-400">
                  難易度フィルタ
                  <select
                    value={createDraft.level_filter}
                    onChange={(event) =>
                      setCreateDraft((state) => ({
                        ...state,
                        level_filter: event.currentTarget.value as RoomSettings["level_filter"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  >
                    {LEVEL_FILTERS.map((levelFilter) => (
                      <option key={levelFilter} value={levelFilter}>
                        {levelLabels[levelFilter]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-gray-400">
                  最大人数
                  <select
                    value={createDraft.max_players}
                    onChange={(event) =>
                      setCreateDraft((state) => ({
                        ...state,
                        max_players: Number(event.currentTarget.value) as RoomSettings["max_players"],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  >
                    {MAX_PLAYERS_OPTIONS.map((maxPlayers) => (
                      <option key={maxPlayers} value={maxPlayers}>
                        {maxPlayers}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 block text-xs font-bold text-gray-400">
                ルーム名 / コメント
                <input
                  type="text"
                  maxLength={ROOM_COMMENT_MAX_LENGTH}
                  value={createDraft.room_comment}
                  onChange={(event) =>
                    setCreateDraft((state) => ({
                      ...state,
                      room_comment: event.currentTarget.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  placeholder="未入力時は mode / play_style が表示されます"
                />
              </label>

              <label className="mt-3 block text-xs font-bold text-gray-400">
                Join Code（任意）
                <input
                  type="text"
                  value={createDraft.join_code ?? ""}
                  onChange={(event) => {
                    const normalized = normalizeJoinCodeInput(event.currentTarget.value).slice(0, JOIN_CODE_LENGTH);
                    setCreateDraft((state) => ({
                      ...state,
                      join_code: normalized.length === 0 ? null : normalized,
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase tracking-widest text-white outline-none"
                  placeholder="不要なら空欄"
                />
                {createJoinCodeError ? <p className="mt-1 text-xs text-rose-400">{createJoinCodeError}</p> : null}
              </label>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateRoomModal}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 transition hover:bg-white/5"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={createBusy || createJoinCodeError !== null || !roomEntryReady}
                  onClick={() => {
                    setBusyAction("create");
                    setLocalMessage(null);
                    void (async () => {
                      try {
                        const response = await createRoom(savedSettings.apiBaseUrl, createDraft);
                        if (response.settings.visibility === "PUBLIC") {
                          const now = Date.now();
                          const roomName = response.settings.room_comment.trim().length > 0
                            ? response.settings.room_comment.trim()
                            : `${response.settings.mode} ${response.settings.play_style}`;
                          lobbyStore.upsertOptimistic({
                            roomId: response.room_id,
                            roomName,
                            ownerUserId: "",
                            ownerDisplayName: "",
                            isPublic: true,
                            currentPlayers: 0,
                            maxPlayers: response.settings.max_players,
                            isFull: false,
                            status: "LOBBY",
                            ttlStartedAt: now,
                            createdAt: now,
                            updatedAt: now,
                          });
                        }

                        await lobbyStore.refresh(savedSettings.apiBaseUrl);
                        setLocalMessage(`ルームを作成しました: ${response.room_id}`);
                        closeCreateRoomModal();
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "ルーム作成に失敗しました。";
                        setLocalMessage(message);
                      } finally {
                        setBusyAction(null);
                      }
                    })();
                  }}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-black text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-300"
                >
                  作成する
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </section>
  );
}
