import {
  JOIN_CODE_LENGTH,
  ROOM_STATES,
  type ClientMessage,
  type RoomStateSnapshot,
} from "@infinitas/shared";

export function sharedSmokeClient(snapshot: RoomStateSnapshot): string {
  const message: ClientMessage<"STATE_GET"> = {
    type: "STATE_GET",
    client_msg_id: "client-msg-id",
    room_id: snapshot.room_id,
    player_id: snapshot.host_player_id,
    payload: {},
  };

  return `${message.type}:${JOIN_CODE_LENGTH}:${ROOM_STATES.includes(snapshot.room_state)}`;
}
