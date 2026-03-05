import type { PlayerRole, SourceType } from "../enums";
import type { ISO8601String } from "./common";

export interface Player {
  player_id: string;
  display_name: string;
  source: SourceType;
  connected: boolean;
  ready: boolean;
  joined_at: ISO8601String;
  left_at: ISO8601String | null;
  rejoin_until: ISO8601String | null;
  role: PlayerRole;
}
