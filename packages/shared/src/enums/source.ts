export const SOURCE_TYPES = ["inf_daken_counter", "inf-notebook", "daken_counter_v3", "reflux"] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
