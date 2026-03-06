import {
  BPL_ROUNDS,
  CHART_DIFFICULTIES,
  MATCH_TTL_MINUTES,
  READY_CHECK_TTL_MINUTES,
  REJOIN_COOLDOWN_SECONDS,
  ROUND_SOFT_TTL_SECONDS,
  START_MIN_PLAYERS,
  type ChartDifficulty,
  type CurrentRoundSnapshot,
  type ExpectedKey,
  type FrozenRound,
  type PlayerRole,
  type PlayStyle,
  type RoomSettings,
  type RoomState,
  type RoomStateSnapshot,
  type SourceType,
} from "@infinitas/shared";

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

interface ParsedPickChartKey {
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

function computeRejoinUntil(now: Date): Date {
  return new Date(now.getTime() + REJOIN_COOLDOWN_SECONDS * 1_000);
}

function canNewPlayerJoin(roomState: RoomState): roomState is "LOBBY" | "READY_CHECK" {
  return roomState === "LOBBY" || roomState === "READY_CHECK";
}

function isChartDifficulty(value: unknown): value is ChartDifficulty {
  return typeof value === "string" && CHART_DIFFICULTIES.includes(value as ChartDifficulty);
}

function normalizeTitleSearchKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+\(/g, "(")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseLevel(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }

  return null;
}

function parsePickChartKeyJson(value: string, playStyle: PlayStyle): ParsedPickChartKey | null {
  if (!value.startsWith("{")) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (!isChartDifficulty(record.difficulty) || typeof record.title_search_key !== "string") {
    return null;
  }

  const titleSearchKey = normalizeTitleSearchKey(record.title_search_key);
  if (titleSearchKey.length === 0) {
    return null;
  }

  const title =
    typeof record.title === "string" && record.title.trim().length > 0
      ? record.title.trim()
      : record.title_search_key;

  return {
    expected_key: {
      play_style: playStyle,
      difficulty: record.difficulty,
      title_search_key: titleSearchKey,
    },
    display: {
      title,
      level: parseLevel(record.level),
    },
  };
}

function parsePickChartKeyDelimited(value: string, playStyle: PlayStyle): ParsedPickChartKey | null {
  const delimiter = value.includes("::") ? "::" : value.includes("|") ? "|" : null;
  if (delimiter === null) {
    return null;
  }

  const segments = value.split(delimiter).map((segment) => segment.trim());
  const difficulty = segments[0];
  const rawTitleSearchKey = segments[1];
  const rawTitle = segments[2];
  const rawLevel = segments[3];

  if (
    segments.length < 2 ||
    difficulty === undefined ||
    rawTitleSearchKey === undefined ||
    !isChartDifficulty(difficulty)
  ) {
    return null;
  }

  const titleSearchKey = normalizeTitleSearchKey(rawTitleSearchKey);
  if (titleSearchKey.length === 0) {
    return null;
  }

  const title = rawTitle && rawTitle.length > 0 ? rawTitle : rawTitleSearchKey;

  return {
    expected_key: {
      play_style: playStyle,
      difficulty,
      title_search_key: titleSearchKey,
    },
    display: {
      title,
      level: parseLevel(rawLevel),
    },
  };
}

