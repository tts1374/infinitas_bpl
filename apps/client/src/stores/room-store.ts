import type {
  CloseReason,
  ClientMessagePayloadMap,
  ClientMessageType,
  ErrorCode,
  ResultReadyPayload,
  RoomStateSnapshot,
  ServerMessage,
  ServerMessagePayloadMap,
  SkipReason,
  SoundEffectKey,
  SourceType,
} from "@infinitas/shared";
import { RoomSocketClient, type SocketConnectionState } from "../services/ws-client";
import { createExternalStore, useExternalStore } from "./create-store";

export type RoomConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "JOINING"
  | "CONNECTED"
  | "CLOSED"
  | "ERROR";

export interface RoomDialogState {
  title: string;
  description: string;
  blocking: boolean;
  code?: string;
}

export interface RoomStoreState {
  roomId: string | null;
  joinCode: string | null;
  connectionStatus: RoomConnectionStatus;
  connectionDetail: string;
  snapshot: RoomStateSnapshot | null;
  resultReady: ResultReadyPayload | null;
  errorDialog: RoomDialogState | null;
  eventLog: string[];
  audioEvents: RoomAudioEvent[];
}

export interface RoomConnectionSettings {
  apiBaseUrl: string;
  playerId: string;
  displayName: string;
  source: SourceType;
}

let activeClient: RoomSocketClient | null = null;
const requestIdsByKey = new Map<string, string>();

export interface RoomAudioEvent {
  kind: SoundEffectKey;
  eventId: string;
  scheduledAt: string;
  closeReason?: CloseReason | null;
}

const initialState: RoomStoreState = {
  roomId: null,
  joinCode: null,
  connectionStatus: "DISCONNECTED",
  connectionDetail: "No active room.",
  snapshot: null,
  resultReady: null,
  errorDialog: null,
  eventLog: [],
  audioEvents: [],
};

const internalStore = createExternalStore<RoomStoreState>(initialState);

function mapSocketState(state: SocketConnectionState): RoomConnectionStatus {
  switch (state) {
    case "CONNECTING":
      return "CONNECTING";
    case "JOINING":
      return "JOINING";
    case "CONNECTED":
      return "CONNECTED";
    case "DISCONNECTED":
    default:
      return "DISCONNECTED";
  }
}

function appendEventLog(message: string): void {
  internalStore.setState((state) => ({
    ...state,
    eventLog: [message, ...state.eventLog].slice(0, 12),
  }));
}

function clearRequestIds(): void {
  requestIdsByKey.clear();
}

function getOrCreateRequestId(key: string): string {
  const existing = requestIdsByKey.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  requestIdsByKey.set(key, nextId);
  return nextId;
}

function pushAudioEvent(event: RoomAudioEvent): void {
  internalStore.setState((state) => ({
    ...state,
    audioEvents: [event, ...state.audioEvents].slice(0, 24),
  }));
}

function setErrorDialog(title: string, description: string, code?: string, blocking = false): void {
  const errorDialog: RoomDialogState =
    code === undefined
      ? {
          title,
          description,
          blocking,
        }
      : {
          title,
          description,
          blocking,
          code,
        };

  internalStore.setState((state) => ({
    ...state,
    errorDialog,
  }));
}

function buildSourceUnavailableDescription(detail: string, roomState: RoomStateSnapshot["room_state"]): string {
  if (roomState === "PLAYING") {
    return `${detail} Use TECH skip if this round cannot be auto-submitted.`;
  }

  return detail;
}

function buildRoomStateLostDescription(detail: string): string {
  return `${detail} The room has been closed locally. Review the latest saved snapshot for partial results.`;
}

function startMatchRejectMessage(reason: string): string {
  switch (reason) {
    case "START_REQUIRES_MIN_PLAYERS":
      return "At least two players are required.";
    case "NOT_ALL_PLAYERS_READY":
      return "All current players must be READY before the match starts.";
    case "BPL_REQUIRES_TWO_PLAYERS":
      return "BPL mode requires exactly two players.";
    default:
      return reason;
  }
}

function closeCurrentClient(sendLeaveMessage: boolean): void {
  const client = activeClient;
  activeClient = null;
  client?.disconnect(sendLeaveMessage);
}

function errorTitleFromCode(code: ErrorCode): string {
  switch (code) {
    case "ROOM_FULL":
      return "Room full";
    case "JOIN_CODE_INVALID":
      return "Join code invalid";
    case "NOT_HOST":
      return "Host only action";
    case "INVALID_STATE":
      return "Invalid state";
    case "START_REQUIRES_MIN_PLAYERS":
      return "Not enough players";
    case "RESULT_KEY_MISMATCH":
      return "Result key mismatch";
    case "ROUND_ALREADY_CONFIRMED":
      return "Round already confirmed";
    case "HOST_SKIP_LOCKED":
      return "Host skip locked";
    case "ROOM_STATE_LOST":
      return "Room state lost";
    case "SOURCE_UNAVAILABLE":
      return "Source unavailable";
    default:
      return "Room error";
  }
}

