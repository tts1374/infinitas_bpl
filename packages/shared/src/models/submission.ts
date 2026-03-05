import type { SkipReason, SubmissionStatus, SubmittedBy, WinMetric } from "../enums";
import type { JsonObject, ISO8601String, Uuid } from "./common";
import type { ExpectedKey } from "./expected-key";

export type SubmissionReason = SkipReason | "UNMAPPED_TIMEOUT" | null;

export interface Submission {
  submission_id: Uuid;
  room_id: string;
  round_index: number;
  player_id: string;
  status: SubmissionStatus;
  reason: SubmissionReason;
  metric: WinMetric;
  metric_value: number;
  observed_key: ExpectedKey | null;
  submitted_at: ISO8601String;
  submitted_by: SubmittedBy;
  source_meta: JsonObject | null;
}
