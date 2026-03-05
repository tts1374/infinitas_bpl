export const JOIN_CODE_LENGTH = 8;
export const JOIN_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_CASE = "UPPERCASE" as const;

export const ROOM_COMMENT_MAX_LENGTH = 80;
export const ROOM_COMMENT_ALLOW_EMPTY = true;
export const ROOM_COMMENT_ALLOW_NEWLINE = false;

export const MAX_PLAYERS_OPTIONS = [2, 3, 4] as const;
export type MaxPlayersOption = (typeof MAX_PLAYERS_OPTIONS)[number];
