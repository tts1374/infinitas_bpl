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
  type RoomListingEntry,
  type RoomSettings,
} from "@infinitas/shared";
import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Key, Lock, MessageSquare, Plus, RefreshCcw, Search, Trophy, Users, X } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoom } from "../services/worker-api-client";
import { lobbyStore, useLobbyStore } from "../stores/lobby-store";
import { roomStore, useRoomStore } from "../stores/room-store";
import { useSettingsStore } from "../stores/settings-store";

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

const levelLabels: Record<LevelFilter, string> = {
  ANY: "制限なし",
  LV8_10: "Lv8～10",
  LV10: "Lv10",
  LV11: "Lv11",
  LV12: "Lv12",
};

const modeLabels = {
  ARENA: "ARENA",
  BPL: "BPL (3 STAGE)",
} as const;

const winMetricLabels = {
  SCORE: "SCORE (EX SCORE)",
  MISSCOUNT: "MISSCOUNT (BP)",
} as const;

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

function roomTitle(room: RoomListingEntry): string {
  const comment = room.room_comment.trim();
  return comment.length > 0 ? comment : `${modeLabels[room.mode]} ${room.play_style}`;
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(children, document.body);
}

export function LobbyPage({ onEnterRoom }: LobbyPageProps) {
  const savedSettings = useSettingsStore((state) => state.saved);
  const rooms = useLobbyStore((state) => state.rooms);
  const filters = useLobbyStore((state) => state.filters);
  const loading = useLobbyStore((state) => state.loading);
  const errorMessage = useLobbyStore((state) => state.errorMessage);
  const nextCursor = useLobbyStore((state) => state.nextCursor);
  const previousCursors = useLobbyStore((state) => state.previousCursors);
  const activeRoomCount = useLobbyStore((state) => state.activeRoomCount);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);

  const [createDraft, setCreateDraft] = useState<RoomSettings>(defaultCreateDraft);
  const [manualRoomId, setManualRoomId] = useState("");
  const [manualJoinCode, setManualJoinCode] = useState("");
  const [busyAction, setBusyAction] = useState<"create" | "join" | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCreateJoinCode, setShowCreateJoinCode] = useState(false);
  const [selectedRoomForJoin, setSelectedRoomForJoin] = useState<RoomListingEntry | null>(null);
  const [joinModalCode, setJoinModalCode] = useState("");
  const [joinModalError, setJoinModalError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(filters.roomComment);
  const deferredSearchDraft = useDeferredValue(searchDraft);

  const manualJoinCodeError = validateJoinCode(manualJoinCode);
  const createJoinCodeError = validateJoinCode(createDraft.join_code ?? "");
  const currentPage = previousCursors.length + 1;
  const pageButtons = Array.from({ length: currentPage + (nextCursor === null ? 0 : 1) }, (_, index) => index + 1);

  useEffect(() => {
    void lobbyStore.refresh(savedSettings.apiBaseUrl);
  }, [savedSettings.apiBaseUrl]);

  useEffect(() => {
    if (deferredSearchDraft === filters.roomComment) {
      return;
    }
    const timer = window.setTimeout(() => {
      lobbyStore.updateFilter("roomComment", deferredSearchDraft);
      void lobbyStore.refresh(savedSettings.apiBaseUrl);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [deferredSearchDraft, filters.roomComment, savedSettings.apiBaseUrl]);

  async function enterRoom(roomId: string, joinCode?: string | null): Promise<void> {
    const connected = roomStore.connect(
      joinCode === undefined ? { roomId } : { roomId, joinCode },
      {
        apiBaseUrl: savedSettings.apiBaseUrl,
        playerId: savedSettings.playerId,
        displayName: savedSettings.displayName,
        source: savedSettings.source,
      },
    );
    if (connected) {
      startTransition(() => onEnterRoom());
    }
  }

  async function joinRoomFromList(room: RoomListingEntry, joinCode?: string | null): Promise<void> {
    setBusyAction("join");
    try {
      await enterRoom(room.room_id, joinCode);
    } finally {
      setBusyAction(null);
    }
  }

  function updateSelectFilter(key: "mode" | "playStyle" | "levelFilter", value: string): void {
    switch (key) {
      case "mode":
        lobbyStore.updateFilter("mode", value as (typeof MODES)[number] | "");
        break;
      case "playStyle":
        lobbyStore.updateFilter("playStyle", value as (typeof PLAY_STYLES)[number] | "");
        break;
      case "levelFilter":
        lobbyStore.updateFilter("levelFilter", value as (typeof LEVEL_FILTERS)[number] | "");
        break;
    }
    void lobbyStore.refresh(savedSettings.apiBaseUrl);
  }

  function requestJoin(room: RoomListingEntry): void {
    if (room.has_join_code) {
      setSelectedRoomForJoin(room);
      setJoinModalCode("");
      setJoinModalError(null);
      return;
    }

    void joinRoomFromList(room);
  }

  return (
    <section className="relative flex min-h-full flex-col text-white">
      <header className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <h1 className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            対戦ロビーを探す
          </h1>
          <p className="mt-1 font-medium text-gray-500">{activeRoomCount} 個のロビーがアクティブです</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => setShowManualJoin(true)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2d2d30] px-5 py-2.5 text-sm font-bold transition-all hover:bg-[#353538] active:scale-95"
          >
            <Key size={18} className="text-gray-400" /> IDを手動入力
          </button>
          <button
            type="button"
            onClick={() => setShowCreateRoom(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-2.5 font-black text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:bg-cyan-400 active:scale-95"
          >
            <Plus size={22} /> ルーム作成
          </button>
        </div>
      </header>

      <section className="mb-8 flex flex-col gap-4 rounded-xl border border-white/5 bg-[#252526] p-4 shadow-2xl xl:flex-row xl:items-center xl:gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Filters</span>
          <select
            value={filters.mode}
            className="lobby-native-select cursor-pointer rounded-md border border-white/10 bg-[#1e1e1e] px-3 py-1.5 text-xs font-bold text-white outline-none transition-colors focus:border-cyan-500/50"
            onChange={(event) => updateSelectFilter("mode", event.currentTarget.value)}
          >
            <option value="">モード: すべて</option>
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabels[mode]}
              </option>
            ))}
          </select>
          <select
            value={filters.playStyle}
            className="lobby-native-select cursor-pointer rounded-md border border-white/10 bg-[#1e1e1e] px-3 py-1.5 text-xs font-bold text-white outline-none transition-colors focus:border-cyan-500/50"
            onChange={(event) => updateSelectFilter("playStyle", event.currentTarget.value)}
          >
            <option value="">プレイスタイル: すべて</option>
            {PLAY_STYLES.map((playStyle) => (
              <option key={playStyle} value={playStyle}>
                {playStyle}
              </option>
            ))}
          </select>
          <select
            value={filters.levelFilter}
            className="lobby-native-select cursor-pointer rounded-md border border-white/10 bg-[#1e1e1e] px-3 py-1.5 text-xs font-bold text-white outline-none transition-colors focus:border-cyan-500/50"
            onChange={(event) => updateSelectFilter("levelFilter", event.currentTarget.value)}
          >
            <option value="">難易度: すべて</option>
            {LEVEL_FILTERS.map((levelFilter) => (
              <option key={levelFilter} value={levelFilter}>
                {levelLabels[levelFilter]}
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={searchDraft}
            placeholder="部屋コメントで検索..."
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

      <div className="flex-1">
        <div className="mb-8 grid gap-4">
          {rooms.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#2d2d30] p-8 text-center text-sm font-medium text-gray-500">
              {loading ? "ロビー一覧を更新中..." : "公開中のロビーがありません。"}
            </div>
          ) : (
            rooms.map((room) => (
              <div
                key={room.room_id}
                onClick={() => requestJoin(room)}
                className="group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl border border-white/5 bg-[#2d2d30] p-5 transition-all hover:translate-x-1 hover:border-cyan-500/40 hover:bg-[#353538]"
              >
                <div className="absolute -bottom-4 right-24 select-none text-7xl font-black italic uppercase tracking-tighter text-white/[0.02]">
                  {room.mode}
                </div>
                <div className="relative z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold transition-colors group-hover:text-cyan-400">{roomTitle(room)}</h3>
                    <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black text-cyan-400">
                      {room.mode === "BPL" ? "BPL" : room.mode}
                    </span>
                    {room.has_join_code ? <Lock size={14} className="text-amber-500/70" /> : null}
                  </div>
                  <div className="flex flex-wrap gap-5 font-mono text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-cyan-500" />
                      {room.play_style}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-cyan-500" />
                      {levelLabels[room.level_filter]}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-cyan-500" />
                      {room.win_metric}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 flex items-center gap-10">
                  <div className="text-right">
                    <div className="text-2xl font-black italic tracking-tighter text-white">
                      {room.current_members ?? "--"}{" "}
                      <span className="text-sm not-italic text-gray-500">/ {room.current_members === null ? "--" : room.max_players}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={(event) => {
                      event.stopPropagation();
                      requestJoin(room);
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

        {rooms.length > 0 ? (
          <div className="flex items-center justify-center gap-2 pb-10">
            <button
              type="button"
              disabled={previousCursors.length === 0 || loading}
              onClick={() => {
                void lobbyStore.previousPage(savedSettings.apiBaseUrl);
              }}
              className="rounded-lg border border-white/10 p-2 text-xs font-bold transition-all hover:bg-white/5 disabled:opacity-20"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-1">
              {pageButtons.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void lobbyStore.goToPage(savedSettings.apiBaseUrl, pageNumber);
                  }}
                  className={`h-10 w-10 rounded-lg text-xs font-black transition-all ${
                    pageNumber === currentPage
                      ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      : "border border-white/5 bg-white/5 hover:border-white/20"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={nextCursor === null || loading}
              onClick={() => {
                void lobbyStore.nextPage(savedSettings.apiBaseUrl);
              }}
              className="rounded-lg border border-white/10 p-2 text-xs font-bold transition-all hover:bg-white/5 disabled:opacity-20"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        ) : null}
      </div>

      {showManualJoin ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[1000]">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
            <div className="relative flex min-h-full items-center justify-center p-4">
              <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-[#252526] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-8 py-6">
                  <h2 className="flex items-center gap-3 text-xl font-bold">
                    <Key size={22} className="text-cyan-400" />
                    IDを手動入力して参加
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowManualJoin(false)}
                    className="rounded-full p-1 text-gray-500 transition-all hover:bg-white/5 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="flex flex-col gap-8 bg-[#252526] p-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Room ID (UUID)</label>
                    <input
                      type="text"
                      value={manualRoomId}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] p-4 font-mono text-sm outline-none transition-all focus:border-cyan-500"
                      onChange={(event) => {
                        setManualRoomId(event.currentTarget.value);
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Join Code (合言葉)</label>
                      {manualJoinCodeError ? <span className="text-[10px] font-bold text-red-500">{manualJoinCodeError}</span> : null}
                    </div>
                    <input
                      type="text"
                      value={manualJoinCode}
                      maxLength={JOIN_CODE_LENGTH}
                      placeholder="例: A1B2C3D4"
                      className={`w-full rounded-xl border bg-[#1e1e1e] p-4 text-center font-mono text-lg tracking-[0.3em] uppercase outline-none transition-all ${
                        manualJoinCodeError ? "border-red-500" : "border-white/10 focus:border-cyan-500"
                      }`}
                      onChange={(event) => {
                        setManualJoinCode(normalizeJoinCodeInput(event.currentTarget.value));
                      }}
                    />
                  </div>
                  <div className="mt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setShowManualJoin(false)}
                      className="flex-1 rounded-xl bg-white/5 py-4 font-bold transition-all hover:bg-white/10"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      disabled={busyAction !== null || manualRoomId.trim().length === 0 || manualJoinCodeError !== null}
                      className={`flex-1 rounded-xl py-4 font-black transition-all shadow-[0_10px_20px_rgba(6,182,212,0.2)] ${
                        busyAction !== null || manualRoomId.trim().length === 0 || manualJoinCodeError !== null
                          ? "cursor-not-allowed bg-gray-800 text-gray-600"
                          : "bg-cyan-500 text-black hover:bg-cyan-400"
                      }`}
                      onClick={() => {
                        setBusyAction("join");
                        void enterRoom(manualRoomId.trim(), manualJoinCode.trim() || null).finally(() => {
                          setBusyAction(null);
                        });
                      }}
                    >
                      参加を確定
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {showCreateRoom ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[1001]">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px]" />
            <div className="relative flex min-h-full items-center justify-center p-4">
              <div className="w-full max-w-[580px] overflow-hidden rounded-2xl border border-white/10 bg-[#252526] shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-white/5 bg-cyan-500/5 px-8 py-6">
              <h2 className="flex items-center gap-3 text-xl font-bold text-cyan-400">
                <Plus size={24} />
                新規ルーム作成
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateRoom(false)}
                className="rounded-full p-1 text-gray-500 transition-all hover:bg-white/5 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-col gap-8 bg-[#252526] p-8">
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  <Trophy size={14} />
                  Rule Settings
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">対戦モード</label>
                    <select
                      value={createDraft.mode}
                      className="lobby-native-select w-full rounded-xl border border-white/10 bg-[#1e1e1e] p-3 text-sm text-white outline-none transition-all focus:border-cyan-500"
                      onChange={(event) => {
                        const nextMode = event.currentTarget.value as (typeof MODES)[number];
                        setCreateDraft((current) => ({
                          ...current,
                          mode: nextMode,
                          max_players: nextMode === "BPL" ? 2 : current.max_players,
                        }));
                      }}
                    >
                      {MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {modeLabels[mode]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">勝敗基準</label>
                    <select
                      value={createDraft.win_metric}
                      className="lobby-native-select w-full rounded-xl border border-white/10 bg-[#1e1e1e] p-3 text-sm text-white outline-none transition-all focus:border-cyan-500"
                      onChange={(event) => {
                        const nextWinMetric = event.currentTarget.value as (typeof WIN_METRICS)[number];
                        setCreateDraft((current) => ({
                          ...current,
                          win_metric: nextWinMetric,
                        }));
                      }}
                    >
                      {WIN_METRICS.map((metric) => (
                        <option key={metric} value={metric}>
                          {winMetricLabels[metric]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400">プレイスタイル</label>
                  <div className="flex gap-2">
                    {PLAY_STYLES.map((playStyle) => (
                      <button
                        key={playStyle}
                        type="button"
                        onClick={() => {
                          setCreateDraft((current) => ({
                            ...current,
                            play_style: playStyle,
                          }));
                        }}
                        className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                          createDraft.play_style === playStyle
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
                            : "border-white/5 bg-[#1e1e1e] text-gray-500 hover:border-white/20"
                        }`}
                      >
                        {playStyle}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400">難易度帯 (目安)</label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {LEVEL_FILTERS.map((levelFilter) => (
                      <button
                        key={levelFilter}
                        type="button"
                        onClick={() => {
                          setCreateDraft((current) => ({
                            ...current,
                            level_filter: levelFilter,
                          }));
                        }}
                        className={`rounded-lg border px-2 py-2 text-xs font-bold transition-all ${
                          createDraft.level_filter === levelFilter
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
                            : "border-white/5 bg-[#1e1e1e] text-gray-500 hover:border-white/20"
                        }`}
                      >
                        {levelLabels[levelFilter]}
                      </button>
                    ))}
                  </div>
                </div>
                {createDraft.mode === "BPL" ? (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <Users size={14} />
                      最大人数
                    </label>
                    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold text-cyan-400">
                      BPL は 2P 固定です
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <Users size={14} />
                      最大人数
                    </label>
                    <div className="flex gap-2">
                      {MAX_PLAYERS_OPTIONS.map((maxPlayers) => (
                        <button
                          key={maxPlayers}
                          type="button"
                          onClick={() => {
                            setCreateDraft((current) => ({
                              ...current,
                              max_players: maxPlayers,
                            }));
                          }}
                          className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                            createDraft.max_players === maxPlayers
                              ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
                              : "border-white/5 bg-[#1e1e1e] text-gray-500 hover:border-white/20"
                          }`}
                        >
                          {maxPlayers}P
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  <Eye size={14} />
                  Visibility
                </h3>
                <div className="flex gap-1 rounded-xl bg-[#1e1e1e] p-1">
                  {VISIBILITIES.map((visibility) => (
                    <button
                      key={visibility}
                      type="button"
                      onClick={() => {
                        setCreateDraft((current) => ({
                          ...current,
                          visibility,
                        }));
                      }}
                      className={`flex-1 rounded-lg py-2 text-[10px] font-black transition-all ${
                        createDraft.visibility === visibility
                          ? "border border-cyan-500/20 bg-[#2d2d30] text-cyan-400 shadow-lg"
                          : "text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {visibility}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <label className="text-xs font-bold text-gray-400">合言葉 (Join Code)</label>
                    {createJoinCodeError ? <span className="text-[10px] font-bold text-red-500">{createJoinCodeError}</span> : null}
                  </div>
                  <div className="relative">
                    <input
                      type={showCreateJoinCode ? "text" : "password"}
                      value={createDraft.join_code ?? ""}
                      maxLength={JOIN_CODE_LENGTH}
                      placeholder={createDraft.visibility === "PUBLIC" ? "任意（未入力でパスワードなし）" : "空欄なら自動生成"}
                      className={`w-full rounded-xl border bg-[#1e1e1e] p-3 pr-12 font-mono text-sm uppercase text-white outline-none transition-all placeholder:text-gray-700 ${
                        createJoinCodeError ? "border-red-500" : "border-white/10 focus:border-cyan-500"
                      }`}
                      onChange={(event) => {
                        const nextJoinCode = normalizeJoinCodeInput(event.currentTarget.value);
                        setCreateDraft((current) => ({
                          ...current,
                          join_code: nextJoinCode.length > 0 ? nextJoinCode : null,
                        }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateJoinCode((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
                      aria-label={showCreateJoinCode ? "合言葉を隠す" : "合言葉を表示"}
                    >
                      {showCreateJoinCode ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </section>
              <section className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  <MessageSquare size={14} />
                  Room Comment
                </label>
                  <input
                    type="text"
                    maxLength={ROOM_COMMENT_MAX_LENGTH}
                    value={createDraft.room_comment}
                    placeholder="例：☆12地力S+ 練習中 / 武器曲投げ合い"
                    className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] p-3 text-sm text-white outline-none transition-all placeholder:text-gray-700 focus:border-cyan-500"
                    onChange={(event) => {
                      const nextRoomComment = event.currentTarget.value;
                      setCreateDraft((current) => ({
                      ...current,
                      room_comment: nextRoomComment,
                    }));
                  }}
                />
              </section>
              {localMessage ? <p className="text-sm font-medium text-red-400">{localMessage}</p> : null}
              <div className="mt-2 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="flex-1 rounded-xl bg-white/5 py-4 font-bold transition-all hover:bg-white/10"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null || createJoinCodeError !== null}
                  className={`flex-1 rounded-xl py-4 font-black transition-all shadow-[0_10px_30px_rgba(6,182,212,0.3)] ${
                    busyAction !== null || createJoinCodeError !== null
                      ? "cursor-not-allowed bg-gray-800 text-gray-600"
                      : "bg-cyan-500 text-black hover:bg-cyan-400"
                  }`}
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
                  ルームを作成する
                </button>
              </div>
            </div>
          </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {selectedRoomForJoin ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[2000]">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <div className="relative flex min-h-full items-center justify-center p-4">
              <div className="w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[#1a1a1c] shadow-[0_30px_90px_rgba(0,0,0,0.9)]">
            <div className="relative p-8 pb-4 text-center">
              <div className="absolute right-6 top-6">
                <button
                  type="button"
                  onClick={() => setSelectedRoomForJoin(null)}
                  className="rounded-full p-2 text-gray-500 transition-all hover:bg-white/5 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-6 inline-flex rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-500">
                <Lock size={32} strokeWidth={2.5} />
              </div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white">合言葉が必要です</h2>
              <p className="px-8 text-sm text-gray-500">
                「<span className="font-bold text-gray-300">{roomTitle(selectedRoomForJoin)}</span>」に参加するにはホストが設定した合言葉を入力してください。
              </p>
            </div>
            <div className="flex flex-col gap-8 p-8 pt-4">
              <div className="space-y-4">
                <div className="flex items-end justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Enter Join Code</label>
                  {joinModalError ? <span className="text-[10px] font-bold text-red-500">{joinModalError}</span> : null}
                </div>
                <div className="group relative">
                  <input
                    type="text"
                    value={joinModalCode}
                    maxLength={JOIN_CODE_LENGTH}
                    autoFocus
                    placeholder="••••••••"
                    className={`w-full rounded-2xl border-2 bg-white/[0.03] p-6 text-center font-mono text-3xl tracking-[0.5em] outline-none transition-all placeholder:text-white/5 ${
                      joinModalError ? "border-red-500/50" : "border-white/5 group-hover:border-white/10 focus:border-cyan-500/50"
                    }`}
                    onChange={(event) => {
                      const nextJoinCode = normalizeJoinCodeInput(event.currentTarget.value);
                      setJoinModalCode(nextJoinCode);
                      setJoinModalError(validateJoinCode(nextJoinCode));
                    }}
                  />
                  <div
                    className={`absolute -bottom-1 left-1/2 h-1 w-[60%] -translate-x-1/2 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] transition-all duration-500 ${
                      joinModalCode.length === JOIN_CODE_LENGTH && joinModalError === null ? "opacity-100" : "scale-x-0 opacity-0"
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRoomForJoin(null)}
                  className="rounded-2xl bg-white/5 py-4 font-bold text-gray-400 transition-all hover:bg-white/10"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null || joinModalError !== null || joinModalCode.length !== JOIN_CODE_LENGTH}
                  onClick={() => {
                    const normalizedCode = normalizeJoinCodeInput(joinModalCode);
                    const validationError = validateJoinCode(normalizedCode);
                    setJoinModalCode(normalizedCode);
                    setJoinModalError(validationError);
                    if (validationError !== null) {
                      return;
                    }
                    void joinRoomFromList(selectedRoomForJoin, normalizedCode).then(() => {
                      setSelectedRoomForJoin(null);
                    });
                  }}
                  className={`rounded-2xl py-4 font-black transition-all ${
                    busyAction !== null || joinModalError !== null || joinModalCode.length !== JOIN_CODE_LENGTH
                      ? "cursor-not-allowed bg-gray-800 text-gray-600 opacity-50"
                      : "bg-cyan-500 text-black shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:bg-cyan-400"
                  }`}
                >
                  参加する
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-white/5 bg-white/[0.02] px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-600">
              <Search size={12} />
              Verification Required
            </div>
          </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </section>
  );
}
