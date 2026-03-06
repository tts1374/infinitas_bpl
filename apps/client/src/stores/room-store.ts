import type {
  ClientMessagePayloadMap,
  ClientMessageType,
  ErrorCode,
  ResultReadyPayload,
  RoomStateSnapshot,
  ServerMessage,
  ServerMessagePayloadMap,
  SkipReason,
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
}

export interface RoomConnectionSettings {
  apiBaseUrl: string;
  playerId: string;
  displayName: string;
  source: SourceType;
}

let activeClient: RoomSocketClient | null = null;

const initialState: RoomStoreState = {
  roomId: null,
  joinCode: null,
  connectionStatus: "DISCONNECTED",
  connectionDetail: "No active room.",
  snapshot: null,
  resultReady: null,
  errorDialog: null,
  eventLog: [],
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
      return `Room closed: ${payload.reason}.`;
    }
    default:
      return null;
  }
}

function updateClosedSnapshot(reason: string, closedAt: string): void {
  internalStore.setState((state) => ({
    ...state,
    snapshot:
      state.snapshot === null
        ? null
        : {
            ...state.snapshot,
            room_state: "CLOSED",
            closed_at: closedAt,
            close_reason: reason,
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
      internalStore.setState((state) => ({
        ...state,
        snapshot: payload.room_state_snapshot,
        roomId: payload.room_state_snapshot.room_id,
        connectionStatus: "CONNECTED",
        connectionDetail: `Connected to ${payload.room_state_snapshot.room_state}.`,
      }));
      return;
    }
    case "ROOM_JOIN_REJECTED": {
      const payload = message.payload as ServerMessagePayloadMap["ROOM_JOIN_REJECTED"];
      closeCurrentClient(false);
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: "ERROR",
        connectionDetail: "Join rejected.",
      }));
      setErrorDialog("Join rejected", payload.reason);
      return;
    }
    case "START_MATCH_REJECTED": {
      const payload = message.payload as ServerMessagePayloadMap["START_MATCH_REJECTED"];
      setErrorDialog("Start rejected", payload.reason);
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
      updateClosedSnapshot(payload.reason, message.server_time);
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: "CLOSED",
        connectionDetail: `Room closed: ${payload.reason}.`,
      }));
      setErrorDialog("Room closed", payload.reason, undefined, true);
      return;
    }
    case "ERROR": {
      const payload = message.payload as ServerMessagePayloadMap["ERROR"];
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: payload.code === "ROOM_STATE_LOST" ? "CLOSED" : state.connectionStatus,
      }));
      setErrorDialog(
        errorTitleFromCode(payload.code),
        payload.message,
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
    internalStore.setState(initialState);
  },
  clearError(): void {
    internalStore.setState((state) => ({
      ...state,
      errorDialog: null,
    }));
  },
  send<TType extends ClientMessageType>(
    type: TType,
    payload: ClientMessagePayloadMap[TType],
  ): boolean {
    if (activeClient === null) {
      setErrorDialog("No active room", "Join a room before sending room actions.");
      return false;
    }

    try {
      activeClient.send(type, payload);
      return true;
    } catch (error) {
      setErrorDialog("Send failed", error instanceof Error ? error.message : "Failed to send message.");
      return false;
    }
  },
  skipSelf(roundIndex: number, reason: SkipReason): boolean {
    return this.send("SKIP_SELF", {
      round_index: roundIndex,
      reason,
    });
  },
};

export function useRoomStore<TSelected>(selector: (state: RoomStoreState) => TSelected): TSelected {
  return useExternalStore(internalStore, selector);
}
