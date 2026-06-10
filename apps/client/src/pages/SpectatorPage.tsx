import {
  isServerMessageType,
  type ResultReadyPayload,
  type ResultReadyPlayer,
  type RoomStateSnapshot,
  type ServerMessage,
  type ServerMessagePayloadMap,
} from "@infinitas/shared";
import { Eye, Loader2, LogOut, Radio, RefreshCcw, ShieldAlert, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applySpectatorRoundConfirmation,
  buildSpectatorJoinMessage,
  buildSpectatorStateGetMessage,
  buildSpectatorWebSocketUrl,
  type FinalResultHistoryItem,
  type SpectatorConnectionState,
  upsertFinalResultHistory,
} from "../services/spectator-client";
import { useSettingsStore } from "../stores/settings-store";

const MAX_RESULT_HISTORY = 20;

interface SpectatorPageProps {
  roomId: string;
  initialJoinCode: string | null;
  onReturnToLobby: () => void;
}

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

function stateLabel(state: RoomStateSnapshot["room_state"] | null): string {
  switch (state) {
    case "LOBBY":
      return "待機中";
    case "PICKING":
      return "選曲中";
    case "PLAYING":
      return "対戦中";
    case "RESULT":
      return "結果表示";
    case "CLOSED":
      return "終了";
    default:
      return "状態未取得";
  }
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

function connectionLabel(state: SpectatorConnectionState): string {
  switch (state) {
    case "connecting":
      return "接続中";
    case "joined":
      return "接続済み";
    case "error":
      return "接続エラー";
    case "closed":
      return "切断済み";
    default:
      return "未接続";
  }
}

function joinRejectionMessage(reason: string): string {
  switch (reason) {
    case "JOIN_CODE_INVALID":
      return "合言葉が一致しません。入力し直して再接続してください。";
    case "ROOM_CLOSED":
    case "ROOM_NOT_FOUND":
    case "ROOM_STATE_LOST":
      return "ルームが見つからないか、すでに終了しています。ロビーに戻って選び直してください。";
    case "CLIENT_VERSION_UNSUPPORTED":
      return "このアプリのバージョンでは接続できません。最新版へ更新してください。";
    default:
      return `観戦接続が拒否されました (${reason})。`;
  }
}

function latestResultTitle(result: ResultReadyPayload | null): string {
  if (result === null) {
    return "まだ最終結果を受信していません";
  }
  if (result.summary.is_draw) {
    return "引き分け";
  }
  return result.summary.winner_player_ids.length > 0 ? "勝敗確定" : "結果確定";
}

function rankCurrentPlayers(snapshot: RoomStateSnapshot) {
  const confirmedByPlayer = new Map(
    (snapshot.current_round?.confirmed ?? []).map((entry) => [entry.player_id, entry]),
  );
  const descending = snapshot.settings.win_metric === "SCORE";
  const sorted = snapshot.players
    .map((player) => ({
      player,
      confirmed: confirmedByPlayer.get(player.player_id) ?? null,
    }))
    .sort((left, right) => {
      const leftMetric = left.confirmed?.metric_value;
      const rightMetric = right.confirmed?.metric_value;
      if (leftMetric === null || leftMetric === undefined) {
        return rightMetric === null || rightMetric === undefined ? 0 : 1;
      }
      if (rightMetric === null || rightMetric === undefined) {
        return -1;
      }
      return descending ? rightMetric - leftMetric : leftMetric - rightMetric;
    });

  let previousMetric: number | null = null;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const metric = entry.confirmed?.metric_value ?? null;
    const rank = metric === null ? null : metric === previousMetric ? previousRank : index + 1;
    if (metric !== null) {
      previousMetric = metric;
      previousRank = rank ?? index + 1;
    }
    return { ...entry, rank };
  });
}

