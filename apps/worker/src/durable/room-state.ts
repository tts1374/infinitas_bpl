import {
  BPL_ROUNDS,
  HOST_SKIP_UNLOCK_SECONDS,
  MATCH_TTL_MINUTES,
  READY_CHECK_TTL_MINUTES,
  REJOIN_COOLDOWN_SECONDS,
  RESULT_TTL_MINUTES,
  ROUND_SOFT_TTL_SECONDS,
  START_MIN_PLAYERS,
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
  reason?: "ROOM_CLOSED" | "ROOM_FULL" | "ROOM_JOIN_LOCKED";
}

export interface LeavePlayerResult {
  changed: boolean;
  was_host: boolean;
}

export interface ReadyCheckOpenResult {
  ok: boolean;
  reason?: "INVALID_STATE" | "NOT_HOST";
  ready_check_deadline?: Date;
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
    | "BPL_REQUIRES_TWO_PLAYERS";
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

export interface RoundConfirmationEvent {
  round_index: number;
  player_id: string;
  status: SubmissionStatus;
  metric_value: number;
  reason: SubmissionReason;
  submitted_at: string;
  submitted_by: SubmittedBy;
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

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function computeMatchDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MATCH_TTL_MINUTES * 60_000);
}

function computeReadyCheckDeadline(openedAt: Date): Date {
  return new Date(openedAt.getTime() + READY_CHECK_TTL_MINUTES * 60_000);
}

function computeResultDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + RESULT_TTL_MINUTES * 60_000);
}

function computeRejoinUntil(now: Date): Date {
  return new Date(now.getTime() + REJOIN_COOLDOWN_SECONDS * 1_000);
}

function canNewPlayerJoin(roomState: RoomState): roomState is "LOBBY" | "READY_CHECK" {
  return roomState === "LOBBY" || roomState === "READY_CHECK";
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
  };
}

export class RoomLobbyState {
  private initialized = false;
  private roomId = "";
  private roomState: RoomState = "LOBBY";
  private settings: RoomSettings = { ...DEFAULT_SETTINGS };
  private hostPlayerId: string | null = null;
  private createdAt = new Date();
  private matchDeadline = computeMatchDeadline(this.createdAt);
  private readyCheckDeadline: Date | null = null;
  private resultDeadline: Date | null = null;
  private closedAt: Date | null = null;
  private closeReason: string | null = null;
  private readonly players = new Map<string, InternalPlayer>();
  private readonly picks: InternalPick[] = [];
  private readonly roundConfirmations = new Map<number, RoundConfirmationEvent[]>();
  private frozenRounds: FrozenRound[] = [];
  private currentRound: CurrentRoundSnapshot | null = null;
  private matchPlayerIds: string[] = [];
  private resultReadyPayload: ResultReadyPayload | null = null;

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
    this.settings = { ...input.settings };
    this.createdAt = createdAt;
    this.matchDeadline = computeMatchDeadline(createdAt);
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
    if (this.roomState === "CLOSED") {
      return { ok: false, reason: "ROOM_CLOSED" };
    }

    const existing = this.players.get(input.player_id);
    if (!existing && !canNewPlayerJoin(this.roomState)) {
      return { ok: false, reason: "ROOM_JOIN_LOCKED" };
    }

    if (!existing && this.players.size >= this.settings.max_players) {
      return { ok: false, reason: "ROOM_FULL" };
    }

    if (existing) {
      existing.display_name = input.display_name;
      existing.source = input.source;
      existing.connected = true;
      existing.left_at = null;
      existing.rejoin_until = null;
      return { ok: true };
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

    return { ok: true };
  }