function parsePickChartKey(value: string, playStyle: PlayStyle): ParsedPickChartKey | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  return (
    parsePickChartKeyJson(trimmedValue, playStyle) ?? parsePickChartKeyDelimited(trimmedValue, playStyle)
  );
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
  private frozenRounds: FrozenRound[] = [];
  private currentRound: CurrentRoundSnapshot | null = null;
  private matchPlayerIds: string[] = [];

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
    this.matchPlayerIds = this.getPlayersInJoinOrder().map((player) => player.player_id);
    this.picks.length = 0;
    this.frozenRounds = [];
    this.currentRound = null;

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

    const parsedPick = parsePickChartKey(pickChartKey, this.settings.play_style);
    if (parsedPick === null) {
      return { ok: false, reason: "INVALID_PICK_CHART_KEY" };
    }

    const resolvedPick = this.resolveDuplicatePick(playerId, pickChartKey.trim(), parsedPick, now);
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

  close(reason: string, now: Date): void {
    if (this.roomState === "CLOSED") {
      return;
    }

    this.roomState = "CLOSED";
    this.readyCheckDeadline = null;
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

  private getPlayersInJoinOrder(): InternalPlayer[] {
    return Array.from(this.players.values()).sort(
      (left, right) => left.joined_at.getTime() - right.joined_at.getTime(),
    );
  }

  private resolveDuplicatePick(
    playerId: string,
    pickChartKey: string,
    parsedPick: ParsedPickChartKey,
    acceptedAt: Date,
  ): InternalPick {
    const usedKeys = new Set(this.picks.map((pick) => expectedKeyId(pick.expected_key)));
    let expectedKey = cloneExpectedKey(parsedPick.expected_key);
    let display = {
      title: parsedPick.display.title,
      level: parsedPick.display.level,
    };
    let resolvedPickChartKey = pickChartKey;

    let duplicateIndex = 0;
    while (usedKeys.has(expectedKeyId(expectedKey))) {
      duplicateIndex += 1;
      expectedKey = {
        play_style: expectedKey.play_style,
        difficulty: expectedKey.difficulty,
        title_search_key: `${parsedPick.expected_key.title_search_key}__auto_${duplicateIndex}`,
      };
      display = {
        title: `${parsedPick.display.title} [AUTO ${duplicateIndex}]`,
        level: parsedPick.display.level,
      };
      resolvedPickChartKey = `${pickChartKey}#AUTO_${duplicateIndex}`;
    }

    return {
      player_id: playerId,
      pick_chart_key: resolvedPickChartKey,
      accepted_at: acceptedAt,
      expected_key: expectedKey,
      display,
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

    // PR-5 has no chart master yet, so the BPL random slot is a synthetic unique placeholder.
    const randomRound = this.buildSyntheticRandomRound(rounds.length, rounds);
    rounds.push(randomRound);

    return rounds.slice(0, BPL_ROUNDS);
  }

  private buildSyntheticRandomRound(roundIndex: number, existingRounds: FrozenRound[]): FrozenRound {
    const usedKeys = new Set(existingRounds.map((round) => expectedKeyId(round.expected_key)));
    const baseDifficulty = existingRounds[0]?.expected_key.difficulty ?? "ANOTHER";
    let suffix = 1;
    let expectedKey: ExpectedKey = {
      play_style: this.settings.play_style,
      difficulty: baseDifficulty,
      title_search_key: `random-${roundIndex + 1}`,
    };

    while (usedKeys.has(expectedKeyId(expectedKey))) {
      suffix += 1;
      expectedKey = {
        play_style: this.settings.play_style,
        difficulty: baseDifficulty,
        title_search_key: `random-${roundIndex + 1}-${suffix}`,
      };
    }

    return {
      round_index: roundIndex,
      expected_key: expectedKey,
      display: {
        title: `RANDOM ${roundIndex + 1}`,
        level: null,
      },
      started_at: null,
      soft_ttl_seconds: ROUND_SOFT_TTL_SECONDS,
    };
  }

  private beginFirstRound(now: Date): CurrentRoundSnapshot | null {
    if (this.frozenRounds.length === 0) {
      return null;
    }

    const roundStartedAt = now.toISOString();
    const firstRoundSource = this.frozenRounds[0];
    if (firstRoundSource === undefined) {
      return null;
    }

    const firstRound = cloneFrozenRound(firstRoundSource);
    firstRound.started_at = roundStartedAt;
    this.frozenRounds = [firstRound, ...this.frozenRounds.slice(1).map(cloneFrozenRound)];
    this.roomState = "PLAYING";
    this.currentRound = {
      round_index: firstRound.round_index,
      expected_key: cloneExpectedKey(firstRound.expected_key),
      round_started_at: roundStartedAt,
      soft_ttl_seconds: firstRound.soft_ttl_seconds,
      confirmed: [],
    };
    return this.currentRound;
  }
}
