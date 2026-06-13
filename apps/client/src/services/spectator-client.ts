import {
  type ClientMessage,
  type CurrentRoundConfirmedPlayer,
  type ResultReadyArenaPlayer,
  type ResultReadyBplPlayer,
  type ResultReadyPayload,
  type ResultReadyPlayer,
  type RoomStateSnapshot,
  type ServerMessagePayloadMap,
} from "@infinitas/shared";
import clientPackageJson from "../../package.json";

export type SpectatorConnectionState = "idle" | "connecting" | "joined" | "error" | "closed";

export interface FinalResultHistoryItem {
  payload: ResultReadyPayload;
  receivedAtIso: string;
}

export interface RankedFinalPlayer {
  player: ResultReadyPlayer;
  rank: number;
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

export function buildSpectatorStateGetMessage(input: {
  roomId: string;
  spectatorId: string;
}): ClientMessage<"STATE_GET"> {
  return {
    type: "STATE_GET",
    client_msg_id: crypto.randomUUID(),
    room_id: input.roomId,
    player_id: input.spectatorId,
    payload: {},
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

function isArenaPlayer(player: ResultReadyPlayer): player is ResultReadyArenaPlayer {
  return "total_points" in player;
}

function isBplPlayer(player: ResultReadyPlayer): player is ResultReadyBplPlayer {
  return "round_wins" in player;
}

function groupByKey<T, K>(items: T[], keyFor: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [item]);
    } else {
      group.push(item);
    }
  }
  return groups;
}

export function rankFinalPlayers(players: ResultReadyPlayer[]): RankedFinalPlayer[] {
  if (players.every(isBplPlayer)) {
    const sorted = [...players].sort((left, right) => right.round_wins - left.round_wins);
    let previousWins: number | null = null;
    let previousRank = 0;
    return sorted.map((player, index) => {
      const rank = player.round_wins === previousWins ? previousRank : index + 1;
      previousWins = player.round_wins;
      previousRank = rank;
      return { player, rank };
    });
  }

  if (!players.every(isArenaPlayer)) {
    return players.map((player, index) => ({ player, rank: index + 1 }));
  }

  const pointGroups = groupByKey(players, (player) => player.total_points);
  const ranked: RankedFinalPlayer[] = [];
  for (const totalPoints of [...pointGroups.keys()].sort((left, right) => right - left)) {
    const pointGroup = pointGroups.get(totalPoints) ?? [];
    const exScoreGroups = pointGroup.every((player) => player.total_ex_score !== null)
      ? groupByKey(pointGroup, (player) => player.total_ex_score ?? 0)
      : new Map([[0, pointGroup]]);

    for (const totalExScore of [...exScoreGroups.keys()].sort((left, right) => right - left)) {
      const exScoreGroup = exScoreGroups.get(totalExScore) ?? [];
      const confirmationGroups = exScoreGroup.every((player) => player.last_confirmed_at !== null)
        ? groupByKey(exScoreGroup, (player) => player.last_confirmed_at ?? "")
        : new Map([["", exScoreGroup]]);

      for (const confirmedAt of [...confirmationGroups.keys()].sort((left, right) => left.localeCompare(right))) {
        const tiedPlayers = confirmationGroups.get(confirmedAt) ?? [];
        const rank = ranked.length + 1;
        ranked.push(...tiedPlayers.map((player) => ({ player, rank })));
      }
    }
  }

  return ranked;
}
