import type { CloseReason, PlayerRole, RoomState, SourceType, SubmissionStatus, SubmittedBy } from "../enums";
import type { ISO8601String, JsonObject } from "./common";
import type { ExpectedKey } from "./expected-key";
import type { FrozenRound } from "./frozen-round";
import type { RoomPick } from "./room-pick";
import type { RoomSettings } from "./room-settings";
import type { MatchSongUnlockFilter, SongUnlockSettings } from "./song-unlock";
import type { SubmissionReason } from "./submission";

export interface RoomPlayerSnapshot {
  player_id: string;
  display_name: string;
  source: SourceType;
  song_unlocks?: SongUnlockSettings;
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
  source_meta: JsonObject | null;
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
  picking_deadline: ISO8601String | null;
  match_deadline: ISO8601String | null;
  result_deadline: ISO8601String | null;
}

export interface RoomStateSnapshot {
  room_id: string;
  generation?: number;
  current_match_id?: string;
  room_state: RoomState;
  settings: RoomSettings;
  auto_rematch_enabled?: boolean;
  auto_rematch_countdown_started_at?: ISO8601String | null;
  auto_rematch_due_at?: ISO8601String | null;
  auto_rematch_generation?: number;
  auto_rematch_cancelled?: boolean;
  auto_rematch_block_reason?: string | null;
  next_match_opt_out_player_ids?: string[];
  last_match_end_reason?: string | null;
  host_player_id: string;
  players: RoomPlayerSnapshot[];
  match_song_unlock_filter?: MatchSongUnlockFilter | null;
  picks: RoomPick[];
  frozen_rounds: FrozenRound[];
  current_round: CurrentRoundSnapshot | null;
  timers: RoomTimers;
  result_ready: boolean;
  created_at?: ISO8601String;
  closed_at?: ISO8601String | null;
  close_reason?: CloseReason | null;
}
