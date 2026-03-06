import {
  LEVEL_FILTERS,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  VISIBILITIES,
  WIN_METRICS,
  type ErrorCode,
  type RoomSettings,
} from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";
import { asEnumValue, asOptionalString, isRecord } from "../utils/validation";
import { createServerEnvelope } from "./ws-codec";
import { RoomLobbyState, type RoomInitializationInput } from "./room-state";

interface RoomSocketSession {
  socket: WebSocket;
}

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

export class RoomDurableObject {
  private readonly roomState = new RoomLobbyState();
  private readonly sessionsBySocket = new Map<WebSocket, RoomSocketSession>();

  constructor(
    private readonly _state: unknown,
    private readonly _env: WorkerEnv,
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
    const session: RoomSocketSession = { socket };
    this.sessionsBySocket.set(socket, session);

    socket.addEventListener("message", () => {
      this.sendError(socket, "INVALID_STATE", "Room message handlers are not initialized.");
    });
    socket.addEventListener("close", () => {
      this.handleSocketClose(socket);
    });
    socket.addEventListener("error", () => {
      this.handleSocketClose(socket);
    });
  }

  private handleSocketClose(socket: WebSocket): void {
    this.sessionsBySocket.delete(socket);
  }

  private sendError(socket: WebSocket, code: ErrorCode, message: string): void {
    if (socket.readyState !== OPEN_WEBSOCKET_STATE) {
      return;
    }

    const roomId = this.roomState.isInitialized() ? this.roomState.getRoomId() : "";
    socket.send(JSON.stringify(createServerEnvelope(roomId, "ERROR", { code, message })));
  }
}
