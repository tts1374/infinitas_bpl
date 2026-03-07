export const ROOM_STATES = [
  "LOBBY",
  "READY_CHECK",
  "PICKING",
  "PLAYING",
  "RESULT",
  "CLOSED",
] as const;

export type RoomState = (typeof ROOM_STATES)[number];

export const CLOSE_REASONS = [
  "ALL_ROUNDS_COMPLETED",
  "MATCH_TTL_EXPIRED",
  "READY_CHECK_TTL_EXPIRED",
  "HOST_DISCONNECTED",
  "HOST_ABORTED",
  "PICKING_ABORTED",
  "FORCE_CLOSED",
] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number];

export const VISIBILITIES = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

export type Visibility = (typeof VISIBILITIES)[number];
