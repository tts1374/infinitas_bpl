import {
  type ClientMessage,
  type CurrentRoundConfirmedPlayer,
  type ResultReadyPayload,
  type RoomStateSnapshot,
  type ServerMessagePayloadMap,
} from "@infinitas/shared";
import clientPackageJson from "../../package.json";

export type SpectatorConnectionState = "idle" | "connecting" | "joined" | "error" | "closed";

export interface FinalResultHistoryItem {
  payload: ResultReadyPayload;
  receivedAtIso: string;
}

const APP_VERSION = typeof clientPackageJson.version === "string" ? clientPackageJson.version : "unknown";

export function buildSpectatorWebSocketUrl(apiBaseUrl: string, roomId: string): string {
  const normalizedBaseUrl = apiBaseUrl.trim().replace(/\/+$/, "");
  if (normalizedBaseUrl.length === 0) {
    throw new Error("Worker API URL is required.");
  }

  const httpUrl = new URL(`${normalizedBaseUrl}/api/rooms/${encodeURIComponent(roomId)}/ws`);
  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return httpUrl.toString();
}

export function buildSpectatorJoinMessage(input: {
  roomId: string;
  spectatorId: string;
  joinCode?: string | null;
}): ClientMessage<"ROOM_JOIN"> {
  const trimmedJoinCode = input.joinCode?.trim() ?? "";
  return {
    type: "ROOM_JOIN",
    client_msg_id: crypto.randomUUID(),
    room_id: input.roomId,
    player_id: input.spectatorId,
    payload: {
      session_kind: "SPECTATOR",
      client_version: APP_VERSION,
      ...(trimmedJoinCode.length > 0 ? { join_code: trimmedJoinCode } : {}),
    },
  };
}

export function applySpectatorRoundConfirmation(
  snapshot: RoomStateSnapshot,
  payload: ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"],
): RoomStateSnapshot {
  if (snapshot.current_round === null || snapshot.current_round.round_index !== payload.round_index) {
    return snapshot;
  }

  const nextConfirmed = [...snapshot.current_round.confirmed];
  const nextPlayer: CurrentRoundConfirmedPlayer = {
    player_id: payload.player_id,
    status: payload.status,
    metric_value: payload.metric_value,
    reason: payload.reason ?? "OTHER",
    submitted_by: payload.submitted_by,
    submitted_at: payload.submitted_at,
    source_meta: payload.source_meta,
  };
  const existingIndex = nextConfirmed.findIndex((entry) => entry.player_id === payload.player_id);
  if (existingIndex >= 0) {
    nextConfirmed[existingIndex] = nextPlayer;
  } else {
    nextConfirmed.push(nextPlayer);
  }

  return {
    ...snapshot,
    current_round: {
      ...snapshot.current_round,
      confirmed: nextConfirmed,
    },
  };
}

export function upsertFinalResultHistory(
  previous: FinalResultHistoryItem[],
  payload: ResultReadyPayload,
  receivedAtIso: string,
  maxItems: number,
): FinalResultHistoryItem[] {
  const nextItem: FinalResultHistoryItem = { payload, receivedAtIso };
  const withoutExisting = previous.filter((item) => item.payload.summary.match_id !== payload.summary.match_id);
  return [nextItem, ...withoutExisting].slice(0, maxItems);
}
