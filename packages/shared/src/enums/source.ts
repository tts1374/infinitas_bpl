export const SOURCE_TYPES = ["inf_daken_counter", "inf-notebook"] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
