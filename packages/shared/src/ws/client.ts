import type { SkipReason, SourceType } from "../enums";
import type { JsonObject } from "../models/common";
import type { ExpectedKey } from "../models/expected-key";
import type { WsEmptyPayload } from "./common";
import type { ClientEnvelope } from "./envelope";
import type { ClientMessageType } from "./message-types";

export interface RequestIdPayload {
  request_id: string;
}

export interface GenerationPayload {
  generation: number;
}

export interface RequestIdWithGenerationPayload extends RequestIdPayload, GenerationPayload {}

export interface RoomJoinPayload {
  join_code?: string;
  display_name: string;
  source: SourceType;
  client_version?: string;
  client_capabilities?: JsonObject;
}

export interface ReadySetPayload extends GenerationPayload {
  ready: boolean;
}

export interface PickSubmitPayload extends RequestIdPayload {
  pick_chart_key: string;
}

export interface ResultSubmitPayload extends RequestIdWithGenerationPayload {
  round_index: number;
  observed_key: ExpectedKey;
  metric_value: number;
  source_meta?: JsonObject;
}

export interface SkipPayload extends RequestIdPayload {
  round_index: number;
  reason: SkipReason;
}

export interface SkipHostAssignPayload extends SkipPayload {
  target_player_id: string;
}

export interface SourceStatusSetPayload extends RequestIdPayload {
  available: boolean;
}

export interface ClientMessagePayloadMap {
  ROOM_JOIN: RoomJoinPayload;
  ROOM_LEAVE: GenerationPayload;
  READY_SET: ReadySetPayload;
  START_MATCH: RequestIdWithGenerationPayload;
  RETURN_TO_LOBBY: RequestIdWithGenerationPayload;
  AUTO_REMATCH_STOP: RequestIdPayload;
  AUTO_REMATCH_OPT_OUT: RequestIdPayload;
  SOURCE_STATUS_SET: SourceStatusSetPayload;
  PICK_SUBMIT: PickSubmitPayload;
  RESULT_SUBMIT: ResultSubmitPayload;
  SKIP_SELF: SkipPayload;
  SKIP_HOST_ASSIGN: SkipHostAssignPayload;
  FORCE_ADVANCE: RequestIdPayload;
  STATE_GET: WsEmptyPayload;
  PING: WsEmptyPayload;
}

export type ClientMessage<
  TType extends ClientMessageType = ClientMessageType,
> = ClientEnvelope<TType, ClientMessagePayloadMap[TType]>;
