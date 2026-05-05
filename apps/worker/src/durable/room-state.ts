import {
  AUTO_REMATCH_RESULT_SECONDS,
  BPL4_ROUNDS,
  BPL4_PICKING_TTL_SECONDS,
  BPL_ROUNDS,
  HOST_SKIP_UNLOCK_SECONDS,
  MATCH_TTL_MINUTES,
  PICKING_TTL_SECONDS,
  QUICK_CHAT_HISTORY_LIMIT,
  QUICK_CHAT_MAX_COMPOSED_LENGTH,
  READY_CHECK_TTL_MINUTES,
  REJOIN_COOLDOWN_SECONDS,
  ROUND_PLAY_BEGIN_AT_SECONDS,
  ROUND_SOFT_TTL_SECONDS,
  START_MIN_PLAYERS,
  composeQuickChatMessage,
  isQuickChatPhraseId,
  type CloseReason,
  type CurrentRoundSnapshot,
  type ExpectedKey,
  type FrozenRound,
  type JsonObject,
  type PlayerRole,
  type QuickChatMessage,
  type QuickChatPhraseId,
  type ResultReadyPayload,
  type ResultReadyArenaRoundPlayerResult,
  type ResultReadyBplRoundPlayerResult,
  type RoomSettings,
  type RoomState,
  type RoomStateSnapshot,
  type SkipReason,
  type SourceType,
  type SubmissionReason,
  type SubmissionStatus,
  type SubmittedBy,
  type MatchSongUnlockFilter,
  type SongUnlockSettings,
  type WinMetric,
} from "@infinitas/shared";
import type { ResolvedMasterChart, RoomChartMaster, SearchChartsOptions } from "../master/chart-master";
import { evaluateResultRating } from "./result-rating";

const BPL_PICK_CUTIN_DELAY_SECONDS = 3;
const BPL_RESULT_PHASE_DELAY_SECONDS = 10;
const ARENA_RESULT_PHASE_DELAY_SECONDS = 10;

type AutoRematchBlockReason =
  | "AUTO_REMATCH_DISABLED"
  | "NOT_PRIVATE_ROOM"
  | "LAST_MATCH_NOT_NORMAL"
  | "HOST_DISCONNECTED"
  | "INSUFFICIENT_PLAYERS"
  | "SOURCE_UNAVAILABLE"
  | "AUTO_REMATCH_STOPPED";

interface InternalPlayer {
  player_id: string;
  display_name: string;
  source: SourceType;
  song_unlocks: SongUnlockSettings;
  connected: boolean;
  ready: boolean;
  role: PlayerRole;
  joined_at: Date;
  left_at: Date | null;
  rejoin_until: Date | null;
}

interface InternalPick {
  player_id: string;
  pick_chart_key: string;
  accepted_at: Date;
  expected_key: ExpectedKey;
  display: FrozenRound["display"];
}

export interface RoomInitializationInput {
  room_id: string;
  settings: RoomSettings;
  created_at: string;
}

export interface JoinPlayerInput {
  player_id: string;
  display_name: string;
  source: SourceType;
  song_unlocks?: SongUnlockSettings;
  now: Date;
}

export interface JoinPlayerResult {
  ok: boolean;
  reason?:
    | "ROOM_CLOSED"
    | "ROOM_FULL"
    | "ROOM_JOIN_LOCKED"
    | "PLAYER_ALREADY_CONNECTED"
    | "REJOIN_WINDOW_EXPIRED";
  join_type?: "NEW" | "RECONNECT";
}

export interface LeavePlayerResult {
  changed: boolean;
  was_host: boolean;
  room_was_closed: boolean;
}

export interface ReadySetResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "PLAYER_NOT_FOUND";
}

export interface StartMatchResult {
  ok: boolean;
  reason?:
    | "INVALID_STATE"
    | "NOT_HOST"
    | "AUTO_MATCH_ROOM_LOCKED"
    | "START_REQUIRES_MIN_PLAYERS"
    | "NOT_ALL_PLAYERS_READY"
    | "PREVIOUS_MATCH_NOT_CLEARED"
    | "BPL_REQUIRES_TWO_PLAYERS";
}

export interface ReturnToLobbyResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "NOT_HOST" | "AUTO_MATCH_ROOM_LOCKED";
}

export interface RecreateRoomResult {
  ok: boolean;
  reason?:
    | "ROOM_NOT_INITIALIZED"
    | "ACTIVE_GENERATION_EXISTS"
    | "NOT_LAST_HOST"
    | "AUTO_MATCH_ROOM_LOCKED"
    | "STALE_STATE"
    | "RECREATE_WINDOW_EXPIRED";
  generation?: number;
}

export interface AutoRematchStopResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "NOT_HOST" | "AUTO_REMATCH_NOT_ACTIVE";
}

export interface AutoRematchOptOutResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "PLAYER_NOT_FOUND";
}

export interface SourceAvailabilityResult {
  ok: boolean;
  changed: boolean;
  reason?: "PLAYER_NOT_FOUND";
}

export interface QuickChatPostResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "PLAYER_NOT_FOUND" | "INVALID_PHRASE_IDS" | "MESSAGE_EMPTY" | "MESSAGE_TOO_LONG";
  message?: QuickChatMessage;
}

export interface AutoRematchDueResult {
  kind: "STARTED" | "CANCELLED";
  generation: number;
  reason?: AutoRematchBlockReason;
  participant_player_ids?: string[];
}

export interface PickSubmitResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "PLAYER_NOT_FOUND" | "PLAYER_ALREADY_PICKED" | "INVALID_PICK_CHART_KEY";
  accepted_pick?: {
    player_id: string;
    pick_chart_key: string;
    accepted_at: Date;
  };
  frozen_rounds?: FrozenRound[];
  round_begin?: {
    round_index: number;
    expected_key: ExpectedKey;
    round_started_at: string;
    soft_ttl_seconds: number;
  };
}

export interface PickingTimeoutResult {
  accepted_picks: Array<{
    player_id: string;
    pick_chart_key: string;
    accepted_at: Date;
  }>;
  frozen_rounds: FrozenRound[];
  round_begin: RoundBeginEvent;
}

export interface RoundConfirmationEvent {
  round_index: number;
  player_id: string;
  status: SubmissionStatus;
  metric_value: number;
  reason: SubmissionReason;
  submitted_at: string;
  submitted_by: SubmittedBy;
  source_meta: JsonObject | null;
}

export interface RoundEndedEvent {
  round_index: number;
}

export interface RoundBeginEvent {
  round_index: number;
  expected_key: ExpectedKey;
  round_started_at: string;
  soft_ttl_seconds: number;
}

export interface ForceAdvanceAppliedEvent {
  round_index: number;
  timed_out_players: string[];
}

export interface RoundTransitionResult {
  confirmations: RoundConfirmationEvent[];
  round_ended?: RoundEndedEvent;
  round_begin?: RoundBeginEvent;
  force_advance_applied?: ForceAdvanceAppliedEvent;
  result_ready?: ResultReadyPayload;
}

export interface ResultSubmitResult extends RoundTransitionResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "PLAYER_NOT_FOUND" | "RESULT_KEY_MISMATCH" | "ROUND_ALREADY_CONFIRMED";
}

export interface SkipSelfResult extends RoundTransitionResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "PLAYER_NOT_FOUND" | "ROUND_ALREADY_CONFIRMED";
}

export interface SkipHostAssignResult extends RoundTransitionResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "NOT_HOST" | "PLAYER_NOT_FOUND" | "ROUND_ALREADY_CONFIRMED" | "HOST_SKIP_LOCKED";
}

export interface ForceAdvanceResult extends RoundTransitionResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "NOT_HOST";
}

interface PersistedPlayer {
  player_id: string;
  display_name: string;
  source: SourceType;
  song_unlocks?: SongUnlockSettings;
  connected: boolean;
  ready: boolean;
  role: PlayerRole;
  joined_at: string;
  left_at: string | null;
  rejoin_until: string | null;
}

interface PersistedPick {
  player_id: string;
  pick_chart_key: string;
  accepted_at: string;
  expected_key: ExpectedKey;
  display: FrozenRound["display"];
}

interface PersistedRoundConfirmations {
  round_index: number;
  confirmations: RoundConfirmationEvent[];
}

interface PersistedQuickChatMessage {
  message_id: string;
  player_id: string;
  phrase_ids: string[];
  message: string;
  posted_at: string;
}

export interface RoomStatePersistenceRecord {
  version: 1;
  initialized: boolean;
  room_id: string;
  generation?: number;
  room_state: RoomState;
  settings: RoomSettings;
  host_player_id: string | null;
  created_at: string;
  match_deadline: string | null;
  ready_check_deadline: string | null;
  picking_deadline: string | null;
  result_deadline: string | null;
  closed_at: string | null;
  close_reason: CloseReason | null;
  players: PersistedPlayer[];
  picks: PersistedPick[];
  round_confirmations: PersistedRoundConfirmations[];
  frozen_rounds: FrozenRound[];
  current_round: CurrentRoundSnapshot | null;
  match_player_ids: string[];
  current_match_id?: string | null;
  match_song_unlock_filter?: MatchSongUnlockFilter | null;
  result_ready_payload: ResultReadyPayload | null;
  result_key_mismatch_detected?: boolean;
  force_advanced_round_indices?: number[];
  auto_rematch_enabled?: boolean;
  auto_rematch_countdown_started_at?: string | null;
  auto_rematch_due_at?: string | null;
  auto_rematch_generation?: number;
  auto_rematch_scheduled_generation?: number | null;
  auto_rematch_cancelled?: boolean;
  auto_rematch_block_reason?: AutoRematchBlockReason | null;
  next_match_opt_out_player_ids?: string[];
  source_unavailable_player_ids?: string[];
  last_match_end_reason?: string | null;
  quick_chat_messages?: PersistedQuickChatMessage[];
}

const DEFAULT_SETTINGS: RoomSettings = {
  visibility: "PUBLIC",
  join_code: null,
  auto_rematch: false,
  mode: "ARENA",
  win_metric: "SCORE",
  play_style: "SP",
  level_filter: "ANY",
  room_comment: "",
  max_players: 4,
};

function normalizeSettingsVisibility(settings: RoomSettings): RoomSettings {
  const visibility = settings.visibility as RoomSettings["visibility"] | "UNLISTED";
  const autoRematch = visibility === "PRIVATE" && settings.auto_rematch === true;
  return {
    ...settings,
    visibility: visibility === "UNLISTED" ? "PRIVATE" : visibility,
    auto_rematch: autoRematch,
    ...(visibility === "PUBLIC" && settings.auto_match === true ? { auto_match: true } : {}),
  };
}

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function parseOptionalDate(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Invalid ISO8601 date: ${value}`);
  }

  return parsed;
}

function parseRequiredDate(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Invalid ISO8601 date: ${value}`);
  }

  return parsed;
}

function generateMatchId(): string {
  return crypto.randomUUID();
}

function extractResultReadySummaryMatchId(payload: ResultReadyPayload | null): string | null {
  if (payload === null) {
    return null;
  }

  const summaryRecord = payload.summary as unknown as Record<string, unknown>;
  const matchId = summaryRecord.match_id;
  return typeof matchId === "string" && matchId.length > 0 ? matchId : null;
}

function ensureResultReadyPayloadMatchId(
  payload: ResultReadyPayload | null,
  fallbackMatchId: string,
): ResultReadyPayload | null {
  if (payload === null) {
    return null;
  }

  return {
    ...payload,
    summary: {
      ...payload.summary,
      match_id: extractResultReadySummaryMatchId(payload) ?? fallbackMatchId,
    },
  };
}

function computeMatchDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MATCH_TTL_MINUTES * 60_000);
}

function computeReadyCheckDeadline(openedAt: Date): Date {
  return new Date(openedAt.getTime() + READY_CHECK_TTL_MINUTES * 60_000);
}

function computePickingDeadline(startedAt: Date, mode: RoomSettings["mode"]): Date {
  const pickingTtlSeconds = mode === "BPL4" ? BPL4_PICKING_TTL_SECONDS : PICKING_TTL_SECONDS;
  return new Date(startedAt.getTime() + pickingTtlSeconds * 1_000);
}

function computeRejoinUntil(now: Date): Date {
  return new Date(now.getTime() + REJOIN_COOLDOWN_SECONDS * 1_000);
}

