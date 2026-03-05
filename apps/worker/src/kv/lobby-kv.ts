import {
  LEVEL_FILTERS,
  MODES,
  PLAY_STYLES,
  ROOM_LIST_PAGE_SIZE,
  type RoomListQuery,
  type RoomListingEntry,
  type Visibility,
  WIN_METRICS,
} from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";
import { asEnumValue, isRecord } from "../utils/validation";

const ROOM_KEY_PREFIX = "room:";
const MAX_SCAN_ITERATIONS = 200;

export interface ListLobbyRoomsInput extends RoomListQuery {
  now?: Date;
}

export interface ListLobbyRoomsOutput {
  rooms: RoomListingEntry[];
  nextCursor: string | null;
}

function roomKvKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function isPublicVisibility(visibility: Visibility): visibility is "PUBLIC" | "UNLISTED" {
  return visibility === "PUBLIC" || visibility === "UNLISTED";
}

function parseStoredRoomListing(rawValue: string): RoomListingEntry | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isRecord(decoded)) {
    return null;
  }

  const roomId = typeof decoded.room_id === "string" ? decoded.room_id : null;
  const visibility = asEnumValue(decoded.visibility, ["PUBLIC", "UNLISTED", "PRIVATE"] as const);
  const hasJoinCode = typeof decoded.has_join_code === "boolean" ? decoded.has_join_code : null;
  const mode = asEnumValue(decoded.mode, MODES);
  const winMetric = asEnumValue(decoded.win_metric, WIN_METRICS);
  const playStyle = asEnumValue(decoded.play_style, PLAY_STYLES);
  const levelFilter = asEnumValue(decoded.level_filter, LEVEL_FILTERS);
  const roomComment = typeof decoded.room_comment === "string" ? decoded.room_comment : null;
  const maxPlayers =
    decoded.max_players === 2 || decoded.max_players === 3 || decoded.max_players === 4
      ? decoded.max_players
      : null;
  const createdAt = typeof decoded.created_at === "string" ? decoded.created_at : null;
  const expiresAt = typeof decoded.expires_at === "string" ? decoded.expires_at : null;

  if (
    roomId === null ||
    visibility === undefined ||
    !isPublicVisibility(visibility) ||
    hasJoinCode === null ||
    mode === undefined ||
    winMetric === undefined ||
    playStyle === undefined ||
    levelFilter === undefined ||
    roomComment === null ||
    maxPlayers === null ||
    createdAt === null ||
    expiresAt === null
  ) {
    return null;
  }

  return {
    room_id: roomId,
    visibility,
    has_join_code: hasJoinCode,
    mode,
    win_metric: winMetric,
    play_style: playStyle,
    level_filter: levelFilter,
    room_comment: roomComment,
    max_players: maxPlayers,
    created_at: createdAt,
    expires_at: expiresAt,
  };
}

function applyRoomFilters(entry: RoomListingEntry, query: RoomListQuery, nowMs: number): boolean {
  const expiresAtMs = Date.parse(entry.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return false;
  }

  if (query.mode !== undefined && entry.mode !== query.mode) {
    return false;
  }
  if (query.play_style !== undefined && entry.play_style !== query.play_style) {
    return false;
  }
  if (query.level_filter !== undefined && entry.level_filter !== query.level_filter) {
    return false;
  }
  if (query.room_comment !== undefined) {
    const needle = query.room_comment.trim().toLowerCase();
    if (needle.length > 0 && !entry.room_comment.toLowerCase().includes(needle)) {
      return false;
    }
  }

  return true;
}

export async function putLobbyRoom(
  env: WorkerEnv,
  roomListingEntry: RoomListingEntry,
): Promise<void> {
  const key = roomKvKey(roomListingEntry.room_id);
  await env.ROOM_LOBBY_KV.put(key, JSON.stringify(roomListingEntry));
}

export async function deleteLobbyRoom(env: WorkerEnv, roomId: string): Promise<void> {
  await env.ROOM_LOBBY_KV.delete(roomKvKey(roomId));
}

export async function listLobbyRooms(
  env: WorkerEnv,
  input: ListLobbyRoomsInput,
): Promise<ListLobbyRoomsOutput> {
  const nowMs = (input.now ?? new Date()).getTime();
  const limit = Math.max(1, Math.min(input.limit ?? ROOM_LIST_PAGE_SIZE, ROOM_LIST_PAGE_SIZE));
  const rooms: RoomListingEntry[] = [];

  let cursor = input.cursor;
  let nextCursor: string | null = null;
  let iterations = 0;

  while (rooms.length < limit && iterations < MAX_SCAN_ITERATIONS) {
    iterations += 1;

    const remaining = limit - rooms.length;
    const listOptions: { prefix: string; limit: number; cursor?: string } = {
      prefix: ROOM_KEY_PREFIX,
      limit: remaining,
    };
    if (cursor !== undefined) {
      listOptions.cursor = cursor;
    }

    const listResult = await env.ROOM_LOBBY_KV.list(listOptions);

    const keyNames = listResult.keys.map((key) => key.name);
    const rawValues = await Promise.all(keyNames.map((keyName) => env.ROOM_LOBBY_KV.get(keyName, "text")));
    for (const rawValue of rawValues) {
      if (rawValue === null) {
        continue;
      }

      const parsed = parseStoredRoomListing(rawValue);
      if (parsed === null) {
        continue;
      }
      if (applyRoomFilters(parsed, input, nowMs)) {
        rooms.push(parsed);
      }
    }

    if (listResult.list_complete) {
      nextCursor = null;
      break;
    }

    if (listResult.cursor === undefined) {
      nextCursor = null;
      break;
    }

    cursor = listResult.cursor;
    nextCursor = cursor;
  }

  return {
    rooms,
    nextCursor,
  };
}
