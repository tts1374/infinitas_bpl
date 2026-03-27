import type { ChartSearchEntry, LobbyListResponse, RoomSettings } from "@infinitas/shared";
import type { ISO8601String } from "@infinitas/shared/models/common";

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface CreateRoomResponse {
  room_id: string;
  generation: number;
  created_at: ISO8601String;
  expires_at: ISO8601String;
  settings: RoomSettings;
}

export type ListLobbyResponse = LobbyListResponse;

export interface ChartSearchResponse {
  charts: ChartSearchEntry[];
  next_cursor: string | null;
}

export type RecruitmentStatus = "recruiting" | "full" | "closed" | "expired";

export interface JoinRoomStatusResponse {
  room_name: string;
  recruitment_status: RecruitmentStatus;
  shareable: boolean;
  download_url: string;
  updated_at: ISO8601String;
}
