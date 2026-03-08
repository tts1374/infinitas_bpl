import type { RatedBlockReason, RoomSettings, SubmissionStatus } from "@infinitas/shared";

interface ResultRatingRoundResult {
  status: SubmissionStatus | null;
}

interface ResultRatingRound {
  played: boolean;
  results: ResultRatingRoundResult[];
}

export interface EvaluateResultRatingInput {
  visibility: RoomSettings["visibility"];
  total_rounds: number;
  completed_rounds: number;
  winner_player_ids: string[];
  rounds: ResultRatingRound[];
  mismatch_observed_key: boolean;
  force_advanced: boolean;
}

export interface ResultRatingDecision {
  is_rated: boolean;
  rated_block_reason: RatedBlockReason | null;
  rating_before: number | null;
  rating_after: number | null;
  rating_delta: number | null;
}

function buildUnratedDecision(reason: RatedBlockReason): ResultRatingDecision {
  return {
    is_rated: false,
    rated_block_reason: reason,
    rating_before: null,
    rating_after: null,
    rating_delta: null,
  };
}

export function evaluateResultRating(input: EvaluateResultRatingInput): ResultRatingDecision {
  if (input.visibility === "PRIVATE") {
    return buildUnratedDecision("private_room");
  }

  if (input.mismatch_observed_key) {
    return buildUnratedDecision("mismatch_observed_key");
  }

  if (input.force_advanced) {
    return buildUnratedDecision("force_advanced");
  }

  let missingSubmission = false;
  let skipped = false;
  let timedOut = false;

  for (const round of input.rounds) {
    if (!round.played) {
      continue;
    }

    for (const result of round.results) {
      if (result.status === null) {
        missingSubmission = true;
        continue;
      }

      if (result.status === "SKIPPED") {
        skipped = true;
      }

      if (result.status === "TIMEOUT") {
        timedOut = true;
      }
    }
  }

  if (skipped) {
    return buildUnratedDecision("skip_occurred");
  }

  if (timedOut) {
    return buildUnratedDecision("timeout_occurred");
  }

  if (missingSubmission) {
    return buildUnratedDecision("missing_submission");
  }

  if (input.total_rounds === 0 || input.completed_rounds !== input.total_rounds) {
    return buildUnratedDecision("incomplete_match");
  }

  if (input.winner_player_ids.length !== 1) {
    return buildUnratedDecision("result_conflict");
  }

  return {
    is_rated: true,
    rated_block_reason: null,
    rating_before: null,
    rating_after: null,
    rating_delta: null,
  };
}
