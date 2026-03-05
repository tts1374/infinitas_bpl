import type { ErrorCode } from "../errors";
import type { SubmissionStatus, SubmittedBy } from "../enums";
import type { JsonObject, ISO8601String } from "../models/common";
import type { ExpectedKey } from "../models/expected-key";
import type { FrozenRound } from "../models/frozen-round";
import type { RoomStateSnapshot } from "../models/room-state-snapshot";
import type { SubmissionReason } from "../models/submission";
import type { WsEmptyPayload } from "./common";
import type { ServerEnvelope } from "./envelope";
import type { ServerMessageType } from "./message-types";

export interface RoomJoinAcceptedPayload {
  room_state_snapshot: RoomStateSnapshot;
}

export interface RoomRejectedPayload {
  reason: string;
}

export interface RoomUpdatedPayload {
  room_state_snapshot: RoomStateSnapshot;
}

export interface RoomClosedPayload {
  reason: string;
}

export interface ReadyCheckOpenedPayload {
  ready_check_deadline: ISO8601String;
}

export interface ReadyStatusChangedPayload {
  player_id: string;
  ready: boolean;
}

export interface PickAcceptedPayload {
  player_id: string;
  pick_chart_key: string;
  accepted_at: ISO8601String;
}

export interface PickRejectedPayload {
  reason: string;
}

export interface PickFrozenPayload {
  frozen_rounds: FrozenRound[];
}

export interface RoundBeginPayload {
  round_index: number;
  expected_key: ExpectedKey;
  round_started_at: ISO8601String;
  soft_ttl_seconds: number;
}

export interface PlayerRoundConfirmedPayload {
  round_index: number;
  player_id: string;
  status: SubmissionStatus;
  metric_value: number;
  reason: SubmissionReason;
  submitted_at: ISO8601String;
  submitted_by: SubmittedBy;
}

export interface RoundEndedPayload {
  round_index: number;
}

export interface ForceAdvanceAppliedPayload {
  round_index: number;
  timed_out_players: string[];
}

export interface ResultReadyPayload {
  summary: JsonObject;
  per_round: JsonObject;
  per_player: JsonObject;
}

export interface StateSnapshotPayload {
  room_state_snapshot: RoomStateSnapshot;
}

export interface ErrorMessagePayload {
  code: ErrorCode;
  message: string;
}

export interface ServerMessagePayloadMap {
  ROOM_JOIN_ACCEPTED: RoomJoinAcceptedPayload;
  ROOM_JOIN_REJECTED: RoomRejectedPayload;
  ROOM_UPDATED: RoomUpdatedPayload;
  ROOM_CLOSED: RoomClosedPayload;
  READY_CHECK_OPENED: ReadyCheckOpenedPayload;
  READY_STATUS_CHANGED: ReadyStatusChangedPayload;
  START_MATCH_REJECTED: RoomRejectedPayload;
  PICK_ACCEPTED: PickAcceptedPayload;
  PICK_REJECTED: PickRejectedPayload;
  PICK_FROZEN: PickFrozenPayload;
  ROUND_BEGIN: RoundBeginPayload;
  PLAYER_ROUND_CONFIRMED: PlayerRoundConfirmedPayload;
  ROUND_ENDED: RoundEndedPayload;
  FORCE_ADVANCE_APPLIED: ForceAdvanceAppliedPayload;
  RESULT_READY: ResultReadyPayload;
  STATE_SNAPSHOT: StateSnapshotPayload;
  ERROR: ErrorMessagePayload;
  PONG: WsEmptyPayload;
}

export type ServerMessage<
  TType extends ServerMessageType = ServerMessageType,
> = ServerEnvelope<TType, ServerMessagePayloadMap[TType]>;
