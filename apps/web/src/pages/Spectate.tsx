import {
  isServerMessageType,
  type ClientMessage,
  type CurrentRoundConfirmedPlayer,
  type ResultReadyPayload,
  type RoomStateSnapshot,
  type ServerMessage,
  type ServerMessagePayloadMap,
} from "@infinitas/shared";
import type { FC, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WEB_RUNTIME } from "../lib/config";

const SPECTATOR_CLIENT_VERSION = "1.2.0";
const MAX_RESULT_HISTORY = 20;

type SpectateConnectionState = "idle" | "connecting" | "joined" | "error" | "closed";
type SpectateThemeMode = "ARENA" | "BPL";

type ResultPlayer = ResultReadyPayload["per_player"]["players"][number];
type ArenaResultPlayer = Extract<ResultPlayer, { total_points: number }>;
type BplResultPlayer = Extract<ResultPlayer, { round_wins: number }>;

interface FinalResultHistoryItem {
  payload: ResultReadyPayload;
  receivedAtIso: string;
}

interface CurrentArenaRow {
  playerId: string;
  name: string;
  metricValue: number | null;
  rank: number | null;
  point: number | null;
}

interface CurrentBplRow {
  playerId: string;
  name: string;
  metricValue: number | null;
  isWinner: boolean;
  point: number | null;
}

interface ArenaHistoryRow {
  playerId: string;
  name: string;
  rank: number;
  point: number;
}

interface BplHistoryRow {
  playerId: string;
  name: string;
  isWinner: boolean;
  point: number;
}

interface MatchHistoryCard {
  matchId: string;
  mode: SpectateThemeMode;
  playedAt: string;
  keyLabel: string;
  arenaRows: ArenaHistoryRow[];
  bplRows: BplHistoryRow[];
}

const readRoomRef = (): string => {
  const raw = new URLSearchParams(window.location.search).get("r");
  return raw?.trim() ?? "";
};

const formatDateTime = (iso: string): string => {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return iso;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(parsed));
};

const buildSpectateWebSocketUrl = (roomRef: string): string => {
  const joinApiUrl = new URL(WEB_RUNTIME.joinApiEndpoint, window.location.origin);
  const wsUrl = new URL(`/api/rooms/${encodeURIComponent(roomRef)}/ws`, joinApiUrl.origin);
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  return wsUrl.toString();
};

const metricComparator = (winMetric: RoomStateSnapshot["settings"]["win_metric"] | null): ((left: number, right: number) => number) => {
  if (winMetric === "MISSCOUNT") {
    return (left, right) => left - right;
  }
  return (left, right) => right - left;
};

const rankByPoint = <TRow extends { point: number }>(rows: TRow[]): (TRow & { rank: number })[] => {
  const sorted = [...rows].sort((left, right) => right.point - left.point);
  let previousPoint: number | null = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const rank = previousPoint !== null && row.point === previousPoint ? previousRank : index + 1;
    previousPoint = row.point;
    previousRank = rank;
    return {
      ...row,
      rank,
    };
  });
};

const toThemeMode = (mode: string | null | undefined): SpectateThemeMode => (mode === "ARENA" ? "ARENA" : "BPL");

const isArenaResultPlayer = (player: ResultPlayer): player is ArenaResultPlayer => "total_points" in player;
const isBplResultPlayer = (player: ResultPlayer): player is BplResultPlayer => "round_wins" in player;

