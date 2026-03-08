import {
  LEVEL_FILTERS,
  MODES,
  PLAY_STYLES,
  ROOM_LIST_PAGE_SIZE,
  type RoomListQuery,
  WIN_METRICS,
} from "@infinitas/shared";
import type { MaxPlayersOption } from "@infinitas/shared/constants/room";
import type { ISO8601String } from "@infinitas/shared/models/common";
import type { WorkerEnv } from "../types/env";
import { asEnumValue, isRecord } from "../utils/validation";

const ROOM_KEY_PREFIX = "room:";
const MAX_SCAN_ITERATIONS = 200;
const KV_SCAN_PAGE_SIZE = 1000;

export interface StoredLobbyRoomEntry {
  room_id: string;
  visibility: "PUBLIC";
  public_lobby_candidate: boolean;
  has_join_code: boolean;
  mode: "ARENA" | "BPL";
  win_metric: "SCORE" | "MISSCOUNT";
  play_style: "SP" | "DP";
  level_filter: "ANY" | "LV8_10" | "LV10" | "LV11" | "LV12";
  room_comment: string;
  max_players: MaxPlayersOption;
  created_at: ISO8601String;
  expires_at: ISO8601String;
}

export interface ListLobbyRoomsInput extends RoomListQuery {
  now?: Date;
}

export interface ListLobbyRoomsOutput {
  rooms: StoredLobbyRoomEntry[];
  nextCursor: string | null;
  activeRoomCount: number;
}

function roomKvKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function parseStoredRoomListing(rawValue: string): StoredLobbyRoomEntry | null {
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
  const visibility = asEnumValue(decoded.visibility, ["PUBLIC", "PRIVATE", "UNLISTED"] as const);
  const publicLobbyCandidate =
    typeof decoded.public_lobby_candidate === "boolean" ? decoded.public_lobby_candidate : true;
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
    visibility !== "PUBLIC" ||
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
    visibility: "PUBLIC",
    public_lobby_candidate: publicLobbyCandidate,
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

function isUnexpired(entry: StoredLobbyRoomEntry, nowMs: number): boolean {
  const expiresAtMs = Date.parse(entry.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return false;
  }

  return true;
}

function applyRoomFilters(entry: StoredLobbyRoomEntry, query: RoomListQuery, nowMs: number): boolean {
  if (!isUnexpired(entry, nowMs) || !entry.public_lobby_candidate) {
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
  roomListingEntry: StoredLobbyRoomEntry,
): Promise<void> {
  const key = roomKvKey(roomListingEntry.room_id);
  await env.ROOM_LOBBY_KV.put(key, JSON.stringify(roomListingEntry));
}

export async function setLobbyRoomCandidate(
  env: WorkerEnv,
  roomId: string,
  publicLobbyCandidate: boolean,
): Promise<void> {
  const key = roomKvKey(roomId);
  const rawValue = await env.ROOM_LOBBY_KV.get(key, "text");
  if (rawValue === null) {
    return;
  }

  const parsed = parseStoredRoomListing(rawValue);
  if (parsed === null) {
    return;
  }

  if (parsed.public_lobby_candidate === publicLobbyCandidate) {
    return;
  }

  await env.ROOM_LOBBY_KV.put(
    key,
    JSON.stringify({
      ...parsed,
      public_lobby_candidate: publicLobbyCandidate,
    }),
  );
}

export async function deleteLobbyRoom(env: WorkerEnv, roomId: string): Promise<void> {
  await env.ROOM_LOBBY_KV.delete(roomKvKey(roomId));
}

async function countActiveLobbyRooms(env: WorkerEnv, nowMs: number): Promise<number> {
  let activeRoomCount = 0;
  let cursor: string | undefined;
  let iterations = 0;

  while (iterations < MAX_SCAN_ITERATIONS) {
    iterations += 1;

    const listOptions: { prefix: string; limit: number; cursor?: string } = {
      prefix: ROOM_KEY_PREFIX,
      limit: KV_SCAN_PAGE_SIZE,
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
      if (parsed !== null && parsed.public_lobby_candidate && isUnexpired(parsed, nowMs)) {
        activeRoomCount += 1;
      }
    }

    if (listResult.list_complete || listResult.cursor === undefined) {
      break;
    }

    cursor = listResult.cursor;
  }

  return activeRoomCount;
}

export async function listLobbyRooms(
  env: WorkerEnv,
  input: ListLobbyRoomsInput,
): Promise<ListLobbyRoomsOutput> {
  const nowMs = (input.now ?? new Date()).getTime();
  const limit = Math.max(1, Math.min(input.limit ?? ROOM_LIST_PAGE_SIZE, ROOM_LIST_PAGE_SIZE));
  const rooms: StoredLobbyRoomEntry[] = [];
  const activeRoomCountPromise = countActiveLobbyRooms(env, nowMs);

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
    activeRoomCount: await activeRoomCountPromise,
  };
}
