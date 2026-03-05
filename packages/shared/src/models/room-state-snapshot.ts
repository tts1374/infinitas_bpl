import type { PlayerRole, RoomState, SourceType, SubmissionStatus, SubmittedBy } from "../enums";
import type { ISO8601String } from "./common";
import type { ExpectedKey } from "./expected-key";
import type { FrozenRound } from "./frozen-round";
import type { RoomPick } from "./room-pick";
import type { RoomSettings } from "./room-settings";
import type { SubmissionReason } from "./submission";

export interface RoomPlayerSnapshot {
  player_id: string;
  display_name: string;
  source: SourceType;
  connected: boolean;
  ready: boolean;
  role?: PlayerRole;
  joined_at?: ISO8601String;
  left_at?: ISO8601String | null;
  rejoin_until?: ISO8601String | null;
}

export interface CurrentRoundConfirmedPlayer {
  player_id: string;
  status: SubmissionStatus;
  metric_value: number;
  reason: SubmissionReason;
  submitted_by: SubmittedBy;
  submitted_at: ISO8601String;
}

export interface CurrentRoundSnapshot {
  round_index: number;
  expected_key: ExpectedKey;
  round_started_at: ISO8601String;
  soft_ttl_seconds: number;
  confirmed: CurrentRoundConfirmedPlayer[];
}

export interface RoomTimers {
  ready_check_deadline: ISO8601String | null;
  match_deadline: ISO8601String;
  result_deadline: ISO8601String | null;
}

export interface RoomStateSnapshot {
  room_id: string;
  room_state: RoomState;
  settings: RoomSettings;
  host_player_id: string;
  players: RoomPlayerSnapshot[];
  picks: RoomPick[];
  frozen_rounds: FrozenRound[];
  current_round: CurrentRoundSnapshot | null;
  timers: RoomTimers;
  created_at?: ISO8601String;
  closed_at?: ISO8601String | null;
  close_reason?: string | null;
}