function formatEvent(message: ServerMessage): string | null {
  switch (message.type) {
    case "READY_CHECK_OPENED": {
      return "READY_CHECK opened.";
    }
    case "READY_STATUS_CHANGED": {
      const payload = message.payload as ServerMessagePayloadMap["READY_STATUS_CHANGED"];
      return `${payload.player_id} ready=${String(payload.ready)}.`;
    }
    case "PICK_ACCEPTED": {
      const payload = message.payload as ServerMessagePayloadMap["PICK_ACCEPTED"];
      return `${payload.player_id} picked ${payload.pick_chart_key}.`;
    }
    case "PICK_FROZEN": {
      const payload = message.payload as ServerMessagePayloadMap["PICK_FROZEN"];
      return `Frozen ${payload.frozen_rounds.length} rounds.`;
    }
    case "ROUND_BEGIN": {
      const payload = message.payload as ServerMessagePayloadMap["ROUND_BEGIN"];
      return `Round ${payload.round_index + 1} started.`;
    }
    case "PLAYER_ROUND_CONFIRMED": {
      const payload = message.payload as ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"];
      return `${payload.player_id} confirmed ${payload.status}.`;
    }
    case "ROUND_ENDED": {
      const payload = message.payload as ServerMessagePayloadMap["ROUND_ENDED"];
      return `Round ${payload.round_index + 1} ended.`;
    }
    case "FORCE_ADVANCE_APPLIED": {
      const payload = message.payload as ServerMessagePayloadMap["FORCE_ADVANCE_APPLIED"];
      return `Force advance applied to ${payload.timed_out_players.length} player(s).`;
    }
    case "RESULT_READY":
      return "Result summary ready.";
    case "ROOM_CLOSED": {
      const payload = message.payload as ServerMessagePayloadMap["ROOM_CLOSED"];
      return `Room closed: ${payload.close_reason}.`;
    }
    case "ROOM_NOTIFICATION": {
      const payload = message.payload as ServerMessagePayloadMap["ROOM_NOTIFICATION"];
      return `Notification: ${payload.kind}.`;
    }
    default:
      return null;
  }
}

function updateClosedSnapshot(closeReason: CloseReason, closedAt: string, resultReady: boolean): void {
  internalStore.setState((state) => ({
    ...state,
    snapshot:
      state.snapshot === null
        ? null
        : {
            ...state.snapshot,
            room_state: "CLOSED",
            closed_at: closedAt,
            close_reason: closeReason,
            result_ready: resultReady,
          },
  }));
}