function rankFinalPlayers(players: ResultReadyPlayer[]) {
  const sorted = [...players].sort((left, right) => {
    if ("total_points" in left && "total_points" in right) {
      return right.total_points - left.total_points || (right.total_ex_score ?? 0) - (left.total_ex_score ?? 0);
    }
    if ("round_wins" in left && "round_wins" in right) {
      return right.round_wins - left.round_wins;
    }
    return 0;
  });

  return sorted.map((player, index) => ({ player, rank: index + 1 }));
}

function finalPlayerSummary(player: ResultReadyPlayer): string {
  if ("total_points" in player) {
    return `合計 ${player.total_points} pt / EX SCORE ${player.total_ex_score ?? "-"}`;
  }
  return `ラウンド勝利 ${player.round_wins}`;
}

export function SpectatorPage({ roomId, initialJoinCode, onReturnToLobby }: SpectatorPageProps) {
  const apiBaseUrl = useSettingsStore((state) => state.saved.apiBaseUrl);
  const [joinCodeInput, setJoinCodeInput] = useState(initialJoinCode ?? "");
  const [connectionState, setConnectionState] = useState<SpectatorConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("観戦接続を準備しています。");
  const [snapshot, setSnapshot] = useState<RoomStateSnapshot | null>(null);
  const [finalResults, setFinalResults] = useState<FinalResultHistoryItem[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<RoomStateSnapshot | null>(null);
  const joinCodeRef = useRef(initialJoinCode ?? "");
  const spectatorId = useMemo(() => `spectator-${crypto.randomUUID()}`, []);
  const isConnecting = connectionState === "connecting";
  const isJoined = connectionState === "joined";
  const currentRound = snapshot?.current_round ?? null;
  const rankedPlayers = useMemo(() => (snapshot === null ? [] : rankCurrentPlayers(snapshot)), [snapshot]);
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

  const connect = useCallback((): void => {
    closeSocket(1000, "Reconnect requested.");
    snapshotRef.current = null;
    setSnapshot(null);
    setConnectionState("connecting");
    setConnectionMessage("観戦接続中...");

    let wsUrl: string;
    try {
      wsUrl = buildSpectatorWebSocketUrl(apiBaseUrl, roomId);
    } catch (error) {
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "接続先を作成できませんでした。");
      return;
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    const isStaleSocketEvent = (): boolean => socketRef.current !== socket;

    socket.addEventListener("open", () => {
      if (isStaleSocketEvent()) {
        return;
      }
      setConnectionMessage("観戦参加を確認中...");
      socket.send(JSON.stringify(buildSpectatorJoinMessage({
        roomId,
        spectatorId,
        joinCode: joinCodeRef.current,
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
        setConnectionMessage("受信データを読み取れませんでした。再接続してください。");
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
          setConnectionMessage("閲覧専用で接続しました。");
          return;
        }
        case "ROOM_UPDATED":
        case "STATE_SNAPSHOT": {
          const payload = message.payload as ServerMessagePayloadMap["ROOM_UPDATED"] | ServerMessagePayloadMap["STATE_SNAPSHOT"];
          applySnapshot(payload.room_state_snapshot);
          setConnectionMessage("ルーム状態を更新しました。");
          return;
        }
        case "PLAYER_ROUND_CONFIRMED": {
          const current = snapshotRef.current;
          if (current !== null) {
            applySnapshot(applySpectatorRoundConfirmation(current, message.payload as ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"]));
          }
          return;
        }
        case "RESULT_READY":
          setFinalResults((previous) =>
            upsertFinalResultHistory(previous, message.payload as ServerMessagePayloadMap["RESULT_READY"], new Date().toISOString(), MAX_RESULT_HISTORY),
          );
          return;
        case "ROOM_JOIN_REJECTED": {
          const payload = message.payload as ServerMessagePayloadMap["ROOM_JOIN_REJECTED"];
          setConnectionState("error");
          setConnectionMessage(joinRejectionMessage(payload.reason));
          return;
        }
        case "ERROR": {
          const payload = message.payload as ServerMessagePayloadMap["ERROR"];
          setConnectionState("error");
          setConnectionMessage(`ルーム状態を取得できませんでした (${payload.code})。再接続してください。`);
          return;
        }
        case "ROOM_CLOSED":
          setConnectionState("closed");
          setConnectionMessage("ルームが終了しました。ロビーに戻って別のルームを選べます。");
          return;
        default:
          return;
      }
    });

    socket.addEventListener("error", () => {
      if (!isStaleSocketEvent()) {
        setConnectionState("error");
        setConnectionMessage("ルームへ接続できませんでした。Room ID と接続先を確認してください。");
      }
    });

    socket.addEventListener("close", (closeEvent) => {
      if (isStaleSocketEvent()) {
        return;
      }
      socketRef.current = null;
      setConnectionState((current) => {
        if (current === "error") {
          return current;
        }
        setConnectionMessage(`観戦接続が切断されました (${closeEvent.code})。`);
        return "closed";
      });
    });
  }, [apiBaseUrl, applySnapshot, closeSocket, roomId, spectatorId]);

  const refreshState = useCallback((): void => {
    const socket = socketRef.current;
    if (socket === null || socket.readyState !== WebSocket.OPEN || !isJoined) {
      return;
    }
    socket.send(JSON.stringify(buildSpectatorStateGetMessage({ roomId, spectatorId })));
    setConnectionMessage("最新状態を取得中...");
  }, [isJoined, roomId, spectatorId]);

  useEffect(() => {
    connect();
    return () => {
      closeSocket(1000, "Spectator page unmounted.");
    };
  }, [closeSocket, connect]);

  return (
    <section className="relative flex min-h-full flex-col text-white">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${
            isJoined ? "border-red-400/30 bg-red-500/15 text-red-200" : "border-white/10 bg-white/5 text-gray-400"
          }`}>
            <Radio size={13} className={isJoined ? "animate-pulse" : ""} />
            LIVE
          </span>
          <span className="text-sm font-bold text-gray-300">{connectionLabel(connectionState)}</span>
          <span className="font-mono text-xs text-gray-500">Room ID: {roomId}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!isJoined}
            onClick={refreshState}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCcw size={16} />
            状態を更新
          </button>
          <button
            type="button"
            onClick={onReturnToLobby}
            className="inline-flex items-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition-all hover:bg-red-500/20"
          >
            <LogOut size={16} />
            切断
          </button>
        </div>
      </header>

      <div className={`mb-6 rounded-xl border px-4 py-3 text-sm font-bold ${
        connectionState === "error" ? "border-red-500/25 bg-red-500/10 text-red-200" : "border-white/5 bg-white/[0.03] text-gray-300"
      }`}>
        {connectionMessage}
      </div>

      {!isJoined ? (
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-white/5 bg-[#252526] p-5">
          <label className="min-w-[220px] flex-1 space-y-2">
            <span className="text-xs font-bold text-gray-400">合言葉</span>
            <input
              type="password"
              value={joinCodeInput}
              onChange={(event) => {
                const nextJoinCode = event.currentTarget.value.toUpperCase();
                joinCodeRef.current = nextJoinCode;
                setJoinCodeInput(nextJoinCode);
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-2.5 font-mono text-sm uppercase tracking-[0.25em] text-white outline-none transition-all focus:border-cyan-500/50"
              placeholder="必要な場合のみ入力"
              disabled={isConnecting}
            />
          </label>
          <button
            type="button"
            disabled={isConnecting}
            onClick={connect}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 font-black text-black transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-800/60 disabled:text-gray-300"
          >
            {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
            {isConnecting ? "接続中..." : "再接続"}
          </button>
          <button
            type="button"
            onClick={onReturnToLobby}
            className="rounded-lg border border-white/10 bg-white/5 px-5 py-3 font-bold text-gray-300 transition-all hover:bg-white/10"
          >
            ロビーへ戻る
          </button>
        </div>
      ) : null}

      {snapshot === null ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#252526]/60 p-10 text-center">
          <div>
            <ShieldAlert className="mx-auto mb-4 text-gray-600" size={36} />
            <p className="text-sm font-bold text-gray-500">ルーム状態を待っています。</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 rounded-xl border border-white/5 bg-[#252526] p-5 shadow-2xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.25em] text-gray-500">閲覧専用</p>
                <h1 className="mt-1 text-2xl font-black text-white">観戦モード</h1>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${stateBadgeClass(snapshot.room_state)}`}>
                {stateLabel(snapshot.room_state)}
              </span>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-4">
              <InfoTile label="対戦形式" value={snapshot.settings.mode} />
              <InfoTile label="勝敗基準" value={snapshot.settings.win_metric === "MISSCOUNT" ? "BP" : "EX SCORE"} />
              <InfoTile label="プレイスタイル" value={snapshot.settings.play_style} />
              <InfoTile label="参加人数" value={`${snapshot.players.length}/${snapshot.settings.max_players}`} />
            </div>

            <div className="mb-6 border-l-4 border-cyan-400 bg-black/20 p-5">
              <p className="mb-2 text-[10px] font-black tracking-[0.25em] text-cyan-300">現在のラウンド</p>
              {currentRound === null ? (
                <p className="text-sm font-bold text-gray-400">現在進行中のラウンドはありません。</p>
              ) : (
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-cyan-500 px-2 py-0.5 text-[10px] font-black text-black">{currentRound.expected_key.play_style}</span>
                    <span className="rounded border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-300">
                      {currentRound.expected_key.difficulty}
                    </span>
                    <span className="font-mono text-xs text-gray-500">第 {currentRound.round_index + 1} ラウンド</span>
                  </div>
                  <p className="text-2xl font-black tracking-tight">{currentRound.expected_key.title_search_key}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black tracking-[0.25em] text-gray-500">順位と進行状況</p>
              {rankedPlayers.map(({ player, confirmed, rank }) => (
                <div key={player.player_id} className="grid grid-cols-[52px_minmax(0,1fr)_100px_110px] items-center gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                  <span className="font-mono text-xl font-black text-amber-200">{rank === null ? "-" : `${rank}位`}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{player.display_name}</p>
                    <p className="text-[10px] font-bold text-gray-600">{player.connected ? "接続中" : "切断中"}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-400">{confirmed === null ? "結果待ち" : "確定済み"}</span>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-500">{snapshot.settings.win_metric === "MISSCOUNT" ? "BP" : "EX SCORE"}</p>
                    <p className="font-mono text-lg font-black text-cyan-200">{confirmed?.metric_value ?? "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="min-h-0 rounded-xl border border-white/5 bg-[#252526] p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <Trophy size={17} className="text-amber-300" />
              <h2 className="text-sm font-black tracking-[0.2em] text-gray-300">対戦結果履歴</h2>
            </div>
            <div className="mb-4 rounded-lg border border-white/5 bg-black/20 p-4">
              <p className="text-xs font-bold text-gray-500">最新結果</p>
              <p className="mt-1 text-lg font-black text-white">{latestResultTitle(latestResult)}</p>
            </div>
            <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
              {finalResults.length === 0 ? (
                <p className="rounded-lg border border-white/5 bg-black/20 p-3 text-sm font-bold text-gray-500">
                  対戦終了後、順位とスコアがここに追加されます。
                </p>
              ) : (
                finalResults.map((item) => (
                  <div key={item.payload.summary.match_id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-white">{latestResultTitle(item.payload)}</p>
                      <p className="text-[11px] text-gray-600">{formatDateTime(item.receivedAtIso)}</p>
                    </div>
                    <div className="space-y-2">
                      {rankFinalPlayers(item.payload.per_player.players).map(({ player, rank }) => (
                        <div key={player.player_id} className="flex items-center gap-3 border-t border-white/5 pt-2">
                          <span className="w-8 font-mono text-sm font-black text-amber-200">{rank}位</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-200">{player.display_name}</span>
                          <span className="text-right text-[11px] font-bold text-cyan-200">{finalPlayerSummary(player)}</span>
                        </div>
                      ))}
                    </div>
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
      <p className="text-[10px] font-black text-gray-600">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-gray-200">{value}</p>
    </div>
  );
}