  leavePlayer(playerId: string, now: Date): LeavePlayerResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { changed: false, was_host: false };
    }

    const wasHost = this.hostPlayerId === playerId;
    player.connected = false;
    player.left_at = now;

    if (canNewPlayerJoin(this.roomState)) {
      this.players.delete(playerId);
    } else {
      player.rejoin_until = computeRejoinUntil(now);
    }

    if (wasHost) {
      this.close("HOST_LEFT", now);
    }

    return { changed: true, was_host: wasHost };
  }

  openReadyCheck(playerId: string, now: Date): ReadyCheckOpenResult {
    if (playerId !== this.hostPlayerId) {
      return { ok: false, reason: "NOT_HOST" };
    }

    if (this.roomState !== "LOBBY") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    this.roomState = "READY_CHECK";
    this.readyCheckDeadline = computeReadyCheckDeadline(now);
    for (const player of this.players.values()) {
      player.ready = false;
    }

    return {
      ok: true,
      ready_check_deadline: this.readyCheckDeadline,
    };
  }

  setPlayerReady(playerId: string, ready: boolean): ReadySetResult {
    if (this.roomState !== "READY_CHECK") {
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

    if (this.roomState !== "READY_CHECK") {
      return { ok: false, reason: "INVALID_STATE" };
    }

    if (this.players.size < START_MIN_PLAYERS) {
      return { ok: false, reason: "START_REQUIRES_MIN_PLAYERS" };
    }

    if (this.settings.mode === "BPL" && this.players.size !== 2) {
      return { ok: false, reason: "BPL_REQUIRES_TWO_PLAYERS" };
    }

    this.roomState = "PICKING";
    this.readyCheckDeadline = null;
    this.matchDeadline = computeMatchDeadline(now);
    this.resultDeadline = null;
    this.matchPlayerIds = this.getPlayersInJoinOrder().map((player) => player.player_id);
    this.picks.length = 0;
    this.roundConfirmations.clear();
    this.frozenRounds = [];
    this.currentRound = null;
    this.resultReadyPayload = null;

    for (const player of this.players.values()) {
      player.ready = false;
    }

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
    if (this.roomState === "READY_CHECK" && this.readyCheckDeadline !== null) {
      return this.readyCheckDeadline;
    }

    if (this.roomState === "PICKING") {
      return this.matchDeadline;
    }

    if (this.roomState === "RESULT" && this.resultDeadline !== null) {
      return this.resultDeadline;
    }

    if (this.roomState !== "PLAYING" || this.currentRound === null) {
      return null;
    }

    const currentRoundDeadline = this.getCurrentRoundDeadline();
    if (currentRoundDeadline === null) {
      return this.matchDeadline;
    }

    return currentRoundDeadline.getTime() <= this.matchDeadline.getTime()
      ? currentRoundDeadline
      : this.matchDeadline;
  }

  submitResult(
    playerId: string,
    roundIndex: number,
    observedKey: ExpectedKey,
    metricValue: number,
    _sourceMeta: JsonObject | null,
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

  closeReadyCheckIfExpired(now: Date): boolean {
    if (
      this.roomState !== "READY_CHECK" ||
      this.readyCheckDeadline === null ||
      now.getTime() < this.readyCheckDeadline.getTime()
    ) {
      return false;
    }

    this.close("READY_CHECK_TIMEOUT", now);
    return true;
  }

  closeResultIfExpired(now: Date): boolean {
    if (
      this.roomState !== "RESULT" ||
      this.resultDeadline === null ||
      now.getTime() < this.resultDeadline.getTime()
    ) {
      return false;
    }

    this.close("RESULT_TIMEOUT", now);
    return true;
  }

  expireMatchIfNeeded(now: Date): RoundTransitionResult | null {
    if ((this.roomState !== "PICKING" && this.roomState !== "PLAYING") || now.getTime() < this.matchDeadline.getTime()) {
      return null;
    }

    if (this.roomState === "PICKING" || this.currentRound === null) {
      this.enterResult(now);
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

  close(reason: string, now: Date): void {
    if (this.roomState === "CLOSED") {
      return;
    }

    this.roomState = "CLOSED";
    this.readyCheckDeadline = null;
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
        match_deadline: this.matchDeadline.toISOString(),
        result_deadline: toIsoString(this.resultDeadline),
      },
      created_at: this.createdAt.toISOString(),
      closed_at: toIsoString(this.closedAt),
      close_reason: this.closeReason,
    };
  }

  private getCurrentRoundDeadline(): Date | null {
    if (this.currentRound === null) {
      return null;
    }

    const roundStartedAt = new Date(this.currentRound.round_started_at);
    if (!Number.isFinite(roundStartedAt.getTime())) {
      return null;
    }

    return new Date(roundStartedAt.getTime() + this.currentRound.soft_ttl_seconds * 1_000);
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
  }): RoundConfirmationEvent {
    return {
      round_index: input.round_index,
      player_id: input.player_id,
      status: input.status,
      metric_value: input.metric_value,
      reason: input.reason,
      submitted_by: input.submitted_by,
      submitted_at: input.submitted_at.toISOString(),
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
      this.enterResult(now);
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
    this.roomState = "RESULT";
    this.currentRound = null;
    this.resultDeadline = computeResultDeadline(now);
    this.resultReadyPayload = this.buildResultReadyPayload();
  }

  private getPlayersInJoinOrder(): InternalPlayer[] {
    return Array.from(this.players.values()).sort(
      (left, right) => left.joined_at.getTime() - right.joined_at.getTime(),
    );
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
    const randomChart = this.chartMaster.pickRandomUnusedChart({
      play_style: this.settings.play_style,
      level_filter: this.settings.level_filter,
      used_chart_keys: usedKeys,
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

    const roundStartedAt = now.toISOString();
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
    return this.currentRound;
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

    const roundWins = this.computeBplWins(roundIndex);
    return Array.from(roundWins.values()).some((wins) => wins >= 2);
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
      for (const playerId of this.matchPlayerIds) {
        totalPoints.set(playerId, 0);
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

          const roundResult = {
            round_index: round.round_index,
            player_id: playerId,
            display_name: this.getPlayerDisplayName(playerId),
            status: confirmation?.status ?? null,
            metric_value: confirmation?.metric_value ?? null,
            reason: confirmation?.reason ?? null,
            submitted_at: confirmation?.submitted_at ?? null,
            submitted_by: confirmation?.submitted_by ?? null,
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
        rounds: perPlayerRounds.get(playerId) ?? [],
      }));
      const highestPoints = players.reduce((maxValue, player) => Math.max(maxValue, player.total_points), 0);
      const winnerPlayerIds = players
        .filter((player) => player.total_points === highestPoints)
        .map((player) => player.player_id);

      return {
        summary: {
          mode: this.settings.mode,
          win_metric: this.settings.win_metric,
          total_rounds: this.frozenRounds.length,
          completed_rounds: completedRounds,
          winner_player_ids: winnerPlayerIds,
          is_draw: winnerPlayerIds.length !== 1,
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

    return {
      summary: {
        mode: this.settings.mode,
        win_metric: this.settings.win_metric,
        total_rounds: this.frozenRounds.length,
        completed_rounds: completedRounds,
        winner_player_ids: winnerPlayerIds,
        is_draw: winnerPlayerIds.length !== 1,
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
