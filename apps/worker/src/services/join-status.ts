import type { JoinRoomStatusResponse, RecruitmentStatus } from "../types/api";
import type { WorkerEnv } from "../types/env";

const INTERNAL_JOIN_STATUS_URL = "https://room.internal/join-status";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const DEFAULT_ROOM_NAME = "期限切れまたは無効な招待URL";
const DEFAULT_DOWNLOAD_URL = "https://github.com/tts1374/infinitas_arena/releases/latest";

interface InternalJoinStatusResponse {
  room_name?: string;
  recruitment_status?: string;
  shareable?: boolean;
  updated_at?: string;
}

const VALID_STATUSES: RecruitmentStatus[] = ["recruiting", "full", "closed", "expired"];

function resolveDownloadUrl(env: WorkerEnv): string {
  const candidate = env.APP_DOWNLOAD_URL?.trim();
  return candidate && candidate.length > 0 ? candidate : DEFAULT_DOWNLOAD_URL;
}

function resolveStatus(value: string | undefined): RecruitmentStatus {
  const normalized = value?.trim().toLowerCase();
  if (normalized && VALID_STATUSES.includes(normalized as RecruitmentStatus)) {
    return normalized as RecruitmentStatus;
  }

  return "expired";
}

function normalizeIso8601(value: string | undefined): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function buildExpiredJoinStatus(env: WorkerEnv): JoinRoomStatusResponse {
  return {
    room_name: DEFAULT_ROOM_NAME,
    recruitment_status: "expired",
    shareable: false,
    download_url: resolveDownloadUrl(env),
    updated_at: new Date().toISOString(),
  };
}

function parseInternalJoinStatus(
  env: WorkerEnv,
  payload: InternalJoinStatusResponse,
): JoinRoomStatusResponse {
  const roomName = payload.room_name?.trim() || DEFAULT_ROOM_NAME;
  const status = resolveStatus(payload.recruitment_status);
  const shareable = payload.shareable === true && status === "recruiting";

  return {
    room_name: roomName,
    recruitment_status: status,
    shareable,
    download_url: resolveDownloadUrl(env),
    updated_at: normalizeIso8601(payload.updated_at),
  };
}

export async function fetchJoinRoomStatus(
  env: WorkerEnv,
  roomRef: string,
): Promise<JoinRoomStatusResponse> {
  const normalizedRoomRef = roomRef.trim();
  if (normalizedRoomRef.length === 0) {
    return buildExpiredJoinStatus(env);
  }

  const roomDoId = env.ROOM_DO.idFromName(normalizedRoomRef);
  const roomDoStub = env.ROOM_DO.get(roomDoId);
  const response = await roomDoStub.fetch(
    new Request(INTERNAL_JOIN_STATUS_URL, {
      method: "GET",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
        "x-room-id": normalizedRoomRef,
      },
    }),
  );

  if (response.status === 404) {
    return buildExpiredJoinStatus(env);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch join status (${response.status}).`);
  }

  const payload = (await response.json()) as InternalJoinStatusResponse;
  return parseInternalJoinStatus(env, payload);
}