const buildMatchHistoryCard = (item: FinalResultHistoryItem): MatchHistoryCard => {
  const summaryMode = toThemeMode(item.payload.summary.mode);
  const representativeRound = item.payload.per_round.rounds.find((round) => round.played) ?? item.payload.per_round.rounds[0];
  const keyLabel =
    representativeRound === undefined
      ? "-"
      : `${representativeRound.expected_key.play_style} / ${representativeRound.expected_key.difficulty}`;

  const arenaPlayers = item.payload.per_player.players.filter(isArenaResultPlayer);
  const arenaRows = rankByPoint(
    arenaPlayers.map((player) => ({
      playerId: player.player_id,
      name: player.display_name,
      point: player.total_points,
    })),
  ).map((row) => ({
    playerId: row.playerId,
    name: row.name,
    rank: row.rank,
    point: row.point,
  }));

  const winnerSet = new Set(item.payload.summary.winner_player_ids);
  const bplPlayers = item.payload.per_player.players.filter(isBplResultPlayer);
  const bplRows = bplPlayers
    .map((player) => ({
      playerId: player.player_id,
      name: player.display_name,
      isWinner: winnerSet.has(player.player_id),
      point: player.round_wins,
    }))
    .sort((left, right) => {
      if (left.isWinner === right.isWinner) {
        return right.point - left.point;
      }
      return left.isWinner ? -1 : 1;
    });

  return {
    matchId: item.payload.summary.match_id,
    mode: summaryMode,
    playedAt: formatDateTime(item.receivedAtIso),
    keyLabel,
    arenaRows,
    bplRows,
  };
};

