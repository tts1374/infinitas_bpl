import {
  LEVEL_FILTERS,
  MATCH_TTL_MS,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  READY_CHECK_TTL_MS,
  SKIP_REASONS,
  SOURCE_TYPES,
  WIN_METRICS,
  type ClientMessage,
  type ErrorCode,
  type ExpectedKey,
  type JsonObject,
  type LobbyRoomSummary,
  type RequestIdPayload,
  type RoomJoinPayload,
  type RoomSettings,
  type RoomStateSnapshot,
  type SkipReason,
  type ServerMessagePayloadMap,
  type ServerMessageType,
} from "@infinitas/shared";
import { normalizeJoinCode } from "../services/join-code";
import { removeLobbyDirectoryRoom, upsertLobbyDirectoryRoom } from "../services/lobby-directory";
import type { WorkerEnv } from "../types/env";
import { asEnumValue, asOptionalString, isRecord } from "../utils/validation";
import { createServerEnvelope, decodeClientMessage } from "./ws-codec";
import {
  RoomLobbyState,
  type PickingTimeoutResult,
  type RoomInitializationInput,
  type RoomStatePersistenceRecord,
  type RoundTransitionResult,
} from "./room-state";
import { workerChartMaster } from "../master/chart-master";

type RoomSocketRole = "HOST" | "PLAYER" | "SPECTATOR";

type RoomSocketAttachment = {
  playerId: string | null;
  joinedAt: string | null;
  role: RoomSocketRole | null;
  connectionId: string | null;
  attachedAt: string | null;
};

interface RoomSocketSession {
  socket: WebSocket;
  playerId: string | null;
  joinedAt: string | null;
  role: RoomSocketRole | null;
  connectionId: string | null;
  attachedAt: string | null;
}

interface HibernationWebSocketLike extends WebSocket {
  serializeAttachment(attachment: RoomSocketAttachment): void;
  deserializeAttachment(): unknown;
}

interface SocketCloseContext {
  trigger: "close" | "error";
  code: number | null;
  reason: string | null;
  wasClean: boolean | null;
}

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  deleteAlarm(): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  acceptWebSocket(socket: WebSocket): void;
  getWebSockets(): WebSocket[];
}

const IDEMPOTENCY_LOG_LIMIT = 300;
const REQUEST_ID_LOG_LIMIT = 300;
const OPEN_WEBSOCKET_STATE = 1;
const SWITCHING_PROTOCOLS_STATUS = 101;
const ROOM_RECORD_STORAGE_KEY = "room-record";

type SeenClientMessageIdsRecord = Record<string, string[]>;

interface RoomDurableRecord {
  room_state: RoomStatePersistenceRecord;
  processed_request_keys: string[];
  seen_client_message_ids?: SeenClientMessageIdsRecord;
  next_event_seq: number;
}

function normalizeSeenClientMessageIds(rawMessageIds: unknown[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (let index = rawMessageIds.length - 1; index >= 0; index -= 1) {
    const rawMessageId = rawMessageIds[index];
    if (typeof rawMessageId !== "string") {
      continue;
    }

    if (rawMessageId.trim().length === 0 || seen.has(rawMessageId)) {
      continue;
    }

    seen.add(rawMessageId);
    normalized.push(rawMessageId);
    if (normalized.length >= IDEMPOTENCY_LOG_LIMIT) {
      break;
    }
  }

  normalized.reverse();
  return normalized;
}

function deserializeSeenClientMessageIds(value: unknown): Map<string, Set<string>> {
  const seenClientMessageIds = new Map<string, Set<string>>();
  if (!isRecord(value)) {
    return seenClientMessageIds;
  }

  for (const [rawPlayerId, rawMessageIds] of Object.entries(value)) {
    if (rawPlayerId.trim().length === 0 || !Array.isArray(rawMessageIds)) {
      continue;
    }

    const normalized = normalizeSeenClientMessageIds(rawMessageIds);
    if (normalized.length === 0) {
      continue;
    }

    seenClientMessageIds.set(rawPlayerId, new Set(normalized));
  }

  return seenClientMessageIds;
}

function serializeSeenClientMessageIds(
  seenClientMessageIds: Map<string, Set<string>>,
): SeenClientMessageIdsRecord {
  const serialized: SeenClientMessageIdsRecord = {};
  for (const [rawPlayerId, messageIds] of seenClientMessageIds) {
    if (rawPlayerId.trim().length === 0 || messageIds.size === 0) {
      continue;
    }

    const normalized = normalizeSeenClientMessageIds(Array.from(messageIds));
    if (normalized.length === 0) {
      continue;
    }

    serialized[rawPlayerId] = normalized;
  }
  return serialized;
}

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

function normalizeVisibility(value: unknown): RoomSettings["visibility"] | undefined {
  const parsed = asEnumValue(value, ["PUBLIC", "PRIVATE", "UNLISTED"] as const);
  if (parsed === "UNLISTED") {
    return "PRIVATE";
  }

  return parsed;
}

function parseRoomSettings(value: unknown): RoomSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  const visibility = normalizeVisibility(value.visibility);
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

function parseRequestIdPayload(payload: unknown): RequestIdPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const requestId = asOptionalString(payload.request_id)?.trim() ?? "";
  if (requestId.length === 0) {
    return null;
  }

  return {
    request_id: requestId,
  };
}

