import {
  CHART_DIFFICULTIES,
  CHART_SEARCH_PAGE_SIZE,
  HOST_SKIP_UNLOCK_SECONDS,
  MATCH_TTL_MINUTES,
  ROUND_MUSIC_SELECT_SECONDS,
  ROUND_PLAY_BEGIN_AT_SECONDS,
  SKIP_REASONS,
  type ChartSearchEntry,
  type CurrentRoundSnapshot,
  type ResultReadyPayload,
  type RoomPlayerSnapshot,
  type RoomStateSnapshot,
} from "@infinitas/shared";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Database,
  Info,
  LogOut,
  MessageSquare,
  Music,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  Swords,
  User,
  Zap,
} from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import { DebugInjectionPanel } from "../components/DebugInjectionPanel";
import { findVisualScenarioChart, listVisualScenarioCharts } from "../dev/visual-scenarios";
import {
  RoomArenaPresentational,
  type RoomArenaFinalResultPlayerSummary,
  type HistoryItem as ArenaHistoryItem,
  type RoomArenaControlledState,
  type RoomArenaLogEntry,
  type RoomArenaMatchInfoItem,
  type RoomArenaPlayer,
  type RoomArenaResultPhasePlayerSummary,
  type Song as ArenaSong,
} from "../components/RoomArena";
import {
  RoomBPLPresentational,
  type RoomBPLControlledState,
  type RoomBPLPlayer,
  type Song as BplSong,
} from "../components/RoomBPL";
import {
  SongSearchModalView,
  type SongSearchModalSong,
} from "../components/SongSearchModalView";
import { runtimeConfig } from "../runtime/runtime-config";
import { useLocalResultArchiveStore } from "../services/result-archive";
import { listCharts } from "../services/worker-api-client";
import { useVoicePlaybackStore } from "../services/voice-announcer";
import { roomStore, useRoomStore, type RoomConnectionStatus } from "../stores/room-store";
import { isVoicePlaybackEnabled, useSettingsStore } from "../stores/settings-store";
import { formatDateTime, stringifyJson } from "../utils/format";

type Theme = {
  accentText: string;
  accentBg: string;
  accentSoft: string;
  accentBorder: string;
  gradient: string;
  primaryButton: string;
  secondaryButton: string;
};

type DifficultyPresentation = {
  shortLabel: string;
  colorClass: string;
  textClass: string;
};

type DisplayExpectedKey = {
  play_style: string;
  difficulty: string;
  title_search_key: string;
};

type ParsedResultPlayer = {
  playerId: string;
  displayName: string;
  totalPoints: number | null;
  totalExScore: number | null;
  roundWins: number | null;
  lastConfirmedAt: string | null;
};

type ParsedResultRound = {
  roundIndex: number;
  title: string;
  level: number | null;
  artist: string | null;
  expectedKey: DisplayExpectedKey | null;
  winnerPlayerIds: string[];
  results: Array<{
    playerId: string;
    displayName: string;
    metricValue: number | null;
    arenaPoints: number | null;
  }>;
};

const BPL_PICK_CUTIN_SECONDS = 3;
const BPL_RESULT_PHASE_SECONDS = 10;
const TWO_LINE_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
  overflowWrap: "anywhere" as const,
};

function formatExpectedKey(
  expectedKey: DisplayExpectedKey | null | undefined,
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

function getDifficultyPresentation(difficulty: string | null | undefined): DifficultyPresentation {
  switch (difficulty) {
    case "BEGINNER":
      return { shortLabel: "B", colorClass: "bg-green-500", textClass: "text-green-400" };
    case "NORMAL":
      return { shortLabel: "N", colorClass: "bg-blue-500", textClass: "text-blue-400" };
    case "HYPER":
      return { shortLabel: "H", colorClass: "bg-yellow-500", textClass: "text-yellow-400" };
    case "ANOTHER":
      return { shortLabel: "A", colorClass: "bg-red-500", textClass: "text-red-400" };
    case "LEGGENDARIA":
      return { shortLabel: "L", colorClass: "bg-purple-600", textClass: "text-purple-400" };
    default:
      return { shortLabel: "-", colorClass: "bg-slate-500", textClass: "text-slate-400" };
  }
}

function getDifficultyId(difficulty: string | null | undefined): string {
  return getDifficultyPresentation(difficulty).shortLabel;
}

function getDifficultyFromId(difficultyId: string | null): (typeof CHART_DIFFICULTIES)[number] | null {
  switch (difficultyId) {
    case "B":
      return "BEGINNER";
    case "N":
      return "NORMAL";
    case "H":
      return "HYPER";
    case "A":
      return "ANOTHER";
    case "L":
      return "LEGGENDARIA";
    default:
      return null;
  }
}

function formatSongKeyTitle(
  titleSearchKey: string,
  playStyle: string | null | undefined,
  difficulty: string | null | undefined,
): string {
  return `${titleSearchKey}(${playStyle ?? "SP"}${getDifficultyPresentation(difficulty).shortLabel})`;
}

function getExpectedKeyCacheKey(expectedKey: DisplayExpectedKey | null | undefined): string | null {
  if (!expectedKey) {
    return null;
  }

  return `${expectedKey.play_style}:${expectedKey.difficulty}:${expectedKey.title_search_key}`;
}

function parsePickChartKey(pickChartKey: string | null | undefined): CurrentRoundSnapshot["expected_key"] | null {
  if (!pickChartKey) {
    return null;
  }

  const [playStyle, difficulty, ...titleParts] = pickChartKey.split("::");
  const titleSearchKey = titleParts.join("::").trim();
  if (
    (playStyle !== "SP" && playStyle !== "DP") ||
    !CHART_DIFFICULTIES.includes(difficulty as (typeof CHART_DIFFICULTIES)[number]) ||
    titleSearchKey.length === 0
  ) {
    return null;
  }

  const parsedDifficulty = difficulty as (typeof CHART_DIFFICULTIES)[number];
  return {
    play_style: playStyle,
    difficulty: parsedDifficulty,
    title_search_key: titleSearchKey,
  };
}

function findVisualScenarioChartByPickKey(id: string, pickChartKey: string): ChartSearchEntry | null {
  return findVisualScenarioChart(id, parsePickChartKey(pickChartKey));
}

function compareMetricValues(winMetric: RoomStateSnapshot["settings"]["win_metric"], left: number, right: number): number {
  if (left === right) {
    return 0;
  }

  if (winMetric === "SCORE") {
    return left > right ? 1 : -1;
  }

  return left < right ? 1 : -1;
}

function formatSongTitle(expectedKey: DisplayExpectedKey | null | undefined, fallbackTitle: string): string {
  if (!expectedKey) {
    return fallbackTitle;
  }

  return formatSongKeyTitle(expectedKey.title_search_key, expectedKey.play_style, expectedKey.difficulty);
}

function formatSongArtist(artist: string | null | undefined): string {
  return artist && artist.trim().length > 0 ? artist : "BEMANI Series";
}

function formatLevelFilterLabel(levelFilter: RoomStateSnapshot["settings"]["level_filter"]): string {
  switch (levelFilter) {
    case "LV8_10":
      return "Lv8-10";
    case "LV10":
      return "Lv10";
    case "LV11":
      return "Lv11";
    case "LV12":
      return "Lv12";
    default:
      return "NO LIMIT";
  }
}

function formatRegulationLabel(
  playStyle: RoomStateSnapshot["settings"]["play_style"],
  levelFilter: RoomStateSnapshot["settings"]["level_filter"],
): string {
  return `${playStyle} / ${formatLevelFilterLabel(levelFilter)}`;
}

function formatRoomTitle(
  mode: RoomStateSnapshot["settings"]["mode"],
  playStyle: RoomStateSnapshot["settings"]["play_style"],
  roomComment: string,
): string {
  const comment = roomComment.trim();
  if (comment.length > 0) {
    return comment;
  }

  return `${mode === "BPL" ? "BPL (3 STAGE)" : "ARENA"} ${playStyle}`;
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

function getLobbyStartIssues(snapshot: RoomStateSnapshot): string[] {
  const issues: string[] = [];

  if (snapshot.players.length < 2) {
    issues.push("At least two players are required.");
  }

  if (snapshot.settings.mode === "BPL" && snapshot.players.length !== 2) {
    issues.push("BPL mode requires exactly two players.");
  }

  const notReadyPlayers = snapshot.players.filter(
    (player) => player.player_id !== snapshot.host_player_id && !player.ready,
  );
  if (notReadyPlayers.length === 1) {
    issues.push(`${notReadyPlayers[0]?.display_name ?? "A player"} is not READY.`);
  } else if (notReadyPlayers.length > 1) {
    issues.push(`${notReadyPlayers.length} players are not READY.`);
  }

  if (
    snapshot.result_ready ||
    snapshot.current_round !== null ||
    snapshot.picks.length > 0 ||
    snapshot.frozen_rounds.length > 0 ||
    snapshot.timers.picking_deadline !== null ||
    snapshot.timers.match_deadline !== null ||
    snapshot.timers.result_deadline !== null
  ) {
    issues.push("Previous match data is still being cleared.");
  }

  return issues;
}

function getTheme(mode: RoomStateSnapshot["settings"]["mode"]): Theme {
  if (mode === "BPL") {
    return {
      accentText: "text-amber-400",
      accentBg: "bg-amber-500",
      accentSoft: "bg-amber-500/10",
      accentBorder: "border-amber-500/30",
      gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
      primaryButton: "bg-amber-500 text-black hover:bg-amber-400",
      secondaryButton: "border border-white/10 bg-white/5 text-white hover:border-amber-500/40 hover:bg-amber-500/10",
    };
  }

  return {
    accentText: "text-cyan-400",
    accentBg: "bg-cyan-500",
    accentSoft: "bg-cyan-500/10",
    accentBorder: "border-cyan-500/30",
    gradient: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    primaryButton: "bg-cyan-500 text-black hover:bg-cyan-400",
    secondaryButton: "border border-white/10 bg-white/5 text-white hover:border-cyan-500/40 hover:bg-cyan-500/10",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function parseResultPlayers(resultReady: ResultReadyPayload | null): ParsedResultPlayer[] {
  const perPlayerRecord = asRecord(resultReady?.per_player);
  const playersValue = perPlayerRecord?.players;
  if (!Array.isArray(playersValue)) {
    return [];
  }

  const players: ParsedResultPlayer[] = [];
  for (const value of playersValue) {
    const record = asRecord(value);
    const playerId = asString(record?.player_id);
    const displayName = asString(record?.display_name);
    if (record === null || playerId === null || displayName === null) {
      continue;
    }

    players.push({
      playerId,
      displayName,
      totalPoints: asNumber(record.total_points),
      totalExScore: asNumber(record.total_ex_score),
      roundWins: asNumber(record.round_wins),
      lastConfirmedAt: asString(record.last_confirmed_at),
    });
  }

  return players.sort((left, right) => {
    const leftPrimary = left.roundWins ?? left.totalPoints ?? Number.NEGATIVE_INFINITY;
    const rightPrimary = right.roundWins ?? right.totalPoints ?? Number.NEGATIVE_INFINITY;
    if (leftPrimary !== rightPrimary) {
      return rightPrimary - leftPrimary;
    }

    return (right.totalExScore ?? Number.NEGATIVE_INFINITY) - (left.totalExScore ?? Number.NEGATIVE_INFINITY);
  });
}

function parseResultRounds(resultReady: ResultReadyPayload | null): ParsedResultRound[] {
  const perRoundRecord = asRecord(resultReady?.per_round);
  const roundsValue = perRoundRecord?.rounds;
  if (!Array.isArray(roundsValue)) {
    return [];
  }

  const rounds: ParsedResultRound[] = [];
  for (const value of roundsValue) {
    const record = asRecord(value);
    const displayRecord = asRecord(record?.display);
    const expectedKeyRecord = asRecord(record?.expected_key);
    if (record === null || displayRecord === null) {
      continue;
    }

    const roundIndex = asNumber(record.round_index);
    const title = asString(displayRecord.title);
    if (roundIndex === null || title === null) {
      continue;
    }

    const results: ParsedResultRound["results"] = [];
    const resultsValue = Array.isArray(record.results) ? record.results : [];
    for (const resultValue of resultsValue) {
      const resultRecord = asRecord(resultValue);
      const playerId = asString(resultRecord?.player_id);
      const displayName = asString(resultRecord?.display_name);
      if (resultRecord === null || playerId === null || displayName === null) {
        continue;
      }

      results.push({
        playerId,
        displayName,
        metricValue: asNumber(resultRecord.metric_value),
        arenaPoints: asNumber(resultRecord.arena_points),
      });
    }

    rounds.push({
      roundIndex,
      title,
      level: asNumber(displayRecord.level),
      artist: asString(displayRecord.artist) ?? asString(record.artist),
      expectedKey:
        expectedKeyRecord === null ||
        asString(expectedKeyRecord.play_style) === null ||
        asString(expectedKeyRecord.difficulty) === null ||
        asString(expectedKeyRecord.title_search_key) === null
          ? null
          : {
              play_style: asString(expectedKeyRecord.play_style) ?? "",
              difficulty: asString(expectedKeyRecord.difficulty) ?? "",
              title_search_key: asString(expectedKeyRecord.title_search_key) ?? "",
            },
      winnerPlayerIds: asStringArray(record.winner_player_ids),
      results,
    });
  }

  return rounds.sort((left, right) => left.roundIndex - right.roundIndex);
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDurationLabel(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return "-";
  }

  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}H ${String(minutes).padStart(2, "0")}M ${String(seconds).padStart(2, "0")}S`;
  }

  return `${minutes}M ${String(seconds).padStart(2, "0")}S`;
}

function getConnectionTone(status: RoomConnectionStatus): string {
  switch (status) {
    case "CONNECTED":
      return "text-emerald-300";
    case "ERROR":
      return "text-red-300";
    case "CLOSED":
      return "text-amber-300";
    default:
      return "text-gray-300";
  }
}

function getPlayerStatus(currentRound: CurrentRoundSnapshot | null, playerId: string) {
  const confirmed = currentRound?.confirmed.find((entry) => entry.player_id === playerId);
  if (!confirmed) {
    return {
      label: "UNCONFIRMED",
      metric: null,
      reason: null,
    };
  }

  return {
    label: confirmed.status,
    metric: confirmed.metric_value,
    reason: confirmed.reason,
  };
}

function maskSecret(value: string | null | undefined): string {
  if (!value) {
    return "********";
  }

  return "*".repeat(Math.max(8, Math.min(12, value.length)));
}

function getMockRoomStateLabel(roomState: RoomStateSnapshot["room_state"]): string {
  switch (roomState) {
    case "LOBBY":
      return "WAITING";
    case "PICKING":
      return "SELECTING";
    default:
      return roomState;
  }
}

function getOrdinalLabel(value: number): string {
  const normalized = value % 100;
  if (normalized >= 11 && normalized <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function HeaderCard(props: {
  snapshot: RoomStateSnapshot;
  theme: Theme;
  connectionStatus: RoomConnectionStatus;
  isHost: boolean;
  onLeaveRoom: () => void;
}) {
  const { snapshot, theme, connectionStatus, isHost, onLeaveRoom } = props;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#101113] p-6 shadow-2xl">
      <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient}`} />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.35em] ${theme.accentSoft} ${theme.accentText}`}>
              {snapshot.settings.mode}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">
              {snapshot.room_state}
            </span>
            <span className={`text-xs font-bold uppercase tracking-[0.28em] ${getConnectionTone(connectionStatus)}`}>
              {connectionStatus}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-black italic tracking-tight text-white">
            {snapshot.settings.mode === "BPL" ? "BPL Battle Room" : "Arena Match Room"}
          </h1>
          <p className="mt-2 text-sm font-medium text-gray-400">
            {formatRegulationLabel(snapshot.settings.play_style, snapshot.settings.level_filter)} / {snapshot.settings.win_metric}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-gray-300">
            <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">Room ID: {snapshot.room_id}</span>
            <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">Join Code: {snapshot.settings.join_code ?? "-"}</span>
            <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">Capacity: {snapshot.settings.max_players}</span>
            <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">Current: {snapshot.players.length}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.28em] ${isHost ? `${theme.accentBorder} ${theme.accentText} ${theme.accentSoft}` : "border-white/10 bg-white/5 text-gray-200"}`}>
            {isHost ? "HOST" : "GUEST"}
          </span>
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:border-red-500/30 hover:bg-red-500/10"
          >
            <LogOut size={16} />
            Leave room
          </button>
        </div>
      </div>
    </section>
  );
}

