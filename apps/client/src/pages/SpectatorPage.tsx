import { isServerMessageType, type ResultReadyPayload, type RoomStateSnapshot, type ServerMessage, type ServerMessagePayloadMap } from "@infinitas/shared";
import { Eye, Loader2, LogOut, Radio, ShieldAlert, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  applySpectatorRoundConfirmation,
  buildSpectatorJoinMessage,
  buildSpectatorWebSocketUrl,
  type FinalResultHistoryItem,
  type SpectatorConnectionState,
  upsertFinalResultHistory,
} from "../services/spectator-client";
import { useSettingsStore } from "../stores/settings-store";

const MAX_RESULT_HISTORY = 20;

function formatDateTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function stateBadgeClass(state: RoomStateSnapshot["room_state"] | null): string {
  switch (state) {
    case "PLAYING":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    case "PICKING":
      return "border-cyan-400/30 bg-cyan-500/15 text-cyan-200";
    case "RESULT":
      return "border-amber-400/30 bg-amber-500/15 text-amber-200";
    case "CLOSED":
      return "border-red-400/30 bg-red-500/15 text-red-200";
    case "LOBBY":
      return "border-white/15 bg-white/10 text-gray-200";
    default:
      return "border-white/10 bg-white/5 text-gray-400";
  }
}

function metricLabel(snapshot: RoomStateSnapshot | null): string {
  return snapshot?.settings.win_metric === "MISSCOUNT" ? "BP" : "EX SCORE";
}

function latestResultTitle(result: ResultReadyPayload | null): string {
  if (result === null) {
    return "まだ最終結果を受信していません";
  }
  const winners = result.summary.winner_player_ids.length;
  if (result.summary.is_draw) {
    return "DRAW";
  }
  return winners > 0 ? `${winners} winner${winners === 1 ? "" : "s"}` : "RESULT READY";
}

