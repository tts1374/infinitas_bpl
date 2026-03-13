import {
  BPL_ROUNDS,
  HOST_SKIP_UNLOCK_SECONDS,
  MATCH_TTL_MINUTES,
  PICKING_TTL_SECONDS,
  READY_CHECK_TTL_MINUTES,
  REJOIN_COOLDOWN_SECONDS,
  ROUND_PLAY_BEGIN_AT_SECONDS,
  ROUND_SOFT_TTL_SECONDS,
  START_MIN_PLAYERS,
  type CloseReason,
  type CurrentRoundSnapshot,
  type ExpectedKey,
  type FrozenRound,
  type JsonObject,
  type PlayerRole,
  type ResultReadyPayload,
  type RoomSettings,
  type RoomState,
  type RoomStateSnapshot,
  type SkipReason,
  type SourceType,
  type SubmissionReason,
  type SubmissionStatus,
  type SubmittedBy,
  type WinMetric,
} from "@infinitas/shared";
import type { ResolvedMasterChart, RoomChartMaster } from "../master/chart-master";
import { evaluateResultRating } from "./result-rating";

const BPL_PICK_CUTIN_DELAY_SECONDS = 3;
const BPL_RESULT_PHASE_DELAY_SECONDS = 10;
const ARENA_RESULT_PHASE_DELAY_SECONDS = 10;

interface InternalPlayer {
  player_id: string;
  display_name: string;
  source: SourceType;
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
    | "START_REQUIRES_MIN_PLAYERS"
    | "NOT_ALL_PLAYERS_READY"
    | "PREVIOUS_MATCH_NOT_CLEARED"
    | "BPL_REQUIRES_TWO_PLAYERS";
}

export interface ReturnToLobbyResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "NOT_HOST";
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

export interface RoomStatePersistenceRecord {
  version: 1;
  initialized: boolean;
  room_id: string;
  room_state: RoomState | "READY_CHECK";
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
  result_ready_payload: ResultReadyPayload | null;
  result_key_mismatch_detected?: boolean;
  force_advanced_round_indices?: number[];
}

const DEFAULT_SETTINGS: RoomSettings = {
  visibility: "PUBLIC",
  join_code: null,
  mode: "ARENA",
  win_metric: "SCORE",
  play_style: "SP",
  level_filter: "ANY",
  room_comment: "",
  max_players: 4,
};

function normalizeSettingsVisibility(settings: RoomSettings): RoomSettings {
  const visibility = settings.visibility as RoomSettings["visibility"] | "UNLISTED";
  return {
    ...settings,
    visibility: visibility === "UNLISTED" ? "PRIVATE" : visibility,
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

function computeMatchDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MATCH_TTL_MINUTES * 60_000);
}

function computeReadyCheckDeadline(openedAt: Date): Date {
  return new Date(openedAt.getTime() + READY_CHECK_TTL_MINUTES * 60_000);
}

function computePickingDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + PICKING_TTL_SECONDS * 1_000);
}

function computeRejoinUntil(now: Date): Date {
  return new Date(now.getTime() + REJOIN_COOLDOWN_SECONDS * 1_000);
}

function canNewPlayerJoin(roomState: RoomState): roomState is "LOBBY" {
  return roomState === "LOBBY";
}

function expectedKeyId(expectedKey: ExpectedKey): string {
  return `${expectedKey.play_style}::${expectedKey.difficulty}::${expectedKey.title_search_key}`;
}

