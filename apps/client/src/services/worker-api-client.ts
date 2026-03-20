import type {
  ChartDifficulty,
  ChartSearchEntry,
  ChartSearchQuery,
  LobbyListResponse,
  PlayStyle,
  RoomSettings,
  SongPack,
} from "@infinitas/shared";

export interface CreateRoomResponse {
  room_id: string;
  created_at: string;
  expires_at: string;
  settings: RoomSettings;
}

export type ListLobbyResponse = LobbyListResponse;

export interface ChartSearchResponse {
  charts: ChartSearchEntry[];
  next_cursor: string | null;
}

export interface SongPackListResponse {
  song_packs: SongPack[];
}

export interface ChartAliasResolveQuery {
  alias: string;
  play_style: PlayStyle;
  difficulty: ChartDifficulty;
}

export interface ChartAliasResolveResponse {
  title_search_keys: string[];
}

export type FeedbackCategory = "bug" | "feature" | "other";

export interface FeedbackClientMeta {
  appVersion: string;
  platform: string;
  screen: string;
  sentAt: string;
}

export interface FeedbackBugBody {
  summary: string;
  steps?: string;
  supplement?: string;
}

export interface FeedbackFeatureBody {
  problem: string;
  proposal: string;
}

export interface FeedbackOtherBody {
  content: string;
}

export type FeedbackBody = FeedbackBugBody | FeedbackFeatureBody | FeedbackOtherBody;

export interface FeedbackRequest {
  category: FeedbackCategory;
  title: string;
  body: FeedbackBody;
  client: FeedbackClientMeta;
}

export interface FeedbackResponse {
  ok: true;
  result: {
    category: FeedbackCategory;
    destination: "github" | "kv";
    key?: string;
  };
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

export async function listLobby(baseUrl: string): Promise<ListLobbyResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return requestJson<ListLobbyResponse>(`${normalizedBaseUrl}/api/lobby`, { method: "GET" });
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

export async function listRoomCharts(baseUrl: string, roomId: string, query: ChartSearchQuery): Promise<ChartSearchResponse> {
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

  const url = `${normalizedBaseUrl}/api/rooms/${encodeURIComponent(roomId)}/charts?${searchParams}`;
  return requestJson<ChartSearchResponse>(url, { method: "GET" });
}

export async function listSongPacks(baseUrl: string): Promise<SongPackListResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return requestJson<SongPackListResponse>(`${normalizedBaseUrl}/api/song-packs`, { method: "GET" });
}

export async function resolveChartAlias(
  baseUrl: string,
  query: ChartAliasResolveQuery,
): Promise<ChartAliasResolveResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const searchParams = new URLSearchParams();
  searchParams.set("alias", query.alias.trim());
  searchParams.set("play_style", query.play_style);
  searchParams.set("difficulty", query.difficulty);

  const url = `${normalizedBaseUrl}/api/chart-aliases/resolve?${searchParams}`;
  return requestJson<ChartAliasResolveResponse>(url, { method: "GET" });
}

export async function sendFeedback(baseUrl: string, payload: FeedbackRequest): Promise<FeedbackResponse> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return requestJson<FeedbackResponse>(`${normalizedBaseUrl}/api/feedback`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