export function SpectatorPage() {
  const apiBaseUrl = useSettingsStore((state) => state.saved.apiBaseUrl);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [connectionState, setConnectionState] = useState<SpectatorConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Room ID を入力して観戦接続してください。");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomStateSnapshot | null>(null);
  const [finalResults, setFinalResults] = useState<FinalResultHistoryItem[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<RoomStateSnapshot | null>(null);
  const spectatorId = useMemo(() => `spectator-${crypto.randomUUID()}`, []);
  const isConnecting = connectionState === "connecting";
  const isJoined = connectionState === "joined";
  const currentRound = snapshot?.current_round ?? null;
  const confirmedPlayers = currentRound?.confirmed ?? [];
  const confirmedByPlayer = useMemo(() => new Map(confirmedPlayers.map((entry) => [entry.player_id, entry])), [confirmedPlayers]);
  const latestResult = finalResults[0]?.payload ?? null;

  const closeSocket = useCallback((code: number, reason: string): void => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket !== null && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      socket.close(code, reason);
    }
  }, []);

  const applySnapshot = useCallback((nextSnapshot: RoomStateSnapshot): void => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const disconnect = useCallback((): void => {
    closeSocket(1000, "Spectator disconnected.");
    snapshotRef.current = null;
    setSnapshot(null);
    setConnectionState("idle");
    setConnectionMessage("切断しました。再接続できます。");
  }, [closeSocket]);

  const connect = useCallback((event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const roomId = roomIdInput.trim();
    if (roomId.length === 0) {
      setConnectionState("error");
      setConnectionMessage("Room ID を入力してください。");
      return;
    }

    closeSocket(1000, "Reconnect requested.");
    if (activeRoomId !== null && activeRoomId !== roomId) {
      setFinalResults([]);
    }
    setActiveRoomId(roomId);
    snapshotRef.current = null;
    setSnapshot(null);
    setConnectionState("connecting");
    setConnectionMessage("接続中...");

    let wsUrl: string;
    try {
      wsUrl = buildSpectatorWebSocketUrl(apiBaseUrl, roomId);
    } catch (error) {
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "WebSocket URL を作成できませんでした。");
      return;
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    const isStaleSocketEvent = (): boolean => socketRef.current !== socket;

    socket.addEventListener("open", () => {
      if (isStaleSocketEvent()) {
        return;
      }
      setConnectionMessage("観戦参加を送信中...");
      socket.send(JSON.stringify(buildSpectatorJoinMessage({
        roomId,
        spectatorId,
        joinCode: joinCodeInput,
      })));
    });

    socket.addEventListener("message", (messageEvent) => {
      if (isStaleSocketEvent() || typeof messageEvent.data !== "string") {
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(messageEvent.data);
      } catch {
        setConnectionState("error");
        setConnectionMessage("受信データの解析に失敗しました。");
        return;
      }

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as { type?: unknown }).type !== "string" ||
        !isServerMessageType((parsed as { type: string }).type)
      ) {
        return;
      }

      const message = parsed as ServerMessage;
      switch (message.type) {
        case "ROOM_JOIN_ACCEPTED": {
          const payload = message.payload as ServerMessagePayloadMap["ROOM_JOIN_ACCEPTED"];
          applySnapshot(payload.room_state_snapshot);
          setConnectionState("joined");
          setConnectionMessage(payload.session_role === "SPECTATOR" ? "観戦接続しました。" : "接続しました。");
          return;
        }
        case "ROOM_UPDATED":
        case "STATE_SNAPSHOT": {
          const payload = message.payload as ServerMessagePayloadMap["ROOM_UPDATED"] | ServerMessagePayloadMap["STATE_SNAPSHOT"];
          applySnapshot(payload.room_state_snapshot);
          return;
        }
        case "PLAYER_ROUND_CONFIRMED": {
          const current = snapshotRef.current;
          if (current === null) {
            return;
          }
          applySnapshot(applySpectatorRoundConfirmation(current, message.payload as ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"]));
          return;
        }
        case "RESULT_READY": {
          setFinalResults((previous) =>
            upsertFinalResultHistory(previous, message.payload as ServerMessagePayloadMap["RESULT_READY"], new Date().toISOString(), MAX_RESULT_HISTORY),
          );
          return;
        }
        case "ROOM_JOIN_REJECTED": {
          const payload = message.payload as ServerMessagePayloadMap["ROOM_JOIN_REJECTED"];
          setConnectionState("error");
          setConnectionMessage(`接続拒否: ${payload.reason}`);
          return;
        }
        case "ERROR": {
          const payload = message.payload as ServerMessagePayloadMap["ERROR"];
          setConnectionState("error");
          setConnectionMessage(`${payload.code}: ${payload.message}`);
          return;
        }
        case "ROOM_CLOSED": {
          const payload = message.payload as ServerMessagePayloadMap["ROOM_CLOSED"];
          setConnectionState("closed");
          setConnectionMessage(`ROOM CLOSED: ${payload.close_reason}`);
          return;
        }
        default:
          return;
      }
    });

    socket.addEventListener("error", () => {
      if (isStaleSocketEvent()) {
        return;
      }
      setConnectionState("error");
      setConnectionMessage("接続エラー");
    });

    socket.addEventListener("close", (closeEvent) => {
      if (isStaleSocketEvent()) {
        return;
      }
      socketRef.current = null;
      setConnectionState("closed");
      setConnectionMessage(`切断 (${closeEvent.code})`);
    });
  }, [activeRoomId, apiBaseUrl, applySnapshot, closeSocket, joinCodeInput, roomIdInput, spectatorId]);

  useEffect(() => () => {
    closeSocket(1000, "Spectator page unmounted.");
  }, [closeSocket]);

  return (
    <section className="relative flex min-h-full flex-col text-white">
      <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
            <Radio size={14} />
            App Spectator
          </p>
          <h1 className="text-3xl font-black tracking-tight">観戦モード</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-gray-400">
            Room ID と合言葉を入力して read-only で観戦します。参加枠や対戦操作には影響しません。
          </p>
        </div>
        {isJoined ? (
          <button
            type="button"
            onClick={disconnect}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-5 py-2.5 text-sm font-bold text-red-100 transition-all hover:bg-red-500/20"
          >
            <LogOut size={17} />
            切断
          </button>
        ) : null}
      </header>

      {!isJoined ? (
        <form onSubmit={connect} className="mb-8 grid gap-4 rounded-xl border border-white/5 bg-[#252526] p-5 shadow-2xl lg:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-xs font-bold text-gray-400">Room ID</span>
            <input
              type="text"
              value={roomIdInput}
              onChange={(event) => setRoomIdInput(event.currentTarget.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2.5 font-mono text-sm text-white outline-none transition-all focus:border-cyan-500/50"
              placeholder="room id"
              disabled={isConnecting}
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold text-gray-400">Join Code</span>
            <input
              type="password"
              value={joinCodeInput}
              onChange={(event) => setJoinCodeInput(event.currentTarget.value.toUpperCase())}
              className="w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2.5 font-mono text-sm uppercase tracking-[0.25em] text-white outline-none transition-all focus:border-cyan-500/50"
              placeholder="OPTIONAL"
              disabled={isConnecting}
            />
          </label>
          <button
            type="submit"
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 font-black text-black shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-800/60 disabled:text-gray-300"
          >
            {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
            {isConnecting ? "接続中..." : "観戦する"}
          </button>
        </form>
      ) : null}

      <div className={`mb-6 rounded-xl border px-4 py-3 text-sm font-bold ${connectionState === "error" ? "border-red-500/25 bg-red-500/10 text-red-200" : "border-white/5 bg-white/[0.03] text-gray-300"}`}>
        {connectionMessage}
      </div>

      {snapshot === null ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#252526]/60 p-10 text-center">
          <div>
            <ShieldAlert className="mx-auto mb-4 text-gray-600" size={36} />
            <p className="text-sm font-bold text-gray-500">観戦接続後、受信したルーム状態をここに表示します。</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-xl border border-white/5 bg-[#252526] p-5 shadow-2xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Room</p>
                <h2 className="mt-1 font-mono text-xl font-black text-white">{snapshot.room_id}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${stateBadgeClass(snapshot.room_state)}`}>
                {snapshot.room_state}
              </span>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-4">
              <InfoTile label="Mode" value={snapshot.settings.mode} />
              <InfoTile label="Metric" value={snapshot.settings.win_metric} />
              <InfoTile label="Style" value={snapshot.settings.play_style} />
              <InfoTile label="Players" value={`${snapshot.players.length}/${snapshot.settings.max_players}`} />
            </div>

            <div className="mb-6 rounded-lg border border-white/5 bg-black/20 p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Current Round</p>
              {currentRound === null ? (
                <p className="text-sm font-bold text-gray-400">現在進行中のラウンドはありません。</p>
              ) : (
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-cyan-500 px-2 py-0.5 text-[10px] font-black text-black">{currentRound.expected_key.play_style}</span>
                    <span className="rounded border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-300">
                      {currentRound.expected_key.difficulty}
                    </span>
                    <span className="font-mono text-xs text-gray-500">Round {currentRound.round_index + 1}</span>
                  </div>
                  <p className="text-2xl font-black tracking-tight">{currentRound.expected_key.title_search_key}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Players</p>
              {snapshot.players.map((player) => {
                const confirmed = confirmedByPlayer.get(player.player_id) ?? null;
                return (
                  <div key={player.player_id} className="flex items-center gap-4 rounded-lg border border-white/5 bg-black/20 p-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${player.connected ? "bg-emerald-400" : "bg-gray-600"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{player.display_name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">{player.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{metricLabel(snapshot)}</p>
                      <p className="font-mono text-lg font-black text-cyan-200">{confirmed?.metric_value ?? "-"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="min-h-0 rounded-xl border border-white/5 bg-[#252526] p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <Trophy size={17} className="text-amber-300" />
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-300">Result History</h2>
            </div>
            <div className="mb-4 rounded-lg border border-white/5 bg-black/20 p-4">
              <p className="text-xs font-bold text-gray-500">Latest</p>
              <p className="mt-1 text-lg font-black text-white">{latestResultTitle(latestResult)}</p>
              {latestResult ? (
                <p className="mt-1 text-xs text-gray-500">Match ID: {latestResult.summary.match_id}</p>
              ) : null}
            </div>
            <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
              {finalResults.length === 0 ? (
                <p className="rounded-lg border border-white/5 bg-black/20 p-3 text-sm font-bold text-gray-500">
                  `RESULT_READY` を受信すると履歴が追加されます。
                </p>
              ) : (
                finalResults.map((item) => (
                  <div key={item.payload.summary.match_id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                    <p className="font-mono text-xs font-bold text-gray-500">{item.payload.summary.match_id}</p>
                    <p className="mt-1 text-sm font-black text-white">{latestResultTitle(item.payload)}</p>
                    <p className="mt-1 text-[11px] text-gray-600">{formatDateTime(item.receivedAtIso)}</p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-gray-200">{value}</p>
    </div>
  );
}