function handleServerMessage(client: RoomSocketClient, message: ServerMessage): void {
  if (activeClient !== client) {
    return;
  }

  const eventMessage = formatEvent(message);
  if (eventMessage) {
    appendEventLog(eventMessage);
  }

  switch (message.type) {
    case "ROOM_JOIN_ACCEPTED":
    case "ROOM_UPDATED":
    case "STATE_SNAPSHOT": {
      const payload = message.payload as { room_state_snapshot: RoomStateSnapshot };
      const previousSnapshot = internalStore.getState().snapshot;
      if (
        payload.room_state_snapshot.room_state === "CLOSED" &&
        previousSnapshot?.room_state !== "CLOSED"
      ) {
        appendEventLog(`Room closed: ${payload.room_state_snapshot.close_reason ?? "CLOSED"}.`);
      }

      internalStore.setState((state) => ({
        ...state,
        snapshot: payload.room_state_snapshot,
        roomId: payload.room_state_snapshot.room_id,
        connectionStatus: "CONNECTED",
        connectionDetail: `Connected to ${payload.room_state_snapshot.room_state}.`,
      }));
      return;
    }
    case "ROOM_NOTIFICATION": {
      const payload = message.payload as ServerMessagePayloadMap["ROOM_NOTIFICATION"];
      pushAudioEvent({
        kind: payload.kind,
        eventId: payload.event_id,
        scheduledAt: payload.scheduled_at,
      });
      return;
    }
    case "ROOM_JOIN_REJECTED": {
      const payload = message.payload as ServerMessagePayloadMap["ROOM_JOIN_REJECTED"];
      closeCurrentClient(false);
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: payload.reason === "ROOM_STATE_LOST" ? "CLOSED" : "ERROR",
        connectionDetail: payload.reason === "ROOM_STATE_LOST" ? "Room state lost." : "Join rejected.",
      }));
      if (payload.reason === "ROOM_STATE_LOST") {
        setErrorDialog(
          "Room state lost",
          buildRoomStateLostDescription("The room could not be recovered."),
          payload.reason,
          true,
        );
        return;
      }

      setErrorDialog("Join rejected", payload.reason);
      return;
    }
    case "START_MATCH_REJECTED": {
      const payload = message.payload as ServerMessagePayloadMap["START_MATCH_REJECTED"];
      setErrorDialog("Start rejected", startMatchRejectMessage(payload.reason), payload.reason);
      return;
    }
    case "PICK_REJECTED": {
      const payload = message.payload as ServerMessagePayloadMap["PICK_REJECTED"];
      setErrorDialog("Pick rejected", payload.reason);
      return;
    }
    case "RESULT_READY": {
      const payload = message.payload as ResultReadyPayload;
      internalStore.setState((state) => ({
        ...state,
        resultReady: payload,
      }));
      return;
    }
    case "ROOM_CLOSED": {
      const payload = message.payload as ServerMessagePayloadMap["ROOM_CLOSED"];
      updateClosedSnapshot(payload.close_reason, payload.closed_at, payload.result_ready);
      pushAudioEvent({
        kind: "cancel",
        eventId: payload.event_id,
        scheduledAt: payload.closed_at,
        closeReason: payload.close_reason,
      });
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: "CLOSED",
        connectionDetail: `Room closed: ${payload.close_reason}.`,
      }));
      if (payload.close_reason !== "ALL_ROUNDS_COMPLETED") {
        setErrorDialog("Room closed", payload.close_reason, undefined, true);
      }
      return;
    }
    case "ERROR": {
      const payload = message.payload as ServerMessagePayloadMap["ERROR"];
      pushAudioEvent({
        kind: "error",
        eventId: `error:${message.server_time}:${payload.code}`,
        scheduledAt: message.server_time,
      });
      const snapshot = internalStore.getState().snapshot;
      const description =
        payload.code === "ROOM_STATE_LOST"
          ? buildRoomStateLostDescription(payload.message)
          : payload.code === "SOURCE_UNAVAILABLE" && snapshot !== null
            ? buildSourceUnavailableDescription(payload.message, snapshot.room_state)
            : payload.message;

      if (payload.code === "ROOM_STATE_LOST") {
        closeCurrentClient(false);
        updateClosedSnapshot("FORCE_CLOSED", message.server_time, internalStore.getState().resultReady !== null);
        appendEventLog("Room state lost. Showing the latest local snapshot.");
      }

      internalStore.setState((state) => ({
        ...state,
        connectionStatus: payload.code === "ROOM_STATE_LOST" ? "CLOSED" : state.connectionStatus,
        connectionDetail: payload.code === "ROOM_STATE_LOST" ? "Room state lost." : state.connectionDetail,
      }));
      setErrorDialog(
        errorTitleFromCode(payload.code),
        description,
        payload.code,
        payload.code === "ROOM_STATE_LOST" || payload.code === "SOURCE_UNAVAILABLE",
      );
      return;
    }
    default:
      return;
  }
}

