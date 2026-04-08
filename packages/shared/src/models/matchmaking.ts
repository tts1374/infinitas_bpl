import type { Mode, PlayStyle, WinMetric } from "../enums";

export const MATCHMAKING_TICKET_STATUSES = [
  "SEARCHING",
  "MATCHED",
  "CANCELLED",
] as const;

export type MatchmakingTicketStatus = (typeof MATCHMAKING_TICKET_STATUSES)[number];

export interface MatchmakingQueueRequest {
  mode: Mode;
  play_style: PlayStyle;
  win_metric: WinMetric;
  rating: number;
  player_id: string;
  display_name: string;
}

export interface MatchmakingWaitingCountQuery {
  mode: Mode;
  play_style: PlayStyle;
  win_metric: WinMetric;
}

export interface MatchmakingWaitingCountResponse {
  waiting_count: number;
}

export interface MatchmakingQueueTicket {
  ticket_id: string;
  status: MatchmakingTicketStatus;
  mode: Mode;
  play_style: PlayStyle;
  win_metric: WinMetric;
  rating: number;
  queued_at: string;
  updated_at: string;
  current_tolerance: number;
  candidate_count: number;
  room_id: string | null;
  matched_player_count: number | null;
}
