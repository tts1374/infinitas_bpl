export const SUBMISSION_STATUSES = ["PLAYED", "SKIPPED", "TIMEOUT"] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SKIP_REASONS = ["UNOWNED", "TECH", "OTHER"] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export const SUBMITTED_BYS = ["SELF", "HOST", "SYSTEM"] as const;

export type SubmittedBy = (typeof SUBMITTED_BYS)[number];

export const PLAYER_ROLES = ["HOST", "GUEST"] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];
