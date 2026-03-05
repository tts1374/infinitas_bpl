import type { SkipReason, SourceType } from "../enums";
import type { JsonObject } from "../models/common";
import type { ExpectedKey } from "../models/expected-key";
import type { WsEmptyPayload } from "./common";
import type { ClientEnvelope } from "./envelope";
import type { ClientMessageType } from "./message-types";

export interface RoomJoinPayload {
  join_code?: string;
  display_name: string;
  source: SourceType;
  client_capabilities?: JsonObject;
}

export interface ReadySetPayload {
  ready: boolean;
}

export interface PickSubmitPayload {
  pick_chart_key: string;
}

export interface ResultSubmitPayload {
  round_index: number;
  observed_key: ExpectedKey;
  metric_value: number;
  source_meta?: JsonObject;
}

export interface SkipPayload {
  round_index: number;
  reason: SkipReason;
}

export interface SkipHostAssignPayload extends SkipPayload {
  target_player_id: string;
}

export interface ClientMessagePayloadMap {
  ROOM_JOIN: RoomJoinPayload;
  ROOM_LEAVE: WsEmptyPayload;
  READY_CHECK_OPEN: WsEmptyPayload;
  READY_SET: ReadySetPayload;
  START_MATCH: WsEmptyPayload;
  PICK_SUBMIT: PickSubmitPayload;
  RESULT_SUBMIT: ResultSubmitPayload;
  SKIP_SELF: SkipPayload;
  SKIP_HOST_ASSIGN: SkipHostAssignPayload;
  FORCE_ADVANCE: WsEmptyPayload;
  STATE_GET: WsEmptyPayload;
  PING: WsEmptyPayload;
}

export type ClientMessage<
  TType extends ClientMessageType = ClientMessageType,
> = ClientEnvelope<TType, ClientMessagePayloadMap[TType]>;
