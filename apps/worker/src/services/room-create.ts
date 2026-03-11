import {
  JOIN_CODE_LENGTH,
  LEVEL_FILTERS,
  MATCH_TTL_MINUTES,
  MAX_PLAYERS_OPTIONS,
  MODES,
  PLAY_STYLES,
  ROOM_COMMENT_ALLOW_EMPTY,
  ROOM_COMMENT_ALLOW_NEWLINE,
  ROOM_COMMENT_MAX_LENGTH,
  type LobbyRoomSummary,
  type RoomSettings,
  WIN_METRICS,
} from "@infinitas/shared";
import type { CreateRoomResponse } from "../types/api";
import type { WorkerEnv } from "../types/env";
import { upsertLobbyDirectoryRoom } from "./lobby-directory";
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
  return new Date(createdAt.getTime() + MATCH_TTL_MINUTES * 60_000);
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

function deriveRoomName(settings: RoomSettings): string {
  const comment = settings.room_comment.trim();
  if (comment.length > 0) {
    return comment;
  }

  return `${settings.mode} ${settings.play_style}`;
}

function toLobbySummary(roomId: string, input: CreateRoomInput): LobbyRoomSummary {
  const createdAt = input.createdAt.getTime();
  return {
    roomId,
    roomName: deriveRoomName(input.settings),
    ownerUserId: "",
    ownerDisplayName: "",
    mode: input.settings.mode,
    playStyle: input.settings.play_style,
    levelFilter: input.settings.level_filter,
    winMetric: input.settings.win_metric,
    hasJoinCode: input.settings.join_code !== null,
    isPublic: input.settings.visibility === "PUBLIC",
    currentPlayers: 0,
    maxPlayers: input.settings.max_players,
    isFull: false,
    status: "LOBBY",
    ttlStartedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
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
    await upsertLobbyDirectoryRoom(env, toLobbySummary(roomId, parsed));
  }

  return {
    room_id: roomId,
    created_at: createdAtIso,
    expires_at: parsed.expiresAt.toISOString(),
    settings: parsed.settings,
  };
}
