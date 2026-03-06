import { isClientMessageType, type ClientMessage, type ServerEnvelope, type ServerMessageType } from "@infinitas/shared";
import { isRecord } from "../utils/validation";

export interface DecodeClientMessageFailure {
  ok: false;
  error: string;
}

export interface DecodeClientMessageSuccess {
  ok: true;
  message: ClientMessage;
}

export type DecodeClientMessageResult = DecodeClientMessageFailure | DecodeClientMessageSuccess;

export function decodeClientMessage(rawData: string): DecodeClientMessageResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawData);
  } catch {
    return {
      ok: false,
      error: "Message must be valid JSON.",
    };
  }

  if (!isRecord(decoded)) {
    return {
      ok: false,
      error: "Message must be object.",
    };
  }

  const messageType = typeof decoded.type === "string" ? decoded.type : null;
  const clientMsgId = typeof decoded.client_msg_id === "string" ? decoded.client_msg_id : null;
  const roomId = typeof decoded.room_id === "string" ? decoded.room_id : null;
  const playerId = typeof decoded.player_id === "string" ? decoded.player_id : null;
  const payload = decoded.payload;

  if (
    messageType === null ||
    !isClientMessageType(messageType) ||
    clientMsgId === null ||
    roomId === null ||
    playerId === null ||
    !isRecord(payload)
  ) {
    return {
      ok: false,
      error: "Message does not match envelope schema.",
    };
  }

  return {
    ok: true,
    message: {
      type: messageType,
      client_msg_id: clientMsgId,
      room_id: roomId,
      player_id: playerId,
      payload,
    } as ClientMessage,
  };
}

export function createServerEnvelope<TType extends ServerMessageType>(
  roomId: string,
  type: TType,
  payload: unknown,
): ServerEnvelope<TType, unknown> {
  return {
    type,
    server_msg_id: crypto.randomUUID(),
    server_time: new Date().toISOString(),
    room_id: roomId,
    payload,
  };
}
