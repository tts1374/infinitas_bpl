import {
  LEVEL_FILTERS,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  SKIP_REASONS,
  SOURCE_TYPES,
  VISIBILITIES,
  WIN_METRICS,
  type ClientMessage,
  type ErrorCode,
  type ExpectedKey,
  type JsonObject,
  type RoomJoinPayload,
  type RoomSettings,
  type SkipReason,
  type ServerMessagePayloadMap,
  type ServerMessageType,
} from "@infinitas/shared";
import { deleteLobbyRoom } from "../kv/lobby-kv";
import { normalizeJoinCode } from "../services/join-code";
import type { WorkerEnv } from "../types/env";
import { asEnumValue, asOptionalString, isRecord } from "../utils/validation";
import { createServerEnvelope, decodeClientMessage } from "./ws-codec";
import {
  RoomLobbyState,
  type PickingTimeoutResult,
  type RoomInitializationInput,
  type RoundTransitionResult,
} from "./room-state";
import { workerChartMaster } from "../master/chart-master";

interface RoomSocketSession {
  socket: WebSocket;
  playerId: string | null;
}

interface DurableObjectStorageLike {
  deleteAlarm(): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

const IDEMPOTENCY_LOG_LIMIT = 300;
const OPEN_WEBSOCKET_STATE = 1;
const SWITCHING_PROTOCOLS_STATUS = 101;

function isWebSocketUpgradeRequest(request: Request): boolean {
  const upgrade = request.headers.get("upgrade");
  return typeof upgrade === "string" && upgrade.toLowerCase() === "websocket";
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function parseRoomSettings(value: unknown): RoomSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  const visibility = asEnumValue(value.visibility, VISIBILITIES);
  const joinCodeRaw = value.join_code;
  const mode = asEnumValue(value.mode, MODES);
  const winMetric = asEnumValue(value.win_metric, WIN_METRICS);
  const playStyle = asEnumValue(value.play_style, PLAY_STYLES);
  const levelFilter = asEnumValue(value.level_filter, LEVEL_FILTERS);
  const roomComment = asOptionalString(value.room_comment);
  const maxPlayers =
    value.max_players === 2 || value.max_players === 3 || value.max_players === 4
      ? value.max_players
      : undefined;

  if (
    visibility === undefined ||
    mode === undefined ||
    winMetric === undefined ||
    playStyle === undefined ||
    levelFilter === undefined ||
    roomComment === undefined ||
    maxPlayers === undefined ||
    !MAX_PLAYERS_OPTIONS.includes(maxPlayers)
  ) {
    return null;
  }

  if (joinCodeRaw !== null && typeof joinCodeRaw !== "string") {
    return null;
  }

  return {
    visibility,
    join_code: joinCodeRaw,
    mode,
    win_metric: winMetric,
    play_style: playStyle,
    level_filter: levelFilter,
    room_comment: roomComment,
    max_players: maxPlayers,
  };
}

function parseInitializationInput(payload: unknown): RoomInitializationInput | null {
  if (!isRecord(payload)) {
    return null;
  }

  const roomId = asOptionalString(payload.room_id);
  const createdAt = asOptionalString(payload.created_at);
  const settings = parseRoomSettings(payload.settings);

  if (!roomId || !createdAt || settings === null) {
    return null;
  }

  return {
    room_id: roomId,
    settings,
    created_at: createdAt,
  };
}

function parseRoomJoinPayload(payload: unknown): RoomJoinPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const displayNameRaw = asOptionalString(payload.display_name);
  const source = asEnumValue(payload.source, SOURCE_TYPES);
  const joinCode = asOptionalString(payload.join_code);

  const displayName = displayNameRaw?.trim() ?? "";
  if (displayName.length === 0 || source === undefined) {
    return null;
  }

  return {
    display_name: displayName,
    source,
    ...(joinCode === undefined ? {} : { join_code: joinCode }),
  };
}

function parseReadySetPayload(payload: unknown): { ready: boolean } | null {
  if (!isRecord(payload) || typeof payload.ready !== "boolean") {
    return null;
  }

  return {
    ready: payload.ready,
  };
}

