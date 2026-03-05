import type { MaxPlayersOption } from "../constants/room";
import type { LevelFilter, Mode, PlayStyle, Visibility, WinMetric } from "../enums";

export interface RoomSettings {
  visibility: Visibility;
  join_code: string | null;
  mode: Mode;
  win_metric: WinMetric;
  play_style: PlayStyle;
  level_filter: LevelFilter;
  room_comment: string;
  max_players: MaxPlayersOption;
}
