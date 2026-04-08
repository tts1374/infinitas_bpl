import {
  MATCHMAKING_ARENA_MAX_PLAYERS,
  MATCHMAKING_ARENA_MIN_PLAYERS,
  MATCHMAKING_INITIAL_RATING_RANGE,
  PLAY_STYLES,
  WIN_METRICS,
  type MatchmakingQueueTicket,
  type Mode,
  type PlayStyle,
  type WinMetric,
} from "@infinitas/shared";
import { Activity, CheckCircle2, ChevronRight, Radar, Settings2, Swords, UserRound, Users, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppView } from "../components/AppSidebar";
import { getCurrentRating } from "../features/stats/stats";
import {
  cancelMatchmakingQueueTicket,
  enqueueMatchmakingQueue,
  getMatchmakingQueueTicket,
  getMatchmakingWaitingCount,
} from "../services/worker-api-client";
import { roomStore, useRoomStore } from "../stores/room-store";
import { useStatsArchiveStore } from "../services/stats-archive";
import { isRoomEntryReady, useSettingsStore } from "../stores/settings-store";

interface AutoMatchProps {
  onNavigate?: (screen: AppView) => void;
}

type MatchState = "CONFIG" | "IN_QUEUE" | "MATCH_FOUND";

const QUEUE_POLL_INTERVAL_MS = 2_000;
const WAITING_COUNT_POLL_INTERVAL_MS = 5_000;
const CANCEL_TOAST_HIDE_DELAY_MS = 3_000;
const AUTO_MATCH_PHASE1_MODES: Mode[] = ["ARENA", "BPL4"];

function getModeDescription(mode: Mode): string {
  if (mode === "ARENA") {
    return "最大4人でのリアルタイム対戦";
  }
  if (mode === "BPL4") {
    return "2人固定・4 STAGE";
  }
  return "2人固定・3 STAGE";
}

function getModeCardLabel(mode: Mode): string {
  if (mode === "BPL4") {
    return "BPL(4 STAGE)";
  }
  return mode;
}

function getQueuedPlayersLabel(mode: Mode): string {
  return mode === "ARENA"
    ? `${MATCHMAKING_ARENA_MIN_PLAYERS}-${MATCHMAKING_ARENA_MAX_PLAYERS}`
    : "2";
}

function formatCurrentRating(value: number | null): string {
  return value === null ? "--" : String(Math.round(value));
}

