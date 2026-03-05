import type { ISO8601String } from "./common";

export interface RoomPick {
  player_id: string;
  pick_chart_key: string;
  accepted_at: ISO8601String;
}