function ChartPickerCard(props: {
  theme: Theme;
  snapshot: RoomStateSnapshot;
  mySubmittedPick: { pick_chart_key: string } | null;
  pickingCountdown: number | null;
  chartDifficulty: (typeof CHART_DIFFICULTIES)[number] | "";
  chartLevel: string;
  chartKeyword: string;
  chartResults: ChartSearchEntry[];
  chartLoading: boolean;
  chartError: string | null;
  chartLastLoadedAt: string | null;
  chartNextCursor: string | null;
  chartPreviousCursors: Array<string | null>;
  onChartDifficultyChange: (value: (typeof CHART_DIFFICULTIES)[number] | "") => void;
  onChartLevelChange: (value: string) => void;
  onChartKeywordChange: (value: string) => void;
  onChartSelect: (chart: ChartSearchEntry) => void;
  onLoadPrevious: () => void;
  onLoadNext: () => void;
}) {
  const {
    theme,
    snapshot,
    mySubmittedPick,
    pickingCountdown,
    chartDifficulty,
    chartLevel,
    chartKeyword,
    chartResults,
    chartLoading,
    chartError,
    chartLastLoadedAt,
    chartNextCursor,
    chartPreviousCursors,
    onChartDifficultyChange,
    onChartLevelChange,
    onChartKeywordChange,
    onChartSelect,
    onLoadPrevious,
    onLoadNext,
  } = props;
  void theme;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <section className="relative flex h-[85vh] max-h-[780px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1e1e1f] shadow-2xl">
        <header className="border-b border-white/5 bg-gradient-to-r from-cyan-500/20 to-transparent p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-cyan-500 p-2 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                <Music size={20} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-black italic leading-none tracking-tighter text-white">Pick Music</h2>
                <span className="mt-1 text-[9px] font-black uppercase tracking-[0.3em] text-cyan-500/80">Infinitas Arena Battle System</span>
              </div>
            </div>
            <div
              className={`rounded-xl border-2 px-6 py-2 ${
                (pickingCountdown ?? 0) <= 10
                  ? "border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse"
                  : (pickingCountdown ?? 0) <= 30
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-cyan-500/30 bg-cyan-500/5"
              }`}
            >
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Time Left</span>
              <span
                className={`block text-3xl font-black italic leading-none tracking-tighter ${
                  (pickingCountdown ?? 0) <= 10
                    ? "text-red-500"
                    : (pickingCountdown ?? 0) <= 30
                      ? "text-amber-500"
                      : "text-cyan-400"
                }`}
              >
                {formatCountdown(pickingCountdown)}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
            <input
              type="text"
              value={chartKeyword}
              onChange={(event) => onChartKeywordChange(event.currentTarget.value)}
              placeholder="Search by title / artist / genre"
              className="w-full rounded-xl border border-white/10 bg-black/60 py-3.5 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all placeholder:text-gray-600 focus:border-cyan-500 focus:bg-black/80"
            />
          </div>
        </header>

        <div className="space-y-6 border-b border-white/5 bg-[#151516] p-6">
          <div>
            <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Difficulty</span>
            <div className="flex flex-wrap gap-2">
              {CHART_DIFFICULTIES.map((difficulty) => (
                (() => {
                  const difficultyTone = getDifficultyPresentation(difficulty);
                  return (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => onChartDifficultyChange(chartDifficulty === difficulty ? "" : difficulty)}
                      className={`min-w-[56px] flex-1 rounded-lg border-2 py-2 text-xs font-black italic transition-all ${
                        chartDifficulty === difficulty
                          ? `${difficultyTone.colorClass} border-white text-white scale-105 shadow-lg`
                          : "border-transparent bg-white/5 text-gray-500 hover:bg-white/10"
                      }`}
                    >
                      {difficultyTone.shortLabel}
                    </button>
                  );
                })()
              ))}
            </div>
          </div>

          <div>
            <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Level</span>
            <div className="grid grid-cols-6 gap-2 md:grid-cols-12">
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChartLevelChange(chartLevel === level ? "" : level)}
                  className={`rounded-lg border-2 py-2 text-xs font-black italic transition-all ${chartLevel === level ? "border-white bg-cyan-500 text-black scale-105" : "border-transparent bg-white/5 text-gray-500 hover:bg-white/10"}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4 custom-scrollbar">
          {chartError ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">{chartError}</div> : null}
          {chartResults.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4 py-12 text-gray-600">
              <Search size={48} />
              <p className="font-black italic uppercase tracking-[0.3em]">{chartLoading ? "Loading" : "No Music Found"}</p>
            </div>
          ) : (
            chartResults.map((chart) => (
              (() => {
                const difficultyTone = getDifficultyPresentation(chart.difficulty);
                return (
                  <button
                    key={chart.chart_key}
                    type="button"
                    disabled={mySubmittedPick !== null}
                    onClick={() => onChartSelect(chart)}
                    className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${mySubmittedPick ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-gray-600" : "border-white/5 bg-white/5 hover:border-cyan-500/50 hover:bg-white/10"}`}
                  >
                    <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-[#252526]">
                      <Music size={24} className={difficultyTone.textClass} />
                      <div className={`absolute inset-x-0 bottom-0 h-1 ${difficultyTone.colorClass}`} />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-black text-white ${difficultyTone.colorClass}`}>{difficultyTone.shortLabel}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">LV {chart.level}</span>
                      </div>
                      <h3 className="truncate text-lg font-black italic uppercase leading-tight tracking-tighter text-white transition-colors group-hover:text-cyan-400">{chart.title}</h3>
                      <p className="truncate text-xs font-bold text-gray-400 transition-colors group-hover:text-gray-300">{chart.artist || "-"}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black italic tracking-tighter text-gray-500 transition-colors group-hover:text-white">Lv{chart.level}</div>
                      <ChevronRight size={16} className="ml-auto text-gray-700 transition-colors group-hover:text-cyan-500" />
                    </div>
                  </button>
                );
              })()
            ))
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/5 bg-black/40 p-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-cyan-500">{chartResults.length}</span>
            <span>/ {chartResults.length + (chartNextCursor ? CHART_SEARCH_PAGE_SIZE : 0)} results</span>
            <span>Last loaded: {formatDateTime(chartLastLoadedAt)}</span>
            {mySubmittedPick ? <span className="text-cyan-500">Submitted</span> : null}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={chartPreviousCursors.length === 0 || chartLoading} onClick={onLoadPrevious} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 disabled:opacity-40">
              <ChevronLeft size={14} />
              Prev
            </button>
            <button type="button" disabled={chartNextCursor === null || chartLoading} onClick={onLoadNext} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 disabled:opacity-40">
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function DebugRoundPanel(props: {
  currentRound: CurrentRoundSnapshot;
  metricValue: string;
  onMetricValueChange: (value: string) => void;
  onSubmit: () => void;
  isHost: boolean;
  forceAdvanceDisabled: boolean;
  forceAdvanceRemainingSeconds: number | null;
  onForceAdvance: () => void;
}) {
  const {
    currentRound,
    metricValue,
    onMetricValueChange,
    onSubmit,
    isHost,
    forceAdvanceDisabled,
    forceAdvanceRemainingSeconds,
    onForceAdvance,
  } = props;

  return (
    <section className="rounded-2xl border border-white/5 bg-[#252526] p-4 shadow-xl">
      <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
        <Database size={14} /> Debug Actions
      </p>
      <div className="space-y-4">
        <label className="block space-y-2 text-sm font-bold text-gray-300">
          <span>Metric value</span>
          <input
            type="number"
            min={0}
            value={metricValue}
            onChange={(event) => onMetricValueChange(event.currentTarget.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          className="w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-cyan-400"
        >
          Submit Score
        </button>
        {isHost ? (
          <button
            type="button"
            onClick={onForceAdvance}
            disabled={forceAdvanceDisabled}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.25em] transition-all ${
              forceAdvanceDisabled
                ? "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
                : "border-2 border-red-500/30 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white"
            }`}
          >
            {forceAdvanceDisabled
              ? `Force Finalize ${formatCountdown(forceAdvanceRemainingSeconds)}`
              : `Force Finalize Round ${currentRound.round_index + 1}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function PlayerCard(props: {
  theme: Theme;
  player: RoomPlayerSnapshot | null;
  slotLabel: string;
  side?: "left" | "right" | undefined;
  highlight?: boolean;
}) {
  const { theme, player, slotLabel, side, highlight = false } = props;
  if (!player) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-white/10 bg-black/20 p-6 text-center">
        <div className={`rounded-full border p-6 ${theme.accentBorder} ${theme.accentSoft}`}>
          <User size={42} className={theme.accentText} />
        </div>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.3em] text-gray-500">Empty Slot</p>
        <p className="mt-2 text-xs font-bold text-gray-600">{slotLabel}</p>
      </div>
    );
  }

  const readyStyles =
    side === "left"
      ? "border-cyan-500 bg-cyan-500/10"
      : side === "right"
        ? "border-amber-500 bg-amber-500/10"
        : `${theme.accentBorder} ${theme.accentSoft}`;

  const iconStyles =
    side === "left"
      ? "bg-cyan-500 text-black"
      : side === "right"
        ? "bg-amber-500 text-black"
        : `${theme.accentBg} text-black`;

  return (
    <article className={`min-h-[240px] rounded-[1.75rem] border p-6 ${player.ready ? readyStyles : "border-white/10 bg-white/5"} ${highlight ? "ring-4 ring-white/20" : ""}`}>
      <div className={`inline-flex rounded-full p-5 ${player.ready ? iconStyles : "bg-white/10 text-gray-500"}`}>
        <User size={40} />
      </div>
      <h3 className="mt-6 text-2xl font-black italic tracking-tight text-white">{player.display_name}</h3>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">{slotLabel}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-white">
          {player.ready ? "READY" : "WAITING"}
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-gray-300">
          {player.connected ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
    </article>
  );
}

function StartPanel(props: {
  theme: Theme;
  isHost: boolean;
  me: RoomPlayerSnapshot | null;
  readyPlayersCount: number;
  playerCount: number;
  issues: string[];
  onToggleReady: () => void;
  onStartMatch: () => void;
}) {
  const { theme, isHost, me, readyPlayersCount, playerCount, issues, onToggleReady, onStartMatch } = props;

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
      <p className="text-sm font-bold text-gray-300">{readyPlayersCount} / {playerCount} players are READY.</p>
      {isHost ? (
        issues.length === 0 ? (
          <p className={`mt-3 text-sm font-bold ${theme.accentText}`}>All start conditions are satisfied.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm font-bold text-red-300">
            {issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-3 text-sm font-bold text-gray-400">Waiting for the host to start the match.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={onToggleReady} className={`rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.25em] transition-all ${theme.secondaryButton}`}>
          {me?.ready ? "Ready OK" : "Ready Up"}
        </button>
        {isHost ? (
          <button type="button" onClick={onStartMatch} className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-[0.25em] transition-all ${theme.primaryButton}`}>
            <Play size={16} fill="currentColor" />
            Start Match
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DebugSection(props: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const { title, children, defaultOpen = false } = props;

  return (
    <details open={defaultOpen} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#151516] shadow-xl">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-gray-200">{title}</summary>
      <div className="border-t border-white/5 p-5">{children}</div>
    </details>
  );
}