function parsePickSubmitPayload(payload: unknown): { pick_chart_key: string } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const pickChartKeyRaw = asOptionalString(payload.pick_chart_key);
  const pickChartKey = pickChartKeyRaw?.trim() ?? "";
  if (pickChartKey.length === 0) {
    return null;
  }

  return {
    pick_chart_key: pickChartKey,
  };
}

function parseExpectedKey(value: unknown): ExpectedKey | null {
  if (!isRecord(value)) {
    return null;
  }

  const playStyle = asEnumValue(value.play_style, PLAY_STYLES);
  const difficulty = asOptionalString(value.difficulty)?.trim() ?? "";
  const titleSearchKey = asOptionalString(value.title_search_key)?.trim() ?? "";

  if (playStyle === undefined || difficulty.length === 0 || titleSearchKey.length === 0) {
    return null;
  }

  return {
    play_style: playStyle,
    difficulty,
    title_search_key: titleSearchKey,
  };
}

function parseResultSubmitPayload(
  payload: unknown,
): { round_index: number; observed_key: ExpectedKey; metric_value: number; source_meta: JsonObject | null } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const roundIndex = typeof payload.round_index === "number" ? payload.round_index : Number.NaN;
  const metricValue = typeof payload.metric_value === "number" ? payload.metric_value : Number.NaN;
  const observedKey = parseExpectedKey(payload.observed_key);
  const sourceMeta = payload.source_meta;
  if (
    !Number.isInteger(roundIndex) ||
    roundIndex < 0 ||
    !Number.isInteger(metricValue) ||
    metricValue < 0 ||
    observedKey === null ||
    (sourceMeta !== undefined && sourceMeta !== null && !isRecord(sourceMeta))
  ) {
    return null;
  }

  return {
    round_index: roundIndex,
    observed_key: observedKey,
    metric_value: metricValue,
    source_meta: sourceMeta === undefined || sourceMeta === null ? null : (sourceMeta as JsonObject),
  };
}

function parseSkipPayload(payload: unknown): { round_index: number; reason: SkipReason } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const roundIndex = typeof payload.round_index === "number" ? payload.round_index : Number.NaN;
  const reason = asEnumValue(payload.reason, SKIP_REASONS);
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || reason === undefined) {
    return null;
  }

  return {
    round_index: roundIndex,
    reason,
  };
}

function parseSkipHostAssignPayload(
  payload: unknown,
): { round_index: number; target_player_id: string; reason: SkipReason } | null {
  const parsedSkip = parseSkipPayload(payload);
  if (parsedSkip === null || !isRecord(payload)) {
    return null;
  }

  const targetPlayerId = asOptionalString(payload.target_player_id)?.trim() ?? "";
  if (targetPlayerId.length === 0) {
    return null;
  }

  return {
    round_index: parsedSkip.round_index,
    target_player_id: targetPlayerId,
    reason: parsedSkip.reason,
  };
}

