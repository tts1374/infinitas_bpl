import type { MatchGame, MatchRecord, StatsMatchResult } from "../features/stats/models";
import { roomStore } from "../stores/room-store";
import { settingsStore } from "../stores/settings-store";
import { writeJson } from "./local-storage";
import { statsArchiveService } from "./stats-archive";
import { isTauriRuntime, saveMatchHistoryOverlay } from "./tauri-bridge";

const MATCH_HISTORY_STORAGE_KEY = "infinitas.client.match-history.overlay.v1";
const MAX_MATCHES_PER_MODE = 3;

type MatchHistoryMode = "ARENA" | "BPL";

interface MatchHistoryPlayer {
  player_id: string;
  display_name: string;
}

interface MatchHistoryChart {
  order: number;
  title: string;
  play_style: string;
  difficulty: string;
  self_score: number;
  self_miss_count: number;
  self_point: number;
}

interface ArenaSummary {
  arena_rank: number;
  arena_points: number;
}

interface BplSummary {
  bpl_result: StatsMatchResult;
  bpl_my_score: number;
  bpl_opp_score: number;
}

type MatchHistorySummary = ArenaSummary | BplSummary;

interface MatchHistoryEntry {
  match_id: string;
  completed_at: string;
  mode: MatchHistoryMode;
  self_player_id: string;
  players: MatchHistoryPlayer[];
  summary: MatchHistorySummary;
  charts: MatchHistoryChart[];
}

interface MatchHistoryDocument {
  session_started_at: string;
  matches: MatchHistoryEntry[];
}

interface RoomMatchContext {
  playStyle: string;
  players: MatchHistoryPlayer[];
}

let started = false;
let currentHistory = createEmptyHistory();
let persistSequence: Promise<void> = Promise.resolve();
let unsubscribeRoomStore: (() => void) | null = null;
let unsubscribeStatsArchive: (() => void) | null = null;
let unsubscribeSettingsStore: (() => void) | null = null;
let lastOutputDirectory: string | null = null;
const processedMatchIds = new Set<string>();
const roomContextByMatchId = new Map<string, RoomMatchContext>();

function createEmptyHistory(sessionStartedAt = new Date().toISOString()): MatchHistoryDocument {
  return {
    session_started_at: sessionStartedAt,
    matches: [],
  };
}

function isSupportedBattleType(value: string): value is MatchHistoryMode {
  return value === "ARENA" || value === "BPL";
}

function toTimeMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function normalizeOutputDirectory(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function compareByCompletedAtDescending(left: MatchHistoryEntry, right: MatchHistoryEntry): number {
  const leftMs = toTimeMs(left.completed_at);
  const rightMs = toTimeMs(right.completed_at);
  if (leftMs !== null && rightMs !== null) {
    return rightMs - leftMs;
  }
  if (leftMs !== null) {
    return -1;
  }
  if (rightMs !== null) {
    return 1;
  }
  return right.completed_at.localeCompare(left.completed_at);
}

function compareMatchRecordByEndedAtAscending(left: MatchRecord, right: MatchRecord): number {
  const leftMs = toTimeMs(left.ended_at);
  const rightMs = toTimeMs(right.ended_at);
  if (leftMs !== null && rightMs !== null) {
    return leftMs - rightMs;
  }
  if (leftMs !== null) {
    return -1;
  }
  if (rightMs !== null) {
    return 1;
  }
  return left.ended_at.localeCompare(right.ended_at);
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function ensureSelfInPlayers(players: MatchHistoryPlayer[]): MatchHistoryPlayer[] {
  const settings = settingsStore.getState().saved;
  const deduped = new Map<string, MatchHistoryPlayer>();

  for (const player of players) {
    if (!deduped.has(player.player_id)) {
      deduped.set(player.player_id, player);
    }
  }

  if (!deduped.has(settings.playerId)) {
    deduped.set(settings.playerId, {
      player_id: settings.playerId,
      display_name: settings.displayName.trim().length > 0 ? settings.displayName.trim() : "you",
    });
  }

  return [...deduped.values()];
}

function buildFallbackPlayers(match: MatchRecord): MatchHistoryPlayer[] {
  const settings = settingsStore.getState().saved;
  const players: MatchHistoryPlayer[] = [
    {
      player_id: settings.playerId,
      display_name: settings.displayName.trim().length > 0 ? settings.displayName.trim() : "you",
    },
  ];

  if (match.opponent_id !== null || match.opponent_name !== null) {
    players.push({
      player_id: match.opponent_id ?? `opponent-${match.match_id}`,
      display_name: match.opponent_name ?? "opponent",
    });
  }

  return players;
}

function toCharts(matchGames: MatchGame[], fallbackPlayStyle: string): MatchHistoryChart[] {
  return [...matchGames]
    .sort((left, right) => left.game_index - right.game_index)
    .map((game, index) => ({
      order: Number.isInteger(game.game_index) ? game.game_index + 1 : index + 1,
      title: game.chart_title,
      play_style: game.play_mode ?? fallbackPlayStyle,
      difficulty: game.chart_difficulty,
      self_score: game.my_ex_score ?? 0,
      self_miss_count: game.my_bp ?? 0,
      self_point: roundToOneDecimal(game.round_point),
    }));
}

function capMatchesPerMode(matches: MatchHistoryEntry[]): MatchHistoryEntry[] {
  const sorted = [...matches].sort(compareByCompletedAtDescending);
  const modeCounts: Record<MatchHistoryMode, number> = {
    ARENA: 0,
    BPL: 0,
  };
  const retained: MatchHistoryEntry[] = [];

  for (const match of sorted) {
    if (modeCounts[match.mode] >= MAX_MATCHES_PER_MODE) {
      continue;
    }

    modeCounts[match.mode] += 1;
    retained.push(match);
  }

  return retained;
}

function isInCurrentSession(endedAt: string): boolean {
  const endedAtMs = toTimeMs(endedAt);
  const sessionStartedAtMs = toTimeMs(currentHistory.session_started_at);
  if (endedAtMs === null || sessionStartedAtMs === null) {
    return true;
  }
  return endedAtMs >= sessionStartedAtMs;
}

function captureRoomContextFromRoomStore(): void {
  const snapshot = roomStore.getState().snapshot;
  if (snapshot === null) {
    return;
  }

  const matchId = snapshot.current_match_id ?? snapshot.room_id;
  roomContextByMatchId.set(matchId, {
    playStyle: snapshot.settings.play_style,
    players: snapshot.players.map((player) => ({
      player_id: player.player_id,
      display_name: player.display_name,
    })),
  });
}

function buildHistoryEntry(match: MatchRecord, allMatchGames: MatchGame[]): MatchHistoryEntry | null {
  if (!isSupportedBattleType(match.battle_type)) {
    return null;
  }

  const relatedGames = allMatchGames.filter((entry) => entry.match_id === match.match_id);
  if (relatedGames.length === 0) {
    return null;
  }

  const context = roomContextByMatchId.get(match.match_id);
  const players = ensureSelfInPlayers(context?.players ?? buildFallbackPlayers(match));
  const selfPlayerId = settingsStore.getState().saved.playerId;
  const charts = toCharts(relatedGames, context?.playStyle ?? match.play_mode);

  if (match.battle_type === "ARENA") {
    const rank = Math.max(1, Math.min(4, match.display_rank ?? match.final_rank ?? 4));
    return {
      match_id: match.match_id,
      completed_at: match.ended_at,
      mode: "ARENA",
      self_player_id: selfPlayerId,
      players,
      summary: {
        arena_rank: rank,
        arena_points: roundToOneDecimal(match.match_point_total),
      },
      charts,
    };
  }

  const myScore = roundToOneDecimal(relatedGames.reduce((sum, game) => sum + game.round_point, 0));
  const opponentScore = roundToOneDecimal(relatedGames.reduce((sum, game) => sum + Math.max(0, 1 - game.round_point), 0));
  return {
    match_id: match.match_id,
    completed_at: match.ended_at,
    mode: "BPL",
    self_player_id: selfPlayerId,
    players,
    summary: {
      bpl_result: match.match_result,
      bpl_my_score: myScore,
      bpl_opp_score: opponentScore,
    },
    charts,
  };
}

function resetInternalState(): void {
  currentHistory = createEmptyHistory();
  processedMatchIds.clear();
  roomContextByMatchId.clear();
}

function queuePersist(): void {
  persistSequence = persistSequence
    .catch(() => undefined)
    .then(async () => {
      const snapshot = currentHistory;
      const jsonText = JSON.stringify(snapshot, null, 2);
      const outputDirectory = normalizeOutputDirectory(settingsStore.getState().saved.obsOutputDirectory);

      if (isTauriRuntime()) {
        await saveMatchHistoryOverlay({ jsonText, outputDirectory });
        return;
      }

      writeJson(MATCH_HISTORY_STORAGE_KEY, snapshot);
    });
}

function syncFromStatsArchive(): void {
  const archive = statsArchiveService.getState().archive;
  const orderedMatches = [...archive.matches].sort(compareMatchRecordByEndedAtAscending);
  let changed = false;

  for (const match of orderedMatches) {
    if (!isSupportedBattleType(match.battle_type) || !match.is_complete) {
      continue;
    }

    if (processedMatchIds.has(match.match_id)) {
      continue;
    }

    if (!isInCurrentSession(match.ended_at)) {
      processedMatchIds.add(match.match_id);
      continue;
    }

    const historyEntry = buildHistoryEntry(match, archive.match_games);
    if (historyEntry === null) {
      continue;
    }

    processedMatchIds.add(match.match_id);
    currentHistory = {
      ...currentHistory,
      matches: capMatchesPerMode([historyEntry, ...currentHistory.matches]),
    };
    changed = true;
  }

  if (changed) {
    queuePersist();
  }
}

export const matchHistoryOverlayService = {
  start(): void {
    if (started) {
      return;
    }

    started = true;
    resetInternalState();
    captureRoomContextFromRoomStore();
    lastOutputDirectory = normalizeOutputDirectory(settingsStore.getState().saved.obsOutputDirectory);
    queuePersist();

    unsubscribeRoomStore = roomStore.subscribe(() => {
      captureRoomContextFromRoomStore();
    });
    unsubscribeStatsArchive = statsArchiveService.subscribe(syncFromStatsArchive);
    unsubscribeSettingsStore = settingsStore.subscribe(() => {
      const nextOutputDirectory = normalizeOutputDirectory(
        settingsStore.getState().saved.obsOutputDirectory,
      );
      if (nextOutputDirectory === lastOutputDirectory) {
        return;
      }

      lastOutputDirectory = nextOutputDirectory;
      queuePersist();
    });
    syncFromStatsArchive();
  },
  stop(): void {
    unsubscribeSettingsStore?.();
    unsubscribeSettingsStore = null;
    unsubscribeStatsArchive?.();
    unsubscribeStatsArchive = null;
    unsubscribeRoomStore?.();
    unsubscribeRoomStore = null;
    lastOutputDirectory = null;
    started = false;
  },
  async resetHistory(): Promise<void> {
    resetInternalState();
    captureRoomContextFromRoomStore();
    lastOutputDirectory = normalizeOutputDirectory(settingsStore.getState().saved.obsOutputDirectory);
    queuePersist();
    syncFromStatsArchive();
    await persistSequence;
  },
};