export function RoomPage() {
  const snapshot = useRoomStore((state) => state.snapshot);
  const resultReady = useRoomStore((state) => state.resultReady);
  const connectionStatus = useRoomStore((state) => state.connectionStatus);
  const connectionDetail = useRoomStore((state) => state.connectionDetail);
  const roundConfirmations = useRoomStore((state) => state.roundConfirmations);
  const endedRoundIndices = useRoomStore((state) => state.endedRoundIndices);
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
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [copiedJoinCode, setCopiedJoinCode] = useState(false);
  const [showHostLeaveConfirm, setShowHostLeaveConfirm] = useState(false);
  const [arenaLobbyLogs, setArenaLobbyLogs] = useState<RoomArenaLogEntry[]>([]);
  const [pendingOwnPickCutIn, setPendingOwnPickCutIn] = useState<ChartSearchEntry | null>(null);
  const [ownPickCutInChart, setOwnPickCutInChart] = useState<ChartSearchEntry | null>(null);
  const [resolvedChartsByExpectedKey, setResolvedChartsByExpectedKey] = useState<Record<string, ChartSearchEntry | null>>({});
  const [resolvedChartsByPickKey, setResolvedChartsByPickKey] = useState<Record<string, ChartSearchEntry | null>>({});
  const chartRequestIdRef = useRef(0);
  const cutInTimeoutRef = useRef<number | null>(null);
  const arenaLobbyLogSequenceRef = useRef(0);
  const previousArenaLobbySnapshotRef = useRef<RoomStateSnapshot | null>(null);
  const mySubmittedPick = snapshot?.picks.find((pick) => pick.player_id === savedSettings.playerId) ?? null;

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
      const response =
        runtimeConfig.mockScenarioId !== null
          ? listVisualScenarioCharts(runtimeConfig.mockScenarioId, {
              play_style: snapshot.settings.play_style,
              level_filter: snapshot.settings.level_filter,
              ...(chartDifficulty === "" ? {} : { difficulty: chartDifficulty }),
              ...(parsedLevel === undefined ? {} : { level: parsedLevel }),
              ...(deferredChartKeyword.trim().length === 0 ? {} : { keyword: deferredChartKeyword.trim() }),
              ...(targetCursor === null ? {} : { cursor: targetCursor }),
              limit: CHART_SEARCH_PAGE_SIZE,
            })
          : await listCharts(savedSettings.apiBaseUrl, {
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
    setResolvedChartsByExpectedKey({});
    setResolvedChartsByPickKey({});
  }, [snapshot?.room_id]);

  useEffect(() => {
    if (snapshot === null) {
      return;
    }

    const targets = [
      ...(snapshot.current_round ? [snapshot.current_round.expected_key] : []),
      ...snapshot.frozen_rounds.map((round) => round.expected_key),
    ];
    const missingTargets = targets.filter((expectedKey, index, allTargets) => {
      const cacheKey = getExpectedKeyCacheKey(expectedKey);
      if (cacheKey === null) {
        return false;
      }

      return (
        allTargets.findIndex((candidate) => getExpectedKeyCacheKey(candidate) === cacheKey) === index &&
        !(cacheKey in resolvedChartsByExpectedKey)
      );
    });
    if (missingTargets.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      missingTargets.map(async (expectedKey) => {
        const cacheKey = getExpectedKeyCacheKey(expectedKey);
        if (cacheKey === null) {
          return null;
        }

        try {
          const resolvedChart =
            runtimeConfig.mockScenarioId !== null
              ? findVisualScenarioChart(runtimeConfig.mockScenarioId, expectedKey)
              : (
                  await listCharts(savedSettings.apiBaseUrl, {
                    play_style: expectedKey.play_style as RoomStateSnapshot["settings"]["play_style"],
                    level_filter: snapshot.settings.level_filter,
                    difficulty: expectedKey.difficulty as (typeof CHART_DIFFICULTIES)[number],
                    keyword: expectedKey.title_search_key,
                    limit: CHART_SEARCH_PAGE_SIZE,
                  })
                ).charts.find(
                  (chart) =>
                    chart.play_style === expectedKey.play_style &&
                    chart.difficulty === expectedKey.difficulty &&
                    chart.title_search_key === expectedKey.title_search_key,
                ) ?? null;

          return [cacheKey, resolvedChart] as const;
        } catch {
          return [cacheKey, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setResolvedChartsByExpectedKey((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (entry === null) {
            continue;
          }

          next[entry[0]] = entry[1];
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    resolvedChartsByExpectedKey,
    savedSettings.apiBaseUrl,
    snapshot,
  ]);

  useEffect(() => {
    if (snapshot === null) {
      return;
    }

    const missingPickChartKeys = snapshot.picks
      .map((pick) => pick.pick_chart_key)
      .filter((pickChartKey, index, allPickChartKeys) => (
        allPickChartKeys.indexOf(pickChartKey) === index &&
        !(pickChartKey in resolvedChartsByPickKey)
      ));
    if (missingPickChartKeys.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      missingPickChartKeys.map(async (pickChartKey) => {
        try {
          const resolvedChart =
            runtimeConfig.mockScenarioId !== null
              ? findVisualScenarioChartByPickKey(runtimeConfig.mockScenarioId, pickChartKey)
              : await (async () => {
                  const parsedPickChartKey = parsePickChartKey(pickChartKey);
                  if (parsedPickChartKey === null) {
                    return null;
                  }

                  const response = await listCharts(savedSettings.apiBaseUrl, {
                    play_style: parsedPickChartKey.play_style as RoomStateSnapshot["settings"]["play_style"],
                    level_filter: snapshot.settings.level_filter,
                    difficulty: parsedPickChartKey.difficulty as (typeof CHART_DIFFICULTIES)[number],
                    keyword: parsedPickChartKey.title_search_key,
                    limit: CHART_SEARCH_PAGE_SIZE,
                  });
                  return response.charts.find((chart) => chart.chart_key === pickChartKey) ?? null;
                })();

          return [pickChartKey, resolvedChart] as const;
        } catch {
          return [pickChartKey, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setResolvedChartsByPickKey((current) => {
        const next = { ...current };
        for (const [pickChartKey, resolvedChart] of entries) {
          next[pickChartKey] = resolvedChart;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    resolvedChartsByPickKey,
    savedSettings.apiBaseUrl,
    snapshot,
  ]);

  useEffect(() => {
    if (
      snapshot?.room_state !== "LOBBY" &&
      snapshot?.room_state !== "PICKING" &&
      snapshot?.room_state !== "PLAYING" &&
      snapshot?.room_state !== "RESULT"
    ) {
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
  }, [
    snapshot?.room_state,
    snapshot?.current_round?.round_started_at,
    snapshot?.timers.picking_deadline,
    snapshot?.timers.ready_check_deadline,
    snapshot?.timers.result_deadline,
  ]);

  useEffect(() => {
    const roomHost =
      snapshot?.players.find((player) => player.player_id === savedSettings.playerId) ?? null;
    const amHost =
      snapshot?.host_player_id === savedSettings.playerId || roomHost?.role === "HOST";

    if (snapshot?.room_state === "LOBBY" && amHost && roomHost && !roomHost.ready) {
      roomStore.send("READY_SET", { ready: true });
    }
  }, [savedSettings.playerId, snapshot]);

  useEffect(() => {
    if (
      snapshot === null ||
      snapshot.room_state === "PICKING" ||
      snapshot.room_state === "PLAYING"
    ) {
      setShowHostLeaveConfirm(false);
    }
  }, [snapshot]);

  useEffect(() => {
    return () => {
      if (cutInTimeoutRef.current !== null) {
        window.clearTimeout(cutInTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPendingOwnPickCutIn(null);
    setOwnPickCutInChart(null);
    if (cutInTimeoutRef.current !== null) {
      window.clearTimeout(cutInTimeoutRef.current);
      cutInTimeoutRef.current = null;
    }
  }, [snapshot?.room_id]);

  useEffect(() => {
    if (pendingOwnPickCutIn === null || mySubmittedPick?.pick_chart_key !== pendingOwnPickCutIn.chart_key) {
      return;
    }

    if (cutInTimeoutRef.current !== null) {
      window.clearTimeout(cutInTimeoutRef.current);
    }

    setOwnPickCutInChart(pendingOwnPickCutIn);
    setPendingOwnPickCutIn(null);
    cutInTimeoutRef.current = window.setTimeout(() => {
      setOwnPickCutInChart(null);
      cutInTimeoutRef.current = null;
    }, BPL_PICK_CUTIN_SECONDS * 1_000);
  }, [mySubmittedPick?.pick_chart_key, pendingOwnPickCutIn]);

  useEffect(() => {
    if (snapshot === null || snapshot.settings.mode !== "ARENA") {
      previousArenaLobbySnapshotRef.current = snapshot;
      setArenaLobbyLogs([]);
      return;
    }

    const previousSnapshot = previousArenaLobbySnapshotRef.current;
    const createLogEntry = (text: string, tone: "default" | "accent" = "default"): RoomArenaLogEntry => ({
      id: `arena-log-${arenaLobbyLogSequenceRef.current++}`,
      text,
      tone,
    });
    const hostName =
      snapshot.players.find((player) => player.player_id === snapshot.host_player_id)?.display_name ?? "HOST";
    const meInRoom =
      snapshot.players.find((player) => player.player_id === savedSettings.playerId) ?? null;

    if (previousSnapshot === null || previousSnapshot.room_id !== snapshot.room_id) {
      const initialLogs: RoomArenaLogEntry[] = [
        createLogEntry(`System: ${hostName} がルームを作成しました`),
        createLogEntry("System: 全員の準備完了を待っています...", "accent"),
      ];
      if (meInRoom && meInRoom.player_id !== snapshot.host_player_id && snapshot.players.length > 1) {
        initialLogs.push(createLogEntry(`System: ${meInRoom.display_name} が入室しました`));
      }
      setArenaLobbyLogs(initialLogs);
      previousArenaLobbySnapshotRef.current = snapshot;
      return;
    }

    const isRemadeLobby =
      previousSnapshot.room_id === snapshot.room_id &&
      previousSnapshot.room_state !== "LOBBY" &&
      snapshot.room_state === "LOBBY" &&
      snapshot.current_round === null &&
      snapshot.picks.length === 0 &&
      snapshot.frozen_rounds.length === 0;
    if (isRemadeLobby) {
      setArenaLobbyLogs([
        createLogEntry("System: 全員の準備完了を待っています...", "accent"),
      ]);
      previousArenaLobbySnapshotRef.current = snapshot;
      return;
    }

    const nextLogs: RoomArenaLogEntry[] = [];
    const previousPlayersById = new Map(previousSnapshot.players.map((player) => [player.player_id, player]));
    const currentPlayersById = new Map(snapshot.players.map((player) => [player.player_id, player]));

    snapshot.players.forEach((player) => {
      if (!previousPlayersById.has(player.player_id)) {
        nextLogs.push(createLogEntry(`System: ${player.display_name} が入室しました`));
      }
    });

    previousSnapshot.players.forEach((player) => {
      if (!currentPlayersById.has(player.player_id)) {
        nextLogs.push(createLogEntry(`System: ${player.display_name} が退室しました`));
      }
    });

    snapshot.players.forEach((player) => {
      if (player.player_id === snapshot.host_player_id) {
        return;
      }

      const previousPlayer = previousPlayersById.get(player.player_id);
      if (!previousPlayer || previousPlayer.ready === player.ready) {
        return;
      }

      nextLogs.push(
        createLogEntry(
          player.ready
            ? `System: ${player.display_name} が準備完了になりました`
            : `System: ${player.display_name} が準備を解除しました`,
        ),
      );
    });

    const previousAllReady =
      previousSnapshot.players.length >= 2 &&
      previousSnapshot.players
        .filter((player) => player.player_id !== previousSnapshot.host_player_id)
        .every((player) => player.ready);
    const currentAllReady =
      snapshot.players.length >= 2 &&
      snapshot.players
        .filter((player) => player.player_id !== snapshot.host_player_id)
        .every((player) => player.ready);
    if (!previousAllReady && currentAllReady) {
      nextLogs.push(createLogEntry("System: 全員が準備完了になりました", "accent"));
    }

    if (nextLogs.length > 0) {
      setArenaLobbyLogs((current) => [...current, ...nextLogs]);
    }

    previousArenaLobbySnapshotRef.current = snapshot;
  }, [savedSettings.playerId, snapshot]);

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
  const readyPlayersCount = snapshot.players.filter(
    (player) => player.ready || player.player_id === snapshot.host_player_id,
  ).length;
  const lobbyStartIssues = snapshot.room_state === "LOBBY" ? getLobbyStartIssues(snapshot) : [];
  const currentRoundDisplay =
    currentRound === null ? null : snapshot.frozen_rounds.find((round) => round.round_index === currentRound.round_index) ?? null;
  const pickingCountdown = getRemainingSeconds(getIsoTimeMs(snapshot.timers.picking_deadline), clockNowMs);
  const playingCountdown = currentRound === null ? null : getPlayingCountdown(currentRound, clockNowMs);
  const resultCountdown = getRemainingSeconds(getIsoTimeMs(snapshot.timers.result_deadline), clockNowMs);

  const theme = getTheme(snapshot.settings.mode);
  const isBpl = snapshot.settings.mode === "BPL";
  const leaveRoomDisabled = snapshot.room_state === "PICKING" || snapshot.room_state === "PLAYING";
  const orderedPlayers = [...snapshot.players].sort((left, right) => {
    const leftHost = left.player_id === snapshot.host_player_id || left.role === "HOST" ? 1 : 0;
    const rightHost = right.player_id === snapshot.host_player_id || right.role === "HOST" ? 1 : 0;
    if (leftHost !== rightHost) {
      return rightHost - leftHost;
    }

    return left.display_name.localeCompare(right.display_name);
  });
  const slots = isBpl
    ? [orderedPlayers[0] ?? null, orderedPlayers[1] ?? null]
    : Array.from({ length: snapshot.settings.max_players }, (_, index) => orderedPlayers[index] ?? null);
  const resultPlayers = parseResultPlayers(resultReady);
  const resultRounds = parseResultRounds(resultReady);
  const winnerIds = new Set(resultReady?.summary.winner_player_ids ?? []);
  const historyRounds: ParsedResultRound[] = (() => {
    if (resultRounds.length > 0) {
      return resultRounds;
    }

    if (isBpl) {
      return endedRoundIndices.reduce<ParsedResultRound[]>((rounds, roundIndex) => {
            const frozenRound = snapshot.frozen_rounds.find((round) => round.round_index === roundIndex);
            const confirmations = roundConfirmations[roundIndex] ?? [];
            if (frozenRound === undefined || confirmations.length < 2) {
              return rounds;
            }

            const confirmationByPlayerId = new Map(confirmations.map((entry) => [entry.player_id, entry]));
            const results = slots
              .filter((player): player is RoomPlayerSnapshot => player !== null)
              .map((player) => ({
                playerId: player.player_id,
                displayName: player.display_name,
                metricValue: confirmationByPlayerId.get(player.player_id)?.metric_value ?? null,
                arenaPoints: null,
              }));
            if (results.length < 2 || results.some((result) => result.metricValue === null)) {
              return rounds;
            }

            const leftResult = results[0];
            const rightResult = results[1];
            if (
              leftResult === undefined ||
              rightResult === undefined ||
              leftResult.metricValue === null ||
              rightResult.metricValue === null
            ) {
              return rounds;
            }

            const comparison = compareMetricValues(
              snapshot.settings.win_metric,
              leftResult.metricValue,
              rightResult.metricValue,
            );
            const winnerPlayerIds =
              comparison === 0 ? [] : [comparison > 0 ? leftResult.playerId : rightResult.playerId];

            const cacheKey = getExpectedKeyCacheKey(frozenRound.expected_key);
            const resolvedChart =
              cacheKey === null ? null : resolvedChartsByExpectedKey[cacheKey] ?? null;
            rounds.push({
              roundIndex,
              title: frozenRound.display.title,
              level: frozenRound.display.level,
              artist: resolvedChart?.artist ?? null,
              expectedKey: frozenRound.expected_key,
              winnerPlayerIds,
              results,
            });

            return rounds;
          }, []);
    }

    return endedRoundIndices.reduce<ParsedResultRound[]>((rounds, roundIndex) => {
      const frozenRound = snapshot.frozen_rounds.find((round) => round.round_index === roundIndex);
      const confirmations = roundConfirmations[roundIndex] ?? [];
      if (frozenRound === undefined || confirmations.length === 0) {
        return rounds;
      }

      const confirmationByPlayerId = new Map(confirmations.map((entry) => [entry.player_id, entry]));
      const rankedPlayers = orderedPlayers
        .map((player) => {
          const confirmation = confirmationByPlayerId.get(player.player_id);
          return confirmation
            ? {
                playerId: player.player_id,
                metricValue: confirmation.metric_value,
              }
            : null;
        })
        .filter((entry): entry is { playerId: string; metricValue: number } => entry !== null)
        .sort((left, right) => {
          const comparison = compareMetricValues(
            snapshot.settings.win_metric,
            left.metricValue,
            right.metricValue,
          );
          if (comparison !== 0) {
            return comparison > 0 ? -1 : 1;
          }

          return left.playerId.localeCompare(right.playerId);
        });

      const rankByPlayerId = new Map<string, number>();
      let previousMetricValue: number | null = null;
      let previousRank = 0;
      rankedPlayers.forEach((entry, index) => {
        if (previousMetricValue !== null && entry.metricValue === previousMetricValue) {
          rankByPlayerId.set(entry.playerId, previousRank);
          return;
        }

        previousMetricValue = entry.metricValue;
        previousRank = index + 1;
        rankByPlayerId.set(entry.playerId, previousRank);
      });

      const results = orderedPlayers.map((player) => {
        const confirmation = confirmationByPlayerId.get(player.player_id);
        const rank = rankByPlayerId.get(player.player_id) ?? null;
        return {
          playerId: player.player_id,
          displayName: player.display_name,
          metricValue: confirmation?.metric_value ?? null,
          arenaPoints:
            rank === null
              ? null
              : rank === 1
                ? 2
                : rank === 2
                  ? 1
                  : 0,
        };
      });

      const winnerPlayerIds = results
        .filter((result) => result.arenaPoints === 2)
        .map((result) => result.playerId);

      rounds.push({
        roundIndex,
        title: frozenRound.display.title,
        level: frozenRound.display.level,
        artist: null,
        expectedKey: frozenRound.expected_key,
        winnerPlayerIds,
        results,
      });

      return rounds;
    }, []);
  })();
  const picksByPlayerId = new Map(snapshot.picks.map((pick) => [pick.player_id, pick]));
  const mockStateLabel = getMockRoomStateLabel(snapshot.room_state);
  const roomIdLabel = snapshot.room_id;
  const joinCodeLabel = snapshot.settings.join_code ?? "";
  const currentExpectedKey = currentRound?.expected_key ?? null;
  const currentExpectedKeyCacheKey = getExpectedKeyCacheKey(currentExpectedKey);
  const currentResolvedChart =
    currentExpectedKeyCacheKey === null ? null : resolvedChartsByExpectedKey[currentExpectedKeyCacheKey] ?? null;
  const roundTitle = formatSongTitle(
    currentExpectedKey,
    currentRoundDisplay?.display.title ?? currentRound?.expected_key.title_search_key ?? "Unknown Track",
  );
  const playingTitle =
    currentResolvedChart?.title_search_key ??
    currentRoundDisplay?.display.title ??
    currentRound?.expected_key.title_search_key ??
    "Unknown Track";
  const roundLevel = currentRoundDisplay?.display.level ?? null;
  const currentSongSubtitle = formatSongArtist(currentResolvedChart?.artist ?? null);
  const currentSongDifficultyTone = getDifficultyPresentation(currentExpectedKey?.difficulty);
  const currentSongDifficultyShort = currentExpectedKey ? currentSongDifficultyTone.shortLabel : null;
  const currentSongLevel = currentResolvedChart?.level ?? roundLevel;
  const activeBplPickIndex = snapshot.room_state === "PICKING" ? Math.min(snapshot.picks.length, 2) : null;
  const displayResultPlayers = resultPlayers.length > 0
    ? resultPlayers
    : orderedPlayers.map((player) => ({
        playerId: player.player_id,
        displayName: player.display_name,
        totalPoints: null,
        totalExScore: null,
        roundWins: null,
        lastConfirmedAt: null,
      }));
  const currentRoundStartAtMs = getIsoTimeMs(currentRound?.round_started_at);
  const forceAdvanceUnlockAtMs =
    currentRoundStartAtMs === null ? null : currentRoundStartAtMs + HOST_SKIP_UNLOCK_SECONDS * 1_000;
  const forceAdvanceRemainingSeconds = getRemainingSeconds(forceAdvanceUnlockAtMs, clockNowMs);
  const forceAdvanceDisabled =
    currentRound === null ||
    forceAdvanceRemainingSeconds === null ||
    forceAdvanceRemainingSeconds > 0;
  const bplLeadInSeconds =
    isBpl && currentRoundStartAtMs !== null && currentRoundStartAtMs > clockNowMs
      ? Math.max(0, Math.ceil((currentRoundStartAtMs - clockNowMs) / 1_000))
      : 0;
  const arenaLeadInSeconds =
    !isBpl && currentRoundStartAtMs !== null && currentRoundStartAtMs > clockNowMs
      ? Math.max(0, Math.ceil((currentRoundStartAtMs - clockNowMs) / 1_000))
      : 0;
  const bplPrestartPhase =
    isBpl && snapshot.room_state === "PLAYING" && currentRound !== null && bplLeadInSeconds > 0 && currentRound.round_index > 0
      ? "RESULT_PHASE"
      : null;
  const arenaPrestartPhase =
    !isBpl && snapshot.room_state === "PLAYING" && currentRound !== null && arenaLeadInSeconds > 0 && currentRound.round_index > 0
      ? "RESULT_PHASE"
      : null;
  const bplPreviousRound =
    isBpl && currentRound !== null && currentRound.round_index > 0
      ? historyRounds.find((round) => round.roundIndex === currentRound.round_index - 1) ?? null
      : null;
  const arenaPreviousRound =
    !isBpl && currentRound !== null && currentRound.round_index > 0
      ? historyRounds.find((round) => round.roundIndex === currentRound.round_index - 1) ?? null
      : null;
  const previousRoundExpectedKey = bplPreviousRound?.expectedKey ?? null;
  const previousRoundDifficultyTone = getDifficultyPresentation(previousRoundExpectedKey?.difficulty);
  const previousRoundTitle = bplPreviousRound
    ? formatSongTitle(previousRoundExpectedKey, bplPreviousRound.title)
    : null;
  const previousRoundSubtitle = formatSongArtist(bplPreviousRound?.artist ?? null);
  const regulationLabel = formatRegulationLabel(snapshot.settings.play_style, snapshot.settings.level_filter);
  const ownPickCutInTitle = ownPickCutInChart
    ? formatSongKeyTitle(ownPickCutInChart.title_search_key, ownPickCutInChart.play_style, ownPickCutInChart.difficulty)
    : null;
  const ownPickCutInArtist = formatSongArtist(ownPickCutInChart?.artist ?? null);
  const soundEnabledLabel = savedSettings.voiceMuted
    ? "Sound muted"
    : isVoicePlaybackEnabled(savedSettings)
      ? `Volume ${savedSettings.voiceVolume}`
      : "Sound disabled";

  function requestLeaveRoom(): void {
    if (leaveRoomDisabled) {
      return;
    }

    if (isHost) {
      setShowHostLeaveConfirm(true);
      return;
    }

    roomStore.leaveRoom();
  }

  function handleCopy(text: string, setCopied: (value: boolean) => void): void {
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });
  }

  function submitManualResult(): void {
    if (!currentRound) {
      return;
    }

    const parsedMetricValue = Number(metricValue);
    if (!Number.isInteger(parsedMetricValue) || parsedMetricValue < 0) {
      return;
    }

    roomStore.submitResult({
      round_index: currentRound.round_index,
      observed_key: currentRound.expected_key,
      metric_value: parsedMetricValue,
    });
  }

  const playElapsedSeconds =
    currentRoundStartAtMs === null ? 0 : Math.max(0, Math.floor((clockNowMs - currentRoundStartAtMs) / 1_000));
  const mockPlayingPhase =
    playingCountdown?.label === "PLAY START"
      ? "PLAY_START"
      : playingCountdown?.label === "IN PLAY"
        ? "IN_PLAY"
        : "MUSIC_SELECT";
  const chartResultsByKey = new Map(chartResults.map((chart) => [chart.chart_key, chart]));
  const getResolvedPickChart = (pickChartKey: string): ChartSearchEntry | null => (
    chartResultsByKey.get(pickChartKey) ??
    resolvedChartsByPickKey[pickChartKey] ??
    (pendingOwnPickCutIn?.chart_key === pickChartKey ? pendingOwnPickCutIn : null) ??
    (ownPickCutInChart?.chart_key === pickChartKey ? ownPickCutInChart : null) ??
    null
  );
  const pickerSongs: SongSearchModalSong[] = chartResults.map((chart) => ({
    id: chart.chart_key,
    title: chart.title,
    artist: chart.artist,
    difficulty: getDifficultyId(chart.difficulty),
    level: chart.level,
    genre: chart.genre,
  }));
  const showPickerModal = snapshot.room_state === "PICKING" && mySubmittedPick === null;
  const pickerModal = (
    <SongSearchModalView
      isOpen={showPickerModal}
      search={chartKeyword}
      selectedDiff={chartDifficulty ? getDifficultyId(chartDifficulty) : null}
      selectedLevel={chartLevel ? Number(chartLevel) : null}
      timeLeft={pickingCountdown ?? 120}
      displayedSongs={pickerSongs}
      totalSongs={chartResults.length + (chartNextCursor === null ? 0 : CHART_SEARCH_PAGE_SIZE)}
      onSearchChange={setChartKeyword}
      onToggleDiff={(difficultyId) => {
        const nextDifficulty = getDifficultyFromId(chartDifficulty === getDifficultyFromId(difficultyId) ? null : difficultyId);
        setChartDifficulty(nextDifficulty ?? "");
      }}
      onToggleLevel={(level) => {
        setChartLevel(chartLevel === String(level) ? "" : String(level));
      }}
      onSelect={(song) => {
        if (typeof song.id !== "string") {
          return;
        }

        const selectedChart = chartResultsByKey.get(song.id);
        if (!selectedChart) {
          return;
        }

        setPendingOwnPickCutIn(selectedChart);
        roomStore.submitPick(selectedChart.chart_key);
      }}
    />
  );

  const actualToMockId = new Map<string, string>();
  const mockIdToActualId = new Map<string, string>();
  orderedPlayers.slice(0, 4).forEach((player, index) => {
    const mockId = String(index + 1);
    actualToMockId.set(player.player_id, mockId);
    mockIdToActualId.set(mockId, player.player_id);
  });

  const roundSongsByIndex = new Map<number, {
    selectionTitle: string;
    playingTitle: string;
    artist: string;
    level: string | number;
    difficultyId: string;
  }>();
  const registerRoundSong = (
    roundIndex: number,
    expectedKey: DisplayExpectedKey | null | undefined,
    fallbackTitle: string,
    fallbackLevel: number | null | undefined,
  ) => {
    const cacheKey = getExpectedKeyCacheKey(expectedKey);
    const resolvedChart = cacheKey === null ? null : resolvedChartsByExpectedKey[cacheKey] ?? null;
    roundSongsByIndex.set(roundIndex, {
      selectionTitle: expectedKey
        ? formatSongKeyTitle(expectedKey.title_search_key, expectedKey.play_style, expectedKey.difficulty)
        : fallbackTitle,
      playingTitle: resolvedChart?.title ?? fallbackTitle,
      artist: formatSongArtist(resolvedChart?.artist ?? null),
      level: resolvedChart?.level ?? fallbackLevel ?? "?",
      difficultyId: getDifficultyId(expectedKey?.difficulty),
    });
  };

  snapshot.frozen_rounds.forEach((round) => {
    if (
      round.started_at === null &&
      currentRound?.round_index !== round.round_index &&
      !endedRoundIndices.includes(round.round_index)
    ) {
      return;
    }

    registerRoundSong(
      round.round_index,
      round.expected_key,
      round.display.title,
      round.display.level,
    );
  });

  if (currentRound && !roundSongsByIndex.has(currentRound.round_index)) {
    registerRoundSong(
      currentRound.round_index,
      currentRound.expected_key,
      currentResolvedChart?.title ?? currentRoundDisplay?.display.title ?? currentRound.expected_key.title_search_key,
      currentSongLevel,
    );
  }

  const bplPlayers: RoomBPLPlayer[] = Array.from({ length: 2 }, (_, index) => {
    const player = slots[index];
    const isPlayerHost = player?.player_id === snapshot.host_player_id || player?.role === "HOST";
    return {
      id: String(index + 1),
      name: player?.display_name ?? (index === 0 ? "HOST" : "GUEST"),
      isReady: player ? (isPlayerHost ? true : player.ready) : false,
      isHost: isPlayerHost,
      side: index === 0 ? "LEFT" : "RIGHT",
    };
  });
  const arenaPlayers: RoomArenaPlayer[] = Array.from({ length: 4 }, (_, index) => {
    const player = orderedPlayers[index] ?? null;
    const isPlayerHost = player?.player_id === snapshot.host_player_id || player?.role === "HOST";
    return {
      id: String(index + 1),
      name:
        player?.display_name ??
        (index === 0
          ? "PLAYER_ONE (HOST)"
          : index === 1
            ? "RIVAL_KUN"
            : index === 2
              ? "IIDX_CHAMP"
              : "ARENA_PRO"),
      isReady: player ? (isPlayerHost ? true : player.ready) : false,
      isHost: isPlayerHost,
    };
  });

  const buildHistorySong = (round: ParsedResultRound) => {
    const song = roundSongsByIndex.get(round.roundIndex);
    return {
      title: song?.playingTitle ?? round.title,
      artist: song?.artist ?? formatSongArtist(round.artist),
      level: song?.level ?? round.level ?? "?",
      ...(song?.difficultyId ? { difficulty: song.difficultyId } : {}),
    };
  };

  const bplHistory = [...historyRounds]
    .filter((round) => round.results.slice(0, 2).every((result) => result.metricValue !== null))
    .reverse()
    .map((round) => {
      const scores: Record<string, number> = { "1": 0, "2": 0 };
      round.results.slice(0, 2).forEach((result) => {
        const mockId = actualToMockId.get(result.playerId);
        if (mockId && result.metricValue !== null) {
          scores[mockId] = result.metricValue;
        }
      });
      const winnerId =
        round.winnerPlayerIds.length === 0
          ? "DRAW"
          : (actualToMockId.get(round.winnerPlayerIds[0] ?? "") ?? "DRAW");

      return {
        round: round.roundIndex + 1,
        song: buildHistorySong(round),
        scores,
        winnerId,
      };
    });
  const arenaHistory: ArenaHistoryItem[] = [...historyRounds]
    .filter((round) => round.results.some((result) => result.metricValue !== null || result.arenaPoints !== null))
    .reverse()
    .map((round) => {
      const scores: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0 };
      round.results.slice(0, 4).forEach((result) => {
        const mockId = actualToMockId.get(result.playerId);
        const value = result.arenaPoints ?? result.metricValue;
        if (mockId && value !== null) {
          scores[mockId] = value;
        }
      });
      const winnerId =
        round.winnerPlayerIds.length === 0
          ? "DRAW"
          : (actualToMockId.get(round.winnerPlayerIds[0] ?? "") ?? "DRAW");

      return {
        round: round.roundIndex + 1,
        song: buildHistorySong(round),
        scores,
        winnerId,
      };
    });

  const bplPicks: (BplSong | null)[] = Array.from({ length: 3 }, (_, index) => {
    const roundSong = roundSongsByIndex.get(index);
    if (roundSong) {
      const revealActualSong =
        endedRoundIndices.includes(index) ||
        currentRound?.round_index === index ||
        bplPreviousRound?.roundIndex === index;
      return {
        title: revealActualSong ? roundSong.playingTitle : roundSong.selectionTitle,
        artist: roundSong.artist,
        level: roundSong.level,
        difficulty: roundSong.difficultyId,
      };
    }

    if (index < 2) {
      const slotPlayer = slots[index];
      const playerPick = slotPlayer ? picksByPlayerId.get(slotPlayer.player_id) ?? null : null;
      if (playerPick) {
        const parsedPickChartKey = parsePickChartKey(playerPick.pick_chart_key);
        const resolvedPickChart = getResolvedPickChart(playerPick.pick_chart_key);
        return {
          title: parsedPickChartKey
            ? formatSongKeyTitle(
                parsedPickChartKey.title_search_key,
                parsedPickChartKey.play_style,
                parsedPickChartKey.difficulty,
              )
            : resolvedPickChart?.title ?? "DECIDED",
          artist: formatSongArtist(resolvedPickChart?.artist ?? null),
          level: resolvedPickChart?.level ?? "?",
          difficulty: getDifficultyId(parsedPickChartKey?.difficulty ?? resolvedPickChart?.difficulty),
        };
      }
    }

    if (index === 2) {
      return { title: "?????", artist: "System Random", level: "??" };
    }

    return null;
  });

  const arenaPicks: Record<string, ArenaSong | null> = {
    "1": null,
    "2": null,
    "3": null,
    "4": null,
  };
  snapshot.picks.forEach((pick) => {
    const mockId = actualToMockId.get(pick.player_id);
    if (!mockId) {
      return;
    }

    const resolvedPickChart = getResolvedPickChart(pick.pick_chart_key);
    const parsedPickChartKey = parsePickChartKey(pick.pick_chart_key);
    const isOwnPick = pick.player_id === savedSettings.playerId;

    arenaPicks[mockId] = {
      title:
        isOwnPick
          ? resolvedPickChart?.title ??
            parsedPickChartKey?.title_search_key ??
            "DECIDED"
          : "DECIDED",
      artist: isOwnPick ? formatSongArtist(resolvedPickChart?.artist ?? null) : "Track Hidden",
      difficulty: isOwnPick
        ? getDifficultyId(parsedPickChartKey?.difficulty ?? resolvedPickChart?.difficulty)
        : "-",
      level: isOwnPick ? resolvedPickChart?.level ?? "?" : "?",
    };
  });
  roundSongsByIndex.forEach((roundSong, roundIndex) => {
    const mockId = String(roundIndex + 1);
    if (!(mockId in arenaPicks)) {
      return;
    }

    arenaPicks[mockId] = {
      title: roundSong.playingTitle,
      artist: roundSong.artist,
      difficulty: roundSong.difficultyId,
      level: typeof roundSong.level === "number" ? roundSong.level : 12,
    };
  });

  const bplPlayerStatus = bplPlayers.reduce<Record<string, "UNCONFIRMED" | "PLAYED" | "SKIPPED" | "TIMEOUT">>((accumulator, player, index) => {
    const actualPlayer = slots[index];
    const status = actualPlayer ? getPlayerStatus(currentRound, actualPlayer.player_id).label : "UNCONFIRMED";
    accumulator[player.id] =
      status === "PLAYED" || status === "SKIPPED" || status === "TIMEOUT" ? status : "UNCONFIRMED";
    return accumulator;
  }, {});
  const bplPlayerMetrics = bplPlayers.reduce<Record<string, number | null>>((accumulator, player, index) => {
    const actualPlayer = slots[index];
    accumulator[player.id] = actualPlayer ? getPlayerStatus(currentRound, actualPlayer.player_id).metric : null;
    return accumulator;
  }, {});
  const bplMetricLabel = snapshot.settings.win_metric === "MISSCOUNT" ? "MISS COUNT" : "EX SCORE";
  const bplResultPlayers = bplPlayers.reduce<Record<string, {
    metricValue: number | null;
    stagePoints: number;
    totalPoints: number;
    outcome: "WINNER" | "LOSER" | "DRAW";
  }>>((accumulator, player, index) => {
    const actualPlayer = slots[index];
    if (!actualPlayer || !bplPreviousRound) {
      return accumulator;
    }

    const currentRoundResult = bplPreviousRound.results.find((result) => result.playerId === actualPlayer.player_id) ?? null;
    const cumulativeRounds = historyRounds.filter((round) => round.roundIndex <= bplPreviousRound.roundIndex);
    const totalPoints = cumulativeRounds.reduce((sum, round) => {
      const leftResult = round.results[0];
      const rightResult = round.results[1];
      if (
        !leftResult ||
        !rightResult ||
        leftResult.metricValue === null ||
        rightResult.metricValue === null
      ) {
        return sum;
      }

      const comparison = compareMetricValues(
        snapshot.settings.win_metric,
        leftResult.metricValue,
        rightResult.metricValue,
      );
      if (comparison === 0) {
        return (actualPlayer.player_id === leftResult.playerId || actualPlayer.player_id === rightResult.playerId)
          ? sum + 1
          : sum;
      }

      const winnerPlayerId = comparison > 0 ? leftResult.playerId : rightResult.playerId;
      return actualPlayer.player_id === winnerPlayerId ? sum + 1 : sum;
    }, 0);

    const leftResult = bplPreviousRound.results[0];
    const rightResult = bplPreviousRound.results[1];
    let outcome: "WINNER" | "LOSER" | "DRAW" = "LOSER";
    let stagePoints = 0;
    if (
      leftResult &&
      rightResult &&
      leftResult.metricValue !== null &&
      rightResult.metricValue !== null
    ) {
      const comparison = compareMetricValues(
        snapshot.settings.win_metric,
        leftResult.metricValue,
        rightResult.metricValue,
      );
      if (comparison === 0) {
        outcome = "DRAW";
        stagePoints = 1;
      } else {
        const winnerPlayerId = comparison > 0 ? leftResult.playerId : rightResult.playerId;
        outcome = actualPlayer.player_id === winnerPlayerId ? "WINNER" : "LOSER";
        stagePoints = actualPlayer.player_id === winnerPlayerId ? 1 : 0;
      }
    }

    accumulator[player.id] = {
      metricValue: currentRoundResult?.metricValue ?? null,
      stagePoints,
      totalPoints,
      outcome,
    };
    return accumulator;
  }, {});
  const derivedBplTotalPointsByPlayerId = historyRounds.reduce<Record<string, number>>((accumulator, round) => {
    const leftResult = round.results[0];
    const rightResult = round.results[1];
    if (
      !leftResult ||
      !rightResult ||
      leftResult.metricValue === null ||
      rightResult.metricValue === null
    ) {
      return accumulator;
    }

    const comparison = compareMetricValues(
      snapshot.settings.win_metric,
      leftResult.metricValue,
      rightResult.metricValue,
    );
    if (comparison === 0) {
      accumulator[leftResult.playerId] = (accumulator[leftResult.playerId] ?? 0) + 1;
      accumulator[rightResult.playerId] = (accumulator[rightResult.playerId] ?? 0) + 1;
      return accumulator;
    }

    const winnerPlayerId = comparison > 0 ? leftResult.playerId : rightResult.playerId;
    accumulator[winnerPlayerId] = (accumulator[winnerPlayerId] ?? 0) + 1;
    return accumulator;
  }, {});
  const displayResultPlayerById = new Map(displayResultPlayers.map((player) => [player.playerId, player]));
  const derivedBplWinnerPlayerIds = winnerIds.size > 0
    ? [...winnerIds]
    : slots
        .filter((player): player is RoomPlayerSnapshot => player !== null)
        .map((player) => ({
          playerId: player.player_id,
          totalPoints:
            displayResultPlayerById.get(player.player_id)?.totalPoints ??
            derivedBplTotalPointsByPlayerId[player.player_id] ??
            0,
        }))
        .reduce<Array<string>>((currentWinners, player) => {
          if (currentWinners.length === 0) {
            return [player.playerId];
          }

          const currentBest = currentWinners[0]
            ? (
                displayResultPlayerById.get(currentWinners[0])?.totalPoints ??
                derivedBplTotalPointsByPlayerId[currentWinners[0]] ??
                0
              )
            : Number.NEGATIVE_INFINITY;
          if (player.totalPoints > currentBest) {
            return [player.playerId];
          }
          if (player.totalPoints === currentBest) {
            return [...currentWinners, player.playerId];
          }

          return currentWinners;
        }, []);
  const bplWinningPlayerName = derivedBplWinnerPlayerIds
    .map((playerId) => (
      slots.find((player) => player?.player_id === playerId)?.display_name ??
      displayResultPlayerById.get(playerId)?.displayName ??
      null
    ))
    .filter((playerName): playerName is string => playerName !== null)
    .join(" / ") || "DRAW";
  const bplFinalResultPlayers = bplPlayers.reduce<Record<string, {
    totalPoints: number;
    isWinner: boolean;
  }>>((accumulator, player, index) => {
    const actualPlayer = slots[index];
    if (!actualPlayer) {
      return accumulator;
    }

    accumulator[player.id] = {
      totalPoints:
        displayResultPlayerById.get(actualPlayer.player_id)?.totalPoints ??
        derivedBplTotalPointsByPlayerId[actualPlayer.player_id] ??
        0,
      isWinner: derivedBplWinnerPlayerIds.includes(actualPlayer.player_id),
    };
    return accumulator;
  }, {});
  const arenaPlayerStatus = arenaPlayers.reduce<Record<string, "UNCONFIRMED" | "PLAYED" | "SKIPPED" | "TIMEOUT">>((accumulator, player, index) => {
    const actualPlayer = orderedPlayers[index] ?? null;
    const status = actualPlayer ? getPlayerStatus(currentRound, actualPlayer.player_id).label : "UNCONFIRMED";
    accumulator[player.id] =
      status === "PLAYED" || status === "SKIPPED" || status === "TIMEOUT" ? status : "UNCONFIRMED";
    return accumulator;
  }, {});
  const arenaPlayerMetrics = arenaPlayers.reduce<Record<string, number | null>>((accumulator, player, index) => {
    const actualPlayer = orderedPlayers[index] ?? null;
    accumulator[player.id] = actualPlayer ? getPlayerStatus(currentRound, actualPlayer.player_id).metric : null;
    return accumulator;
  }, {});
  const arenaMetricLabel = snapshot.settings.win_metric === "MISSCOUNT" ? "MISS COUNT" : "EX SCORE";
  const arenaResultSong = arenaPreviousRound ? buildHistorySong(arenaPreviousRound) : null;
  const arenaPreviousRoundResultsByPlayerId = new Map(
    (arenaPreviousRound?.results ?? []).map((result) => [result.playerId, result]),
  );
  const rankedArenaPreviousRoundResults = (arenaPreviousRound?.results ?? [])
    .filter((result): result is ParsedResultRound["results"][number] & { metricValue: number } => result.metricValue !== null)
    .sort((left, right) => {
      const comparison = compareMetricValues(
        snapshot.settings.win_metric,
        left.metricValue,
        right.metricValue,
      );
      if (comparison !== 0) {
        return comparison > 0 ? -1 : 1;
      }

      return left.playerId.localeCompare(right.playerId);
    });
  const arenaPreviousRoundRankByPlayerId = rankedArenaPreviousRoundResults.reduce<Map<string, number>>((accumulator, result, resultIndex) => {
    const previousResult = resultIndex > 0 ? rankedArenaPreviousRoundResults[resultIndex - 1] : null;
    const previousRank = previousResult ? accumulator.get(previousResult.playerId) ?? resultIndex : 0;
    accumulator.set(
      result.playerId,
      previousResult && previousResult.metricValue === result.metricValue ? previousRank : resultIndex + 1,
    );
    return accumulator;
  }, new Map<string, number>());
  const arenaResultPlayers = arenaPlayers.reduce<Record<string, RoomArenaResultPhasePlayerSummary>>((accumulator, player, index) => {
    const actualPlayer = orderedPlayers[index] ?? null;
    if (!actualPlayer || !arenaPreviousRound) {
      return accumulator;
    }

    const actualResult = arenaPreviousRoundResultsByPlayerId.get(actualPlayer.player_id);
    const rank = arenaPreviousRoundRankByPlayerId.get(actualPlayer.player_id) ?? null;
    accumulator[player.id] = {
      rank,
      stagePoints:
        rank === null
          ? 0
          : rank === 1
            ? 2
            : rank === 2
              ? 1
              : 0,
      metricValue: actualResult?.metricValue ?? null,
      isWinner: rank === 1,
    };
    return accumulator;
  }, {});
  const sortedArenaFinalPlayers = [...displayResultPlayers].sort((left, right) => {
    const leftPoints = left.totalPoints ?? Number.NEGATIVE_INFINITY;
    const rightPoints = right.totalPoints ?? Number.NEGATIVE_INFINITY;
    if (leftPoints !== rightPoints) {
      return rightPoints - leftPoints;
    }

    const leftExScore = left.totalExScore ?? Number.NEGATIVE_INFINITY;
    const rightExScore = right.totalExScore ?? Number.NEGATIVE_INFINITY;
    if (leftExScore !== rightExScore) {
      return rightExScore - leftExScore;
    }

    return left.displayName.localeCompare(right.displayName);
  });
  const arenaFinalRankByPlayerId = sortedArenaFinalPlayers.reduce<Map<string, number>>((accumulator, player, playerIndex) => {
    const previousPlayer = playerIndex > 0 ? sortedArenaFinalPlayers[playerIndex - 1] : null;
    const previousRank = previousPlayer ? accumulator.get(previousPlayer.playerId) ?? playerIndex : 0;
    accumulator.set(
      player.playerId,
      previousPlayer &&
        previousPlayer.totalPoints === player.totalPoints &&
        previousPlayer.totalExScore === player.totalExScore
        ? previousRank
        : playerIndex + 1,
    );
    return accumulator;
  }, new Map<string, number>());
  const arenaFinalWinnerPlayerIds = winnerIds.size > 0
    ? [...winnerIds]
    : sortedArenaFinalPlayers
        .filter((player) => (arenaFinalRankByPlayerId.get(player.playerId) ?? null) === 1)
        .map((player) => player.playerId);
  const arenaFinalResultPlayers = arenaPlayers.reduce<Record<string, RoomArenaFinalResultPlayerSummary>>((accumulator, player, index) => {
    const actualPlayer = orderedPlayers[index] ?? null;
    if (!actualPlayer) {
      return accumulator;
    }

    const resultPlayer = displayResultPlayers.find((entry) => entry.playerId === actualPlayer.player_id) ?? null;
    accumulator[player.id] = {
      rank: arenaFinalRankByPlayerId.get(actualPlayer.player_id) ?? null,
      totalPoints: resultPlayer?.totalPoints ?? 0,
      isWinner: arenaFinalWinnerPlayerIds.includes(actualPlayer.player_id),
    };
    return accumulator;
  }, {});
  const arenaFinalDurationMsCandidates = [
    getIsoTimeMs(snapshot.closed_at),
    ...displayResultPlayers.map((player) => getIsoTimeMs(player.lastConfirmedAt)),
  ].filter((value): value is number => value !== null);
  const arenaFinalEndAtMs =
    arenaFinalDurationMsCandidates.length > 0
      ? Math.max(...arenaFinalDurationMsCandidates)
      : clockNowMs;
  const arenaFinalDurationReferenceMs =
    snapshot.room_state === "RESULT" ? clockNowMs : arenaFinalEndAtMs;
  const arenaCreatedAtMs = getIsoTimeMs(snapshot.created_at);
  const arenaFinalDurationLabel = formatDurationLabel(
    arenaCreatedAtMs === null
      ? null
      : Math.max(
          0,
          MATCH_TTL_MINUTES * 60 - Math.floor((arenaFinalDurationReferenceMs - arenaCreatedAtMs) / 1_000),
        ),
  );
  const arenaRoomName = formatRoomTitle(
    snapshot.settings.mode,
    snapshot.settings.play_style,
    snapshot.settings.room_comment,
  );
  const arenaBattleModeLabel = formatRegulationLabel(snapshot.settings.play_style, snapshot.settings.level_filter);
  const arenaRegCount = snapshot.settings.max_players;
  const arenaTotalRounds = snapshot.frozen_rounds.length > 0 ? snapshot.frozen_rounds.length : snapshot.players.length;
  const arenaMatchInfoItems: RoomArenaMatchInfoItem[] = [
    { label: "Mode", value: snapshot.settings.mode },
    { label: "Scoring", value: arenaMetricLabel },
    { label: "Players", value: `${snapshot.players.length} / ${snapshot.settings.max_players}` },
    { label: "Visibility", value: snapshot.settings.visibility },
  ];

  const roomSurface = (() => {
    if (snapshot.room_state === "CLOSED") {
      return (
        <section className="relative flex min-h-full items-center justify-center overflow-hidden bg-[#0b0b0c] px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.14),transparent_40%)]" />
          <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#17181a] p-8 shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-300">
              <ShieldAlert size={30} />
            </div>
            <p className="mt-6 text-center text-[10px] font-black uppercase tracking-[0.35em] text-red-400">Room Closed</p>
            <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-white">部屋が解散しました</h2>
            <p className="mt-4 text-center text-sm font-bold text-gray-400">
              理由: {snapshot.close_reason ?? "-"}
            </p>
            <p className="mt-1 text-center text-xs font-medium text-gray-500">
              {formatDateTime(snapshot.closed_at)}
            </p>
            <button
              type="button"
              onClick={() => roomStore.leaveRoom()}
              className="mt-8 w-full rounded-2xl bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-gray-200"
            >
              OK
            </button>
          </div>
        </section>
      );
    }

    const onMockSkip = (mockPlayerId: string) => {
      if (!currentRound) {
        return;
      }

      const targetPlayerId = mockIdToActualId.get(mockPlayerId);
      if (!targetPlayerId) {
        return;
      }

      if (targetPlayerId === savedSettings.playerId) {
        roomStore.skipSelf(currentRound.round_index, "OTHER");
        return;
      }

      if (isHost) {
        roomStore.skipHostAssign(currentRound.round_index, targetPlayerId, "OTHER");
      }
    };
    const onPrimaryRoomAction = () => {
      if (snapshot.room_state !== "LOBBY") {
        return;
      }

      if (isHost) {
        roomStore.startMatch();
      } else {
        roomStore.send("READY_SET", { ready: !(me?.ready ?? false) });
      }
    };
    const onReturnToLobby = () => {
      if (!isHost) {
        return;
      }

      roomStore.returnToLobby();
    };
    const lastMockPickedSong =
      ownPickCutInChart === null
        ? null
        : {
            title: ownPickCutInTitle ?? ownPickCutInChart.title,
            artist: ownPickCutInArtist,
            level: ownPickCutInChart.level,
          };

    if (isBpl) {
      const bplRoomStatus: RoomBPLControlledState["roomStatus"] =
        snapshot.room_state === "LOBBY"
          ? "WAITING"
          : snapshot.room_state === "PICKING"
            ? "SELECTING"
            : snapshot.room_state === "PLAYING" && bplPrestartPhase === "RESULT_PHASE" && bplPreviousRound
              ? "RESULT"
            : snapshot.room_state === "PLAYING"
                ? "PLAYING"
                : "CLOSED";
      const bplRoundCount =
        bplRoomStatus === "RESULT"
          ? (bplPreviousRound?.roundIndex ?? 0) + 1
          : currentRound
            ? currentRound.round_index + 1
            : historyRounds.length > 0
              ? historyRounds[historyRounds.length - 1]!.roundIndex + 1
              : 1;
      const controlledProps: RoomBPLControlledState = {
        roomStatus: bplRoomStatus,
        isReady: isHost ? true : me?.ready ?? false,
        closeReason: snapshot.close_reason ?? "ALL_ROUNDS_COMPLETED",
        resultTimer: bplRoomStatus === "RESULT" ? bplLeadInSeconds : resultCountdown ?? BPL_RESULT_PHASE_SECONDS,
        currentTurn: activeBplPickIndex ?? 0,
        roundCount: bplRoundCount,
        picks: bplPicks,
        history: bplHistory,
        showSearch: showPickerModal,
        lastPickedSong: lastMockPickedSong,
        showCutIn: ownPickCutInChart !== null,
        copiedId: copiedRoomId,
        copiedCode: copiedJoinCode,
        lobbyTimer: getRemainingSeconds(getIsoTimeMs(snapshot.timers.ready_check_deadline), clockNowMs) ?? 0,
        roomId: roomIdLabel,
        joinCode: joinCodeLabel,
        battleModeLabel: formatRegulationLabel(snapshot.settings.play_style, snapshot.settings.level_filter),
        playTime: playElapsedSeconds,
        playingPhase: mockPlayingPhase,
        playingCountdownSeconds: playingCountdown?.remainingSeconds ?? null,
        playerStatus: bplPlayerStatus,
        playerMetrics: bplPlayerMetrics,
        metricLabel: bplMetricLabel,
        resultPlayers: bplResultPlayers,
        resultRegulationLabel: "3 STAGES",
        finalResultPlayers: bplFinalResultPlayers,
        finalWinningPlayerName: bplWinningPlayerName,
        isHost,
        players: bplPlayers,
        disablePrimaryAction: snapshot.room_state !== "LOBBY" || (isHost && lobbyStartIssues.length > 0),
        disableLeave: leaveRoomDisabled,
        searchModal: pickerModal,
        onCopyRoomId: () => handleCopy(roomIdLabel, setCopiedRoomId),
        onCopyJoinCode: () => handleCopy(joinCodeLabel, setCopiedJoinCode),
        onPrimaryAction: onPrimaryRoomAction,
        onSkip: onMockSkip,
        onProceedToResult: () => {
          if (currentRound) {
            roomStore.forceAdvance(currentRound.round_index);
          }
        },
        onLeaveRoom: requestLeaveRoom,
        onRemakeStage: onReturnToLobby,
      };

      return <RoomBPLPresentational {...controlledProps} />;
    }

    const arenaRoomStatus: RoomArenaControlledState["roomStatus"] =
      snapshot.room_state === "LOBBY"
        ? "WAITING"
        : snapshot.room_state === "PICKING"
          ? "SELECTING"
          : snapshot.room_state === "PLAYING" && arenaPrestartPhase === "RESULT_PHASE" && arenaPreviousRound
            ? "RESULT"
            : snapshot.room_state === "PLAYING"
              ? "PLAYING"
              : "CLOSED";
    const arenaRoundCount =
      arenaRoomStatus === "RESULT"
        ? (arenaPreviousRound?.roundIndex ?? 0) + 1
        : currentRound
          ? currentRound.round_index + 1
          : historyRounds.length > 0
            ? historyRounds[historyRounds.length - 1]!.roundIndex + 1
            : 1;
    const controlledProps: RoomArenaControlledState = {
      roomStatus: arenaRoomStatus,
      isReady: isHost ? true : me?.ready ?? false,
      closeReason: snapshot.close_reason ?? "ALL_ROUNDS_COMPLETED",
      resultTimer: arenaRoomStatus === "RESULT" ? arenaLeadInSeconds : resultCountdown ?? 10,
      roundCount: arenaRoundCount,
      history: arenaHistory,
      playerPicks: arenaPicks,
      showSearch: showPickerModal,
      showCutIn: ownPickCutInChart !== null,
      lastPickedSong: lastMockPickedSong,
      copiedId: copiedRoomId,
      copiedCode: copiedJoinCode,
      lobbyTimer: getRemainingSeconds(getIsoTimeMs(snapshot.timers.ready_check_deadline), clockNowMs) ?? 0,
      currentPlayers: snapshot.players.length,
      maxPlayers: snapshot.settings.max_players,
      roomName: arenaRoomName,
      battleModeLabel: arenaBattleModeLabel,
      regCount: arenaRegCount,
      isPrivateRoom: snapshot.settings.visibility === "PRIVATE",
      roomId: roomIdLabel,
      joinCode: joinCodeLabel,
      pickingCountdownSeconds: pickingCountdown ?? 0,
      logs: arenaLobbyLogs,
      matchInfoItems: arenaMatchInfoItems,
      playTime: playElapsedSeconds,
      playingPhase: mockPlayingPhase,
      playingCountdownSeconds: playingCountdown?.remainingSeconds ?? null,
      playerStatus: arenaPlayerStatus,
      playerMetrics: arenaPlayerMetrics,
      metricLabel: arenaMetricLabel,
      resultSong: arenaResultSong,
      resultPlayers: arenaResultPlayers,
      durationLabel: arenaFinalDurationLabel,
      finalResultPlayers: arenaFinalResultPlayers,
      totalRounds: arenaTotalRounds,
      isHost,
      allPlayers: arenaPlayers,
      searchModal: pickerModal,
      disablePrimaryAction: snapshot.room_state !== "LOBBY" || (isHost && lobbyStartIssues.length > 0),
      disableLeave: leaveRoomDisabled,
      onCopyRoomId: () => handleCopy(roomIdLabel, setCopiedRoomId),
      onCopyJoinCode: () => handleCopy(joinCodeLabel, setCopiedJoinCode),
      onPrimaryAction: onPrimaryRoomAction,
      onToggleReady: onPrimaryRoomAction,
      onSkip: onMockSkip,
      onProceedToResult: () => {
        if (currentRound) {
          roomStore.forceAdvance(currentRound.round_index);
        }
      },
      onLeaveRoom: requestLeaveRoom,
      onRemakeStage: onReturnToLobby,
    };

    return <RoomArenaPresentational {...controlledProps} />;
  })();

  return (
    <section id="visual-capture-root" className="flex h-full min-h-0 w-full flex-col text-white font-sans">
      {roomSurface}

      {runtimeConfig.debugUiEnabled && snapshot.room_state === "PLAYING" && currentRound ? (
        <div className="fixed bottom-6 right-6 z-[160] w-[320px]">
          <DebugRoundPanel
            currentRound={currentRound}
            metricValue={metricValue}
            onMetricValueChange={setMetricValue}
            onSubmit={submitManualResult}
            isHost={isHost}
            forceAdvanceDisabled={forceAdvanceDisabled}
            forceAdvanceRemainingSeconds={forceAdvanceRemainingSeconds}
            onForceAdvance={() => roomStore.forceAdvance(currentRound.round_index)}
          />
        </div>
      ) : null}

      {showHostLeaveConfirm && isHost ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-[480px] overflow-hidden rounded-3xl border border-red-500/20 bg-[#1a1a1c] shadow-[0_30px_90px_rgba(0,0,0,0.9)]">
            <div className="p-8 pb-5 text-center">
              <div className="mb-6 inline-flex rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-500">
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <h2 className="mb-3 text-2xl font-black tracking-tight text-white">LEAVE ROOM</h2>
              <p className="text-sm font-medium text-gray-400">退出すると今回の対戦準備は中止されます。よろしいですか？</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-white/5 px-8 py-6">
              <button
                type="button"
                onClick={() => setShowHostLeaveConfirm(false)}
                className="rounded-2xl bg-white/5 py-4 font-bold text-gray-300 transition-all hover:bg-white/10"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHostLeaveConfirm(false);
                  roomStore.leaveRoom();
                }}
                className="rounded-2xl bg-red-500 py-4 font-black text-black transition-all hover:bg-red-400"
              >
                退出する
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {false && runtimeConfig.debugUiEnabled ? (
        <section className="space-y-4">
          <DebugSection title="Debug Actions">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Manual RESULT_SUBMIT</p>
                {currentRound ? (
                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                    <label className="flex-1 space-y-2 text-sm font-bold text-gray-300">
                      <span>Metric value</span>
                      <input type="number" min={0} value={metricValue} onChange={(event) => setMetricValue(event.currentTarget.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                    </label>
                    <button type="button" onClick={submitManualResult} className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-cyan-400">Submit</button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-bold text-gray-500">No active round.</p>
                )}
              </div>
              <DebugInjectionPanel />
            </div>
          </DebugSection>

          <DebugSection title="Support">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Connection</p>
                <p className={`mt-3 text-xl font-black italic tracking-tight ${getConnectionTone(connectionStatus)}`}>{connectionStatus}</p>
                <p className="mt-2 text-sm font-bold text-gray-400">{connectionDetail}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Voice</p>
                <p className={`mt-3 text-xl font-black italic tracking-tight ${getVoiceTone(voicePhase)}`}>{voicePhase}</p>
                <p className="mt-2 text-sm font-bold text-gray-400">{soundEnabledLabel}</p>
                <p className="mt-2 text-sm font-bold text-gray-500">{voiceDetail}</p>
                <p className="mt-2 text-xs font-bold text-gray-500">Pending cues: {voicePendingCues} / Updated: {formatDateTime(voiceLastUpdatedAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 xl:col-span-2">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Local Archive</p>
                <p className={`mt-3 text-xl font-black italic tracking-tight ${getArchiveTone(archiveStatus)}`}>{archiveStatus}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-gray-300">Storage: {archiveStorage}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-gray-300">Save Count: {archiveSaveCount}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-gray-300">Last Saved: {formatDateTime(archiveLastSavedAt)}</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-gray-300">Latest State: {archiveLatest?.latest_snapshot.room_state ?? "-"}</div>
                </div>
                {archivePath ? <p className="mt-3 break-all font-mono text-xs text-gray-500">{archivePath}</p> : null}
                {!archivePath && archiveStorageKey ? <p className="mt-3 break-all font-mono text-xs text-gray-500">{archiveStorageKey}</p> : null}
                {archiveLastError ? <p className="mt-3 text-sm font-bold text-red-300">{archiveLastError}</p> : null}
              </div>
            </div>
          </DebugSection>

          <DebugSection title="Raw Payloads">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Room Snapshot</p>
                <pre className="max-h-[420px] overflow-auto text-xs text-gray-300 custom-scrollbar">{stringifyJson(snapshot)}</pre>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Result Ready</p>
                <pre className="max-h-[420px] overflow-auto text-xs text-gray-300 custom-scrollbar">{stringifyJson(resultReady)}</pre>
              </div>
            </div>
          </DebugSection>

          <DebugSection title="Events">
            {eventLog.length === 0 ? (
              <p className="text-sm font-bold text-gray-500">No server events yet.</p>
            ) : (
              <ul className="space-y-2 text-sm font-medium text-gray-300">
                {eventLog.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs">
                    {entry}
                  </li>
                ))}
              </ul>
            )}
          </DebugSection>
        </section>
      ) : null}
    </section>
  );
}