export class RoomDurableObject {
  private readonly roomState = new RoomLobbyState(workerChartMaster);
  private readonly sessionsBySocket = new Map<WebSocket, RoomSocketSession>();
  private readonly seenClientMessageIds = new Map<string, string[]>();

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: WorkerEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/internal/init" && request.method === "POST") {
      return this.handleInternalInitialize(request);
    }

    if (!isWebSocketUpgradeRequest(request)) {
      return new Response("Expected websocket upgrade request.", { status: 426 });
    }

    const roomIdHeader = request.headers.get("x-room-id");
    if (this.roomState.isInitialized() && roomIdHeader !== this.roomState.getRoomId()) {
      return new Response("room_id routing mismatch.", { status: 400 });
    }

    const socketPairCtor = (globalThis as unknown as {
      WebSocketPair: new () => { 0: WebSocket; 1: WebSocket };
    }).WebSocketPair;
    const socketPair = new socketPairCtor();
    const clientSocket = socketPair[0];
    const serverSocket = socketPair[1];

    (serverSocket as unknown as { accept: () => void }).accept();
    this.attachSocket(serverSocket);

    return new Response(null, {
      status: SWITCHING_PROTOCOLS_STATUS,
      webSocket: clientSocket,
    } as ResponseInit);
  }

  async alarm(): Promise<void> {
    await this.processDueTransitions(new Date());
  }

  private async handleInternalInitialize(request: Request): Promise<Response> {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON payload." });
    }

    const parsed = parseInitializationInput(payload);
    if (parsed === null) {
      return jsonResponse(400, { error: "Invalid room initialization payload." });
    }

    try {
      this.roomState.initialize(parsed);
      await this.syncAlarm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize room.";
      return jsonResponse(400, { error: message });
    }

    return jsonResponse(200, {
      ok: true,
      room_id: this.roomState.getRoomId(),
    });
  }

  private attachSocket(socket: WebSocket): void {
    const session: RoomSocketSession = {
      socket,
      playerId: null,
    };
    this.sessionsBySocket.set(socket, session);

    socket.addEventListener("message", (event) => {
      void this.handleSocketMessage(socket, event);
    });
    socket.addEventListener("close", () => {
      void this.handleSocketClose(socket);
    });
    socket.addEventListener("error", () => {
      void this.handleSocketClose(socket);
    });
  }

  private async handleSocketMessage(socket: WebSocket, event: MessageEvent): Promise<void> {
    const session = this.sessionsBySocket.get(socket);
    if (!session) {
      return;
    }

    try {
      if (typeof event.data !== "string") {
        this.sendError(socket, "INVALID_STATE", "Only text messages are supported.");
        return;
      }

      const decoded = decodeClientMessage(event.data);
      if (!decoded.ok) {
        this.sendError(socket, "INVALID_STATE", decoded.error);
        return;
      }

      const message = decoded.message;
      if (
        message.client_msg_id.trim().length === 0 ||
        message.player_id.trim().length === 0 ||
        message.room_id.trim().length === 0
      ) {
        this.sendError(socket, "INVALID_STATE", "Envelope fields must not be empty.");
        return;
      }

      if (this.roomState.isInitialized() && message.room_id !== this.roomState.getRoomId()) {
        this.sendError(socket, "INVALID_STATE", "room_id does not match this room.");
        return;
      }

      if (session.playerId !== null && session.playerId !== message.player_id) {
        this.sendError(socket, "INVALID_STATE", "player_id mismatch on this socket.");
        return;
      }

      if (await this.processDueTransitions(new Date())) {
        return;
      }

      if (this.isDuplicateMessage(message.player_id, message.client_msg_id)) {
        return;
      }

      if (message.type !== "ROOM_JOIN" && session.playerId === null) {
        this.sendError(socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
        return;
      }

      switch (message.type) {
        case "ROOM_JOIN":
          this.handleRoomJoin(session, message as ClientMessage<"ROOM_JOIN">);
          return;
        case "ROOM_LEAVE":
          await this.handleRoomLeave(session, true);
          return;
        case "READY_CHECK_OPEN":
          await this.handleReadyCheckOpen(session);
          return;
        case "READY_SET":
          this.handleReadySet(session, message as ClientMessage<"READY_SET">);
          return;
        case "START_MATCH":
          await this.handleStartMatch(session);
          return;
        case "PICK_SUBMIT":
          await this.handlePickSubmit(session, message as ClientMessage<"PICK_SUBMIT">);
          return;
        case "RESULT_SUBMIT":
          await this.handleResultSubmit(session, message as ClientMessage<"RESULT_SUBMIT">);
          return;
        case "SKIP_SELF":
          await this.handleSkipSelf(session, message as ClientMessage<"SKIP_SELF">);
          return;
        case "SKIP_HOST_ASSIGN":
          await this.handleSkipHostAssign(session, message as ClientMessage<"SKIP_HOST_ASSIGN">);
          return;
        case "FORCE_ADVANCE":
          await this.handleForceAdvance(session);
          return;
        case "STATE_GET":
          this.sendStateSnapshot(socket);
          return;
        case "PING":
          this.send(socket, "PONG", {});
          return;
        default:
          this.sendError(
            socket,
            "INVALID_STATE",
            `Message type ${message.type} is unavailable in ${this.roomState.getRoomState()}.`,
          );
      }
    } catch {
      this.sendError(socket, "INVALID_STATE", "Failed to process message.");
    }
  }

  private async handleSocketClose(socket: WebSocket): Promise<void> {
    const session = this.sessionsBySocket.get(socket);
    if (!session) {
      return;
    }

    this.sessionsBySocket.delete(socket);
    await this.handleRoomLeave(session, false);
  }

  private handleRoomJoin(session: RoomSocketSession, message: ClientMessage<"ROOM_JOIN">): void {
    if (!this.roomState.isInitialized()) {
      this.sendJoinRejected(session.socket, "ROOM_STATE_LOST");
      return;
    }
    if (this.roomState.getRoomState() === "CLOSED") {
      this.sendJoinRejected(session.socket, "ROOM_CLOSED");
      return;
    }

    const payload = parseRoomJoinPayload(message.payload);
    if (payload === null) {
      this.sendJoinRejected(session.socket, "INVALID_JOIN_PAYLOAD");
      return;
    }

    const existingSession = this.findSessionByPlayerId(message.player_id);
    if (existingSession && existingSession.socket !== session.socket) {
      this.sendJoinRejected(session.socket, "PLAYER_ALREADY_CONNECTED");
      return;
    }

    const settings = this.roomState.getSettings();
    if (settings.visibility === "PRIVATE") {
      const expectedJoinCode = normalizeJoinCode(settings.join_code);
      const observedJoinCode = normalizeJoinCode(payload.join_code);
      if (expectedJoinCode === null || observedJoinCode !== expectedJoinCode) {
        this.sendJoinRejected(session.socket, "JOIN_CODE_INVALID");
        return;
      }
    }

    const joinResult = this.roomState.joinPlayer({
      player_id: message.player_id,
      display_name: payload.display_name,
      source: payload.source,
      now: new Date(),
    });
    if (!joinResult.ok) {
      this.sendJoinRejected(session.socket, joinResult.reason ?? "ROOM_JOIN_REJECTED");
      return;
    }

    session.playerId = message.player_id;

    this.send(session.socket, "ROOM_JOIN_ACCEPTED", {
      room_state_snapshot: this.roomState.toSnapshot(),
    });
    this.sendResultReadyIfAvailable(session.socket);
    this.broadcastRoomUpdated();
  }

  private async handleRoomLeave(session: RoomSocketSession, closeSocket: boolean): Promise<void> {
    const playerId = session.playerId;
    session.playerId = null;

    if (playerId === null) {
      if (closeSocket) {
        this.safeCloseSocket(session.socket, 1000, "Left room.");
      }
      return;
    }

    const leaveResult = this.roomState.leavePlayer(playerId, new Date());
    if (!leaveResult.changed) {
      if (closeSocket) {
        this.safeCloseSocket(session.socket, 1000, "Left room.");
      }
      return;
    }

    if (leaveResult.was_host && !leaveResult.room_was_closed) {
      await this.clearAlarm();
      this.broadcast("ROOM_CLOSED", { reason: "HOST_LEFT" }, true);
      await this.cleanupLobbyEntry();
      this.disconnectAll(4000, "Host left.");
      return;
    }

    this.broadcastRoomUpdated();
    if (closeSocket) {
      this.safeCloseSocket(session.socket, 1000, "Left room.");
    }
  }

  private async handleReadyCheckOpen(session: RoomSocketSession): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const openedAt = new Date();
    const result = this.roomState.openReadyCheck(session.playerId, openedAt);
    if (!result.ok) {
      if (result.reason === "NOT_HOST") {
        this.sendError(session.socket, "NOT_HOST", "Only the host can open READY_CHECK.");
        return;
      }

      this.sendError(session.socket, "INVALID_STATE", "READY_CHECK can only be opened from LOBBY.");
      return;
    }

    const deadline = result.ready_check_deadline;
    if (deadline === undefined) {
      this.sendError(session.socket, "INVALID_STATE", "READY_CHECK deadline is unavailable.");
      return;
    }

    await this.syncAlarm();
    this.broadcast("READY_CHECK_OPENED", {
      ready_check_deadline: deadline.toISOString(),
    });
    this.broadcastRoomUpdated();
  }

  private handleReadySet(session: RoomSocketSession, message: ClientMessage<"READY_SET">): void {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseReadySetPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "READY_SET payload is invalid.");
      return;
    }

    const result = this.roomState.setPlayerReady(session.playerId, payload.ready);
    if (!result.ok) {
      this.sendError(session.socket, "INVALID_STATE", "READY_SET is only available during READY_CHECK.");
      return;
    }

    this.broadcast("READY_STATUS_CHANGED", {
      player_id: session.playerId,
      ready: payload.ready,
    });
    this.broadcastRoomUpdated();
  }

  private async handleStartMatch(session: RoomSocketSession): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const result = this.roomState.startMatch(session.playerId, new Date());
    if (!result.ok) {
      switch (result.reason) {
        case "NOT_HOST":
          this.sendError(session.socket, "NOT_HOST", "Only the host can start the match.");
          return;
        case "START_REQUIRES_MIN_PLAYERS":
          this.sendStartMatchRejected(session.socket, "START_REQUIRES_MIN_PLAYERS");
          return;
        case "NOT_ALL_PLAYERS_READY":
          this.sendStartMatchRejected(session.socket, "NOT_ALL_PLAYERS_READY");
          return;
        case "BPL_REQUIRES_TWO_PLAYERS":
          this.sendStartMatchRejected(session.socket, "BPL_REQUIRES_TWO_PLAYERS");
          return;
        default:
          this.sendStartMatchRejected(session.socket, "INVALID_STATE");
          return;
      }
    }

    await this.syncAlarm();
    this.broadcastRoomUpdated();
  }

  private async handlePickSubmit(session: RoomSocketSession, message: ClientMessage<"PICK_SUBMIT">): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parsePickSubmitPayload(message.payload);
    if (payload === null) {
      this.send(session.socket, "PICK_REJECTED", { reason: "INVALID_PICK_CHART_KEY" });
      return;
    }

    const result = this.roomState.submitPick(session.playerId, payload.pick_chart_key, new Date());
    if (!result.ok || result.accepted_pick === undefined) {
      this.send(session.socket, "PICK_REJECTED", {
        reason: result.reason ?? "PICK_REJECTED",
      });
      return;
    }

    this.broadcastAcceptedPick(result.accepted_pick);
    this.broadcastFrozenRoundTransition(result.frozen_rounds, result.round_begin);

    await this.syncAlarm();
    this.broadcastRoomUpdated();
  }

  private async handleResultSubmit(
    session: RoomSocketSession,
    message: ClientMessage<"RESULT_SUBMIT">,
  ): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseResultSubmitPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "RESULT_SUBMIT payload is invalid.");
      return;
    }

    const result = this.roomState.submitResult(
      session.playerId,
      payload.round_index,
      payload.observed_key,
      payload.metric_value,
      payload.source_meta,
      new Date(),
    );
    if (!result.ok) {
      switch (result.reason) {
        case "RESULT_KEY_MISMATCH":
          this.sendError(session.socket, "RESULT_KEY_MISMATCH", "observed_key does not match current round.");
          return;
        case "ROUND_ALREADY_CONFIRMED":
          this.sendError(session.socket, "ROUND_ALREADY_CONFIRMED", "Player already confirmed for this round.");
          return;
        default:
          this.sendError(session.socket, "INVALID_STATE", "RESULT_SUBMIT is unavailable in the current state.");
          return;
      }
    }

    await this.publishRoundTransition(result);
  }

  private async handleSkipSelf(session: RoomSocketSession, message: ClientMessage<"SKIP_SELF">): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseSkipPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "SKIP_SELF payload is invalid.");
      return;
    }

    const result = this.roomState.skipSelf(session.playerId, payload.round_index, payload.reason, new Date());
    if (!result.ok) {
      switch (result.reason) {
        case "ROUND_ALREADY_CONFIRMED":
          this.sendError(session.socket, "ROUND_ALREADY_CONFIRMED", "Player already confirmed for this round.");
          return;
        default:
          this.sendError(session.socket, "INVALID_STATE", "SKIP_SELF is unavailable in the current state.");
          return;
      }
    }

    await this.publishRoundTransition(result);
  }

  private async handleSkipHostAssign(
    session: RoomSocketSession,
    message: ClientMessage<"SKIP_HOST_ASSIGN">,
  ): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseSkipHostAssignPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "SKIP_HOST_ASSIGN payload is invalid.");
      return;
    }

    const result = this.roomState.assignHostSkip(
      session.playerId,
      payload.round_index,
      payload.target_player_id,
      payload.reason,
      new Date(),
    );
    if (!result.ok) {
      switch (result.reason) {
        case "NOT_HOST":
          this.sendError(session.socket, "NOT_HOST", "Only the host can assign a skip.");
          return;
        case "HOST_SKIP_LOCKED":
          this.sendError(session.socket, "HOST_SKIP_LOCKED", "Host skip is locked until the round has been active for 240 seconds.");
          return;
        case "ROUND_ALREADY_CONFIRMED":
          this.sendError(session.socket, "ROUND_ALREADY_CONFIRMED", "Target player already confirmed for this round.");
          return;
        default:
          this.sendError(session.socket, "INVALID_STATE", "SKIP_HOST_ASSIGN is unavailable in the current state.");
          return;
      }
    }

    await this.publishRoundTransition(result);
  }

  private async handleForceAdvance(session: RoomSocketSession): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const result = this.roomState.forceAdvance(session.playerId, new Date());
    if (!result.ok) {
      switch (result.reason) {
        case "NOT_HOST":
          this.sendError(session.socket, "NOT_HOST", "Only the host can force advance.");
          return;
        default:
          this.sendError(
            session.socket,
            "INVALID_STATE",
            "FORCE_ADVANCE is unavailable unless the current round still has unconfirmed players.",
          );
          return;
      }
    }

    await this.publishRoundTransition(result);
  }

  private findSessionByPlayerId(playerId: string): RoomSocketSession | null {
    for (const session of this.sessionsBySocket.values()) {
      if (session.playerId === playerId) {
        return session;
      }
    }

    return null;
  }

  private sendStateSnapshot(socket: WebSocket): void {
    this.send(socket, "STATE_SNAPSHOT", {
      room_state_snapshot: this.roomState.toSnapshot(),
    });
    this.sendResultReadyIfAvailable(socket);
  }

  private broadcastRoomUpdated(): void {
    this.broadcast("ROOM_UPDATED", {
      room_state_snapshot: this.roomState.toSnapshot(),
    });
  }

  private broadcastAcceptedPick(acceptedPick: {
    player_id: string;
    pick_chart_key: string;
    accepted_at: Date;
  }): void {
    this.broadcast("PICK_ACCEPTED", {
      player_id: acceptedPick.player_id,
      pick_chart_key: acceptedPick.pick_chart_key,
      accepted_at: acceptedPick.accepted_at.toISOString(),
    });
  }

  private broadcastFrozenRoundTransition(
    frozenRounds: ServerMessagePayloadMap["PICK_FROZEN"]["frozen_rounds"] | undefined,
    roundBegin: ServerMessagePayloadMap["ROUND_BEGIN"] | undefined,
  ): void {
    if (frozenRounds !== undefined) {
      this.broadcast("PICK_FROZEN", {
        frozen_rounds: frozenRounds,
      });
    }

    if (roundBegin !== undefined) {
      this.broadcast("ROUND_BEGIN", roundBegin);
    }
  }

  private broadcastPickingTimeoutTransition(result: PickingTimeoutResult): void {
    for (const acceptedPick of result.accepted_picks) {
      this.broadcastAcceptedPick(acceptedPick);
    }

    this.broadcastFrozenRoundTransition(result.frozen_rounds, result.round_begin);
  }

  private broadcastRoundTransition(result: RoundTransitionResult): void {
    for (const confirmation of result.confirmations) {
      this.broadcast("PLAYER_ROUND_CONFIRMED", confirmation);
    }

    if (result.force_advance_applied !== undefined) {
      this.broadcast("FORCE_ADVANCE_APPLIED", result.force_advance_applied);
    }

    if (result.round_ended !== undefined) {
      this.broadcast("ROUND_ENDED", result.round_ended);
    }

    if (result.round_begin !== undefined) {
      this.broadcast("ROUND_BEGIN", result.round_begin);
    }

    if (result.result_ready !== undefined) {
      this.broadcast("RESULT_READY", result.result_ready);
    }
  }

  private broadcast<TType extends ServerMessageType>(
    type: TType,
    payload: ServerMessagePayloadMap[TType],
    includeUnjoined = false,
  ): void {
    for (const session of this.sessionsBySocket.values()) {
      if (!includeUnjoined && session.playerId === null) {
        continue;
      }
      this.send(session.socket, type, payload);
    }
  }

  private send<TType extends ServerMessageType>(
    socket: WebSocket,
    type: TType,
    payload: ServerMessagePayloadMap[TType],
  ): void {
    if (socket.readyState !== OPEN_WEBSOCKET_STATE) {
      return;
    }

    const roomId = this.roomState.isInitialized() ? this.roomState.getRoomId() : "";
    const envelope = createServerEnvelope(roomId, type, payload);
    socket.send(JSON.stringify(envelope));
  }

  private sendError(socket: WebSocket, code: ErrorCode, message: string): void {
    this.send(socket, "ERROR", { code, message });
  }

  private sendJoinRejected(socket: WebSocket, reason: string): void {
    this.send(socket, "ROOM_JOIN_REJECTED", { reason });
  }

  private sendStartMatchRejected(socket: WebSocket, reason: string): void {
    this.send(socket, "START_MATCH_REJECTED", { reason });
  }

  private sendResultReadyIfAvailable(socket: WebSocket): void {
    const payload = this.roomState.getResultReadyPayload();
    if (payload === null) {
      return;
    }

    this.send(socket, "RESULT_READY", payload);
  }

  private isDuplicateMessage(playerId: string, clientMessageId: string): boolean {
    const seenIds = this.seenClientMessageIds.get(playerId) ?? [];
    if (seenIds.includes(clientMessageId)) {
      return true;
    }

    seenIds.push(clientMessageId);
    if (seenIds.length > IDEMPOTENCY_LOG_LIMIT) {
      seenIds.shift();
    }
    this.seenClientMessageIds.set(playerId, seenIds);
    return false;
  }

  private disconnectAll(code: number, reason: string): void {
    const sessions = Array.from(this.sessionsBySocket.values());
    this.sessionsBySocket.clear();

    for (const session of sessions) {
      session.playerId = null;
      this.safeCloseSocket(session.socket, code, reason);
    }
  }

  private safeCloseSocket(socket: WebSocket, code: number, reason: string): void {
    if (socket.readyState === OPEN_WEBSOCKET_STATE) {
      socket.close(code, reason);
    }
  }

  private async clearAlarm(): Promise<void> {
    await this.state.storage.deleteAlarm();
  }

  private async syncAlarm(): Promise<void> {
    const nextAlarmAt = this.roomState.getNextAlarmAt();
    if (nextAlarmAt === null) {
      await this.clearAlarm();
      return;
    }

    await this.state.storage.setAlarm(nextAlarmAt);
  }

  private async publishRoundTransition(result: RoundTransitionResult): Promise<void> {
    await this.syncAlarm();
    this.broadcastRoundTransition(result);
    this.broadcastRoomUpdated();
    await this.cleanupLobbyEntryIfClosed();
  }

  private async processDueTransitions(now: Date): Promise<boolean> {
    if (await this.closeReadyCheckOnTimeout(now)) {
      return true;
    }

    const pickingTransition = this.roomState.expirePickingIfNeeded(now);
    if (pickingTransition !== null) {
      this.broadcastPickingTimeoutTransition(pickingTransition);
      await this.syncAlarm();
      this.broadcastRoomUpdated();
      return false;
    }

    const matchTransition = this.roomState.expireMatchIfNeeded(now);
    if (matchTransition !== null) {
      await this.publishRoundTransition(matchTransition);
      return false;
    }

    const roundTransition = this.roomState.expireCurrentRoundIfNeeded(now);
    if (roundTransition !== null) {
      await this.publishRoundTransition(roundTransition);
    }

    return false;
  }

  private async closeReadyCheckOnTimeout(now: Date): Promise<boolean> {
    const closed = this.roomState.closeReadyCheckIfExpired(now);
    if (!closed) {
      return false;
    }

    await this.clearAlarm();
    this.broadcast("ROOM_CLOSED", { reason: "READY_CHECK_TIMEOUT" }, true);
    await this.cleanupLobbyEntry();
    this.disconnectAll(4001, "Ready check timed out.");
    return true;
  }

  private async cleanupLobbyEntry(): Promise<void> {
    if (!this.roomState.isInitialized()) {
      return;
    }

    try {
      await deleteLobbyRoom(this.env, this.roomState.getRoomId());
    } catch {
      // no-op: list API has expires_at guard as fallback
    }
  }

  private async cleanupLobbyEntryIfClosed(): Promise<void> {
    if (this.roomState.getRoomState() !== "CLOSED") {
      return;
    }

    await this.cleanupLobbyEntry();
  }
}
