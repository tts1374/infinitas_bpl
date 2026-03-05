export const ROOM_STATES = [
  "LOBBY",
  "READY_CHECK",
  "PICKING",
  "PLAYING",
  "RESULT",
  "CLOSED",
] as const;

export type RoomState = (typeof ROOM_STATES)[number];

export const VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

export type Visibility = (typeof VISIBILITIES)[number];
