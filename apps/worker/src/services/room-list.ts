import { LEVEL_FILTERS, MODES, PLAY_STYLES, ROOM_LIST_PAGE_SIZE } from "@infinitas/shared";
import type { ListRoomsResponse } from "../types/api";
import type { WorkerEnv } from "../types/env";
import { listLobbyRooms } from "../kv/lobby-kv";
import { asEnumValue, parsePositiveInt } from "../utils/validation";

function parseLimit(rawLimit: string | null): number {
  const parsed = parsePositiveInt(rawLimit);
  if (parsed === undefined) {
    return ROOM_LIST_PAGE_SIZE;
  }

  return Math.min(parsed, ROOM_LIST_PAGE_SIZE);
}

export async function listRooms(env: WorkerEnv, url: URL): Promise<ListRoomsResponse> {
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursorRaw = url.searchParams.get("cursor");
  const cursor = cursorRaw !== null && cursorRaw.trim().length > 0 ? cursorRaw : undefined;

  const mode = asEnumValue(url.searchParams.get("mode"), MODES);
  const playStyle = asEnumValue(url.searchParams.get("play_style"), PLAY_STYLES);
  const levelFilter = asEnumValue(url.searchParams.get("level_filter"), LEVEL_FILTERS);
  const roomComment = url.searchParams.get("room_comment") ?? undefined;

  const query: {
    limit: number;
    cursor?: string;
    mode?: "ARENA" | "BPL";
    play_style?: "SP" | "DP";
    level_filter?: "ANY" | "LV8_10" | "LV10" | "LV11" | "LV12";
    room_comment?: string;
  } = { limit };
  if (cursor !== undefined) {
    query.cursor = cursor;
  }
  if (mode !== undefined) {
    query.mode = mode;
  }
  if (playStyle !== undefined) {
    query.play_style = playStyle;
  }
  if (levelFilter !== undefined) {
    query.level_filter = levelFilter;
  }
  if (roomComment !== undefined) {
    query.room_comment = roomComment;
  }

  const listResult = await listLobbyRooms(env, query);

  return {
    rooms: listResult.rooms,
    next_cursor: listResult.nextCursor,
  };
}
