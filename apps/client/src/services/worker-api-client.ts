import type { ChartSearchEntry, ChartSearchQuery, RoomListQuery, RoomListingEntry, RoomSettings } from "@infinitas/shared";

export interface CreateRoomResponse {
  room_id: string;
  created_at: string;
  expires_at: string;
  settings: RoomSettings;
}

export interface ListRoomsResponse {
  rooms: RoomListingEntry[];
  next_cursor: string | null;
  active_room_count: number;
}

export interface ChartSearchResponse {
  charts: ChartSearchEntry[];
  next_cursor: string | null;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "WorkerApiError";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (trimmed.length === 0) {
    throw new WorkerApiError("Worker API URL is required.", 0);
  }

  return trimmed.replace(/\/+$/, "");
}

async function requestJson<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    let code: string | null = null;

    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      if (typeof errorBody.error?.message === "string") {
        message = errorBody.error.message;
      }
      if (typeof errorBody.error?.code === "string") {
        code = errorBody.error.code;
      }
    } catch {
      // no-op: keep generic error
    }

    throw new WorkerApiError(message, response.status, code);
  }

  return (await response.json()) as TResponse;
}

function appendQueryParam(searchParams: URLSearchParams, key: string, value: string | undefined): void {
  if (value === undefined) {
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length > 0) {
    searchParams.set(key, trimmed);
  }
}

export async function listRooms(baseUrl: string, query: RoomListQuery = {}): Promise<ListRoomsResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const searchParams = new URLSearchParams();

  appendQueryParam(searchParams, "cursor", query.cursor);
  appendQueryParam(searchParams, "mode", query.mode);
  appendQueryParam(searchParams, "play_style", query.play_style);
  appendQueryParam(searchParams, "level_filter", query.level_filter);
  appendQueryParam(searchParams, "room_comment", query.room_comment);
  if (typeof query.limit === "number") {
    searchParams.set("limit", String(query.limit));
  }

  const url = `${normalizedBaseUrl}/api/rooms${searchParams.size > 0 ? `?${searchParams}` : ""}`;
  return requestJson<ListRoomsResponse>(url, { method: "GET" });
}

export async function createRoom(baseUrl: string, settings: RoomSettings): Promise<CreateRoomResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return requestJson<CreateRoomResponse>(`${normalizedBaseUrl}/api/rooms`, {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export async function listCharts(baseUrl: string, query: ChartSearchQuery): Promise<ChartSearchResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const searchParams = new URLSearchParams();

  appendQueryParam(searchParams, "cursor", query.cursor);
  appendQueryParam(searchParams, "play_style", query.play_style);
  appendQueryParam(searchParams, "level_filter", query.level_filter);
  appendQueryParam(searchParams, "difficulty", query.difficulty);
  appendQueryParam(searchParams, "keyword", query.keyword);
  if (typeof query.level === "number") {
    searchParams.set("level", String(query.level));
  }
  if (typeof query.limit === "number") {
    searchParams.set("limit", String(query.limit));
  }

  const url = `${normalizedBaseUrl}/api/charts?${searchParams}`;
  return requestJson<ChartSearchResponse>(url, { method: "GET" });
}