function normalizeOwnedPackIds(ownedPackIds: number[] | undefined): number[] {
  if (!Array.isArray(ownedPackIds)) {
    return [];
  }

  const deduped = new Set<number>();
  for (const value of ownedPackIds) {
    if (!Number.isInteger(value) || value <= 0) {
      continue;
    }
    deduped.add(value);
  }

  return Array.from(deduped).sort((left, right) => left - right);
}

function normalizeSongUnlockSettings(value: SongUnlockSettings | undefined): SongUnlockSettings {
  return {
    bit_unlocked: value?.bit_unlocked === true,
    djp_unlocked: value?.djp_unlocked === true,
    allow_leggendaria: value?.allow_leggendaria === true,
    owned_pack_ids: normalizeOwnedPackIds(value?.owned_pack_ids),
  };
}

function cloneSongUnlockSettings(value: SongUnlockSettings): SongUnlockSettings {
  return {
    bit_unlocked: value.bit_unlocked,
    djp_unlocked: value.djp_unlocked,
    allow_leggendaria: value.allow_leggendaria === true,
    owned_pack_ids: [...value.owned_pack_ids],
  };
}

function cloneMatchSongUnlockFilter(value: MatchSongUnlockFilter): MatchSongUnlockFilter {
  return {
    include_bit: value.include_bit,
    include_djp: value.include_djp,
    include_leggendaria: value.include_leggendaria === true,
    common_pack_ids: [...value.common_pack_ids],
  };
}

function computeMatchSongUnlockFilter(players: InternalPlayer[]): MatchSongUnlockFilter {
  if (players.length === 0) {
    return {
      include_bit: false,
      include_djp: false,
      include_leggendaria: false,
      common_pack_ids: [],
    };
  }

  const includeBit = players.every((player) => player.song_unlocks.bit_unlocked);
  const includeDjp = players.every((player) => player.song_unlocks.djp_unlocked);
  const includeLeggendaria = players.every((player) => player.song_unlocks.allow_leggendaria);

  const commonPackIds = players
    .map((player) => new Set(player.song_unlocks.owned_pack_ids))
    .reduce<Set<number>>((intersection, currentSet, index) => {
      if (index === 0) {
        return new Set(currentSet);
      }

      return new Set(Array.from(intersection).filter((packId) => currentSet.has(packId)));
    }, new Set<number>());

  return {
    include_bit: includeBit,
    include_djp: includeDjp,
    include_leggendaria: includeLeggendaria,
    common_pack_ids: Array.from(commonPackIds).sort((left, right) => left - right),
  };
}

function canNewPlayerJoin(roomState: RoomState): roomState is "LOBBY" {
  return roomState === "LOBBY";
}

function cloneExpectedKey(expectedKey: ExpectedKey): ExpectedKey {
  return {
    play_style: expectedKey.play_style,
    difficulty: expectedKey.difficulty,
    title_search_key: expectedKey.title_search_key,
    ...(typeof expectedKey.chart_id === "number" && Number.isInteger(expectedKey.chart_id) && expectedKey.chart_id > 0
      ? { chart_id: expectedKey.chart_id }
      : {}),
  };
}

function cloneFrozenRound(round: FrozenRound): FrozenRound {
  return {
    round_index: round.round_index,
    expected_key: cloneExpectedKey(round.expected_key),
    display: {
      title: round.display.title,
      level: round.display.level,
    },
    started_at: round.started_at,
    soft_ttl_seconds: round.soft_ttl_seconds,
  };
}

function cloneRoundConfirmation(entry: RoundConfirmationEvent): RoundConfirmationEvent {
  return {
    round_index: entry.round_index,
    player_id: entry.player_id,
    status: entry.status,
    metric_value: entry.metric_value,
    reason: entry.reason,
    submitted_at: entry.submitted_at,
    submitted_by: entry.submitted_by,
    source_meta: entry.source_meta,
  };
}

function cloneQuickChatMessage(message: QuickChatMessage): QuickChatMessage {
  return {
    message_id: message.message_id,
    player_id: message.player_id,
    phrase_ids: [...message.phrase_ids],
    message: message.message,
    posted_at: message.posted_at,
  };
}

