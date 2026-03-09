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
  roundConfirmations: Record<number, Array<ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"]>>;
  endedRoundIndices: number[];
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
let activeMockScenarioId: string | null = null;
const requestIdsByKey = new Map<string, string>();
const DJ_NAME_PATTERN = /^[a-zA-Z0-9.\-*&!?#$]*$/;
const DJ_NAME_MAX_LENGTH = 6;

export interface MockRoomStoreState {
  scenarioId: string;
  roomId: string | null;
  joinCode: string | null;
  connectionStatus: RoomConnectionStatus;
  connectionDetail: string;
  snapshot: RoomStateSnapshot | null;
  resultReady: ResultReadyPayload | null;
  errorDialog?: RoomDialogState | null;
  roundConfirmations: Record<number, Array<ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"]>>;
  endedRoundIndices: number[];
  eventLog?: string[];
  audioEvents?: RoomAudioEvent[];
}

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
  roundConfirmations: {},
  endedRoundIndices: [],
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

function upsertRoundConfirmation(payload: ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"]): void {
  internalStore.setState((state) => {
    const currentEntries = state.roundConfirmations[payload.round_index] ?? [];
    const nextEntries = currentEntries.some((entry) => entry.player_id === payload.player_id)
      ? currentEntries.map((entry) => (entry.player_id === payload.player_id ? payload : entry))
      : [...currentEntries, payload];

    return {
      ...state,
      roundConfirmations: {
        ...state.roundConfirmations,
        [payload.round_index]: nextEntries,
      },
    };
  });
}

function markRoundEnded(roundIndex: number): void {
  internalStore.setState((state) => ({
    ...state,
    endedRoundIndices: state.endedRoundIndices.includes(roundIndex)
      ? state.endedRoundIndices
      : [...state.endedRoundIndices, roundIndex].sort((left, right) => left - right),
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
    case "PREVIOUS_MATCH_NOT_CLEARED":
      return "Previous match data is still being cleared.";
    case "BPL_REQUIRES_TWO_PLAYERS":
      return "BPL mode requires exactly two players.";
    case "INVALID_STATE":
      return "Return to the lobby before starting a new match.";
    default:
      return reason;
  }
}

function joinRejectDialog(reason: string, hasSnapshot: boolean): {
  title: string;
  description: string;
  code?: string;
  blocking?: boolean;
} {
  switch (reason) {
    case "ROOM_FULL":
      return {
        title: "参加できません",
        description: "部屋が満員でした",
      };
    case "INVALID_STATE":
      return {
        title: "参加できません",
        description: "対戦開始済みでした",
      };
    case "JOIN_CODE_INVALID":
      return {
        title: "参加できません",
        description: "合言葉が一致しませんでした",
      };
    case "ROOM_CLOSED":
      return {
        title: "参加できません",
        description: "部屋が解散しました",
      };
    case "ROOM_STATE_LOST":
      if (!hasSnapshot) {
        return {
          title: "参加できません",
          description: "部屋が見つかりませんでした",
        };
      }

      return {
        title: "Room state lost",
        description: buildRoomStateLostDescription("The room could not be recovered."),
        code: reason,
        blocking: true,
      };
    default:
      return {
        title: "Join rejected",
        description: reason,
      };
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
      const shouldResetRoundHistory =
        payload.room_state_snapshot.room_state === "LOBBY" &&
        payload.room_state_snapshot.current_round === null &&
        payload.room_state_snapshot.picks.length === 0 &&
        payload.room_state_snapshot.frozen_rounds.length === 0 &&
        !payload.room_state_snapshot.result_ready;
      if (
        payload.room_state_snapshot.room_state === "CLOSED" &&
        previousSnapshot?.room_state !== "CLOSED"
      ) {
        appendEventLog(`Room closed: ${payload.room_state_snapshot.close_reason ?? "CLOSED"}.`);
      }

      // Authoritative snapshots mark the end of a request cycle, so stale request_ids
      // must not leak into later rounds or rematches.
      clearRequestIds();

      internalStore.setState((state) => ({
        ...state,
        snapshot: payload.room_state_snapshot,
        resultReady: payload.room_state_snapshot.result_ready ? state.resultReady : null,
        roundConfirmations: shouldResetRoundHistory ? {} : state.roundConfirmations,
        endedRoundIndices: shouldResetRoundHistory ? [] : state.endedRoundIndices,
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
      const { snapshot } = internalStore.getState();
      const dialog = joinRejectDialog(payload.reason, snapshot !== null);
      closeCurrentClient(false);
      internalStore.setState((state) => ({
        ...state,
        connectionStatus: dialog.blocking ? "CLOSED" : "ERROR",
        connectionDetail: dialog.description,
      }));
      setErrorDialog(dialog.title, dialog.description, dialog.code, dialog.blocking ?? false);
      return;
    }
    case "START_MATCH_REJECTED": {
      const payload = message.payload as ServerMessagePayloadMap["START_MATCH_REJECTED"];
      setErrorDialog("Start rejected", startMatchRejectMessage(payload.reason), payload.reason);
      return;
    }
    case "PLAYER_ROUND_CONFIRMED": {
      const payload = message.payload as ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"];
      upsertRoundConfirmation(payload);
      return;
    }
    case "ROUND_ENDED": {
      const payload = message.payload as ServerMessagePayloadMap["ROUND_ENDED"];
      markRoundEnded(payload.round_index);
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
      clearRequestIds();
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
  hydrateMockScenario(input: MockRoomStoreState): void {
    closeCurrentClient(false);
    clearRequestIds();
    activeMockScenarioId = input.scenarioId;
    internalStore.setState({
      ...initialState,
      roomId: input.roomId,
      joinCode: input.joinCode,
      connectionStatus: input.connectionStatus,
      connectionDetail: input.connectionDetail,
      snapshot: input.snapshot,
      resultReady: input.resultReady,
      errorDialog: input.errorDialog ?? null,
      roundConfirmations: input.roundConfirmations,
      endedRoundIndices: input.endedRoundIndices,
      eventLog: input.eventLog ?? [`Mock scenario: ${input.scenarioId}`],
      audioEvents: input.audioEvents ?? [],
    });
  },
  connect(
    connection: { roomId: string; joinCode?: string | null },
    settings: RoomConnectionSettings,
  ): boolean {
    const displayNameError = validateDisplayName(settings.displayName);
    if (displayNameError !== null) {
      setErrorDialog("DJ NAME invalid", displayNameError);
      return false;
    }
    const trimmedDisplayName = settings.displayName.trim();

    closeCurrentClient(false);
    clearRequestIds();
    activeMockScenarioId = null;

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
    activeMockScenarioId = null;
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
    if (activeMockScenarioId !== null) {
      appendEventLog(`[mock] ${type}`);
      return true;
    }

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
  returnToLobby(): boolean {
    return this.send("RETURN_TO_LOBBY", {
      request_id: getOrCreateRequestId("RETURN_TO_LOBBY"),
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

function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "DJ NAME は必須です。";
  }

  if (Array.from(trimmed).length > DJ_NAME_MAX_LENGTH) {
    return "DJ NAME は6文字以内で入力してください。";
  }

  if (!DJ_NAME_PATTERN.test(trimmed)) {
    return "使用可能文字はa-z A-Z 0-9 .- *&!?#$です";
  }

  return null;
}
