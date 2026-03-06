import type { ChartSearchEntry } from "@infinitas/shared/models/chart-search";
import type { RoomSettings } from "@infinitas/shared";
import type { ISO8601String } from "@infinitas/shared/models/common";
import type { RoomListingEntry } from "@infinitas/shared/models/room-listing";

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

export interface ListRoomsResponse {
  rooms: RoomListingEntry[];
  next_cursor: string | null;
}

export interface ChartSearchResponse {
  charts: ChartSearchEntry[];
  next_cursor: string | null;
}
