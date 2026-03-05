import { ERROR_CODES, ROOM_LIST_PAGE_SIZE, type ServerMessage } from "@infinitas/shared";

export function sharedSmokeWorker(): ServerMessage<"PONG"> {
  return {
    type: "PONG",
    server_msg_id: "server-msg-id",
    server_time: new Date(0).toISOString(),
    room_id: "room-id",
    payload: {},
  };
}

export const firstErrorCode = ERROR_CODES[0];
export const roomListPageSize = ROOM_LIST_PAGE_SIZE;
