import type { MaxPlayersOption } from "../constants/room";
import type { LevelFilter, Mode, PlayStyle, Visibility, WinMetric } from "../enums";
import type { ISO8601String } from "./common";

export type PublicVisibility = Extract<Visibility, "PUBLIC">;

export interface RoomListingEntry {
  room_id: string;
  visibility: PublicVisibility;
  has_join_code: boolean;
  mode: Mode;
  win_metric: WinMetric;
  play_style: PlayStyle;
  level_filter: LevelFilter;
  room_comment: string;
  current_members: number | null;
  max_players: MaxPlayersOption;
  created_at: ISO8601String;
  expires_at: ISO8601String;
}

export interface RoomListQuery {
  cursor?: string;
  limit?: number;
  mode?: Mode;
  play_style?: PlayStyle;
  level_filter?: LevelFilter;
  room_comment?: string;
}
