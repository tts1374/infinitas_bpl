import {
  JOIN_CODE_LENGTH,
  LEVEL_FILTERS,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  ROOM_KV_EXPIRES_MINUTES,
  ROOM_COMMENT_ALLOW_EMPTY,
  ROOM_COMMENT_ALLOW_NEWLINE,
  ROOM_COMMENT_MAX_LENGTH,
  type RoomSettings,
  WIN_METRICS,
} from "@infinitas/shared";
import type { CreateRoomResponse } from "../types/api";
import type { WorkerEnv } from "../types/env";
import { putLobbyRoom, type StoredLobbyRoomEntry } from "../kv/lobby-kv";
import { generateJoinCode, isValidJoinCode, normalizeJoinCode } from "./join-code";
import { initializeRoomDurableObject } from "./room-do";
import { asEnumValue, asNullableString, asOptionalString, isRecord } from "../utils/validation";

interface CreateRoomInput {
  settings: RoomSettings;
  createdAt: Date;
  expiresAt: Date;
}

function normalizeVisibility(value: unknown): RoomSettings["visibility"] | undefined {
  const parsed = asEnumValue(value, ["PUBLIC", "PRIVATE", "UNLISTED"] as const);
  if (parsed === "UNLISTED") {
    return "PRIVATE";
  }

  return parsed;
}

function computeRoomExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + ROOM_KV_EXPIRES_MINUTES * 60_000);
}

function ensureRoomComment(value: unknown): string {
  const comment = asOptionalString(value) ?? "";
  if (!ROOM_COMMENT_ALLOW_EMPTY && comment.length === 0) {
    throw new Error("room_comment must not be empty.");
  }
  if (!ROOM_COMMENT_ALLOW_NEWLINE && /[\r\n]/.test(comment)) {
    throw new Error("room_comment cannot contain newline.");
  }
  if (comment.length > ROOM_COMMENT_MAX_LENGTH) {
    throw new Error(`room_comment must be <= ${ROOM_COMMENT_MAX_LENGTH} characters.`);
  }

  return comment;
}

function ensureJoinCode(raw: unknown, visibility: RoomSettings["visibility"]): string | null {
  const normalized = normalizeJoinCode(asNullableString(raw));
  if (normalized === null) {
    if (visibility === "PUBLIC") {
      return null;
    }

    return generateJoinCode();
  }

  if (!isValidJoinCode(normalized)) {
    throw new Error(`join_code must be ${JOIN_CODE_LENGTH} chars and allowed charset only.`);
  }

  return normalized;
}

function parseCreateRoomPayload(payload: unknown): CreateRoomInput {
  if (!isRecord(payload)) {
    throw new Error("Invalid JSON payload.");
  }

  const visibility = normalizeVisibility(payload.visibility);
  const mode = asEnumValue(payload.mode, MODES);
  const winMetric = asEnumValue(payload.win_metric, WIN_METRICS);
  const playStyle = asEnumValue(payload.play_style, PLAY_STYLES);
  const levelFilter = asEnumValue(payload.level_filter, LEVEL_FILTERS);
  const maxPlayers =
    payload.max_players === 2 || payload.max_players === 3 || payload.max_players === 4
      ? payload.max_players
      : undefined;

  if (
    visibility === undefined ||
    mode === undefined ||
    winMetric === undefined ||
    playStyle === undefined ||
    levelFilter === undefined ||
    maxPlayers === undefined ||
    !MAX_PLAYERS_OPTIONS.includes(maxPlayers)
  ) {
    throw new Error("Invalid room settings.");
  }

  if ("join_code" in payload && payload.join_code !== null && typeof payload.join_code !== "string") {
    throw new Error("join_code must be string or null.");
  }
  if ("room_comment" in payload && typeof payload.room_comment !== "string") {
    throw new Error("room_comment must be string.");
  }

  const joinCode = ensureJoinCode(payload.join_code, visibility);
  const roomComment = ensureRoomComment(payload.room_comment);
  const createdAt = new Date();
  const expiresAt = computeRoomExpiry(createdAt);

  return {
    settings: {
      visibility,
      join_code: joinCode,
      mode,
      win_metric: winMetric,
      play_style: playStyle,
      level_filter: levelFilter,
      room_comment: roomComment,
      max_players: maxPlayers,
    },
    createdAt,
    expiresAt,
  };
}

function toLobbyEntry(roomId: string, input: CreateRoomInput): StoredLobbyRoomEntry {
  if (input.settings.visibility === "PRIVATE") {
    throw new Error("PRIVATE room must not be written to lobby.");
  }

  return {
    room_id: roomId,
    visibility: input.settings.visibility,
    public_lobby_candidate: true,
    has_join_code: input.settings.join_code !== null,
    mode: input.settings.mode,
    win_metric: input.settings.win_metric,
    play_style: input.settings.play_style,
    level_filter: input.settings.level_filter,
    room_comment: input.settings.room_comment,
    max_players: input.settings.max_players,
    created_at: input.createdAt.toISOString(),
    expires_at: input.expiresAt.toISOString(),
  };
}

export async function createRoom(
  env: WorkerEnv,
  payload: unknown,
): Promise<CreateRoomResponse> {
  const parsed = parseCreateRoomPayload(payload);
  const roomId = crypto.randomUUID();
  const createdAtIso = parsed.createdAt.toISOString();

  await initializeRoomDurableObject(env, roomId, parsed.settings, createdAtIso);

  if (parsed.settings.visibility === "PUBLIC") {
    await putLobbyRoom(env, toLobbyEntry(roomId, parsed));
  }

  return {
    room_id: roomId,
    created_at: createdAtIso,
    expires_at: parsed.expiresAt.toISOString(),
    settings: parsed.settings,
  };
}