export const SpectatePage: FC = () => {
  const initialRoomRef = useMemo(readRoomRef, []);
  const [roomRefInput, setRoomRefInput] = useState(initialRoomRef);
  const roomRef = roomRefInput.trim();
  const spectatorId = useMemo(() => `spectator-${crypto.randomUUID()}`, []);
  const socketRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<RoomStateSnapshot | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [connectionState, setConnectionState] = useState<SpectateConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Room ID / Join Code を入力して接続してください");
  const [snapshot, setSnapshot] = useState<RoomStateSnapshot | null>(null);
  const [stickySnapshot, setStickySnapshot] = useState<RoomStateSnapshot | null>(null);
  const [finalResults, setFinalResults] = useState<FinalResultHistoryItem[]>([]);
  const [activeRoomRef, setActiveRoomRef] = useState<string | null>(null);

  const isConnected = connectionState === "joined";

  const closeSocket = useCallback((code: number, reason: string): void => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket !== null && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      socket.close(code, reason);
    }
  }, []);

  const sendClientMessage = useCallback((message: ClientMessage): void => {
    const socket = socketRef.current;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const upsertFinalResult = useCallback((payload: ResultReadyPayload): void => {
    const receivedAtIso = new Date().toISOString();
    setFinalResults((previous) => {
      const existingIndex = previous.findIndex((item) => item.payload.summary.match_id === payload.summary.match_id);
      const nextItem: FinalResultHistoryItem = { payload, receivedAtIso };
      if (existingIndex < 0) {
        return [nextItem, ...previous].slice(0, MAX_RESULT_HISTORY);
      }

      const withoutExisting = previous.filter((_, index) => index !== existingIndex);
      return [nextItem, ...withoutExisting].slice(0, MAX_RESULT_HISTORY);
    });
  }, []);

  const applyIncomingSnapshot = useCallback((nextSnapshot: RoomStateSnapshot): void => {
    const previousSnapshot = snapshotRef.current;
    const previousRoundIndex = previousSnapshot?.current_round?.round_index ?? null;
    const nextRoundIndex = nextSnapshot.current_round?.round_index ?? null;
    const previousHadConfirmed = (previousSnapshot?.current_round?.confirmed.length ?? 0) > 0;
    const roundAdvanced =
      previousRoundIndex !== null &&
      nextRoundIndex !== null &&
      nextRoundIndex > previousRoundIndex;
    const movedToResult =
      previousRoundIndex !== null &&
      nextRoundIndex === null &&
      nextSnapshot.room_state === "RESULT";
    if ((roundAdvanced || movedToResult) && previousHadConfirmed && previousSnapshot !== null) {
      setStickySnapshot(previousSnapshot);
    }

    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const disconnect = useCallback((): void => {
    closeSocket(1000, "Manual disconnect.");
    setConnectionState("idle");
    setConnectionMessage("切断しました。再接続できます。");
    snapshotRef.current = null;
    setSnapshot(null);
    setStickySnapshot(null);
  }, [closeSocket]);

  const connect = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      if (roomRef.length === 0) {
        setConnectionState("error");
        setConnectionMessage("Room ID を入力してください");
        return;
      }

      closeSocket(1000, "Reconnect requested.");
      if (activeRoomRef !== null && activeRoomRef !== roomRef) {
        setFinalResults([]);
      }
      setActiveRoomRef(roomRef);
      snapshotRef.current = null;
      setSnapshot(null);
      setStickySnapshot(null);
      setConnectionState("connecting");
      setConnectionMessage("接続中...");

      const wsUrl = buildSpectateWebSocketUrl(roomRef);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionMessage("観戦参加を送信中...");
        sendClientMessage({
          type: "ROOM_JOIN",
          client_msg_id: crypto.randomUUID(),
          room_id: roomRef,
          player_id: spectatorId,
          payload: {
            session_kind: "SPECTATOR",
            client_version: SPECTATOR_CLIENT_VERSION,
            ...(joinCode.trim().length > 0 ? { join_code: joinCode.trim() } : {}),
          },
        });
      });

      socket.addEventListener("message", (messageEvent) => {
        if (typeof messageEvent.data !== "string") {
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(messageEvent.data);
        } catch {
          setConnectionState("error");
          setConnectionMessage("受信データの解析に失敗しました");
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
            applyIncomingSnapshot(payload.room_state_snapshot);
            setConnectionState("joined");
            setConnectionMessage("CONNECTED");
            return;
          }
          case "ROOM_UPDATED":
          case "STATE_SNAPSHOT": {
            const payload = message.payload as ServerMessagePayloadMap["ROOM_UPDATED"] | ServerMessagePayloadMap["STATE_SNAPSHOT"];
            applyIncomingSnapshot(payload.room_state_snapshot);
            return;
          }
          case "PLAYER_ROUND_CONFIRMED": {
            const payload = message.payload as ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"];
            const current = snapshotRef.current;
            if (current === null || current.current_round === null || current.current_round.round_index !== payload.round_index) {
              return;
            }

            const nextConfirmed = [...current.current_round.confirmed];
            const nextPlayer: CurrentRoundConfirmedPlayer = {
              player_id: payload.player_id,
              status: payload.status,
              metric_value: payload.metric_value,
              reason: payload.reason ?? "OTHER",
              submitted_by: payload.submitted_by,
              submitted_at: payload.submitted_at,
              source_meta: payload.source_meta,
            };
            const existingIndex = nextConfirmed.findIndex((item) => item.player_id === payload.player_id);
            if (existingIndex >= 0) {
              nextConfirmed[existingIndex] = nextPlayer;
            } else {
              nextConfirmed.push(nextPlayer);
            }

            const nextSnapshot: RoomStateSnapshot = {
              ...current,
              current_round: {
                ...current.current_round,
                confirmed: nextConfirmed,
              },
            };
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            return;
          }
          case "RESULT_READY": {
            const payload = message.payload as ServerMessagePayloadMap["RESULT_READY"];
            upsertFinalResult(payload);
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
        setConnectionState("error");
        setConnectionMessage("接続エラー");
      });

      socket.addEventListener("close", (closeEvent) => {
        socketRef.current = null;
        setConnectionState("closed");
        setConnectionMessage(`切断 (${closeEvent.code})`);
      });
    },
    [activeRoomRef, applyIncomingSnapshot, closeSocket, joinCode, roomRef, sendClientMessage, spectatorId, upsertFinalResult],
  );

  useEffect(
    () => () => {
      closeSocket(1000, "Spectate page unmounted.");
    },
    [closeSocket],
  );

  useEffect(() => {
    if (stickySnapshot === null || snapshot === null) {
      return;
    }

    const stickyRoundIndex = stickySnapshot.current_round?.round_index ?? null;
    const liveRoundIndex = snapshot.current_round?.round_index ?? null;
    const liveHasProgress = (snapshot.current_round?.confirmed.length ?? 0) > 0;
    const movedAwayFromSticky = stickyRoundIndex !== liveRoundIndex;

    if (movedAwayFromSticky && liveHasProgress) {
      setStickySnapshot(null);
      return;
    }

    if (snapshot.room_state === "LOBBY" && snapshot.current_round === null) {
      setStickySnapshot(null);
    }
  }, [snapshot, stickySnapshot]);

  const latestResult = finalResults[0]?.payload ?? null;
  const resultDisplaySnapshot = stickySnapshot ?? snapshot;
  const livePreviewSnapshot = snapshot;
  const themeMode = toThemeMode(snapshot?.settings.mode ?? resultDisplaySnapshot?.settings.mode ?? latestResult?.summary.mode);
  const isArenaTheme = themeMode === "ARENA";
  const connectedBackgroundClass = isArenaTheme ? "bg-[#1a1a2e]" : "bg-[#1e1a1a]";
  const headingAccentClass = isArenaTheme ? "text-cyan-400" : "text-amber-400";
  const statusBadgeClass = isArenaTheme ? "bg-cyan-400 text-black" : "bg-amber-400 text-black";
  const activeResultPointClass = isArenaTheme ? "text-cyan-400" : "text-amber-400";
  const isShowingPreviousRoundResult =
    stickySnapshot !== null &&
    snapshot !== null &&
    stickySnapshot.current_round?.round_index !== snapshot.current_round?.round_index;

  const currentRound = resultDisplaySnapshot?.current_round ?? null;
  const currentRoundFrozen = useMemo(() => {
    if (resultDisplaySnapshot === null || currentRound === null) {
      return null;
    }
    return resultDisplaySnapshot.frozen_rounds.find((round) => round.round_index === currentRound.round_index) ?? null;
  }, [currentRound, resultDisplaySnapshot]);

  const livePreviewRoundIndex = useMemo(() => {
    if (livePreviewSnapshot === null || livePreviewSnapshot.current_round === null) {
      return null;
    }
    // When sticky is active, the upper section is showing the previous round result.
    // In that case the preview should point to the live current round (not +1).
    if (isShowingPreviousRoundResult) {
      return livePreviewSnapshot.current_round.round_index;
    }
    return livePreviewSnapshot.current_round.round_index + 1;
  }, [isShowingPreviousRoundResult, livePreviewSnapshot]);

  const livePreviewRoundFrozen = useMemo(() => {
    if (livePreviewSnapshot === null || livePreviewRoundIndex === null) {
      return null;
    }
    return livePreviewSnapshot.frozen_rounds.find((round) => round.round_index === livePreviewRoundIndex) ?? null;
  }, [livePreviewRoundIndex, livePreviewSnapshot]);

  const currentSongTitle = currentRoundFrozen?.display.title ?? currentRound?.expected_key.title_search_key ?? "WAITING...";
  const currentLevelLabel =
    currentRoundFrozen?.display.level === null || currentRoundFrozen?.display.level === undefined
      ? "-"
      : `☆${currentRoundFrozen.display.level}`;
  const currentPlayStyle = currentRound?.expected_key.play_style ?? "-";
  const currentDifficulty = currentRound?.expected_key.difficulty ?? "-";
  const currentMetricLabel = resultDisplaySnapshot?.settings.win_metric === "MISSCOUNT" ? "Miss Count" : "EX Score";

  const livePreviewSongTitle = livePreviewRoundFrozen?.display.title ?? livePreviewRoundFrozen?.expected_key.title_search_key ?? "次曲準備中";
  const livePreviewLevelLabel =
    livePreviewRoundFrozen?.display.level === null || livePreviewRoundFrozen?.display.level === undefined
      ? "-"
      : `☆${livePreviewRoundFrozen.display.level}`;
  const livePreviewPlayStyle = livePreviewRoundFrozen?.expected_key.play_style ?? "-";
  const livePreviewDifficulty = livePreviewRoundFrozen?.expected_key.difficulty ?? "-";

  const currentArenaRows = useMemo<CurrentArenaRow[]>(() => {
    if (resultDisplaySnapshot === null || currentRound === null) {
      return [];
    }

    const confirmedMap = new Map<string, CurrentRoundConfirmedPlayer>();
    for (const confirmed of currentRound.confirmed) {
      confirmedMap.set(confirmed.player_id, confirmed);
    }

    const measuredRows = resultDisplaySnapshot.players
      .map((player) => ({
        playerId: player.player_id,
        name: player.display_name,
        metricValue: confirmedMap.get(player.player_id)?.metric_value ?? null,
      }))
      .filter((row) => row.metricValue !== null)
      .sort((left, right) =>
        metricComparator(resultDisplaySnapshot.settings.win_metric)(left.metricValue as number, right.metricValue as number),
      );

    let previousMetric: number | null = null;
    let previousRank = 0;
    const rankedRows = measuredRows.map((row, index) => {
      const metric = row.metricValue as number;
      const rank = previousMetric !== null && previousMetric === metric ? previousRank : index + 1;
      previousMetric = metric;
      previousRank = rank;
      return {
        playerId: row.playerId,
        name: row.name,
        metricValue: metric,
        rank,
        point: rank === 1 ? 2 : rank === 2 ? 1 : 0,
      };
    });

    const measuredPlayerIdSet = new Set(rankedRows.map((row) => row.playerId));
    const pendingRows = resultDisplaySnapshot.players
      .filter((player) => !measuredPlayerIdSet.has(player.player_id))
      .map((player) => ({
        playerId: player.player_id,
        name: player.display_name,
        metricValue: null,
        rank: null,
        point: null,
      }));

    return [...rankedRows, ...pendingRows];
  }, [currentRound, resultDisplaySnapshot]);

  const currentBplRows = useMemo<CurrentBplRow[]>(() => {
    if (resultDisplaySnapshot === null || currentRound === null) {
      return [];
    }

    const confirmedMap = new Map<string, CurrentRoundConfirmedPlayer>();
    for (const confirmed of currentRound.confirmed) {
      confirmedMap.set(confirmed.player_id, confirmed);
    }

    const measuredRows = resultDisplaySnapshot.players
      .map((player) => ({
        playerId: player.player_id,
        name: player.display_name,
        metricValue: confirmedMap.get(player.player_id)?.metric_value ?? null,
      }))
      .filter((row) => row.metricValue !== null)
      .sort((left, right) =>
        metricComparator(resultDisplaySnapshot.settings.win_metric)(left.metricValue as number, right.metricValue as number),
      );

    const bestMetric = measuredRows[0]?.metricValue ?? null;
    const winnerPlayerIdSet = new Set(
      measuredRows
        .filter((row) => bestMetric !== null && row.metricValue === bestMetric)
        .map((row) => row.playerId),
    );

    const mergedRows = resultDisplaySnapshot.players.map((player) => {
      const measured = measuredRows.find((row) => row.playerId === player.player_id) ?? null;
      const isWinner = measured !== null && winnerPlayerIdSet.has(player.player_id);
      return {
        playerId: player.player_id,
        name: player.display_name,
        metricValue: measured?.metricValue ?? null,
        isWinner,
        point: measured === null ? null : isWinner ? 1 : 0,
      };
    });

    return mergedRows.sort((left, right) => {
      if (left.metricValue === null && right.metricValue === null) {
        return 0;
      }
      if (left.metricValue === null) {
        return 1;
      }
      if (right.metricValue === null) {
        return -1;
      }
      if (left.isWinner !== right.isWinner) {
        return left.isWinner ? -1 : 1;
      }
      return metricComparator(resultDisplaySnapshot.settings.win_metric)(left.metricValue, right.metricValue);
    });
  }, [currentRound, resultDisplaySnapshot]);

  const matchHistoryCards = useMemo<MatchHistoryCard[]>(() => finalResults.map(buildMatchHistoryCard), [finalResults]);

  if (!isConnected) {
    return (
      <div className="h-screen bg-[#1e1e1e] flex flex-col items-center justify-center text-white relative">
        <div className="bg-[#252526] p-8 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-200">Spectator Connect</h2>

          <form onSubmit={connect} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Room ID</label>
              <input
                type="text"
                value={roomRefInput}
                onChange={(event) => {
                  setRoomRefInput(event.target.value);
                }}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                placeholder="0000-0000"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Join Code</label>
              <input
                type="password"
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(event.target.value.toUpperCase());
                }}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono tracking-widest"
                placeholder="OPTIONAL"
              />
            </div>

            <button
              type="submit"
              disabled={connectionState === "connecting"}
              className="w-full py-3 rounded font-bold mt-4 transition-all bg-cyan-500 text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-cyan-800/60 disabled:text-gray-300"
            >
              {connectionState === "connecting" ? "CONNECTING..." : "CONNECT TO MATCH"}
            </button>
          </form>

          <p className="text-xs text-center text-gray-500 mt-4">
            接続完了後、このフォームはOBS映り込み防止のため非表示になります。
          </p>
          <p className="text-xs text-center text-gray-500 mt-1">
            切断は接続後画面の左上にある薄い「Disconnect」ボタンから実行します。
          </p>
          <p className="text-xs text-center text-gray-400 mt-2">{connectionMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen ${connectedBackgroundClass} text-white flex flex-col p-6 overflow-hidden relative font-sans`}>
      <div className="absolute top-2 left-2 z-[100] opacity-10 hover:opacity-100 transition-opacity flex gap-2">
        <button
          type="button"
          onClick={disconnect}
          className="px-2 py-1 bg-black/50 backdrop-blur-sm text-gray-400 text-[10px] font-bold rounded border border-white/10 hover:border-gray-400"
        >
          Disconnect
        </button>
      </div>

      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-3xl font-black italic tracking-tighter uppercase ${headingAccentClass}`} style={{ fontStyle: "italic" }}>
            SPECTATOR <span className="text-white">VIEW</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-gray-400 tracking-widest">LIVE / {themeMode} MODE</span>
            <span className="text-xs text-gray-600 font-mono ml-2">ID: {roomRef || "----"}</span>
          </div>
        </div>
      </header>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-2/3 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm">
            <div
              className={`absolute top-0 right-0 w-64 h-64 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 ${isArenaTheme ? "bg-cyan-500" : "bg-amber-500"}`}
            />

            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 pl-2 border-l-2 border-gray-500">
              Current Match
            </h2>
            {isShowingPreviousRoundResult ? (
              <p className="text-xs text-gray-500 mb-2">直前ラウンド結果を保持中（次ラウンドの提出が始まるまで表示）</p>
            ) : null}

            <div className="flex items-center gap-4 mb-8 border-l-4 border-l-white pl-4 py-2">
              <div className="flex flex-col">
                {currentRound !== null ? (
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${statusBadgeClass}`}>{currentPlayStyle}</span>
                    <span className="text-xs font-bold text-red-400 uppercase border border-red-400/30 px-1.5 rounded bg-red-500/10">
                      {currentDifficulty}
                    </span>
                    <span className="text-xs font-bold text-gray-400">{currentLevelLabel}</span>
                  </div>
                ) : null}
                <h3 className="text-3xl font-bold">{currentSongTitle}</h3>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {currentRound === null ? (
                <div className="p-4 rounded-lg border border-white/10 bg-black/20 text-gray-400 text-sm">
                  現在進行中のラウンドはありません。次ラウンド開始を待機中です。
                </div>
              ) : isArenaTheme ? (
                currentArenaRows.map((row) => (
                  <div
                    key={row.playerId}
                    className={`flex items-center p-3 rounded-lg border ${row.rank === 1 ? "border-amber-400/50 bg-amber-400/10" : "border-white/5 bg-black/20"}`}
                  >
                    <div className={`w-8 text-center font-black italic text-xl ${row.rank === 1 ? "text-amber-400" : "text-gray-500"}`}>
                      {row.rank ?? "-"}
                    </div>
                    <div className="flex-1 ml-4 font-bold text-lg">{row.name}</div>
                    <div className="text-right flex items-end gap-3">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">{currentMetricLabel}</span>
                        <span className="font-mono text-2xl tracking-tight leading-none">{row.metricValue ?? "-"}</span>
                      </div>
                      <div className="flex flex-col text-right w-16">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Points</span>
                        <span className={`font-black text-xl italic leading-none ${row.point !== null && row.point > 0 ? activeResultPointClass : "text-gray-500"}`}>
                          {row.point === null ? "-" : `+${row.point}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                currentBplRows.map((row) => (
                  <div
                    key={row.playerId}
                    className={`flex items-center p-4 rounded-lg border ${row.isWinner ? "border-amber-400/50 bg-amber-400/10" : "border-white/5 bg-black/20"}`}
                  >
                    <div className="flex flex-col gap-1 w-12 items-center">
                      {row.isWinner ? <span className="text-amber-400 font-black text-xs uppercase animate-pulse">WIN</span> : null}
                    </div>
                    <div className="flex-1 ml-2 font-bold text-2xl">{row.name}</div>
                    <div className="text-right flex items-end gap-4">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">{currentMetricLabel}</span>
                        <span className="font-mono text-3xl tracking-tight leading-none">{row.metricValue ?? "-"}</span>
                      </div>
                      <div className="flex flex-col text-right w-16">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Points</span>
                        <span className={`font-black text-2xl italic leading-none ${row.point !== null && row.point > 0 ? activeResultPointClass : "text-gray-500"}`}>
                          {row.point === null ? "-" : `+${row.point}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LIVE Next Preview</p>
              {livePreviewRoundFrozen === null ? (
                <p className="mt-2 text-sm text-gray-400">次曲準備中</p>
              ) : (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${statusBadgeClass}`}>{livePreviewPlayStyle}</span>
                    <span className="text-[10px] font-bold text-red-400 uppercase border border-red-400/30 px-1.5 rounded bg-red-500/10">
                      {livePreviewDifficulty}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{livePreviewLevelLabel}</span>
                    <span className="text-[10px] font-bold text-gray-500 ml-2">Round {livePreviewRoundFrozen.round_index}</span>
                  </div>
                  <p className="text-lg font-bold leading-tight">{livePreviewSongTitle}</p>
                </div>
              )}
              {isShowingPreviousRoundResult ? (
                <p className="mt-2 text-[11px] text-gray-500">上段は直前ラウンド結果を保持中です（次曲の提出開始まで）。</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="w-1/3 flex flex-col gap-2">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2 pl-2 border-l-2 border-gray-500">
            Match History
          </h2>

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 pb-8">
            {matchHistoryCards.length === 0 ? (
              <div className="bg-[#252526] border border-white/10 rounded-lg p-3 text-sm text-gray-400">
                RESULT_READYを受信すると履歴がここに追加されます。
              </div>
            ) : (
              matchHistoryCards.map((card) => (
                <div key={card.matchId} className="bg-[#252526] border border-white/10 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2 font-bold">
                    Match ID: {card.matchId} // <span className="text-gray-300">{card.playedAt}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mb-2 font-bold uppercase">Key: {card.keyLabel}</div>

                  <div className="flex flex-col gap-1">
                    {card.mode === "ARENA"
                      ? card.arenaRows.map((row) => (
                          <div key={row.playerId} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black w-4 text-center ${row.rank === 1 ? "text-amber-400" : "text-gray-500"}`}>
                                {row.rank}
                              </span>
                              <span className={`font-bold ${row.rank === 1 ? "text-white" : "text-gray-400"}`}>{row.name}</span>
                            </div>
                            <span className={`font-black italic text-xs ${row.point > 0 ? "text-cyan-400" : "text-gray-500"}`}>
                              {row.point} pt
                            </span>
                          </div>
                        ))
                      : card.bplRows.map((row) => (
                          <div
                            key={row.playerId}
                            className={`flex justify-between items-center text-sm p-1 rounded ${row.isWinner ? "bg-white/5" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              {row.isWinner ? (
                                <span className="text-amber-400 text-xs font-black w-4 text-center">★</span>
                              ) : (
                                <span className="w-4" />
                              )}
                              <span className={`font-bold ${row.isWinner ? "text-white" : "text-gray-400"}`}>{row.name}</span>
                            </div>
                            <span className={`font-black italic text-xs ${row.point > 0 ? "text-amber-400" : "text-gray-500"}`}>
                              {row.point} pt
                            </span>
                          </div>
                        ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
