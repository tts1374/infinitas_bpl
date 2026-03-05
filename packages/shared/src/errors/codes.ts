export const ERROR_CODES = [
  "ROOM_FULL",
  "JOIN_CODE_INVALID",
  "NOT_HOST",
  "INVALID_STATE",
  "START_REQUIRES_MIN_PLAYERS",
  "RESULT_KEY_MISMATCH",
  "ROUND_ALREADY_CONFIRMED",
  "HOST_SKIP_LOCKED",
  "ROOM_STATE_LOST",
  "SOURCE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}