function parsePickSubmitPayload(payload: unknown): { request_id: string; pick_chart_key: string } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const requestId = asOptionalString(payload.request_id)?.trim() ?? "";
  const pickChartKeyRaw = asOptionalString(payload.pick_chart_key);
  const pickChartKey = pickChartKeyRaw?.trim() ?? "";
  if (requestId.length === 0 || pickChartKey.length === 0) {
    return null;
  }

  return {
    request_id: requestId,
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
): {
  request_id: string;
  round_index: number;
  observed_key: ExpectedKey;
  metric_value: number;
  source_meta: JsonObject | null;
} | null {
  if (!isRecord(payload)) {
    return null;
  }

  const requestId = asOptionalString(payload.request_id)?.trim() ?? "";
  const roundIndex = typeof payload.round_index === "number" ? payload.round_index : Number.NaN;
  const metricValue = typeof payload.metric_value === "number" ? payload.metric_value : Number.NaN;
  const observedKey = parseExpectedKey(payload.observed_key);
  const sourceMeta = payload.source_meta;
  if (
    requestId.length === 0 ||
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
    request_id: requestId,
    round_index: roundIndex,
    observed_key: observedKey,
    metric_value: metricValue,
    source_meta: sourceMeta === undefined || sourceMeta === null ? null : (sourceMeta as JsonObject),
  };
}

function parseSkipPayload(payload: unknown): { request_id: string; round_index: number; reason: SkipReason } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const requestId = asOptionalString(payload.request_id)?.trim() ?? "";
  const roundIndex = typeof payload.round_index === "number" ? payload.round_index : Number.NaN;
  const reason = asEnumValue(payload.reason, SKIP_REASONS);
  if (requestId.length === 0 || !Number.isInteger(roundIndex) || roundIndex < 0 || reason === undefined) {
    return null;
  }

  return {
    request_id: requestId,
    round_index: roundIndex,
    reason,
  };
}

function parseRoomSocketRole(value: unknown): RoomSocketRole | null {
  if (value === "HOST" || value === "PLAYER" || value === "SPECTATOR") {
    return value;
  }

  return null;
}

function parseRoomSocketAttachment(value: unknown): RoomSocketAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const playerId = value.playerId;
  const joinedAt = value.joinedAt;
  const rawRole = value.role;
  const rawConnectionId = value.connectionId;
  const rawAttachedAt = value.attachedAt;
  if ((typeof playerId !== "string" && playerId !== null) || (typeof joinedAt !== "string" && joinedAt !== null)) {
    return null;
  }
  if (
    (typeof rawConnectionId !== "string" && rawConnectionId !== null && rawConnectionId !== undefined) ||
    (typeof rawAttachedAt !== "string" && rawAttachedAt !== null && rawAttachedAt !== undefined)
  ) {
    return null;
  }

  if (rawRole === null) {
    return {
      playerId,
      joinedAt,
      role: null,
      connectionId: typeof rawConnectionId === "string" ? rawConnectionId : null,
      attachedAt: typeof rawAttachedAt === "string" ? rawAttachedAt : null,
    };
  }

  const role = parseRoomSocketRole(rawRole);
  if (role === null) {
    return null;
  }

  return {
    playerId,
    joinedAt,
    role,
    connectionId: typeof rawConnectionId === "string" ? rawConnectionId : null,
    attachedAt: typeof rawAttachedAt === "string" ? rawAttachedAt : null,
  };
}