function getSourceMetric(sourceMeta: JsonObject | null, key: "score"): number | null {
  if (sourceMeta === null) {
    return null;
  }

  const value = (sourceMeta as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getConfirmationExScore(
  confirmation: RoundConfirmationEvent | undefined,
  winMetric: WinMetric,
): number | null {
  if (confirmation === undefined) {
    return null;
  }

  return getSourceMetric(confirmation.source_meta, "score") ??
    (winMetric === "SCORE" ? confirmation.metric_value : null);
}

function resolveArenaWinnerPlayerIds(
  players: Array<{
    player_id: string;
    total_points: number;
    total_ex_score: number | null;
    last_confirmed_at: string | null;
  }>,
): string[] {
  if (players.length === 0) {
    return [];
  }

  const highestPoints = players.reduce((maxValue, player) => Math.max(maxValue, player.total_points), 0);
  let leaders = players.filter((player) => player.total_points === highestPoints);
  if (leaders.length <= 1) {
    return leaders.map((player) => player.player_id);
  }

  if (leaders.every((player) => player.total_ex_score !== null)) {
    const highestExScore = leaders.reduce(
      (maxValue, player) => Math.max(maxValue, player.total_ex_score ?? Number.NEGATIVE_INFINITY),
      Number.NEGATIVE_INFINITY,
    );
    leaders = leaders.filter((player) => player.total_ex_score === highestExScore);
    if (leaders.length <= 1) {
      return leaders.map((player) => player.player_id);
    }
  }

  if (leaders.every((player) => player.last_confirmed_at !== null)) {
    const earliestConfirmation =
      [...leaders].map((player) => player.last_confirmed_at ?? "").sort((left, right) => left.localeCompare(right))[0] ??
      null;
    leaders = leaders.filter((player) => player.last_confirmed_at === earliestConfirmation);
  }

  return leaders.map((player) => player.player_id);
}

export class RoomLobbyState {
  private initialized = false;
  private roomId = "";
  private generation = 1;
  private roomState: RoomState = "LOBBY";
  private settings: RoomSettings = { ...DEFAULT_SETTINGS };
  private hostPlayerId: string | null = null;
  private createdAt = new Date();
  private matchDeadline: Date | null = null;
  private readyCheckDeadline: Date | null = null;
  private pickingDeadline: Date | null = null;
  private resultDeadline: Date | null = null;
  private closedAt: Date | null = null;
  private closeReason: CloseReason | null = null;
  private readonly players = new Map<string, InternalPlayer>();
  private readonly picks: InternalPick[] = [];
  private readonly roundConfirmations = new Map<number, RoundConfirmationEvent[]>();
  private frozenRounds: FrozenRound[] = [];
  private currentRound: CurrentRoundSnapshot | null = null;
  private matchPlayerIds: string[] = [];
  private currentMatchId: string | null = null;
  private matchSongUnlockFilter: MatchSongUnlockFilter | null = null;
  private resultReadyPayload: ResultReadyPayload | null = null;
  private resultKeyMismatchDetected = false;
  private readonly forceAdvancedRoundIndices = new Set<number>();
  private autoRematchEnabled = false;
  private autoRematchCountdownStartedAt: Date | null = null;
  private autoRematchDueAt: Date | null = null;
  private autoRematchGeneration = 0;
  private autoRematchScheduledGeneration: number | null = null;
  private autoRematchCancelled = false;
  private autoRematchBlockReason: AutoRematchBlockReason | null = null;
  private readonly nextMatchOptOutPlayerIds = new Set<string>();
  private readonly sourceUnavailablePlayerIds = new Set<string>();
  private lastMatchEndReason: string | null = null;
  private quickChatMessages: QuickChatMessage[] = [];

  constructor(private readonly chartMaster: RoomChartMaster) {}

  initialize(input: RoomInitializationInput): void {
    const createdAt = new Date(input.created_at);
    if (!Number.isFinite(createdAt.getTime())) {
      throw new Error("created_at must be ISO8601.");
    }

    if (this.initialized) {
      if (this.roomId !== input.room_id) {
        throw new Error("room_id mismatch on reinitialize.");
      }
      return;
    }

    this.initialized = true;
    this.roomId = input.room_id;
    this.generation = 1;
    this.settings = normalizeSettingsVisibility({ ...input.settings });
    this.autoRematchEnabled = this.settings.visibility === "PRIVATE" && this.settings.auto_rematch === true;
    this.createdAt = createdAt;
    this.roomState = "LOBBY";
    this.readyCheckDeadline = computeReadyCheckDeadline(createdAt);
    this.matchDeadline = null;
    this.matchSongUnlockFilter = null;
    this.clearAutoRematchState(false);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRoomId(): string {
    return this.roomId;
  }

  getGeneration(): number {
    return this.generation;
  }

  getRoomState(): RoomState {
    return this.roomState;
  }

  getSettings(): RoomSettings {
    return this.settings;
  }

  getHostPlayerId(): string | null {
    return this.hostPlayerId;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  isPlayerConnected(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player?.connected === true;
  }

  canJoin(playerId: string): boolean {
    if (this.players.has(playerId)) {
      return true;
    }

    if (!canNewPlayerJoin(this.roomState)) {
      return false;
    }

    return this.players.size < this.settings.max_players;
  }

  joinPlayer(input: JoinPlayerInput): JoinPlayerResult {
    const normalizedSongUnlocks = normalizeSongUnlockSettings(input.song_unlocks);
    const existing = this.players.get(input.player_id);
    if (this.roomState === "CLOSED" && !existing) {
      return { ok: false, reason: "ROOM_CLOSED" };
    }

    if (!existing && !canNewPlayerJoin(this.roomState)) {
      return { ok: false, reason: "ROOM_JOIN_LOCKED" };
    }

    if (!existing && this.players.size >= this.settings.max_players) {
      return { ok: false, reason: "ROOM_FULL" };
    }

    if (existing) {
      if (existing.connected) {
        return { ok: false, reason: "PLAYER_ALREADY_CONNECTED" };
      }

      if (existing.rejoin_until === null) {
        return { ok: false, reason: "ROOM_JOIN_LOCKED" };
      }

      if (input.now.getTime() > existing.rejoin_until.getTime()) {
        return { ok: false, reason: "REJOIN_WINDOW_EXPIRED" };
      }

      existing.display_name = input.display_name;
      existing.source = input.source;
      existing.song_unlocks = normalizedSongUnlocks;
      existing.connected = true;
      existing.left_at = null;
      existing.rejoin_until = null;
      this.sourceUnavailablePlayerIds.delete(input.player_id);
      this.maybeStartAutoMatch(input.now);
      return { ok: true, join_type: "RECONNECT" };
    }

    let role: PlayerRole = "GUEST";
    if (this.hostPlayerId === null) {
      this.hostPlayerId = input.player_id;
      role = "HOST";
    }

    this.players.set(input.player_id, {
      player_id: input.player_id,
      display_name: input.display_name,
      source: input.source,
      song_unlocks: normalizedSongUnlocks,
      connected: true,
      ready: false,
      role,
      joined_at: input.now,
      left_at: null,
      rejoin_until: null,
    });
    this.sourceUnavailablePlayerIds.delete(input.player_id);

    this.maybeStartAutoMatch(input.now);
    return { ok: true, join_type: "NEW" };
  }

  markPlayerDisconnected(playerId: string, now: Date): LeavePlayerResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { changed: false, was_host: false, room_was_closed: this.roomState === "CLOSED" };
    }

    const wasHost = this.hostPlayerId === playerId;
    const roomWasClosed = this.roomState === "CLOSED";
    player.connected = false;
    player.left_at = now;
    player.rejoin_until = computeRejoinUntil(now);
    if (this.roomState === "RESULT") {
      if (wasHost) {
        this.cancelAutoRematch("HOST_DISCONNECTED");
      } else if (this.getAutoRematchParticipantPlayerIds().length < START_MIN_PLAYERS) {
        this.cancelAutoRematch("INSUFFICIENT_PLAYERS");
      }
    }

    return { changed: true, was_host: wasHost, room_was_closed: roomWasClosed };
  }

  leavePlayer(
    playerId: string,
    now: Date,
    hostCloseReason: Extract<CloseReason, "HOST_ABORTED" | "HOST_DISCONNECTED"> = "HOST_DISCONNECTED",
  ): LeavePlayerResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { changed: false, was_host: false, room_was_closed: this.roomState === "CLOSED" };
    }

    const wasHost = this.hostPlayerId === playerId;
    const roomWasClosed = this.roomState === "CLOSED";
    player.connected = false;
    player.left_at = now;

    const keepDisconnectedSlot = wasHost && hostCloseReason === "HOST_DISCONNECTED";
    if (canNewPlayerJoin(this.roomState) && !keepDisconnectedSlot) {
      this.players.delete(playerId);
    } else {
      player.rejoin_until = computeRejoinUntil(now);
    }
    if (!player.connected) {
      this.sourceUnavailablePlayerIds.delete(playerId);
    }

    if (wasHost && !roomWasClosed && hostCloseReason === "HOST_ABORTED") {
      this.close("HOST_ABORTED", now);
    }
    if (this.roomState === "RESULT") {
      if (wasHost) {
        this.cancelAutoRematch("HOST_DISCONNECTED");
      } else if (this.getAutoRematchParticipantPlayerIds().length < START_MIN_PLAYERS) {
        this.cancelAutoRematch("INSUFFICIENT_PLAYERS");
      }
    }

    return { changed: true, was_host: wasHost, room_was_closed: roomWasClosed };
  }

  setPlayerReady(playerId: string, ready: boolean): ReadySetResult {
    if (this.roomState !== "LOBBY") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { ok: false, reason: "PLAYER_NOT_FOUND" };
    }

    player.ready = ready;
    return { ok: true };
  }

  startMatch(playerId: string, now: Date): StartMatchResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST" };
    }

    if (this.isAutoMatchRoom()) {
      return { ok: false, reason: "AUTO_MATCH_ROOM_LOCKED" };
    }

    if (this.roomState !== "LOBBY") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (this.hasMatchTransientState()) {
      return { ok: false, reason: "PREVIOUS_MATCH_NOT_CLEARED" };
    }

    if (this.players.size < START_MIN_PLAYERS) {
      return { ok: false, reason: "START_REQUIRES_MIN_PLAYERS" };
    }

    if (this.getPlayersInJoinOrder().some((player) => !player.ready)) {
      return { ok: false, reason: "NOT_ALL_PLAYERS_READY" };
    }

    if (this.isBplMode() && this.players.size !== 2) {
      return { ok: false, reason: "BPL_REQUIRES_TWO_PLAYERS" };
    }

    const participantIds = this.getPlayersInJoinOrder().map((player) => player.player_id);
    return this.beginMatch(participantIds, now);
  }

  returnToLobby(playerId: string, now: Date): ReturnToLobbyResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST" };
    }

    if (this.isAutoMatchRoom()) {
      return { ok: false, reason: "AUTO_MATCH_ROOM_LOCKED" };
    }

    if (this.roomState !== "RESULT") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    this.resetLobbyState(now);
    return { ok: true };
  }

  recreateAsLastHost(playerId: string, now: Date, recreateWindowMs: number): RecreateRoomResult {
    if (!this.initialized) {
      return { ok: false, reason: "ROOM_NOT_INITIALIZED" };
    }

    if (this.roomState !== "CLOSED") {
      return { ok: false, reason: "ACTIVE_GENERATION_EXISTS" };
    }

    if (this.hostPlayerId === null || playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_LAST_HOST" };
    }

    if (this.isAutoMatchRoom()) {
      return { ok: false, reason: "AUTO_MATCH_ROOM_LOCKED" };
    }

    if (this.closedAt === null) {
      return { ok: false, reason: "STALE_STATE" };
    }

    const elapsedMs = now.getTime() - this.closedAt.getTime();
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      return { ok: false, reason: "STALE_STATE" };
    }
    if (elapsedMs > recreateWindowMs) {
      return { ok: false, reason: "RECREATE_WINDOW_EXPIRED" };
    }

    this.generation += 1;
    this.createdAt = now;
    this.resetLobbyState(now);
    this.hostPlayerId = null;
    this.players.clear();
    this.sourceUnavailablePlayerIds.clear();
    this.nextMatchOptOutPlayerIds.clear();
    this.quickChatMessages = [];
    return { ok: true, generation: this.generation };
  }

  stopAutoRematch(playerId: string): AutoRematchStopResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST" };
    }

    if (this.roomState !== "RESULT") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (this.autoRematchDueAt === null && !this.autoRematchCancelled) {
      return { ok: false, reason: "AUTO_REMATCH_NOT_ACTIVE" };
    }

    this.cancelAutoRematch("AUTO_REMATCH_STOPPED");
    return { ok: true };
  }

  optOutNextMatch(playerId: string): AutoRematchOptOutResult {
    if (this.roomState !== "RESULT") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (!this.players.has(playerId) || !this.matchPlayerIds.includes(playerId)) {
      return { ok: false, reason: "PLAYER_NOT_FOUND" };
    }

    this.nextMatchOptOutPlayerIds.add(playerId);
    if (this.getAutoRematchParticipantPlayerIds().length < START_MIN_PLAYERS) {
      this.cancelAutoRematch("INSUFFICIENT_PLAYERS");
    }

    return { ok: true };
  }

  setPlayerSourceAvailability(playerId: string, available: boolean): SourceAvailabilityResult {
    if (!this.players.has(playerId)) {
      return { ok: false, changed: false, reason: "PLAYER_NOT_FOUND" };
    }

    const hasUnavailable = this.sourceUnavailablePlayerIds.has(playerId);
    if (available) {
      if (!hasUnavailable) {
        return { ok: true, changed: false };
      }
      this.sourceUnavailablePlayerIds.delete(playerId);
      return { ok: true, changed: true };
    }

    if (hasUnavailable) {
      return { ok: true, changed: false };
    }
    this.sourceUnavailablePlayerIds.add(playerId);
    if (this.roomState === "RESULT" && this.autoRematchDueAt !== null) {
      this.cancelAutoRematch("SOURCE_UNAVAILABLE");
    }

    return { ok: true, changed: true };
  }

  postQuickChat(playerId: string, phraseIds: string[], now: Date): QuickChatPostResult {
    if (this.roomState !== "LOBBY" && this.roomState !== "PICKING") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    const player = this.players.get(playerId);
    if (player === undefined || !player.connected) {
      return { ok: false, reason: "PLAYER_NOT_FOUND" };
    }

    if (phraseIds.length === 0 || phraseIds.some((phraseId) => !isQuickChatPhraseId(phraseId))) {
      return { ok: false, reason: "INVALID_PHRASE_IDS" };
    }

    const messageText = composeQuickChatMessage(phraseIds);
    if (messageText === null) {
      return { ok: false, reason: "INVALID_PHRASE_IDS" };
    }

    if (messageText.length === 0) {
      return { ok: false, reason: "MESSAGE_EMPTY" };
    }

    if (messageText.length > QUICK_CHAT_MAX_COMPOSED_LENGTH) {
      return { ok: false, reason: "MESSAGE_TOO_LONG" };
    }

    const message: QuickChatMessage = {
      message_id: crypto.randomUUID(),
      player_id: playerId,
      phrase_ids: phraseIds as QuickChatPhraseId[],
      message: messageText,
      posted_at: now.toISOString(),
    };
    this.quickChatMessages = [...this.quickChatMessages, message].slice(-QUICK_CHAT_HISTORY_LIMIT);
    return { ok: true, message: cloneQuickChatMessage(message) };
  }

  submitPick(playerId: string, pickChartKey: string, now: Date): PickSubmitResult {
    if (this.roomState !== "PICKING") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (!this.matchPlayerIds.includes(playerId)) {
      return { ok: false, reason: "PLAYER_NOT_FOUND" };
    }

    const playerPickCount = this.picks.filter((pick) => pick.player_id === playerId).length;
    if (playerPickCount >= this.getRequiredPickCountForPlayer(playerId)) {
      return { ok: false, reason: "PLAYER_ALREADY_PICKED" };
    }

    const resolvedChartWithoutFilter = this.chartMaster.resolvePickChartKey(
      pickChartKey,
      this.settings.play_style,
      this.settings.level_filter,
    );
    if (resolvedChartWithoutFilter === null) {
      return { ok: false, reason: "INVALID_PICK_CHART_KEY" };
    }

    const resolvedChart = this.chartMaster.resolvePickChartKey(
      pickChartKey,
      this.settings.play_style,
      this.settings.level_filter,
      this.matchSongUnlockFilter ?? undefined,
    );
    if (resolvedChart === null) {
      return { ok: false, reason: "INVALID_PICK_CHART_KEY" };
    }

    const resolvedPick = this.resolveDuplicatePick(
      playerId,
      pickChartKey.trim(),
      resolvedChart,
      now,
      this.matchSongUnlockFilter ?? undefined,
    );
    if (resolvedPick === null) {
      return { ok: false, reason: "INVALID_STATE" };
    }

    this.picks.push(resolvedPick);

    const result: PickSubmitResult = {
      ok: true,
      accepted_pick: {
        player_id: resolvedPick.player_id,
        pick_chart_key: resolvedPick.pick_chart_key,
        accepted_at: resolvedPick.accepted_at,
      },
    };

    if (this.picks.length < this.getRequiredPickCount()) {
      return result;
    }

    const frozenRounds = this.buildFrozenRounds();
    if (frozenRounds.length === 0) {
      return { ok: false, reason: "INVALID_STATE" };
    }

    this.frozenRounds = frozenRounds;
    const roundBegin = this.beginFirstRound(now);
    if (roundBegin === null) {
      return { ok: false, reason: "INVALID_STATE" };
    }

    result.frozen_rounds = frozenRounds.map(cloneFrozenRound);
    result.round_begin = {
      round_index: roundBegin.round_index,
      expected_key: cloneExpectedKey(roundBegin.expected_key),
      round_started_at: roundBegin.round_started_at,
      soft_ttl_seconds: roundBegin.soft_ttl_seconds,
    };
    return result;
  }

  getNextAlarmAt(): Date | null {
    const hostDisconnectDeadline = this.getHostDisconnectDeadline();
    let baseAlarm: Date | null = null;

    if (this.roomState === "LOBBY" && this.readyCheckDeadline !== null) {
      baseAlarm = this.readyCheckDeadline;
    }

    if (this.roomState === "PICKING") {
      if (this.matchDeadline === null) {
        baseAlarm = this.pickingDeadline;
      } else if (this.pickingDeadline === null) {
        baseAlarm = this.matchDeadline;
      } else {
        baseAlarm =
          this.pickingDeadline.getTime() <= this.matchDeadline.getTime()
            ? this.pickingDeadline
            : this.matchDeadline;
      }
    }

    if (this.roomState === "PLAYING" && this.currentRound !== null) {
      if (this.matchDeadline === null) {
        baseAlarm = this.getCurrentRoundDeadline();
      } else {
        const currentRoundDeadline = this.getCurrentRoundDeadline();
        if (currentRoundDeadline === null) {
          baseAlarm = this.matchDeadline;
        } else {
          baseAlarm =
            currentRoundDeadline.getTime() <= this.matchDeadline.getTime()
              ? currentRoundDeadline
              : this.matchDeadline;
        }
      }
    }

    if (this.roomState === "RESULT") {
      const autoMatchResultDeadline = this.isAutoMatchRoom() ? this.resultDeadline : null;
      if (this.matchDeadline === null) {
        baseAlarm = this.autoRematchDueAt ?? autoMatchResultDeadline;
      } else if (this.autoRematchDueAt === null) {
        baseAlarm =
          autoMatchResultDeadline === null
            ? this.matchDeadline
            : autoMatchResultDeadline.getTime() <= this.matchDeadline.getTime()
              ? autoMatchResultDeadline
              : this.matchDeadline;
      } else if (autoMatchResultDeadline === null) {
        baseAlarm =
          this.autoRematchDueAt.getTime() <= this.matchDeadline.getTime()
            ? this.autoRematchDueAt
            : this.matchDeadline;
      } else {
        const earlierDeadline =
          this.autoRematchDueAt.getTime() <= autoMatchResultDeadline.getTime()
            ? this.autoRematchDueAt
            : autoMatchResultDeadline;
        baseAlarm = earlierDeadline.getTime() <= this.matchDeadline.getTime() ? earlierDeadline : this.matchDeadline;
      }
    }

    if (baseAlarm === null) {
      return hostDisconnectDeadline;
    }

    if (hostDisconnectDeadline === null) {
      return baseAlarm;
    }

    return hostDisconnectDeadline.getTime() <= baseAlarm.getTime()
      ? hostDisconnectDeadline
      : baseAlarm;
  }

  closeHostDisconnectIfExpired(now: Date): boolean {
    const hostDisconnectDeadline = this.getHostDisconnectDeadline();
    if (
      this.roomState === "CLOSED" ||
      hostDisconnectDeadline === null ||
      now.getTime() < hostDisconnectDeadline.getTime()
    ) {
      return false;
    }

    this.close("HOST_DISCONNECTED", now);
    return true;
  }

  submitResult(
    playerId: string,
    roundIndex: number,
    observedKey: ExpectedKey,
    metricValue: number,
    sourceMeta: JsonObject | null,
    now: Date,
  ): ResultSubmitResult {
    if (this.roomState !== "PLAYING" || this.currentRound === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    if (!this.matchPlayerIds.includes(playerId)) {
      return { ok: false, reason: "PLAYER_NOT_FOUND", confirmations: [] };
    }

    if (roundIndex !== this.currentRound.round_index) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    if (this.currentRound.confirmed.some((entry) => entry.player_id === playerId)) {
      return { ok: false, reason: "ROUND_ALREADY_CONFIRMED", confirmations: [] };
    }

    if (!this.isSameExpectedKey(this.currentRound.expected_key, observedKey)) {
      this.resultKeyMismatchDetected = true;
      return { ok: false, reason: "RESULT_KEY_MISMATCH", confirmations: [] };
    }

    const confirmation = this.createRoundConfirmation({
      round_index: roundIndex,
      player_id: playerId,
      status: "PLAYED",
      metric_value: metricValue,
      reason: null,
      submitted_by: "SELF",
      submitted_at: now,
      source_meta: sourceMeta,
    });
    const transition = this.applyRoundConfirmations([confirmation], now, {});
    if (transition === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    return {
      ok: true,
      confirmations: transition.confirmations,
      ...(transition.round_ended === undefined ? {} : { round_ended: transition.round_ended }),
      ...(transition.round_begin === undefined ? {} : { round_begin: transition.round_begin }),
      ...(transition.result_ready === undefined ? {} : { result_ready: transition.result_ready }),
    };
  }

  skipSelf(playerId: string, roundIndex: number, reason: SkipReason, now: Date): SkipSelfResult {
    if (this.roomState !== "PLAYING" || this.currentRound === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    if (!this.matchPlayerIds.includes(playerId)) {
      return { ok: false, reason: "PLAYER_NOT_FOUND", confirmations: [] };
    }

    if (roundIndex !== this.currentRound.round_index) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    if (this.currentRound.confirmed.some((entry) => entry.player_id === playerId)) {
      return { ok: false, reason: "ROUND_ALREADY_CONFIRMED", confirmations: [] };
    }

    const confirmation = this.createSkipConfirmation(roundIndex, playerId, reason, "SELF", now);
    const transition = this.applyRoundConfirmations([confirmation], now, {});
    if (transition === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    return {
      ok: true,
      confirmations: transition.confirmations,
      ...(transition.round_ended === undefined ? {} : { round_ended: transition.round_ended }),
      ...(transition.round_begin === undefined ? {} : { round_begin: transition.round_begin }),
      ...(transition.result_ready === undefined ? {} : { result_ready: transition.result_ready }),
    };
  }

  assignHostSkip(
    playerId: string,
    roundIndex: number,
    targetPlayerId: string,
    reason: SkipReason,
    now: Date,
  ): SkipHostAssignResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST", confirmations: [] };
    }

    if (this.roomState !== "PLAYING" || this.currentRound === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    if (roundIndex !== this.currentRound.round_index) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    if (!this.matchPlayerIds.includes(targetPlayerId)) {
      return { ok: false, reason: "PLAYER_NOT_FOUND", confirmations: [] };
    }

    if (this.currentRound.confirmed.some((entry) => entry.player_id === targetPlayerId)) {
      return { ok: false, reason: "ROUND_ALREADY_CONFIRMED", confirmations: [] };
    }

    if (!this.isHostSkipUnlocked(now)) {
      return { ok: false, reason: "HOST_SKIP_LOCKED", confirmations: [] };
    }

    const confirmation = this.createSkipConfirmation(roundIndex, targetPlayerId, reason, "HOST", now);
    const transition = this.applyRoundConfirmations([confirmation], now, {});
    if (transition === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    return {
      ok: true,
      confirmations: transition.confirmations,
      ...(transition.round_ended === undefined ? {} : { round_ended: transition.round_ended }),
      ...(transition.round_begin === undefined ? {} : { round_begin: transition.round_begin }),
      ...(transition.result_ready === undefined ? {} : { result_ready: transition.result_ready }),
    };
  }

  forceAdvance(playerId: string, now: Date): ForceAdvanceResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST", confirmations: [] };
    }

    if (this.roomState !== "PLAYING" || this.currentRound === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    const timedOutPlayerIds = this.getUnconfirmedPlayerIds(this.currentRound);
    if (timedOutPlayerIds.length === 0) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    const confirmations = timedOutPlayerIds.map((targetPlayerId) =>
      this.createTimeoutConfirmation(this.currentRound?.round_index ?? 0, targetPlayerId, now),
    );
    const transition = this.applyRoundConfirmations(confirmations, now, {
      force_advance_applied: {
        round_index: this.currentRound.round_index,
        timed_out_players: [...timedOutPlayerIds],
      },
    });
    if (transition === null) {
      return { ok: false, reason: "INVALID_STATE", confirmations: [] };
    }

    return {
      ok: true,
      confirmations: transition.confirmations,
      ...(transition.round_ended === undefined ? {} : { round_ended: transition.round_ended }),
      ...(transition.round_begin === undefined ? {} : { round_begin: transition.round_begin }),
      ...(transition.force_advance_applied === undefined
        ? {}
        : { force_advance_applied: transition.force_advance_applied }),
      ...(transition.result_ready === undefined ? {} : { result_ready: transition.result_ready }),
    };
  }

  getResultReadyPayload(): ResultReadyPayload | null {
    return this.resultReadyPayload;
  }

  getMatchSongUnlockFilter(): MatchSongUnlockFilter | null {
    return this.matchSongUnlockFilter === null ? null : cloneMatchSongUnlockFilter(this.matchSongUnlockFilter);
  }

  searchCharts(options: SearchChartsOptions) {
    return this.chartMaster.searchCharts({
      ...options,
      ...(this.matchSongUnlockFilter === null
        ? {}
        : { unlock_filter: this.matchSongUnlockFilter }),
    });
  }

  getReadyCheckDeadline(): Date | null {
    return this.readyCheckDeadline;
  }

  expirePickingIfNeeded(now: Date): PickingTimeoutResult | null {
    if (
      this.roomState !== "PICKING" ||
      this.pickingDeadline === null ||
      now.getTime() < this.pickingDeadline.getTime()
    ) {
      return null;
    }

    const usedChartKeys = new Set(this.picks.map((pick) => pick.pick_chart_key));
    const missingPickPlayerIds: string[] = [];
    for (const playerId of this.matchPlayerIds) {
      const currentPickCount = this.picks.filter((pick) => pick.player_id === playerId).length;
      const requiredPickCountForPlayer = this.getRequiredPickCountForPlayer(playerId);
      for (let pickIndex = currentPickCount; pickIndex < requiredPickCountForPlayer; pickIndex += 1) {
        missingPickPlayerIds.push(playerId);
      }
    }
    const acceptedPicks: PickingTimeoutResult["accepted_picks"] = [];

    for (const [index, playerId] of missingPickPlayerIds.entries()) {
      const acceptedAt = new Date(now.getTime() + index);
      const autoPick = this.chartMaster.pickRandomUnusedChart({
        play_style: this.settings.play_style,
        level_filter: this.settings.level_filter,
        used_chart_keys: usedChartKeys,
        ...(this.matchSongUnlockFilter === null
          ? {}
          : { unlock_filter: this.matchSongUnlockFilter }),
        seed: `${this.roomId}:auto-pick:${playerId}:${acceptedAt.toISOString()}`,
      });
      if (autoPick === null) {
        return null;
      }

      this.picks.push({
        player_id: playerId,
        pick_chart_key: autoPick.chart_key,
        accepted_at: acceptedAt,
        expected_key: cloneExpectedKey(autoPick.expected_key),
        display: {
          title: autoPick.display.title,
          level: autoPick.display.level,
        },
      });
      usedChartKeys.add(autoPick.chart_key);
      acceptedPicks.push({
        player_id: playerId,
        pick_chart_key: autoPick.chart_key,
        accepted_at: acceptedAt,
      });
    }

    const frozenRounds = this.buildFrozenRounds();
    if (frozenRounds.length === 0) {
      return null;
    }

    this.frozenRounds = frozenRounds;
    const roundBegin = this.beginFirstRound(now);
    if (roundBegin === null) {
      return null;
    }

    return {
      accepted_picks: acceptedPicks,
      frozen_rounds: frozenRounds.map(cloneFrozenRound),
      round_begin: {
        round_index: roundBegin.round_index,
        expected_key: cloneExpectedKey(roundBegin.expected_key),
        round_started_at: roundBegin.round_started_at,
        soft_ttl_seconds: roundBegin.soft_ttl_seconds,
      },
    };
  }

  closeReadyCheckIfExpired(now: Date): boolean {
    if (
      this.roomState !== "LOBBY" ||
      this.readyCheckDeadline === null ||
      now.getTime() < this.readyCheckDeadline.getTime()
    ) {
      return false;
    }

    this.close("READY_CHECK_TTL_EXPIRED", now);
    return true;
  }

  expireMatchIfNeeded(now: Date): RoundTransitionResult | null {
    if (
      this.matchDeadline === null ||
      (this.roomState !== "PICKING" && this.roomState !== "PLAYING" && this.roomState !== "RESULT") ||
      now.getTime() < this.matchDeadline.getTime()
    ) {
      return null;
    }

    if (this.roomState === "RESULT") {
      this.close("MATCH_TTL_EXPIRED", now);
      return {
        confirmations: [],
        ...(this.resultReadyPayload === null ? {} : { result_ready: this.resultReadyPayload }),
      };
    }

    if (this.roomState === "PICKING" || this.currentRound === null) {
      this.closeWithResult("MATCH_TTL_EXPIRED", now);
      return {
        confirmations: [],
        ...(this.resultReadyPayload === null ? {} : { result_ready: this.resultReadyPayload }),
      };
    }

    const timedOutPlayers = this.getUnconfirmedPlayerIds(this.currentRound).map((playerId) =>
      this.createTimeoutConfirmation(this.currentRound?.round_index ?? 0, playerId, now),
    );
    return this.applyRoundConfirmations(timedOutPlayers, now, { force_result: true });
  }

  expireAutoRematchIfNeeded(now: Date): AutoRematchDueResult | null {
    if (
      this.roomState !== "RESULT" ||
      this.autoRematchDueAt === null ||
      this.autoRematchScheduledGeneration === null ||
      now.getTime() < this.autoRematchDueAt.getTime()
    ) {
      return null;
    }

    const scheduledGeneration = this.autoRematchScheduledGeneration;
    if (scheduledGeneration !== this.autoRematchGeneration) {
      return null;
    }

    const eligibility = this.checkAutoRematchEligibility();
    if (!eligibility.ok) {
      this.cancelAutoRematch(eligibility.reason);
      return {
        kind: "CANCELLED",
        generation: this.autoRematchGeneration,
        reason: eligibility.reason,
      };
    }

    const hostPlayerId = this.hostPlayerId;
    if (hostPlayerId === null) {
      this.cancelAutoRematch("HOST_DISCONNECTED");
      return {
        kind: "CANCELLED",
        generation: this.autoRematchGeneration,
        reason: "HOST_DISCONNECTED",
      };
    }

    const participantIds = this.getAutoRematchParticipantPlayerIds();
    this.resetLobbyState(now);
    for (const participantId of participantIds) {
      const participant = this.players.get(participantId);
      if (participant !== undefined) {
        participant.ready = true;
      }
    }

    const startResult = this.beginMatch(participantIds, now);
    if (!startResult.ok) {
      this.cancelAutoRematch("INSUFFICIENT_PLAYERS");
      return {
        kind: "CANCELLED",
        generation: this.autoRematchGeneration,
        reason: "INSUFFICIENT_PLAYERS",
      };
    }

    this.clearAutoRematchState(true);
    return {
      kind: "STARTED",
      generation: this.autoRematchGeneration,
      participant_player_ids: participantIds,
    };
  }

  expireAutoMatchResultIfNeeded(now: Date): boolean {
    if (
      this.roomState !== "RESULT" ||
      !this.isAutoMatchRoom() ||
      this.resultDeadline === null ||
      now.getTime() < this.resultDeadline.getTime()
    ) {
      return false;
    }

    this.close("ALL_ROUNDS_COMPLETED", now);
    return true;
  }

  expireCurrentRoundIfNeeded(now: Date): RoundTransitionResult | null {
    if (this.roomState !== "PLAYING" || this.currentRound === null) {
      return null;
    }

    const deadline = this.getCurrentRoundDeadline();
    if (
      this.matchDeadline === null ||
      deadline === null ||
      now.getTime() < deadline.getTime() ||
      now.getTime() >= this.matchDeadline.getTime()
    ) {
      return null;
    }

    const unconfirmedPlayerIds = this.getUnconfirmedPlayerIds(this.currentRound);
    if (unconfirmedPlayerIds.length === 0) {
      return null;
    }

    const confirmations = unconfirmedPlayerIds.map((playerId) =>
      this.createTimeoutConfirmation(this.currentRound?.round_index ?? 0, playerId, now),
    );
    return this.applyRoundConfirmations(confirmations, now, {});
  }

  close(reason: CloseReason, now: Date): void {
    if (this.roomState === "CLOSED") {
      return;
    }

    this.roomState = "CLOSED";
    this.currentRound = null;
    this.readyCheckDeadline = null;
    this.pickingDeadline = null;
    this.matchDeadline = null;
    this.resultDeadline = null;
    this.closeReason = reason;
    this.closedAt = now;
    this.clearAutoRematchState(false);
  }

  toSnapshot(): RoomStateSnapshot {
    const players = this.getPlayersInJoinOrder().map((player) => ({
      player_id: player.player_id,
      display_name: player.display_name,
      source: player.source,
      song_unlocks: cloneSongUnlockSettings(player.song_unlocks),
      connected: player.connected,
      ready: player.ready,
      role: player.role,
      joined_at: player.joined_at.toISOString(),
      left_at: toIsoString(player.left_at),
      rejoin_until: toIsoString(player.rejoin_until),
    }));

    return {
      room_id: this.roomId,
      generation: this.generation,
      current_match_id: this.currentMatchId ?? this.roomId,
      room_state: this.roomState,
      settings: this.settings,
      auto_rematch_enabled: this.autoRematchEnabled,
      auto_rematch_countdown_started_at: toIsoString(this.autoRematchCountdownStartedAt),
      auto_rematch_due_at: toIsoString(this.autoRematchDueAt),
      auto_rematch_generation: this.autoRematchGeneration,
      auto_rematch_cancelled: this.autoRematchCancelled,
      auto_rematch_block_reason: this.autoRematchBlockReason,
      next_match_opt_out_player_ids: this.getPlayersInJoinOrder()
        .map((player) => player.player_id)
        .filter((playerId) => this.nextMatchOptOutPlayerIds.has(playerId)),
      last_match_end_reason: this.lastMatchEndReason,
      host_player_id: this.hostPlayerId ?? "",
      players,
      match_song_unlock_filter:
        this.matchSongUnlockFilter === null ? null : cloneMatchSongUnlockFilter(this.matchSongUnlockFilter),
      quick_chat_messages: this.quickChatMessages.map(cloneQuickChatMessage),
      picks: this.picks.map((pick) => ({
        player_id: pick.player_id,
        pick_chart_key: pick.pick_chart_key,
        accepted_at: pick.accepted_at.toISOString(),
      })),
      frozen_rounds: this.frozenRounds.map(cloneFrozenRound),
      current_round:
        this.currentRound === null
          ? null
          : {
              round_index: this.currentRound.round_index,
              expected_key: cloneExpectedKey(this.currentRound.expected_key),
              round_started_at: this.currentRound.round_started_at,
              soft_ttl_seconds: this.currentRound.soft_ttl_seconds,
              confirmed: this.currentRound.confirmed.map((entry) => ({ ...entry })),
            },
      timers: {
        ready_check_deadline: toIsoString(this.readyCheckDeadline),
        picking_deadline: toIsoString(this.pickingDeadline),
        match_deadline: toIsoString(this.matchDeadline),
        result_deadline: toIsoString(this.resultDeadline),
      },
      result_ready: this.resultReadyPayload !== null,
      created_at: this.createdAt.toISOString(),
      closed_at: toIsoString(this.closedAt),
      close_reason: this.closeReason,
    };
  }

  toPersistenceRecord(): RoomStatePersistenceRecord {
    return {
      version: 1,
      initialized: this.initialized,
      room_id: this.roomId,
      generation: this.generation,
      room_state: this.roomState,
      settings: { ...this.settings },
      auto_rematch_enabled: this.autoRematchEnabled,
      auto_rematch_countdown_started_at: toIsoString(this.autoRematchCountdownStartedAt),
      auto_rematch_due_at: toIsoString(this.autoRematchDueAt),
      auto_rematch_generation: this.autoRematchGeneration,
      auto_rematch_scheduled_generation: this.autoRematchScheduledGeneration,
      auto_rematch_cancelled: this.autoRematchCancelled,
      auto_rematch_block_reason: this.autoRematchBlockReason,
      host_player_id: this.hostPlayerId,
      created_at: this.createdAt.toISOString(),
      match_deadline: toIsoString(this.matchDeadline),
      ready_check_deadline: toIsoString(this.readyCheckDeadline),
      picking_deadline: toIsoString(this.pickingDeadline),
      result_deadline: toIsoString(this.resultDeadline),
      closed_at: toIsoString(this.closedAt),
      close_reason: this.closeReason,
      players: this.getPlayersInJoinOrder().map((player) => ({
        player_id: player.player_id,
        display_name: player.display_name,
        source: player.source,
        song_unlocks: cloneSongUnlockSettings(player.song_unlocks),
        connected: player.connected,
        ready: player.ready,
        role: player.role,
        joined_at: player.joined_at.toISOString(),
        left_at: toIsoString(player.left_at),
        rejoin_until: toIsoString(player.rejoin_until),
      })),
      picks: this.picks.map((pick) => ({
        player_id: pick.player_id,
        pick_chart_key: pick.pick_chart_key,
        accepted_at: pick.accepted_at.toISOString(),
        expected_key: cloneExpectedKey(pick.expected_key),
        display: {
          title: pick.display.title,
          level: pick.display.level,
        },
      })),
      round_confirmations: Array.from(this.roundConfirmations.entries()).map(([round_index, confirmations]) => ({
        round_index,
        confirmations: confirmations.map(cloneRoundConfirmation),
      })),
      frozen_rounds: this.frozenRounds.map(cloneFrozenRound),
      current_round:
        this.currentRound === null
          ? null
          : {
              round_index: this.currentRound.round_index,
              expected_key: cloneExpectedKey(this.currentRound.expected_key),
              round_started_at: this.currentRound.round_started_at,
              soft_ttl_seconds: this.currentRound.soft_ttl_seconds,
              confirmed: this.currentRound.confirmed.map((entry) => ({ ...entry })),
            },
      match_player_ids: [...this.matchPlayerIds],
      current_match_id: this.currentMatchId,
      match_song_unlock_filter:
        this.matchSongUnlockFilter === null ? null : cloneMatchSongUnlockFilter(this.matchSongUnlockFilter),
      result_ready_payload: ensureResultReadyPayloadMatchId(
        this.resultReadyPayload,
        this.currentMatchId ?? this.roomId,
      ),
      result_key_mismatch_detected: this.resultKeyMismatchDetected,
      force_advanced_round_indices: Array.from(this.forceAdvancedRoundIndices).sort((left, right) => left - right),
      next_match_opt_out_player_ids: this.getPlayersInJoinOrder()
        .map((player) => player.player_id)
        .filter((playerId) => this.nextMatchOptOutPlayerIds.has(playerId)),
      source_unavailable_player_ids: this.getPlayersInJoinOrder()
        .map((player) => player.player_id)
        .filter((playerId) => this.sourceUnavailablePlayerIds.has(playerId)),
      last_match_end_reason: this.lastMatchEndReason,
      quick_chat_messages: this.quickChatMessages.map((message) => ({
        message_id: message.message_id,
        player_id: message.player_id,
        phrase_ids: [...message.phrase_ids],
        message: message.message,
        posted_at: message.posted_at,
      })),
    };
  }

  hydrate(record: RoomStatePersistenceRecord): void {
    if (!record.initialized) {
      return;
    }

    this.initialized = true;
    this.roomId = record.room_id;
    this.generation =
      typeof record.generation === "number" && Number.isInteger(record.generation) && record.generation > 0
        ? record.generation
        : 1;
    // Legacy pre-release snapshots may still contain READY_CHECK; fold them into LOBBY on restore.
    const persistedRoomState = record.room_state as RoomState | "READY_CHECK";
    this.roomState = persistedRoomState === "READY_CHECK" ? "LOBBY" : persistedRoomState;
    this.settings = normalizeSettingsVisibility({ ...record.settings });
    this.autoRematchEnabled =
      record.auto_rematch_enabled === true ||
      (this.settings.visibility === "PRIVATE" && this.settings.auto_rematch === true);
    this.autoRematchCountdownStartedAt = parseOptionalDate(record.auto_rematch_countdown_started_at ?? null);
    this.autoRematchDueAt = parseOptionalDate(record.auto_rematch_due_at ?? null);
    this.autoRematchGeneration =
      typeof record.auto_rematch_generation === "number" && Number.isInteger(record.auto_rematch_generation)
        ? record.auto_rematch_generation
        : 0;
    this.autoRematchScheduledGeneration =
      typeof record.auto_rematch_scheduled_generation === "number" &&
        Number.isInteger(record.auto_rematch_scheduled_generation)
        ? record.auto_rematch_scheduled_generation
        : null;
    this.autoRematchCancelled = record.auto_rematch_cancelled === true;
    this.autoRematchBlockReason = (record.auto_rematch_block_reason ?? null) as AutoRematchBlockReason | null;
    this.hostPlayerId = record.host_player_id;
    this.createdAt = parseRequiredDate(record.created_at);
    this.matchDeadline = parseOptionalDate(record.match_deadline);
    this.readyCheckDeadline = parseOptionalDate(record.ready_check_deadline);
    this.pickingDeadline = parseOptionalDate(record.picking_deadline);
    this.resultDeadline = parseOptionalDate(record.result_deadline);
    this.closedAt = parseOptionalDate(record.closed_at);
    this.closeReason = record.close_reason;

    this.players.clear();
    for (const player of record.players) {
      this.players.set(player.player_id, {
        player_id: player.player_id,
        display_name: player.display_name,
        source: player.source,
        song_unlocks: normalizeSongUnlockSettings(player.song_unlocks),
        connected: player.connected,
        ready: player.ready,
        role: player.role,
        joined_at: parseRequiredDate(player.joined_at),
        left_at: parseOptionalDate(player.left_at),
        rejoin_until: parseOptionalDate(player.rejoin_until),
      });
    }

    this.picks.length = 0;
    for (const pick of record.picks) {
      this.picks.push({
        player_id: pick.player_id,
        pick_chart_key: pick.pick_chart_key,
        accepted_at: parseRequiredDate(pick.accepted_at),
        expected_key: cloneExpectedKey(pick.expected_key),
        display: {
          title: pick.display.title,
          level: pick.display.level,
        },
      });
    }

    this.roundConfirmations.clear();
    for (const entry of record.round_confirmations) {
      this.roundConfirmations.set(entry.round_index, entry.confirmations.map(cloneRoundConfirmation));
    }

    this.frozenRounds = record.frozen_rounds.map(cloneFrozenRound);
    this.currentRound =
      record.current_round === null
        ? null
        : {
            round_index: record.current_round.round_index,
            expected_key: cloneExpectedKey(record.current_round.expected_key),
            round_started_at: record.current_round.round_started_at,
            soft_ttl_seconds: record.current_round.soft_ttl_seconds,
            confirmed: record.current_round.confirmed.map((entry) => ({ ...entry })),
          };
    this.matchPlayerIds = [...record.match_player_ids];
    const persistedCurrentMatchId =
      typeof record.current_match_id === "string" && record.current_match_id.length > 0
        ? record.current_match_id
        : null;
    this.currentMatchId = persistedCurrentMatchId ?? extractResultReadySummaryMatchId(record.result_ready_payload);
    this.matchSongUnlockFilter =
      record.match_song_unlock_filter === undefined || record.match_song_unlock_filter === null
        ? null
        : cloneMatchSongUnlockFilter(record.match_song_unlock_filter);
    this.resultReadyPayload = ensureResultReadyPayloadMatchId(
      record.result_ready_payload,
      this.currentMatchId ?? this.roomId,
    );
    if (this.currentMatchId === null) {
      this.currentMatchId = extractResultReadySummaryMatchId(this.resultReadyPayload);
    }
    this.resultKeyMismatchDetected = record.result_key_mismatch_detected === true;
    this.forceAdvancedRoundIndices.clear();
    for (const roundIndex of record.force_advanced_round_indices ?? []) {
      this.forceAdvancedRoundIndices.add(roundIndex);
    }
    this.nextMatchOptOutPlayerIds.clear();
    for (const playerId of record.next_match_opt_out_player_ids ?? []) {
      if (typeof playerId === "string" && playerId.length > 0) {
        this.nextMatchOptOutPlayerIds.add(playerId);
      }
    }
    this.sourceUnavailablePlayerIds.clear();
    for (const playerId of record.source_unavailable_player_ids ?? []) {
      if (typeof playerId === "string" && playerId.length > 0) {
        this.sourceUnavailablePlayerIds.add(playerId);
      }
    }
    this.lastMatchEndReason = record.last_match_end_reason ?? null;
    this.quickChatMessages = (record.quick_chat_messages ?? [])
      .filter((message): message is PersistedQuickChatMessage => {
        if (
          typeof message.message_id !== "string" ||
          typeof message.player_id !== "string" ||
          typeof message.message !== "string" ||
          typeof message.posted_at !== "string" ||
          !Array.isArray(message.phrase_ids)
        ) {
          return false;
        }

        const postedAt = new Date(message.posted_at);
        return (
          message.message_id.length > 0 &&
          message.player_id.length > 0 &&
          message.message.length > 0 &&
          message.message.length <= QUICK_CHAT_MAX_COMPOSED_LENGTH &&
          Number.isFinite(postedAt.getTime()) &&
          message.phrase_ids.length > 0 &&
          message.phrase_ids.every((phraseId) => typeof phraseId === "string" && isQuickChatPhraseId(phraseId))
        );
      })
      .slice(-QUICK_CHAT_HISTORY_LIMIT)
      .map((message) => ({
        message_id: message.message_id,
        player_id: message.player_id,
        phrase_ids: message.phrase_ids as QuickChatPhraseId[],
        message: message.message,
        posted_at: message.posted_at,
      }));
  }

  private getCurrentRoundDeadline(): Date | null {
    if (this.currentRound === null) {
      return null;
    }

    const roundStartedAt = new Date(this.currentRound.round_started_at);
    if (!Number.isFinite(roundStartedAt.getTime())) {
      return null;
    }

    return new Date(
      roundStartedAt.getTime() +
        ROUND_PLAY_BEGIN_AT_SECONDS * 1_000 +
        this.currentRound.soft_ttl_seconds * 1_000,
    );
  }

  private isSameExpectedKey(left: ExpectedKey, right: ExpectedKey): boolean {
    if (
      typeof left.chart_id === "number" &&
      Number.isInteger(left.chart_id) &&
      left.chart_id > 0 &&
      typeof right.chart_id === "number" &&
      Number.isInteger(right.chart_id) &&
      right.chart_id > 0
    ) {
      return left.chart_id === right.chart_id;
    }

    return (
      left.play_style === right.play_style &&
      left.difficulty === right.difficulty &&
      left.title_search_key === right.title_search_key
    );
  }

  private createRoundConfirmation(input: {
    round_index: number;
    player_id: string;
    status: SubmissionStatus;
    metric_value: number;
    reason: SubmissionReason;
    submitted_by: SubmittedBy;
    submitted_at: Date;
    source_meta: JsonObject | null;
  }): RoundConfirmationEvent {
    return {
      round_index: input.round_index,
      player_id: input.player_id,
      status: input.status,
      metric_value: input.metric_value,
      reason: input.reason,
      submitted_by: input.submitted_by,
      submitted_at: input.submitted_at.toISOString(),
      source_meta: input.source_meta,
    };
  }

  private createSkipConfirmation(
    roundIndex: number,
    playerId: string,
    reason: SkipReason,
    submittedBy: SubmittedBy,
    submittedAt: Date,
  ): RoundConfirmationEvent {
    return this.createRoundConfirmation({
      round_index: roundIndex,
      player_id: playerId,
      status: "SKIPPED",
      metric_value: this.getDefaultTerminalMetricValue(this.settings.win_metric),
      reason,
      submitted_by: submittedBy,
      submitted_at: submittedAt,
      source_meta: null,
    });
  }

  private createTimeoutConfirmation(
    roundIndex: number,
    playerId: string,
    submittedAt: Date,
  ): RoundConfirmationEvent {
    return this.createRoundConfirmation({
      round_index: roundIndex,
      player_id: playerId,
      status: "TIMEOUT",
      metric_value: this.getDefaultTerminalMetricValue(this.settings.win_metric),
      reason: "UNMAPPED_TIMEOUT",
      submitted_by: "SYSTEM",
      submitted_at: submittedAt,
      source_meta: null,
    });
  }

  private getDefaultTerminalMetricValue(metric: WinMetric): number {
    return metric === "MISSCOUNT" ? 9999 : 0;
  }

  private getUnconfirmedPlayerIds(round: CurrentRoundSnapshot): string[] {
    const confirmedPlayerIds = new Set(round.confirmed.map((entry) => entry.player_id));
    return this.matchPlayerIds.filter((playerId) => !confirmedPlayerIds.has(playerId));
  }

  private applyRoundConfirmations(
    confirmations: RoundConfirmationEvent[],
    now: Date,
    options: {
      force_result?: boolean;
      force_advance_applied?: ForceAdvanceAppliedEvent;
    },
  ): RoundTransitionResult | null {
    if (this.currentRound === null) {
      return null;
    }

    const clonedConfirmations = confirmations.map(cloneRoundConfirmation);
    this.currentRound.confirmed = [
      ...this.currentRound.confirmed,
      ...clonedConfirmations,
    ];

    const currentRoundIndex = this.currentRound.round_index;
    const existingRoundConfirmations = this.roundConfirmations.get(currentRoundIndex) ?? [];
    this.roundConfirmations.set(currentRoundIndex, [...existingRoundConfirmations, ...clonedConfirmations]);
    const result: RoundTransitionResult = {
      confirmations: clonedConfirmations,
    };
    if (options.force_advance_applied !== undefined) {
      this.forceAdvancedRoundIndices.add(options.force_advance_applied.round_index);
      result.force_advance_applied = {
        round_index: options.force_advance_applied.round_index,
        timed_out_players: [...options.force_advance_applied.timed_out_players],
      };
    }

    if (!options.force_result && this.currentRound.confirmed.length < this.matchPlayerIds.length) {
      return result;
    }

    result.round_ended = { round_index: currentRoundIndex };

    if (options.force_result || this.shouldEnterResultAfterRound(currentRoundIndex)) {
      if (options.force_result) {
        this.closeWithResult("MATCH_TTL_EXPIRED", now);
      } else {
        this.enterResult(now);
      }
      if (this.resultReadyPayload !== null) {
        result.result_ready = this.resultReadyPayload;
      }
      return result;
    }

    const nextRound = this.beginNextRound(currentRoundIndex + 1, now);
    if (nextRound !== null) {
      result.round_begin = nextRound;
      return result;
    }

    this.enterResult(now);
    if (this.resultReadyPayload !== null) {
      result.result_ready = this.resultReadyPayload;
    }
    return result;
  }

  private enterResult(now: Date): void {
    this.resultReadyPayload = this.buildResultReadyPayload();
    this.currentRound = null;
    this.roomState = "RESULT";
    this.readyCheckDeadline = null;
    this.pickingDeadline = null;
    this.resultDeadline = this.isAutoMatchRoom()
      ? new Date(now.getTime() + AUTO_REMATCH_RESULT_SECONDS * 1_000)
      : null;
    this.closeReason = null;
    this.closedAt = null;
    this.lastMatchEndReason = this.isLastMatchNormalForAutoRematch() ? "RESULT_READY_NORMAL" : "RESULT_READY_WITH_ISSUES";
    this.startAutoRematchCountdown(now);
  }

  private closeWithResult(reason: CloseReason, now: Date): void {
    this.resultReadyPayload = this.buildResultReadyPayload();
    this.currentRound = null;
    this.roomState = "CLOSED";
    this.readyCheckDeadline = null;
    this.pickingDeadline = null;
    this.matchDeadline = null;
    this.resultDeadline = null;
    this.closeReason = reason;
    this.closedAt = now;
    this.lastMatchEndReason = reason;
    this.clearAutoRematchState(false);
  }

  private hasMatchTransientState(): boolean {
    return (
      this.picks.length > 0 ||
      this.roundConfirmations.size > 0 ||
      this.frozenRounds.length > 0 ||
      this.currentRound !== null ||
      this.matchPlayerIds.length > 0 ||
      this.resultReadyPayload !== null ||
      this.pickingDeadline !== null ||
      this.matchDeadline !== null ||
      this.resultDeadline !== null
    );
  }

  private resetLobbyState(now: Date): void {
    this.roomState = "LOBBY";
    this.readyCheckDeadline = computeReadyCheckDeadline(now);
    this.pickingDeadline = null;
    this.matchDeadline = null;
    this.resultDeadline = null;
    this.closedAt = null;
    this.closeReason = null;
    this.picks.length = 0;
    this.roundConfirmations.clear();
    this.frozenRounds = [];
    this.currentRound = null;
    this.matchPlayerIds = [];
    this.currentMatchId = null;
    this.matchSongUnlockFilter = null;
    this.resultReadyPayload = null;
    this.resultKeyMismatchDetected = false;
    this.forceAdvancedRoundIndices.clear();
    this.clearAutoRematchState(false);
    this.lastMatchEndReason = null;

    for (const [playerId, player] of Array.from(this.players.entries())) {
      if (!player.connected) {
        this.players.delete(playerId);
        continue;
      }

      player.ready = false;
      player.left_at = null;
      player.rejoin_until = null;
    }
  }

  private beginMatch(participantPlayerIds: string[], now: Date): StartMatchResult {
    if (this.hasMatchTransientState()) {
      return { ok: false, reason: "PREVIOUS_MATCH_NOT_CLEARED" };
    }

    const participantSet = new Set(participantPlayerIds);
    const participants = this.getPlayersInJoinOrder().filter(
      (player) => participantSet.has(player.player_id) && player.connected,
    );

    if (participants.length < START_MIN_PLAYERS) {
      return { ok: false, reason: "START_REQUIRES_MIN_PLAYERS" };
    }

    if (this.isBplMode() && participants.length !== 2) {
      return { ok: false, reason: "BPL_REQUIRES_TWO_PLAYERS" };
    }

    this.roomState = "PICKING";
    this.readyCheckDeadline = null;
    this.pickingDeadline = computePickingDeadline(now, this.settings.mode);
    this.matchDeadline = computeMatchDeadline(now);
    this.resultDeadline = null;
    this.closedAt = null;
    this.closeReason = null;
    this.matchPlayerIds = participants.map((player) => player.player_id);
    this.currentMatchId = generateMatchId();
    this.matchSongUnlockFilter = computeMatchSongUnlockFilter(participants);
    this.picks.length = 0;
    this.roundConfirmations.clear();
    this.frozenRounds = [];
    this.currentRound = null;
    this.resultReadyPayload = null;
    this.resultKeyMismatchDetected = false;
    this.forceAdvancedRoundIndices.clear();
    this.clearAutoRematchState(false);
    this.lastMatchEndReason = null;

    for (const player of this.players.values()) {
      player.ready = false;
    }

    return { ok: true };
  }

  private maybeStartAutoMatch(now: Date): boolean {
    if (!this.isAutoMatchRoom() || this.roomState !== "LOBBY") {
      return false;
    }

    if (this.hasMatchTransientState()) {
      return false;
    }

    const participantIds = this.getPlayersInJoinOrder()
      .filter((player) => player.connected)
      .map((player) => player.player_id);
    if (participantIds.length !== this.settings.max_players || participantIds.length < START_MIN_PLAYERS) {
      return false;
    }

    if (this.isBplMode() && participantIds.length !== 2) {
      return false;
    }

    const startResult = this.beginMatch(participantIds, now);
    return startResult.ok;
  }

  private clearAutoRematchState(incrementGeneration: boolean): void {
    if (incrementGeneration) {
      this.autoRematchGeneration += 1;
    }
    this.autoRematchCountdownStartedAt = null;
    this.autoRematchDueAt = null;
    this.autoRematchScheduledGeneration = null;
    this.autoRematchCancelled = false;
    this.autoRematchBlockReason = null;
    this.nextMatchOptOutPlayerIds.clear();
  }

  private cancelAutoRematch(reason: AutoRematchBlockReason): void {
    this.autoRematchGeneration += 1;
    this.autoRematchCountdownStartedAt = null;
    this.autoRematchDueAt = null;
    this.autoRematchScheduledGeneration = null;
    this.autoRematchCancelled = true;
    this.autoRematchBlockReason = reason;
  }

  private startAutoRematchCountdown(now: Date): void {
    this.clearAutoRematchState(false);

    if (this.settings.visibility !== "PRIVATE") {
      this.autoRematchEnabled = false;
      return;
    }

    if (!this.autoRematchEnabled) {
      return;
    }

    const eligibility = this.checkAutoRematchEligibility();
    if (!eligibility.ok) {
      this.cancelAutoRematch(eligibility.reason);
      return;
    }

    this.autoRematchGeneration += 1;
    this.autoRematchCountdownStartedAt = now;
    this.autoRematchDueAt = new Date(now.getTime() + AUTO_REMATCH_RESULT_SECONDS * 1_000);
    this.autoRematchScheduledGeneration = this.autoRematchGeneration;
  }

  private isAutoMatchRoom(): boolean {
    return this.settings.auto_match === true;
  }

  private checkAutoRematchEligibility():
    | { ok: true }
    | { ok: false; reason: AutoRematchBlockReason } {
    if (this.settings.visibility !== "PRIVATE") {
      return { ok: false, reason: "NOT_PRIVATE_ROOM" };
    }

    if (!this.autoRematchEnabled) {
      return { ok: false, reason: "AUTO_REMATCH_DISABLED" };
    }

    if (!this.isLastMatchNormalForAutoRematch()) {
      return { ok: false, reason: "LAST_MATCH_NOT_NORMAL" };
    }

    if (this.hostPlayerId === null || !this.isPlayerConnected(this.hostPlayerId)) {
      return { ok: false, reason: "HOST_DISCONNECTED" };
    }

    const participantIds = this.getAutoRematchParticipantPlayerIds();
    if (participantIds.length < START_MIN_PLAYERS) {
      return { ok: false, reason: "INSUFFICIENT_PLAYERS" };
    }

    if (this.isBplMode() && participantIds.length !== 2) {
      return { ok: false, reason: "INSUFFICIENT_PLAYERS" };
    }

    if (participantIds.some((playerId) => this.sourceUnavailablePlayerIds.has(playerId))) {
      return { ok: false, reason: "SOURCE_UNAVAILABLE" };
    }

    return { ok: true };
  }

  private getAutoRematchParticipantPlayerIds(): string[] {
    return this.matchPlayerIds.filter((playerId) => {
      const player = this.players.get(playerId);
      return (
        player !== undefined &&
        player.connected &&
        !this.nextMatchOptOutPlayerIds.has(playerId)
      );
    });
  }

  private isLastMatchNormalForAutoRematch(): boolean {
    if (this.resultReadyPayload === null) {
      return false;
    }

    if (this.resultKeyMismatchDetected || this.forceAdvancedRoundIndices.size > 0) {
      return false;
    }

    for (const confirmations of this.roundConfirmations.values()) {
      for (const confirmation of confirmations) {
        if (confirmation.status !== "PLAYED" || confirmation.reason !== null) {
          return false;
        }
      }
    }

    return true;
  }

  private getPlayersInJoinOrder(): InternalPlayer[] {
    return Array.from(this.players.values()).sort(
      (left, right) => left.joined_at.getTime() - right.joined_at.getTime(),
    );
  }

  private getHostDisconnectDeadline(): Date | null {
    if (this.roomState === "CLOSED" || this.hostPlayerId === null) {
      return null;
    }

    const host = this.players.get(this.hostPlayerId);
    if (!host || host.connected || host.rejoin_until === null) {
      return null;
    }

    return host.rejoin_until;
  }

  private resolveDuplicatePick(
    playerId: string,
    requestedPickChartKey: string,
    resolvedChart: ResolvedMasterChart,
    acceptedAt: Date,
    unlockFilter: MatchSongUnlockFilter | undefined,
  ): InternalPick | null {
    const usedKeys = new Set(this.picks.map((pick) => pick.pick_chart_key));
    let selectedChart = resolvedChart;

    if (usedKeys.has(selectedChart.chart_key)) {
      const replacementChart = this.chartMaster.pickRandomUnusedChart({
        play_style: this.settings.play_style,
        level_filter: this.settings.level_filter,
        used_chart_keys: usedKeys,
        ...(unlockFilter === undefined ? {} : { unlock_filter: unlockFilter }),
        seed: `${this.roomId}:${playerId}:${requestedPickChartKey}:${acceptedAt.toISOString()}`,
        preferred_difficulty: selectedChart.expected_key.difficulty,
        preferred_level: selectedChart.display.level,
      });
      if (replacementChart === null) {
        return null;
      }

      selectedChart = replacementChart;
    }

    return {
      player_id: playerId,
      pick_chart_key: selectedChart.chart_key,
      accepted_at: acceptedAt,
      expected_key: cloneExpectedKey(selectedChart.expected_key),
      display: {
        title: selectedChart.display.title,
        level: selectedChart.display.level,
      },
    };
  }

  private isBplMode(): boolean {
    return this.settings.mode === "BPL" || this.settings.mode === "BPL4";
  }

  private isBplFourStageMode(): boolean {
    return this.settings.mode === "BPL4";
  }

  private getBplRoundCount(): number {
    return this.isBplFourStageMode() ? BPL4_ROUNDS : BPL_ROUNDS;
  }

  private getRequiredPickCount(): number {
    if (this.settings.mode === "ARENA") {
      return this.matchPlayerIds.length;
    }

    if (!this.isBplMode()) {
      return this.matchPlayerIds.length;
    }

    return this.isBplFourStageMode() ? this.getBplRoundCount() : this.matchPlayerIds.length;
  }

  private getRequiredPickCountForPlayer(playerId: string): number {
    if (!this.matchPlayerIds.includes(playerId)) {
      return 0;
    }

    if (!this.isBplMode()) {
      return 1;
    }

    if (!this.isBplFourStageMode()) {
      return 1;
    }

    const participantCount = this.matchPlayerIds.length;
    if (participantCount <= 0) {
      return 0;
    }

    const playerIndex = this.matchPlayerIds.indexOf(playerId);
    const roundCount = this.getBplRoundCount();
    const basePickCount = Math.floor(roundCount / participantCount);
    const extraPickCount = roundCount % participantCount;
    return basePickCount + (playerIndex >= 0 && playerIndex < extraPickCount ? 1 : 0);
  }

  private buildFrozenRounds(): FrozenRound[] {
    const picksByAcceptedOrder = [...this.picks].sort(
      (left, right) => left.accepted_at.getTime() - right.accepted_at.getTime(),
    );

    if (this.settings.mode === "ARENA") {
      return picksByAcceptedOrder.map((pick, index) => ({
        round_index: index,
        expected_key: cloneExpectedKey(pick.expected_key),
        display: {
          title: pick.display.title,
          level: pick.display.level,
        },
        started_at: null,
        soft_ttl_seconds: ROUND_SOFT_TTL_SECONDS,
      }));
    }

    if (!this.isBplMode()) {
      return [];
    }

    if (picksByAcceptedOrder.length < this.getRequiredPickCount()) {
      return [];
    }

    if (this.isBplFourStageMode()) {
      return picksByAcceptedOrder.slice(0, this.getBplRoundCount()).map((pick, index) => ({
        round_index: index,
        expected_key: cloneExpectedKey(pick.expected_key),
        display: {
          title: pick.display.title,
          level: pick.display.level,
        },
        started_at: null,
        soft_ttl_seconds: ROUND_SOFT_TTL_SECONDS,
      }));
    }

    const rounds: FrozenRound[] = picksByAcceptedOrder.slice(0, 2).map((pick, index) => ({
      round_index: index,
      expected_key: cloneExpectedKey(pick.expected_key),
      display: {
        title: pick.display.title,
        level: pick.display.level,
      },
      started_at: null,
      soft_ttl_seconds: ROUND_SOFT_TTL_SECONDS,
    }));

    const usedChartKeys = new Set(picksByAcceptedOrder.slice(0, 2).map((pick) => pick.pick_chart_key));
    const randomRound = this.buildMasterRandomRound(rounds.length, rounds, usedChartKeys);
    if (randomRound === null) {
      return [];
    }

    rounds.push(randomRound);

    return rounds.slice(0, this.getBplRoundCount());
  }

  private buildMasterRandomRound(
    roundIndex: number,
    existingRounds: FrozenRound[],
    usedChartKeys: Set<string>,
  ): FrozenRound | null {
    const pickedLevels = existingRounds
      .map((round) => round.display.level)
      .filter((level): level is number => typeof level === "number");
    if (pickedLevels.length === 0) {
      return null;
    }
    const levelMin = Math.min(...pickedLevels);
    const levelMax = Math.max(...pickedLevels);
    const randomChart = this.chartMaster.pickRandomUnusedChart({
      play_style: this.settings.play_style,
      level_filter: this.settings.level_filter,
      used_chart_keys: usedChartKeys,
      ...(this.matchSongUnlockFilter === null
        ? {}
        : { unlock_filter: this.matchSongUnlockFilter }),
      preferred_level_min: levelMin,
      preferred_level_max: levelMax,
      enforce_level_range: true,
      seed: `${this.roomId}:random:${roundIndex}:${Array.from(usedChartKeys).sort().join("|")}`,
    });
    if (randomChart === null) {
      return null;
    }

    return {
      round_index: roundIndex,
      expected_key: cloneExpectedKey(randomChart.expected_key),
      display: {
        title: randomChart.display.title,
        level: randomChart.display.level,
      },
      started_at: null,
      soft_ttl_seconds: ROUND_SOFT_TTL_SECONDS,
    };
  }

  private beginFirstRound(now: Date): CurrentRoundSnapshot | null {
    return this.beginRoundAtIndex(0, now);
  }

  private beginNextRound(roundIndex: number, now: Date): RoundBeginEvent | null {
    const nextRound = this.beginRoundAtIndex(roundIndex, now);
    if (nextRound === null) {
      return null;
    }

    return {
      round_index: nextRound.round_index,
      expected_key: cloneExpectedKey(nextRound.expected_key),
      round_started_at: nextRound.round_started_at,
      soft_ttl_seconds: nextRound.soft_ttl_seconds,
    };
  }

  private beginRoundAtIndex(roundIndex: number, now: Date): CurrentRoundSnapshot | null {
    if (this.frozenRounds.length === 0) {
      return null;
    }

    const roundStartedAt = new Date(
      now.getTime() + this.getRoundLeadInSeconds(roundIndex) * 1_000,
    ).toISOString();
    const roundSource = this.frozenRounds.find((round) => round.round_index === roundIndex);
    if (roundSource === undefined) {
      return null;
    }

    this.frozenRounds = this.frozenRounds.map((round) => {
      if (round.round_index !== roundIndex) {
        return cloneFrozenRound(round);
      }

      return {
        ...cloneFrozenRound(round),
        started_at: roundStartedAt,
      };
    });

    const startedRound = this.frozenRounds.find((round) => round.round_index === roundIndex);
    if (startedRound === undefined) {
      return null;
    }

    this.roomState = "PLAYING";
    this.currentRound = {
      round_index: startedRound.round_index,
      expected_key: cloneExpectedKey(startedRound.expected_key),
      round_started_at: roundStartedAt,
      soft_ttl_seconds: startedRound.soft_ttl_seconds,
      confirmed: [],
    };
    this.pickingDeadline = null;
    this.resultDeadline = null;
    return this.currentRound;
  }

  private getRoundLeadInSeconds(roundIndex: number): number {
    if (this.isBplMode()) {
      return roundIndex === 0 ? BPL_PICK_CUTIN_DELAY_SECONDS : BPL_RESULT_PHASE_DELAY_SECONDS;
    }

    if (this.settings.mode === "ARENA" && roundIndex > 0) {
      return ARENA_RESULT_PHASE_DELAY_SECONDS;
    }

    return 0;
  }

  private isHostSkipUnlocked(now: Date): boolean {
    if (this.currentRound === null) {
      return false;
    }

    const roundStartedAt = new Date(this.currentRound.round_started_at);
    if (!Number.isFinite(roundStartedAt.getTime())) {
      return false;
    }

    return now.getTime() >= roundStartedAt.getTime() + HOST_SKIP_UNLOCK_SECONDS * 1_000;
  }

  private shouldEnterResultAfterRound(roundIndex: number): boolean {
    if (!this.isBplMode()) {
      return false;
    }

    return roundIndex >= this.frozenRounds.length - 1;
  }

  private computeBplWins(maxRoundIndex: number): Map<string, number> {
    const wins = new Map<string, number>();
    for (const playerId of this.matchPlayerIds) {
      wins.set(playerId, 0);
    }

    for (let roundIndex = 0; roundIndex <= maxRoundIndex; roundIndex += 1) {
      const winnerPlayerId = this.getBplRoundWinnerPlayerId(roundIndex);
      if (winnerPlayerId === null) {
        continue;
      }

      wins.set(winnerPlayerId, (wins.get(winnerPlayerId) ?? 0) + 1);
    }

    return wins;
  }

  private getBplRoundWinnerPlayerId(roundIndex: number): string | null {
    const [firstPlayerId, secondPlayerId] = this.matchPlayerIds;
    if (firstPlayerId === undefined || secondPlayerId === undefined) {
      return null;
    }

    const roundConfirmations = this.roundConfirmations.get(roundIndex) ?? [];
    const firstResult = roundConfirmations.find((entry) => entry.player_id === firstPlayerId);
    const secondResult = roundConfirmations.find((entry) => entry.player_id === secondPlayerId);
    if (firstResult === undefined || secondResult === undefined) {
      return null;
    }

    const comparison = this.compareMetricValues(firstResult.metric_value, secondResult.metric_value);
    if (comparison === 0) {
      return null;
    }

    return comparison > 0 ? firstPlayerId : secondPlayerId;
  }

  private compareMetricValues(left: number, right: number): number {
    if (left === right) {
      return 0;
    }

    if (this.settings.win_metric === "SCORE") {
      return left > right ? 1 : -1;
    }

    return left < right ? 1 : -1;
  }

  private getArenaPointsForRank(rank: number): number {
    if (rank === 1) {
      return 2;
    }

    if (rank === 2) {
      return 1;
    }

    return 0;
  }

  private getPlayerDisplayName(playerId: string): string {
    return this.players.get(playerId)?.display_name ?? playerId;
  }

  private buildResultReadyPayload(): ResultReadyPayload {
    const matchId = this.currentMatchId ?? this.roomId;

    const completedRounds = this.frozenRounds.filter((round) => round.started_at !== null).length;

    if (this.settings.mode === "ARENA") {
      const perPlayerRounds = new Map<string, ResultReadyArenaRoundPlayerResult[]>();
      const totalPoints = new Map<string, number>();
      const totalExScore = new Map<string, number | null>();
      const lastConfirmedAt = new Map<string, string | null>();
      for (const playerId of this.matchPlayerIds) {
        perPlayerRounds.set(playerId, []);
        totalPoints.set(playerId, 0);
        totalExScore.set(playerId, 0);
        lastConfirmedAt.set(playerId, null);
      }

      const rounds = this.frozenRounds.map((round) => {
        const roundConfirmations = this.roundConfirmations.get(round.round_index) ?? [];
        const confirmationByPlayer = new Map(roundConfirmations.map((entry) => [entry.player_id, entry]));
        const rankedPlayers = this.matchPlayerIds
          .map((playerId) => {
            const confirmation = confirmationByPlayer.get(playerId);
            return {
              player_id: playerId,
              confirmation,
            };
          })
          .filter(
            (entry): entry is { player_id: string; confirmation: RoundConfirmationEvent } =>
              entry.confirmation !== undefined,
          )
          .sort((left, right) => {
            const comparison = this.compareMetricValues(
              left.confirmation.metric_value,
              right.confirmation.metric_value,
            );
            if (comparison !== 0) {
              return comparison > 0 ? -1 : 1;
            }

            return left.player_id.localeCompare(right.player_id);
          });

        const rankByPlayerId = new Map<string, number>();
        let previousMetricValue: number | null = null;
        let previousRank = 0;
        rankedPlayers.forEach((entry, index) => {
          if (previousMetricValue !== null && entry.confirmation.metric_value === previousMetricValue) {
            rankByPlayerId.set(entry.player_id, previousRank);
            return;
          }

          const rank = index + 1;
          previousMetricValue = entry.confirmation.metric_value;
          previousRank = rank;
          rankByPlayerId.set(entry.player_id, rank);
        });

        const results = this.matchPlayerIds.map((playerId) => {
          const confirmation = confirmationByPlayer.get(playerId);
          const rank = confirmation === undefined ? null : (rankByPlayerId.get(playerId) ?? null);
          const arenaPoints = rank === null ? 0 : this.getArenaPointsForRank(rank);
          totalPoints.set(playerId, (totalPoints.get(playerId) ?? 0) + arenaPoints);
          const exScore = getConfirmationExScore(confirmation, this.settings.win_metric);
          totalExScore.set(
            playerId,
            exScore === null || totalExScore.get(playerId) === null ? null : (totalExScore.get(playerId) ?? 0) + exScore,
          );
          if (
            confirmation?.submitted_at !== undefined &&
            ((lastConfirmedAt.get(playerId) ?? null) === null || (lastConfirmedAt.get(playerId) ?? "") < confirmation.submitted_at)
          ) {
            lastConfirmedAt.set(playerId, confirmation.submitted_at);
          }

          const roundResult: ResultReadyArenaRoundPlayerResult = {
            round_index: round.round_index,
            player_id: playerId,
            display_name: this.getPlayerDisplayName(playerId),
            status: confirmation?.status ?? null,
            metric_value: confirmation?.metric_value ?? null,
            reason: confirmation?.reason ?? null,
            submitted_at: confirmation?.submitted_at ?? null,
            submitted_by: confirmation?.submitted_by ?? null,
            source_meta: confirmation?.source_meta ?? null,
            rank,
            arena_points: arenaPoints,
          };
          perPlayerRounds.get(playerId)?.push(roundResult);
          return roundResult;
        });

        const winnerPlayerIds = results
          .filter((entry) => entry.rank === 1)
          .map((entry) => entry.player_id);

        return {
          round_index: round.round_index,
          expected_key: cloneExpectedKey(round.expected_key),
          display: {
            title: round.display.title,
            level: round.display.level,
          },
          round_started_at: round.started_at,
          played: round.started_at !== null,
          winner_player_ids: winnerPlayerIds,
          results,
        };
      });

      const players = this.matchPlayerIds.map((playerId) => ({
        player_id: playerId,
        display_name: this.getPlayerDisplayName(playerId),
        total_points: totalPoints.get(playerId) ?? 0,
        total_ex_score: totalExScore.get(playerId) ?? null,
        last_confirmed_at: lastConfirmedAt.get(playerId) ?? null,
        rounds: perPlayerRounds.get(playerId) ?? [],
      }));
      const winnerPlayerIds = resolveArenaWinnerPlayerIds(players);
      const ratingDecision = evaluateResultRating({
        visibility: this.settings.visibility,
        total_rounds: this.frozenRounds.length,
        completed_rounds: completedRounds,
        winner_player_ids: winnerPlayerIds,
        rounds: rounds.map((round) => ({
          played: round.played,
          results: round.results.map((result) => ({
            status: result.status,
          })),
        })),
        mismatch_observed_key: this.resultKeyMismatchDetected,
        force_advanced: this.forceAdvancedRoundIndices.size > 0,
      });

      return {
        summary: {
          match_id: matchId,
          mode: this.settings.mode === "ARENA" ? "ARENA" : "BPL",
          win_metric: this.settings.win_metric,
          total_rounds: this.frozenRounds.length,
          completed_rounds: completedRounds,
          winner_player_ids: winnerPlayerIds,
          is_draw: winnerPlayerIds.length !== 1,
          ...ratingDecision,
        },
        per_round: {
          rounds,
        },
        per_player: {
          players,
        },
      };
    }

    const perPlayerRounds = new Map<string, ResultReadyBplRoundPlayerResult[]>();
    for (const playerId of this.matchPlayerIds) {
      perPlayerRounds.set(playerId, []);
    }

    const roundWins = this.computeBplWins(this.frozenRounds.length - 1);
    const rounds = this.frozenRounds.map((round) => {
      const roundConfirmations = this.roundConfirmations.get(round.round_index) ?? [];
      const confirmationByPlayer = new Map(roundConfirmations.map((entry) => [entry.player_id, entry]));
      const winnerPlayerId = this.getBplRoundWinnerPlayerId(round.round_index);
      const results = this.matchPlayerIds.map((playerId) => {
        const confirmation = confirmationByPlayer.get(playerId);
        const roundResult: ResultReadyBplRoundPlayerResult = {
          round_index: round.round_index,
          player_id: playerId,
          display_name: this.getPlayerDisplayName(playerId),
          status: confirmation?.status ?? null,
          metric_value: confirmation?.metric_value ?? null,
          reason: confirmation?.reason ?? null,
          submitted_at: confirmation?.submitted_at ?? null,
          submitted_by: confirmation?.submitted_by ?? null,
          source_meta: confirmation?.source_meta ?? null,
          round_win: winnerPlayerId === playerId,
        };
        perPlayerRounds.get(playerId)?.push(roundResult);
        return roundResult;
      });

      return {
        round_index: round.round_index,
        expected_key: cloneExpectedKey(round.expected_key),
        display: {
          title: round.display.title,
          level: round.display.level,
        },
        round_started_at: round.started_at,
        played: round.started_at !== null,
        winner_player_ids: winnerPlayerId === null ? [] : [winnerPlayerId],
        results,
      };
    });

    const players = this.matchPlayerIds.map((playerId) => ({
      player_id: playerId,
      display_name: this.getPlayerDisplayName(playerId),
      round_wins: roundWins.get(playerId) ?? 0,
      rounds: perPlayerRounds.get(playerId) ?? [],
    }));
    const highestWins = players.reduce((maxValue, player) => Math.max(maxValue, player.round_wins), 0);
    const winnerPlayerIds = players
      .filter((player) => player.round_wins === highestWins)
      .map((player) => player.player_id);
    const ratingDecision = evaluateResultRating({
      visibility: this.settings.visibility,
      total_rounds: this.frozenRounds.length,
      completed_rounds: completedRounds,
      winner_player_ids: winnerPlayerIds,
      rounds: rounds.map((round) => ({
        played: round.played,
        results: round.results.map((result) => ({
          status: result.status,
        })),
      })),
      mismatch_observed_key: this.resultKeyMismatchDetected,
      force_advanced: this.forceAdvancedRoundIndices.size > 0,
    });

    return {
      summary: {
        match_id: matchId,
        mode: "BPL",
        win_metric: this.settings.win_metric,
        total_rounds: this.frozenRounds.length,
        completed_rounds: completedRounds,
        winner_player_ids: winnerPlayerIds,
        is_draw: winnerPlayerIds.length !== 1,
        ...ratingDecision,
      },
      per_round: {
        rounds,
      },
      per_player: {
        players,
      },
    };
  }
}
