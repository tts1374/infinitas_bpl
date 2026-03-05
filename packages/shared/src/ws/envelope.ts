import type { ISO8601String, Uuid } from "../models/common";
import type { ClientMessageType, ServerMessageType } from "./message-types";

export interface ClientEnvelope<
  TType extends ClientMessageType = ClientMessageType,
  TPayload = unknown,
> {
  type: TType;
  client_msg_id: Uuid;
  room_id: string;
  player_id: string;
  payload: TPayload;
}

export interface ServerEnvelope<
  TType extends ServerMessageType = ServerMessageType,
  TPayload = unknown,
> {
  type: TType;
  server_msg_id: Uuid;
  server_time: ISO8601String;
  room_id: string;
  payload: TPayload;
}