function formatQueueSeconds(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AutoMatchPage({ onNavigate }: AutoMatchProps) {
  const savedSettings = useSettingsStore((state) => state.saved);
  const statsArchive = useStatsArchiveStore((state) => state.archive);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);
  const roomSnapshot = useRoomStore((state) => state.snapshot);
  const roomEntryReady = isRoomEntryReady(savedSettings);
  const roomEntryRequiredMessage = "DJ NAME と DATA SOURCE を設定してから自動マッチを開始してください。";

  const [matchState, setMatchState] = useState<MatchState>("CONFIG");
  const [mode, setMode] = useState<Mode>("ARENA");
  const [playStyle, setPlayStyle] = useState<PlayStyle>("SP");
  const [winMetric, setWinMetric] = useState<WinMetric>("SCORE");
  const [ticket, setTicket] = useState<MatchmakingQueueTicket | null>(null);
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const [queueTimeSeconds, setQueueTimeSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [displayedPlayers, setDisplayedPlayers] = useState(1);
  const [playerIncreasePulse, setPlayerIncreasePulse] = useState(false);
  const previousFoundPlayersRef = useRef(1);
  const waitingCountRequestIdRef = useRef(0);
  const statusMessageTimerIdRef = useRef<number | null>(null);

  const currentRating = getCurrentRating(statsArchive, mode === "ARENA" ? "ARENA" : "BPL", playStyle);
  const estimatedRating = currentRating ?? 1500;
  const ticketId = ticket?.ticket_id ?? null;
  const currentTolerance = ticket?.current_tolerance ?? MATCHMAKING_INITIAL_RATING_RANGE;
  const queuedPlayersLabel = getQueuedPlayersLabel(mode);
  const queuePlayerLimit = mode === "ARENA" ? MATCHMAKING_ARENA_MAX_PLAYERS : 2;
  const foundPlayers = ticket === null
    ? 1
    : ticket.status === "MATCHED"
      ? ticket.matched_player_count ?? 1
      : Math.min(ticket.candidate_count + 1, queuePlayerLimit);

  useEffect(() => {
    if (matchState !== "IN_QUEUE") {
      previousFoundPlayersRef.current = 1;
      setDisplayedPlayers(1);
      setPlayerIncreasePulse(false);
      return;
    }

    let pulseTimerId: number | undefined;
    if (foundPlayers > previousFoundPlayersRef.current) {
      setPlayerIncreasePulse(true);
      pulseTimerId = window.setTimeout(() => {
        setPlayerIncreasePulse(false);
      }, 850);
    }
    previousFoundPlayersRef.current = foundPlayers;
    setDisplayedPlayers(foundPlayers);
    return () => {
      if (pulseTimerId !== undefined) {
        window.clearTimeout(pulseTimerId);
      }
    };
  }, [foundPlayers, matchState]);

  useEffect(() => {
    if (matchState !== "MATCH_FOUND") {
      return;
    }

    if (roomSnapshot !== null || roomConnectionStatus === "CONNECTING" || roomConnectionStatus === "JOINING") {
      return;
    }

    if (roomConnectionStatus !== "ERROR" && roomConnectionStatus !== "CLOSED") {
      return;
    }

    if (ticket?.status !== "MATCHED" || ticket.room_id === null) {
      return;
    }

    setMatchState("IN_QUEUE");
    setStatusMessage("ルームへの接続に失敗しました。再試行します。");
  }, [matchState, roomConnectionStatus, roomSnapshot, ticket]);

  useEffect(() => {
    return () => {
      if (statusMessageTimerIdRef.current !== null) {
        window.clearTimeout(statusMessageTimerIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (matchState !== "CONFIG") {
      setWaitingCount(null);
      return;
    }

    const requestId = waitingCountRequestIdRef.current + 1;
    waitingCountRequestIdRef.current = requestId;
    let disposed = false;
    setWaitingCount(null);

    const refreshWaitingCount = async (): Promise<void> => {
      try {
        const response = await getMatchmakingWaitingCount(savedSettings.apiBaseUrl, {
          mode,
          play_style: playStyle,
          win_metric: winMetric,
        });
        if (disposed || requestId !== waitingCountRequestIdRef.current) {
          return;
        }
        setWaitingCount(response.waiting_count);
      } catch {
        if (disposed || requestId !== waitingCountRequestIdRef.current) {
          return;
        }
        setWaitingCount(null);
      }
    };

    void refreshWaitingCount();
    const intervalId = window.setInterval(() => {
      void refreshWaitingCount();
    }, WAITING_COUNT_POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [matchState, mode, playStyle, winMetric, savedSettings.apiBaseUrl]);

  function connectToMatchedRoom(roomId: string): boolean {
    return roomStore.connect(
      { roomId },
      {
        apiBaseUrl: savedSettings.apiBaseUrl,
        playerId: savedSettings.playerId,
        displayName: savedSettings.displayName,
        source: savedSettings.source,
        bitUnlockEnabled: savedSettings.bitUnlockEnabled,
        djpUnlockEnabled: savedSettings.djpUnlockEnabled,
        allowLeggendaria: savedSettings.allowLeggendaria,
        ownedPackIds: savedSettings.ownedPackIds,
      },
    );
  }

  useEffect(() => {
    if (matchState !== "IN_QUEUE") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setQueueTimeSeconds((current) => current + 1);
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [matchState, ticketId]);

  useEffect(() => {
    if (matchState !== "IN_QUEUE" || ticketId === null) {
      return;
    }

    let disposed = false;

    const pollTicket = async (): Promise<void> => {
      try {
        const nextTicket = await getMatchmakingQueueTicket(savedSettings.apiBaseUrl, ticketId);
        if (disposed) {
          return;
        }

        setTicket(nextTicket);
        if (nextTicket.status === "MATCHED" && nextTicket.room_id !== null) {
          setMatchState("MATCH_FOUND");
          setStatusMessage(`マッチ成立: ルーム ${nextTicket.room_id} に接続しています。`);
          const connected = connectToMatchedRoom(nextTicket.room_id);
          if (!connected) {
            setMatchState("IN_QUEUE");
            setStatusMessage("ルームへの接続に失敗しました。再試行します。");
          }
          return;
        }
        if (nextTicket.status === "CANCELLED") {
          setMatchState("CONFIG");
          setQueueTimeSeconds(0);
          setTicket(null);
          setStatusMessage("マッチングキューはキャンセルされました。");
        }
      } catch (error) {
        if (disposed) {
          return;
        }
        setMatchState("CONFIG");
        setQueueTimeSeconds(0);
        setTicket(null);
        setStatusMessage(error instanceof Error ? error.message : "マッチング状態の取得に失敗しました。");
      }
    };

    void pollTicket();
    const intervalId = window.setInterval(() => {
      void pollTicket();
    }, QUEUE_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [matchState, ticketId, savedSettings.apiBaseUrl]);

  async function handleStartQueue(): Promise<void> {
    if (busy) {
      return;
    }
    if (!roomEntryReady) {
      setStatusMessage(roomEntryRequiredMessage);
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    setQueueTimeSeconds(0);

    try {
      const nextTicket = await enqueueMatchmakingQueue(savedSettings.apiBaseUrl, {
        mode,
        play_style: playStyle,
        win_metric: winMetric,
        rating: Math.max(0, Math.trunc(estimatedRating)),
        player_id: savedSettings.playerId,
        display_name: savedSettings.displayName.trim(),
      });

      setTicket(nextTicket);
      if (nextTicket.status === "MATCHED" && nextTicket.room_id !== null) {
        setMatchState("MATCH_FOUND");
        setStatusMessage(`マッチ成立: ルーム ${nextTicket.room_id} に接続しています。`);
        const connected = connectToMatchedRoom(nextTicket.room_id);
        if (!connected) {
          setMatchState("IN_QUEUE");
          setStatusMessage("ルームへの接続に失敗しました。再試行します。");
        }
      } else {
        setMatchState("IN_QUEUE");
      }
    } catch (error) {
      setMatchState("CONFIG");
      setStatusMessage(error instanceof Error ? error.message : "マッチングキューへの参加に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelQueue(): Promise<void> {
    const currentTicketId = ticket?.ticket_id;

    if (!currentTicketId || busy) {
      return;
    }

    setBusy(true);
    try {
      await cancelMatchmakingQueueTicket(savedSettings.apiBaseUrl, currentTicketId);
      setMatchState("CONFIG");
      setQueueTimeSeconds(0);
      setTicket(null);
      const message = "マッチングキューをキャンセルしました。";
      setStatusMessage(message);
      if (statusMessageTimerIdRef.current !== null) {
        window.clearTimeout(statusMessageTimerIdRef.current);
      }
      statusMessageTimerIdRef.current = window.setTimeout(() => {
        setStatusMessage((current) => (current === message ? null : current));
        statusMessageTimerIdRef.current = null;
      }, CANCEL_TOAST_HIDE_DELAY_MS);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "マッチングキューのキャンセルに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0f] font-sans text-white">
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0a0a0f] to-[#0a0a0f]" />
        <div className="absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />

        <header className="relative z-10 flex items-center justify-between px-12 pb-6 pt-12">
          <div>
            <h1 className="flex items-center gap-4 text-4xl font-black tracking-tight">
              <Zap className="text-cyan-400" size={32} />
              AUTO MATCH
            </h1>
            <p className="mt-2 font-medium tracking-wide text-gray-400">
              自動マッチングシステム
            </p>
          </div>
          {matchState === "CONFIG" ? (
            <button
              type="button"
              onClick={() => onNavigate?.("lobby")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-all hover:bg-white/10"
            >
              <X size={20} className="text-gray-400" />
            </button>
          ) : null}
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-8">
          {matchState === "CONFIG" ? (
            <div className="grid w-full max-w-5xl animate-in grid-cols-[1fr_420px] items-start gap-8 fade-in slide-in-from-bottom-8 duration-500">
              <div className="rounded-3xl border border-white/5 bg-[#15151a] p-8 shadow-2xl">
                <h2 className="mb-8 flex items-center gap-3 text-xl font-bold text-white/90">
                  <Settings2 className="text-cyan-400" /> Condition Settings
                </h2>

                  <div className="space-y-8">
                    <div>
                      <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">Match Mode</label>
                      <div className="grid grid-cols-2 gap-4">
                      {AUTO_MATCH_PHASE1_MODES.map((candidateMode) => (
                        <button
                          type="button"
                          key={candidateMode}
                          onClick={() => setMode(candidateMode)}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            mode === candidateMode
                              ? "border-indigo-500 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                              : "border-white/5 bg-white/[0.02] text-gray-400 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${mode === candidateMode ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5"}`}>
                            {candidateMode === "ARENA" ? <Users size={20} /> : <Swords size={20} />}
                          </div>
                          <div className="text-lg font-bold">{getModeCardLabel(candidateMode)}</div>
                          <div className="mt-1 text-[10px] font-medium opacity-60">
                            {getModeDescription(candidateMode)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">Play Style</label>
                      <div className="flex rounded-xl bg-black/40 p-1">
                        {PLAY_STYLES.map((candidatePlayStyle) => (
                          <button
                            type="button"
                            key={candidatePlayStyle}
                            onClick={() => setPlayStyle(candidatePlayStyle)}
                            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                              playStyle === candidatePlayStyle
                                ? "bg-[#2d2d30] text-cyan-400 shadow-md"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {candidatePlayStyle}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">Win Metric</label>
                      <div className="flex rounded-xl bg-black/40 p-1">
                        {WIN_METRICS.map((candidateMetric) => (
                          <button
                            type="button"
                            key={candidateMetric}
                            onClick={() => setWinMetric(candidateMetric)}
                            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                              winMetric === candidateMetric
                                ? "bg-[#2d2d30] text-purple-400 shadow-md"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {candidateMetric}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-[#15151a] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full" />
                  <h3 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2">
                    <Activity size={16} /> Player Status
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-gray-500 font-black uppercase mb-1">Current Rating</div>
                        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                          {formatCurrentRating(currentRating)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 font-black uppercase mb-1">Waiting Players</div>
                        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                          {waitingCount === null ? "—" : waitingCount}<span className="text-xl text-yellow-500/50 font-bold ml-1">人</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                      <div className="text-[10px] text-gray-500 font-black uppercase mb-2">Search Condition</div>
                      <ul className="text-sm font-semibold space-y-2">
                        <li className="flex justify-between">
                          <span className="text-gray-400">Target Range</span>
                          <span className="text-cyan-400">±{MATCHMAKING_INITIAL_RATING_RANGE} (Auto Expand)</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-gray-400">Players</span>
                          <span className="text-white">{queuedPlayersLabel}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-gray-400">Metric</span>
                          <span className="text-white">{winMetric}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy || !roomEntryReady}
                  onClick={() => {
                    void handleStartQueue();
                  }}
                  className={`w-full h-[84px] text-black font-black text-xl rounded-3xl shadow-[0_15px_40px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center relative overflow-hidden group ${
                    busy || !roomEntryReady
                      ? "cursor-not-allowed bg-gray-800 text-gray-500 shadow-none"
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_20px_50px_rgba(6,182,212,0.5)] active:scale-95"
                  }`}
                >
                  <span className="transition-transform duration-300 ease-out group-hover:-translate-y-2">
                    START MATCHING
                  </span>
                  <span className="absolute bottom-4 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out text-[10px] font-bold text-black/60 uppercase tracking-widest">
                    Enqueue now
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {matchState === "IN_QUEUE" ? (
            <div className="flex w-full max-w-2xl animate-in zoom-in-95 flex-col items-center justify-center duration-500">
              <div className="relative mb-16 flex h-64 w-64 items-center justify-center">
                <div className="absolute inset-0 animate-[spin_20s_linear_infinite] rounded-full border border-cyan-500/20 border-dashed" />
                <div className="absolute inset-4 rounded-full border border-cyan-500/40 opacity-50" />
                <div className="absolute inset-12 rounded-full border border-purple-500/40 opacity-30" />
                <div className="absolute left-0 top-1/2 h-[2px] w-1/2 -translate-y-1/2 origin-right animate-[spin_3s_linear_infinite] bg-gradient-to-r from-transparent to-cyan-400" />
                <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-500/50 bg-black/50 shadow-[0_0_30px_rgba(6,182,212,0.5)] backdrop-blur">
                  <Radar className="h-10 w-10 text-cyan-400" />
                </div>
                {[
                  "absolute right-10 top-5",
                  "absolute bottom-8 left-10",
                  "absolute left-4 top-1/2 -translate-y-1/2",
                ].map((positionClass, index) => {
                  const active = displayedPlayers > index + 1;
                  return (
                    <div
                      key={positionClass}
                      className={`${positionClass} flex h-8 w-8 items-center justify-center rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.2)] transition-all duration-300 ${
                        active ? "scale-100 opacity-100" : "scale-75 opacity-0"
                      } ${playerIncreasePulse && active ? "animate-pulse" : ""}`}
                    >
                      <UserRound size={15} strokeWidth={2.5} />
                    </div>
                  );
                })}
              </div>

              <div className="mb-12 space-y-4 text-center">
                <h2 className="flex flex-col items-center gap-2 text-3xl font-black uppercase tracking-widest text-white">
                  Searching
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: "0.2s" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: "0.4s" }} />
                  </span>
                </h2>
                <div className="flex justify-center gap-6 font-mono text-sm text-gray-400">
                  <div className="flex flex-col items-center">
                    <span className="mb-1 text-[10px] text-gray-600">ELAPSED</span>
                    <span className="text-xl text-cyan-400">{formatQueueSeconds(queueTimeSeconds)}</span>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div className="flex flex-col items-center">
                    <span className="mb-1 text-[10px] text-gray-600">RATING RANGE</span>
                    <span className="text-xl font-bold text-purple-400 transition-all duration-500">
                      ±{currentTolerance}
                    </span>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div className="flex flex-col items-center">
                    <span className="mb-1 text-[10px] text-gray-600">PLAYERS</span>
                    <span className={`text-xl font-bold text-yellow-400 transition-all duration-500 ${playerIncreasePulse ? "scale-110" : "scale-100"}`}>
                      {displayedPlayers} / {queuePlayerLimit}
                    </span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-500">Ticket: {ticketId}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleCancelQueue();
                }}
                className="rounded-full border border-red-500/50 bg-transparent px-8 py-3 text-sm font-bold text-red-400 transition-all hover:bg-red-500/10"
              >
                キャンセル
              </button>
            </div>
          ) : null}

          {matchState === "MATCH_FOUND" ? (
            <div className="flex animate-in zoom-in-110 flex-col items-center justify-center duration-700">
              <div className="mb-8 flex h-40 w-40 animate-bounce items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-[0_0_80px_rgba(52,211,153,0.6)] transition-all">
                <CheckCircle2 className="h-20 w-20 text-white" />
              </div>
              <h2 className="mb-4 text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                MATCH FOUND!
              </h2>
              <p className="mb-2 font-bold text-gray-300">対戦相手が見つかりました。</p>
              <div className="flex animate-pulse items-center gap-2 text-sm font-bold text-cyan-400">
                ルームへ接続中です <ChevronRight size={16} />
              </div>
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-xs font-semibold text-gray-400">
                {ticket?.room_id ? `Room ID: ${ticket.room_id}` : "ルーム情報を取得中..."}
              </div>
            </div>
          ) : null}

          {statusMessage ? (
            <div className="absolute bottom-8 left-1/2 w-full max-w-3xl -translate-x-1/2 px-4">
              <div className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-semibold text-gray-100 backdrop-blur">
                {statusMessage}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