export class RoomDurableObject {
  private readonly roomState = new RoomLobbyState(workerChartMaster);
  private readonly sessionsBySocket = new Map<WebSocket, RoomSocketSession>();
  private readonly activeSocketByPlayerId = new Map<string, WebSocket>();
  private readonly seenClientMessageIds = new Map<string, Set<string>>();
  private readonly processedRequestKeySet = new Set<string>();
  private processedRequestKeys: string[] = [];
  private nextEventSeq = 0;
  private readonly readyPromise: Promise<void>;

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: WorkerEnv,
  ) {
    this.readyPromise = this.state.blockConcurrencyWhile(async () => {
      const record = await this.state.storage.get<RoomDurableRecord>(ROOM_RECORD_STORAGE_KEY);
      if (record !== undefined) {
        this.roomState.hydrate(record.room_state);
        this.processedRequestKeys = [...record.processed_request_keys];
        for (const key of this.processedRequestKeys) {
          this.processedRequestKeySet.add(key);
        }
        const hydratedSeenClientMessageIds = deserializeSeenClientMessageIds(record.seen_client_message_ids);
        for (const [playerId, messageIds] of hydratedSeenClientMessageIds) {
          this.seenClientMessageIds.set(playerId, messageIds);
        }
        this.nextEventSeq = record.next_event_seq;
      }

      this.rebuildSessionsFromWebSockets();
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.readyPromise;
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

    this.state.acceptWebSocket(serverSocket);
    const attachment = this.buildInitialSocketAttachment();
    this.writeSocketAttachment(serverSocket, attachment);
    this.registerSocketSession(serverSocket, attachment);

    return new Response(null, {
      status: SWITCHING_PROTOCOLS_STATUS,
      webSocket: clientSocket,
    } as ResponseInit);
  }

  async alarm(): Promise<void> {
    await this.readyPromise;
    await this.processDueTransitions(new Date());
    await this.syncAlarm();
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
      await this.persistRoomRecord();
      await this.syncAlarm();
      await this.syncLobbyDirectory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize room.";
      return jsonResponse(400, { error: message });
    }

    return jsonResponse(200, {
      ok: true,
      room_id: this.roomState.getRoomId(),
    });
  }

  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer | ArrayBufferView,
  ): Promise<void> {
    await this.readyPromise;
    await this.handleSocketMessage(socket, message);
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    await this.readyPromise;
    await this.handleSocketClose(socket, {
      trigger: "close",
      code,
      reason,
      wasClean,
    });
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    await this.readyPromise;
    console.warn("[room-do] websocket error", {
      roomId: this.roomState.isInitialized() ? this.roomState.getRoomId() : "(uninitialized)",
      error,
    });
    await this.handleSocketClose(socket, {
      trigger: "error",
      code: null,
      reason: null,
      wasClean: null,
    });
  }

  private buildInitialSocketAttachment(): RoomSocketAttachment {
    return {
      playerId: null,
      joinedAt: null,
      role: null,
      connectionId: null,
      attachedAt: null,
    };
  }

  private asHibernationSocket(socket: WebSocket): HibernationWebSocketLike | null {
    const maybeSocket = socket as Partial<HibernationWebSocketLike>;
    if (
      typeof maybeSocket.serializeAttachment !== "function" ||
      typeof maybeSocket.deserializeAttachment !== "function"
    ) {
      return null;
    }

    return socket as HibernationWebSocketLike;
  }

  private readSocketAttachment(socket: WebSocket): RoomSocketAttachment {
    const hibernationSocket = this.asHibernationSocket(socket);
    if (hibernationSocket === null) {
      return this.buildInitialSocketAttachment();
    }

    try {
      const parsed = parseRoomSocketAttachment(hibernationSocket.deserializeAttachment());
      if (parsed === null) {
        return this.buildInitialSocketAttachment();
      }

      return parsed;
    } catch {
      return this.buildInitialSocketAttachment();
    }
  }

  private writeSocketAttachment(socket: WebSocket, attachment: RoomSocketAttachment): void {
    const hibernationSocket = this.asHibernationSocket(socket);
    if (hibernationSocket === null) {
      return;
    }

    try {
      hibernationSocket.serializeAttachment(attachment);
    } catch {
      // no-op: attachment sync failure is treated as unjoined fallback on next restore.
    }
  }

  private registerSocketSession(
    socket: WebSocket,
    attachment = this.readSocketAttachment(socket),
  ): RoomSocketSession {
    const session: RoomSocketSession = {
      socket,
      playerId: attachment.playerId,
      joinedAt: attachment.joinedAt,
      role: attachment.role,
      connectionId: attachment.connectionId,
      attachedAt: attachment.attachedAt,
    };
    this.sessionsBySocket.set(socket, session);
    return session;
  }

  private getOrCreateSocketSession(socket: WebSocket): RoomSocketSession {
    const existing = this.sessionsBySocket.get(socket);
    if (existing !== undefined) {
      return existing;
    }

    return this.registerSocketSession(socket);
  }

  private rebuildSessionsFromWebSockets(): void {
    this.sessionsBySocket.clear();
    this.activeSocketByPlayerId.clear();
    for (const socket of this.state.getWebSockets()) {
      this.registerSocketSession(socket);
    }

    this.rebuildActiveSocketIndex();
  }

  private syncSocketAttachment(session: RoomSocketSession): void {
    this.writeSocketAttachment(session.socket, {
      playerId: session.playerId,
      joinedAt: session.joinedAt,
      role: session.role,
      connectionId: session.connectionId,
      attachedAt: session.attachedAt,
    });
  }

  private resolveSocketRole(playerId: string): RoomSocketRole {
    return this.roomState.getHostPlayerId() === playerId ? "HOST" : "PLAYER";
  }

  private parseAttachmentTimestamp(value: string | null): number {
    if (typeof value !== "string") {
      return Number.NEGATIVE_INFINITY;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  private rebuildActiveSocketIndex(): void {
    this.activeSocketByPlayerId.clear();
    const newestAttachedAtByPlayerId = new Map<string, number>();

    for (const session of this.sessionsBySocket.values()) {
      if (session.playerId === null) {
        continue;
      }

      const attachedAt = this.parseAttachmentTimestamp(session.attachedAt);
      const knownAttachedAt = newestAttachedAtByPlayerId.get(session.playerId) ?? Number.NEGATIVE_INFINITY;
      if (attachedAt >= knownAttachedAt) {
        newestAttachedAtByPlayerId.set(session.playerId, attachedAt);
        this.activeSocketByPlayerId.set(session.playerId, session.socket);
      }
    }
  }

  private isCurrentSocketForPlayer(playerId: string, socket: WebSocket): boolean {
    return this.activeSocketByPlayerId.get(playerId) === socket;
  }

  private clearActiveSocketForPlayer(playerId: string, socket: WebSocket): void {
    if (this.activeSocketByPlayerId.get(playerId) === socket) {
      this.activeSocketByPlayerId.delete(playerId);
    }
  }

  private clearSessionPlayerBinding(session: RoomSocketSession): void {
    if (session.playerId !== null) {
      this.clearActiveSocketForPlayer(session.playerId, session.socket);
    }

    session.playerId = null;
    session.joinedAt = null;
    session.role = null;
    session.connectionId = null;
    session.attachedAt = null;
    this.syncSocketAttachment(session);
  }

  private assignSessionToPlayer(session: RoomSocketSession, playerId: string, joinedAt: string, attachedAt: string): void {
    session.playerId = playerId;
    session.joinedAt = joinedAt;
    session.role = this.resolveSocketRole(playerId);
    session.connectionId = crypto.randomUUID();
    session.attachedAt = attachedAt;
    this.syncSocketAttachment(session);
    this.activeSocketByPlayerId.set(playerId, session.socket);
  }

  private replacePlayerSocket(playerId: string, currentSession: RoomSocketSession): void {
    for (const session of this.sessionsBySocket.values()) {
      if (session.socket === currentSession.socket || session.playerId !== playerId) {
        continue;
      }

      this.clearSessionPlayerBinding(session);
      this.safeCloseSocket(session.socket, 4002, "Replaced by a new connection.");
    }
  }

  private async handleSocketMessage(
    socket: WebSocket,
    data: string | ArrayBuffer | ArrayBufferView,
  ): Promise<void> {
    const session = this.getOrCreateSocketSession(socket);
    try {
      if (typeof data !== "string") {
        this.sendError(socket, "INVALID_STATE", "Only text messages are supported.");
        return;
      }

      const decoded = decodeClientMessage(data);
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
      await this.persistRoomRecord();

      if (message.type !== "ROOM_JOIN" && session.playerId === null) {
        this.sendError(socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
        return;
      }

      switch (message.type) {
        case "ROOM_JOIN":
          await this.handleRoomJoin(session, message as ClientMessage<"ROOM_JOIN">);
          return;
        case "ROOM_LEAVE":
          await this.handleRoomLeave(session, true);
          return;
        case "READY_SET":
          await this.handleReadySet(session, message as ClientMessage<"READY_SET">);
          return;
        case "START_MATCH":
          await this.handleStartMatch(session, message as ClientMessage<"START_MATCH">);
          return;
        case "RETURN_TO_LOBBY":
          await this.handleReturnToLobby(session, message as ClientMessage<"RETURN_TO_LOBBY">);
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
          await this.handleForceAdvance(session, message as ClientMessage<"FORCE_ADVANCE">);
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

  private async handleSocketClose(
    socket: WebSocket,
    context: SocketCloseContext,
  ): Promise<void> {
    const session = this.getOrCreateSocketSession(socket);
    const playerId = session.playerId;
    const isCurrentSocket = playerId !== null && this.isCurrentSocketForPlayer(playerId, socket);

    const roomId = this.roomState.isInitialized()
      ? this.roomState.getRoomId()
      : "(uninitialized)";
    console.info("[room-do] socket closed", {
      roomId,
      playerId,
      roomState: this.roomState.getRoomState(),
      trigger: context.trigger,
      code: context.code,
      reason: context.reason,
      wasClean: context.wasClean,
      activeSocketCount: this.sessionsBySocket.size,
    });

    this.sessionsBySocket.delete(socket);
    if (playerId === null || !isCurrentSocket) {
      return;
    }

    this.clearActiveSocketForPlayer(playerId, socket);
    const leaveResult = this.roomState.markPlayerDisconnected(playerId, new Date());
    if (!leaveResult.changed) {
      return;
    }

    await this.persistRoomRecord();
    await this.syncAlarm();
    await this.syncLobbyDirectory();
    this.broadcastRoomUpdated();
  }

  private async handleRoomJoin(session: RoomSocketSession, message: ClientMessage<"ROOM_JOIN">): Promise<void> {
    if (!this.roomState.isInitialized()) {
      this.sendJoinRejected(session.socket, "ROOM_STATE_LOST");
      return;
    }

    if (
      session.playerId === message.player_id &&
      this.roomState.isPlayerConnected(message.player_id) &&
      this.isCurrentSocketForPlayer(message.player_id, session.socket)
    ) {
      this.send(session.socket, "ROOM_JOIN_ACCEPTED", {
        room_state_snapshot: this.roomState.toSnapshot(),
      });
      this.sendResultReadyIfAvailable(session.socket);
      return;
    }

    const payload = parseRoomJoinPayload(message.payload);
    if (payload === null) {
      this.sendJoinRejected(session.socket, "INVALID_JOIN_PAYLOAD");
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

    const now = new Date();
    const joinResult = this.roomState.joinPlayer({
      player_id: message.player_id,
      display_name: payload.display_name,
      source: payload.source,
      now,
    });
    if (!joinResult.ok) {
      this.sendJoinRejected(session.socket, joinResult.reason ?? "ROOM_JOIN_REJECTED");
      return;
    }

    const snapshot = this.roomState.toSnapshot();
    const joinedPlayer = snapshot.players.find((player) => player.player_id === message.player_id);
    const attachedAt = now.toISOString();
    const joinedAt = typeof joinedPlayer?.joined_at === "string"
      ? joinedPlayer.joined_at
      : attachedAt;
    this.assignSessionToPlayer(session, message.player_id, joinedAt, attachedAt);
    this.replacePlayerSocket(message.player_id, session);
    await this.persistRoomRecord();
    await this.syncLobbyDirectory();

    this.send(session.socket, "ROOM_JOIN_ACCEPTED", {
      room_state_snapshot: snapshot,
    });
    this.sendResultReadyIfAvailable(session.socket);
    this.broadcastRoomUpdated();
  }

  private async handleRoomLeave(session: RoomSocketSession, closeSocket: boolean): Promise<void> {
    const playerId = session.playerId;
    this.clearSessionPlayerBinding(session);

    if (playerId === null) {
      if (closeSocket) {
        this.safeCloseSocket(session.socket, 1000, "Left room.");
      }
      return;
    }

    const leaveResult = this.roomState.leavePlayer(
      playerId,
      new Date(),
      closeSocket ? "HOST_ABORTED" : "HOST_DISCONNECTED",
    );
    console.info("[room-do] leave player", {
      roomId: this.roomState.getRoomId(),
      playerId,
      closeSocket,
      leaveReason: closeSocket ? "HOST_ABORTED" : "HOST_DISCONNECTED",
      wasHost: leaveResult.was_host,
      roomWasClosed: leaveResult.room_was_closed,
      roomState: this.roomState.getRoomState(),
    });
    if (!leaveResult.changed) {
      if (closeSocket) {
        this.safeCloseSocket(session.socket, 1000, "Left room.");
      }
      return;
    }

    if (leaveResult.was_host && !leaveResult.room_was_closed) {
      await this.persistRoomRecord();
      await this.syncAlarm();
      if (this.roomState.getRoomState() === "CLOSED") {
        await this.clearAlarm();
        this.broadcastRoomClosed(true);
        await this.removeLobbyDirectoryEntry();
        this.disconnectAll(4000, closeSocket ? "Host left." : "Host disconnected.");
        return;
      }

      await this.syncLobbyDirectory();
      this.broadcastRoomUpdated();
      return;
    }

    await this.persistRoomRecord();
    await this.syncLobbyDirectory();
    this.broadcastRoomUpdated();
    if (closeSocket) {
      this.safeCloseSocket(session.socket, 1000, "Left room.");
    }
  }

  private async handleReadySet(session: RoomSocketSession, message: ClientMessage<"READY_SET">): Promise<void> {
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
      this.sendError(session.socket, "INVALID_STATE", "READY_SET is only available in LOBBY.");
      return;
    }

    await this.persistRoomRecord();
    this.broadcast("READY_STATUS_CHANGED", {
      player_id: session.playerId,
      ready: payload.ready,
    });
    this.broadcastRoomUpdated();
  }

  private async handleStartMatch(
    session: RoomSocketSession,
    message: ClientMessage<"START_MATCH">,
  ): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseRequestIdPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "START_MATCH payload is invalid.");
      return;
    }

    if (this.isDuplicateRequest(session.playerId, message.type, payload.request_id)) {
      this.sendStateSnapshot(session.socket);
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
        case "PREVIOUS_MATCH_NOT_CLEARED":
          this.sendStartMatchRejected(session.socket, "PREVIOUS_MATCH_NOT_CLEARED");
          return;
        case "BPL_REQUIRES_TWO_PLAYERS":
          this.sendStartMatchRejected(session.socket, "BPL_REQUIRES_TWO_PLAYERS");
          return;
        default:
          this.sendStartMatchRejected(session.socket, "INVALID_STATE");
          return;
      }
    }

    this.rememberRequest(session.playerId, message.type, payload.request_id);
    await this.persistRoomRecord();
    await this.syncAlarm();
    await this.syncLobbyDirectory();
    this.broadcast("ROOM_NOTIFICATION", {
      kind: "match_found",
      event_id: this.nextEventId("match_found"),
      scheduled_at: new Date().toISOString(),
    });
    this.broadcastRoomUpdated();
  }

  private async handleReturnToLobby(
    session: RoomSocketSession,
    message: ClientMessage<"RETURN_TO_LOBBY">,
  ): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseRequestIdPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "RETURN_TO_LOBBY payload is invalid.");
      return;
    }

    if (this.isDuplicateRequest(session.playerId, message.type, payload.request_id)) {
      this.sendStateSnapshot(session.socket);
      return;
    }

    const result = this.roomState.returnToLobby(session.playerId, new Date());
    if (!result.ok) {
      if (result.reason === "NOT_HOST") {
        this.sendError(session.socket, "NOT_HOST", "Only the host can return the room to LOBBY.");
        return;
      }

      this.sendError(session.socket, "INVALID_STATE", "RETURN_TO_LOBBY is only available in RESULT.");
      return;
    }

    this.rememberRequest(session.playerId, message.type, payload.request_id);
    await this.persistRoomRecord();
    await this.syncAlarm();
    await this.syncLobbyDirectory();
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

    if (this.isDuplicateRequest(session.playerId, message.type, payload.request_id)) {
      this.sendStateSnapshot(session.socket);
      return;
    }

    const result = this.roomState.submitPick(session.playerId, payload.pick_chart_key, new Date());
    if (!result.ok || result.accepted_pick === undefined) {
      this.send(session.socket, "PICK_REJECTED", {
        reason: result.reason ?? "PICK_REJECTED",
      });
      return;
    }

    this.rememberRequest(session.playerId, message.type, payload.request_id);
    await this.persistRoomRecord();
    this.broadcastAcceptedPick(result.accepted_pick);
    this.broadcastFrozenRoundTransition(result.frozen_rounds, result.round_begin);

    await this.syncAlarm();
    await this.syncLobbyDirectory();
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

    if (this.isDuplicateRequest(session.playerId, message.type, payload.request_id)) {
      this.sendStateSnapshot(session.socket);
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

    this.rememberRequest(session.playerId, message.type, payload.request_id);
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

    if (this.isDuplicateRequest(session.playerId, message.type, payload.request_id)) {
      this.sendStateSnapshot(session.socket);
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

    this.rememberRequest(session.playerId, message.type, payload.request_id);
    await this.publishRoundTransition(result);
  }

  private async handleSkipHostAssign(
    session: RoomSocketSession,
    _message: ClientMessage<"SKIP_HOST_ASSIGN">,
  ): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    this.sendError(session.socket, "INVALID_STATE", "SKIP_HOST_ASSIGN is disabled. Use SKIP_SELF.");
  }

  private async handleForceAdvance(
    session: RoomSocketSession,
    message: ClientMessage<"FORCE_ADVANCE">,
  ): Promise<void> {
    if (session.playerId === null) {
      this.sendError(session.socket, "INVALID_STATE", "Send ROOM_JOIN before this message.");
      return;
    }

    const payload = parseRequestIdPayload(message.payload);
    if (payload === null) {
      this.sendError(session.socket, "INVALID_STATE", "FORCE_ADVANCE payload is invalid.");
      return;
    }

    if (this.isDuplicateRequest(session.playerId, message.type, payload.request_id)) {
      this.sendStateSnapshot(session.socket);
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

    this.rememberRequest(session.playerId, message.type, payload.request_id);
    await this.publishRoundTransition(result);
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

  private buildRoomClosedPayload(): ServerMessagePayloadMap["ROOM_CLOSED"] {
    const snapshot = this.roomState.toSnapshot();
    if (snapshot.close_reason == null || snapshot.closed_at == null) {
      throw new Error("Closed room snapshot is missing close metadata.");
    }

    return {
      close_reason: snapshot.close_reason,
      closed_at: snapshot.closed_at,
      result_ready: snapshot.result_ready,
      event_id: this.nextEventId(`cancel:${snapshot.close_reason}`),
    };
  }

  private broadcastRoomClosed(includeUnjoined = false): void {
    this.broadcast("ROOM_CLOSED", this.buildRoomClosedPayload(), includeUnjoined);
  }

  private isDuplicateMessage(playerId: string, clientMessageId: string): boolean {
    if (this.hasSeenClientMessageId(playerId, clientMessageId)) {
      return true;
    }

    this.rememberClientMessageId(playerId, clientMessageId);
    return false;
  }

  private hasSeenClientMessageId(playerId: string, clientMessageId: string): boolean {
    const seenIds = this.seenClientMessageIds.get(playerId);
    return seenIds?.has(clientMessageId) ?? false;
  }

  private rememberClientMessageId(playerId: string, clientMessageId: string): void {
    let seenIds = this.seenClientMessageIds.get(playerId);
    if (seenIds === undefined) {
      seenIds = new Set<string>();
      this.seenClientMessageIds.set(playerId, seenIds);
    }

    if (seenIds.has(clientMessageId)) {
      return;
    }

    seenIds.add(clientMessageId);
    while (seenIds.size > IDEMPOTENCY_LOG_LIMIT) {
      const oldest = seenIds.values().next().value;
      if (typeof oldest !== "string") {
        break;
      }

      seenIds.delete(oldest);
    }
  }

  private clearSeenClientMessageIds(): void {
    this.seenClientMessageIds.clear();
  }

  private buildRequestKey(playerId: string, type: string, requestId: string): string {
    return `${playerId}:${type}:${requestId}`;
  }

  private isDuplicateRequest(playerId: string, type: string, requestId: string): boolean {
    return this.processedRequestKeySet.has(this.buildRequestKey(playerId, type, requestId));
  }

  private rememberRequest(playerId: string, type: string, requestId: string): void {
    const key = this.buildRequestKey(playerId, type, requestId);
    if (this.processedRequestKeySet.has(key)) {
      return;
    }

    this.processedRequestKeySet.add(key);
    this.processedRequestKeys.push(key);
    if (this.processedRequestKeys.length > REQUEST_ID_LOG_LIMIT) {
      const removed = this.processedRequestKeys.shift();
      if (removed !== undefined) {
        this.processedRequestKeySet.delete(removed);
      }
    }
  }

  private nextEventId(kind: string): string {
    this.nextEventSeq += 1;
    return `${kind}:${this.roomState.getRoomId()}:${this.nextEventSeq}`;
  }

  private disconnectAll(code: number, reason: string): void {
    const sessions = Array.from(this.sessionsBySocket.values());
    this.sessionsBySocket.clear();
    this.activeSocketByPlayerId.clear();

    for (const session of sessions) {
      this.clearSessionPlayerBinding(session);
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

  private async persistRoomRecord(): Promise<void> {
    if (this.roomState.getRoomState() === "CLOSED") {
      // CLOSED means the room lifecycle ended, so message-level dedupe history is discarded.
      this.clearSeenClientMessageIds();
    }

    const record: RoomDurableRecord = {
      room_state: this.roomState.toPersistenceRecord(),
      processed_request_keys: [...this.processedRequestKeys],
      seen_client_message_ids: serializeSeenClientMessageIds(this.seenClientMessageIds),
      next_event_seq: this.nextEventSeq,
    };
    await this.state.storage.put(ROOM_RECORD_STORAGE_KEY, record);
  }

  private async publishRoundTransition(result: RoundTransitionResult): Promise<void> {
    await this.persistRoomRecord();
    await this.syncAlarm();
    await this.syncLobbyDirectory();
    this.broadcastRoundTransition(result);
    this.broadcastRoomUpdated();
    if (this.roomState.getRoomState() === "CLOSED") {
      this.broadcastRoomClosed();
    }
  }

  private async processDueTransitions(now: Date): Promise<boolean> {
    if (await this.closeHostDisconnectOnTimeout(now)) {
      return true;
    }

    if (await this.closeReadyCheckOnTimeout(now)) {
      return true;
    }

    const pickingTransition = this.roomState.expirePickingIfNeeded(now);
    if (pickingTransition !== null) {
      await this.persistRoomRecord();
      this.broadcastPickingTimeoutTransition(pickingTransition);
      await this.syncAlarm();
      await this.syncLobbyDirectory();
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

  private async closeHostDisconnectOnTimeout(now: Date): Promise<boolean> {
    const closed = this.roomState.closeHostDisconnectIfExpired(now);
    if (!closed) {
      return false;
    }

    await this.persistRoomRecord();
    await this.clearAlarm();
    this.broadcastRoomClosed(true);
    await this.removeLobbyDirectoryEntry();
    this.disconnectAll(4000, "Host disconnected.");
    return true;
  }

  private async closeReadyCheckOnTimeout(now: Date): Promise<boolean> {
    const closed = this.roomState.closeReadyCheckIfExpired(now);
    if (!closed) {
      return false;
    }

    await this.persistRoomRecord();
    await this.clearAlarm();
    this.broadcastRoomClosed(true);
    await this.removeLobbyDirectoryEntry();
    this.disconnectAll(4001, "Ready check timed out.");
    return true;
  }

  private deriveLobbyRoomName(snapshot: RoomStateSnapshot): string {
    const comment = snapshot.settings.room_comment.trim();
    if (comment.length > 0) {
      return comment;
    }

    return `${snapshot.settings.mode} ${snapshot.settings.play_style}`;
  }

  private resolveLobbyStatus(roomState: RoomStateSnapshot["room_state"]): LobbyRoomSummary["status"] | null {
    switch (roomState) {
      case "LOBBY":
      case "PICKING":
      case "PLAYING":
      case "RESULT":
        return roomState;
      default:
        return null;
    }
  }

  private resolveLobbyTtlStartedAt(snapshot: RoomStateSnapshot, createdAtMs: number): number {
    const parseTimestamp = (value: string | null): number | null => {
      if (value === null) {
        return null;
      }

      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    if (snapshot.room_state === "LOBBY") {
      const readyCheckDeadline = parseTimestamp(snapshot.timers.ready_check_deadline);
      if (readyCheckDeadline !== null) {
        return readyCheckDeadline - READY_CHECK_TTL_MS;
      }
      return createdAtMs;
    }

    const matchDeadline = parseTimestamp(snapshot.timers.match_deadline);
    if (matchDeadline !== null) {
      return matchDeadline - MATCH_TTL_MS;
    }

    return createdAtMs;
  }

  private buildLobbySummary(snapshot: RoomStateSnapshot, nowMs: number): LobbyRoomSummary | null {
    if (snapshot.settings.visibility !== "PUBLIC") {
      return null;
    }

    const status = this.resolveLobbyStatus(snapshot.room_state);
    if (status === null) {
      return null;
    }

    if (typeof snapshot.created_at !== "string") {
      return null;
    }
    const createdAtMs = Date.parse(snapshot.created_at);
    if (!Number.isFinite(createdAtMs)) {
      return null;
    }

    const hostPlayer = snapshot.players.find((player) => player.player_id === snapshot.host_player_id);
    const currentPlayers = snapshot.players.length;
    const maxPlayers = snapshot.settings.max_players;

    return {
      roomId: snapshot.room_id,
      roomName: this.deriveLobbyRoomName(snapshot),
      ownerUserId: hostPlayer?.player_id ?? snapshot.host_player_id,
      ownerDisplayName: hostPlayer?.display_name ?? "",
      mode: snapshot.settings.mode,
      playStyle: snapshot.settings.play_style,
      levelFilter: snapshot.settings.level_filter,
      winMetric: snapshot.settings.win_metric,
      hasJoinCode: snapshot.settings.join_code !== null,
      isPublic: true,
      currentPlayers,
      maxPlayers,
      isFull: currentPlayers >= maxPlayers,
      status,
      ttlStartedAt: this.resolveLobbyTtlStartedAt(snapshot, createdAtMs),
      createdAt: createdAtMs,
      updatedAt: nowMs,
    };
  }

  private async removeLobbyDirectoryEntry(): Promise<void> {
    if (!this.roomState.isInitialized()) {
      return;
    }

    try {
      await removeLobbyDirectoryRoom(this.env, this.roomState.getRoomId());
    } catch {
      // no-op: lobby listing is best-effort from room events
    }
  }

  private async syncLobbyDirectory(): Promise<void> {
    if (!this.roomState.isInitialized()) {
      return;
    }

    const snapshot = this.roomState.toSnapshot();
    const nowMs = Date.now();
    const summary = this.buildLobbySummary(snapshot, nowMs);

    if (summary === null) {
      await this.removeLobbyDirectoryEntry();
      return;
    }

    try {
      await upsertLobbyDirectoryRoom(this.env, summary);
    } catch {
      // no-op: listing will converge on next state update/poll
    }
  }
}