function cloneExpectedKey(expectedKey: ExpectedKey): ExpectedKey {
  return {
    play_style: expectedKey.play_style,
    difficulty: expectedKey.difficulty,
    title_search_key: expectedKey.title_search_key,
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
  private resultReadyPayload: ResultReadyPayload | null = null;
  private resultKeyMismatchDetected = false;
  private readonly forceAdvancedRoundIndices = new Set<number>();

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
    this.settings = normalizeSettingsVisibility({ ...input.settings });
    this.createdAt = createdAt;
    this.roomState = "LOBBY";
    this.readyCheckDeadline = computeReadyCheckDeadline(createdAt);
    this.matchDeadline = null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRoomId(): string {
    return this.roomId;
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
      existing.connected = true;
      existing.left_at = null;
      existing.rejoin_until = null;
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
      connected: true,
      ready: false,
      role,
      joined_at: input.now,
      left_at: null,
      rejoin_until: null,
    });

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

    if (wasHost && !roomWasClosed && hostCloseReason === "HOST_ABORTED") {
      this.close("HOST_ABORTED", now);
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

    if (this.settings.mode === "BPL" && this.players.size !== 2) {
      return { ok: false, reason: "BPL_REQUIRES_TWO_PLAYERS" };
    }

    this.roomState = "PICKING";
    this.readyCheckDeadline = null;
    this.pickingDeadline = computePickingDeadline(now);
    this.matchDeadline = computeMatchDeadline(now);
    this.resultDeadline = null;
    this.closedAt = null;
    this.closeReason = null;
    this.matchPlayerIds = this.getPlayersInJoinOrder().map((player) => player.player_id);
    this.picks.length = 0;
    this.roundConfirmations.clear();
    this.frozenRounds = [];
    this.currentRound = null;
    this.resultReadyPayload = null;
    this.resultKeyMismatchDetected = false;
    this.forceAdvancedRoundIndices.clear();

    for (const player of this.players.values()) {
      player.ready = false;
    }

    return { ok: true };
  }

  returnToLobby(playerId: string, now: Date): ReturnToLobbyResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST" };
    }

    if (this.roomState !== "RESULT") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    this.resetLobbyState(now);
    return { ok: true };
  }

  submitPick(playerId: string, pickChartKey: string, now: Date): PickSubmitResult {
    if (this.roomState !== "PICKING") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (!this.matchPlayerIds.includes(playerId)) {
      return { ok: false, reason: "PLAYER_NOT_FOUND" };
    }

    if (this.picks.some((pick) => pick.player_id === playerId)) {
      return { ok: false, reason: "PLAYER_ALREADY_PICKED" };
    }

    const resolvedChart = this.chartMaster.resolvePickChartKey(
      pickChartKey,
      this.settings.play_style,
      this.settings.level_filter,
    );
    if (resolvedChart === null) {
      return { ok: false, reason: "INVALID_PICK_CHART_KEY" };
    }

    const resolvedPick = this.resolveDuplicatePick(playerId, pickChartKey.trim(), resolvedChart, now);
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

    if (this.picks.length < this.matchPlayerIds.length) {
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

    if (this.roomState === "RESULT" && this.matchDeadline !== null) {
      baseAlarm = this.matchDeadline;
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
    const missingPlayerIds = this.matchPlayerIds.filter(
      (playerId) => !this.picks.some((pick) => pick.player_id === playerId),
    );
    const acceptedPicks: PickingTimeoutResult["accepted_picks"] = [];

    for (const [index, playerId] of missingPlayerIds.entries()) {
      const acceptedAt = new Date(now.getTime() + index);
      const autoPick = this.chartMaster.pickRandomUnusedChart({
        play_style: this.settings.play_style,
        level_filter: this.settings.level_filter,
        used_chart_keys: usedChartKeys,
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
  }

  toSnapshot(): RoomStateSnapshot {
    const players = this.getPlayersInJoinOrder().map((player) => ({
      player_id: player.player_id,
      display_name: player.display_name,
      source: player.source,
      connected: player.connected,
      ready: player.ready,
      role: player.role,
      joined_at: player.joined_at.toISOString(),
      left_at: toIsoString(player.left_at),
      rejoin_until: toIsoString(player.rejoin_until),
    }));

    return {
      room_id: this.roomId,
      room_state: this.roomState,
      settings: this.settings,
      host_player_id: this.hostPlayerId ?? "",
      players,
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
      room_state: this.roomState,
      settings: { ...this.settings },
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
      result_ready_payload: this.resultReadyPayload,
      result_key_mismatch_detected: this.resultKeyMismatchDetected,
      force_advanced_round_indices: Array.from(this.forceAdvancedRoundIndices).sort((left, right) => left - right),
    };
  }

  hydrate(record: RoomStatePersistenceRecord): void {
    if (!record.initialized) {
      return;
    }

    this.initialized = true;
    this.roomId = record.room_id;
    this.roomState = record.room_state === "READY_CHECK" ? "LOBBY" : record.room_state;
    this.settings = normalizeSettingsVisibility({ ...record.settings });
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
    this.resultReadyPayload = record.result_ready_payload;
    this.resultKeyMismatchDetected = record.result_key_mismatch_detected === true;
    this.forceAdvancedRoundIndices.clear();
    for (const roundIndex of record.force_advanced_round_indices ?? []) {
      this.forceAdvancedRoundIndices.add(roundIndex);
    }
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
    return expectedKeyId(left) === expectedKeyId(right);
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

  private enterResult(_now: Date): void {
    this.resultReadyPayload = this.buildResultReadyPayload();
    this.currentRound = null;
    this.roomState = "RESULT";
    this.readyCheckDeadline = null;
    this.pickingDeadline = null;
    this.resultDeadline = null;
    this.closeReason = null;
    this.closedAt = null;
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
    this.resultReadyPayload = null;
    this.resultKeyMismatchDetected = false;
    this.forceAdvancedRoundIndices.clear();

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
  ): InternalPick | null {
    const usedKeys = new Set(this.picks.map((pick) => pick.pick_chart_key));
    let selectedChart = resolvedChart;

    if (usedKeys.has(selectedChart.chart_key)) {
      const replacementChart = this.chartMaster.pickRandomUnusedChart({
        play_style: this.settings.play_style,
        level_filter: this.settings.level_filter,
        used_chart_keys: usedKeys,
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

    if (picksByAcceptedOrder.length < 2) {
      return [];
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

    const randomRound = this.buildMasterRandomRound(rounds.length, rounds);
    if (randomRound === null) {
      return [];
    }

    rounds.push(randomRound);

    return rounds.slice(0, BPL_ROUNDS);
  }

  private buildMasterRandomRound(roundIndex: number, existingRounds: FrozenRound[]): FrozenRound | null {
    const usedKeys = new Set(existingRounds.map((round) => expectedKeyId(round.expected_key)));
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
      used_chart_keys: usedKeys,
      preferred_level_min: levelMin,
      preferred_level_max: levelMax,
      enforce_level_range: true,
      seed: `${this.roomId}:random:${roundIndex}:${Array.from(usedKeys).sort().join("|")}`,
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
    if (this.settings.mode === "BPL") {
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
    if (this.settings.mode !== "BPL") {
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
    const perPlayerRounds = new Map<string, Array<Record<string, unknown>>>();
    for (const playerId of this.matchPlayerIds) {
      perPlayerRounds.set(playerId, []);
    }

    const completedRounds = this.frozenRounds.filter((round) => round.started_at !== null).length;

    if (this.settings.mode === "ARENA") {
      const totalPoints = new Map<string, number>();
      const totalExScore = new Map<string, number | null>();
      const lastConfirmedAt = new Map<string, string | null>();
      for (const playerId of this.matchPlayerIds) {
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

          const roundResult = {
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
          mode: this.settings.mode,
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

    const roundWins = this.computeBplWins(this.frozenRounds.length - 1);
    const rounds = this.frozenRounds.map((round) => {
      const roundConfirmations = this.roundConfirmations.get(round.round_index) ?? [];
      const confirmationByPlayer = new Map(roundConfirmations.map((entry) => [entry.player_id, entry]));
      const winnerPlayerId = this.getBplRoundWinnerPlayerId(round.round_index);
      const results = this.matchPlayerIds.map((playerId) => {
        const confirmation = confirmationByPlayer.get(playerId);
        const roundResult = {
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
        mode: this.settings.mode,
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