export const roomStore = {
  ...internalStore,
  connect(
    connection: { roomId: string; joinCode?: string | null },
    settings: RoomConnectionSettings,
  ): boolean {
    const trimmedDisplayName = settings.displayName.trim();
    if (trimmedDisplayName.length === 0) {
      setErrorDialog("Display name required", "Save a non-empty display name before joining.");
      return false;
    }

    closeCurrentClient(false);
    clearRequestIds();

    internalStore.setState({
      ...initialState,
      roomId: connection.roomId,
      joinCode: connection.joinCode?.trim() || null,
      connectionStatus: "CONNECTING",
      connectionDetail: `Opening room ${connection.roomId}.`,
    });

    const client = new RoomSocketClient({
      apiBaseUrl: settings.apiBaseUrl,
      roomId: connection.roomId,
      playerId: settings.playerId,
      displayName: trimmedDisplayName,
      source: settings.source,
      joinCode: connection.joinCode ?? null,
      onMessage(message) {
        handleServerMessage(client, message);
      },
      onStateChange(state, detail) {
        if (activeClient !== client) {
          return;
        }

        internalStore.setState((currentState) => ({
          ...currentState,
          connectionStatus:
            currentState.connectionStatus === "CLOSED" ? currentState.connectionStatus : mapSocketState(state),
          connectionDetail: detail,
        }));
      },
      onError(error) {
        if (activeClient !== client) {
          return;
        }

        internalStore.setState((state) => ({
          ...state,
          connectionStatus: "ERROR",
          connectionDetail: error.message,
        }));
        setErrorDialog("WebSocket error", error.message);
      },
      onClose(event) {
        if (activeClient !== client) {
          return;
        }

        activeClient = null;
        internalStore.setState((state) => ({
          ...state,
          connectionStatus:
            state.connectionStatus === "CLOSED" ? "CLOSED" : event.code === 1000 ? "DISCONNECTED" : "ERROR",
          connectionDetail:
            state.connectionStatus === "CLOSED"
              ? state.connectionDetail
              : event.reason || `Socket closed (${event.code}).`,
        }));
      },
    });

    activeClient = client;

    try {
      client.connect();
      return true;
    } catch (error) {
      activeClient = null;
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: "ERROR",
        connectionDetail: error instanceof Error ? error.message : "Failed to connect.",
      }));
      setErrorDialog("Connection failed", error instanceof Error ? error.message : "Failed to connect.");
      return false;
    }
  },
  leaveRoom(): void {
    closeCurrentClient(true);
    clearRequestIds();
    internalStore.setState(initialState);
  },
  clearError(): void {
    internalStore.setState((state) => ({
      ...state,
      errorDialog: null,
    }));
  },
  noteLocalEvent(message: string): void {
    if (internalStore.getState().snapshot === null) {
      return;
    }

    appendEventLog(message);
  },
  reportSourceUnavailable(detail: string): void {
    const state = internalStore.getState();
    if (state.snapshot === null || state.snapshot.room_state === "CLOSED") {
      return;
    }

    const description = buildSourceUnavailableDescription(detail, state.snapshot.room_state);
    if (
      state.errorDialog?.code === "SOURCE_UNAVAILABLE" &&
      state.errorDialog.description === description
    ) {
      return;
    }

    appendEventLog(`Source unavailable: ${detail}`);
    setErrorDialog(
      "Source unavailable",
      description,
      "SOURCE_UNAVAILABLE",
      state.snapshot.room_state === "PLAYING",
    );
  },
  send<TType extends ClientMessageType>(
    type: TType,
    payload: ClientMessagePayloadMap[TType],
  ): boolean {
    if (activeClient === null) {
      setErrorDialog("No active room", "Join a room before sending room actions.");
      pushAudioEvent({
        kind: "error",
        eventId: `error:local:${Date.now()}:no-active-room`,
        scheduledAt: new Date().toISOString(),
      });
      return false;
    }

    try {
      activeClient.send(type, payload);
      return true;
    } catch (error) {
      setErrorDialog("Send failed", error instanceof Error ? error.message : "Failed to send message.");
      pushAudioEvent({
        kind: "error",
        eventId: `error:local:${Date.now()}:send-failed`,
        scheduledAt: new Date().toISOString(),
      });
      return false;
    }
  },
  startMatch(): boolean {
    return this.send("START_MATCH", {
      request_id: getOrCreateRequestId("START_MATCH"),
    });
  },
  submitPick(pickChartKey: string): boolean {
    return this.send("PICK_SUBMIT", {
      request_id: getOrCreateRequestId(`PICK_SUBMIT:${pickChartKey}`),
      pick_chart_key: pickChartKey,
    });
  },
  submitResult(input: {
    round_index: number;
    observed_key: ClientMessagePayloadMap["RESULT_SUBMIT"]["observed_key"];
    metric_value: number;
    source_meta?: ClientMessagePayloadMap["RESULT_SUBMIT"]["source_meta"];
  }): boolean {
    const requestKey =
      `RESULT_SUBMIT:${input.round_index}:${input.metric_value}:` +
      `${input.observed_key.play_style}:${input.observed_key.difficulty}:${input.observed_key.title_search_key}`;
    return this.send("RESULT_SUBMIT", {
      request_id: getOrCreateRequestId(requestKey),
      round_index: input.round_index,
      observed_key: input.observed_key,
      metric_value: input.metric_value,
      ...(input.source_meta === undefined ? {} : { source_meta: input.source_meta }),
    });
  },
  skipSelf(roundIndex: number, reason: SkipReason): boolean {
    return this.send("SKIP_SELF", {
      request_id: getOrCreateRequestId(`SKIP_SELF:${roundIndex}:${reason}`),
      round_index: roundIndex,
      reason,
    });
  },
  skipHostAssign(roundIndex: number, targetPlayerId: string, reason: SkipReason): boolean {
    return this.send("SKIP_HOST_ASSIGN", {
      request_id: getOrCreateRequestId(`SKIP_HOST_ASSIGN:${roundIndex}:${targetPlayerId}:${reason}`),
      round_index: roundIndex,
      target_player_id: targetPlayerId,
      reason,
    });
  },
  forceAdvance(roundIndex: number): boolean {
    return this.send("FORCE_ADVANCE", {
      request_id: getOrCreateRequestId(`FORCE_ADVANCE:${roundIndex}`),
    });
  },
};

export function useRoomStore<TSelected>(selector: (state: RoomStoreState) => TSelected): TSelected {
  return useExternalStore(internalStore, selector);
}
