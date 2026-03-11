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
  created_at: ISO8601String;
  expires_at: ISO8601String;
  settings: RoomSettings;
}

export type ListLobbyResponse = LobbyListResponse;

export interface ChartSearchResponse {
  charts: ChartSearchEntry[];
  next_cursor: string | null;
}
