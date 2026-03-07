import { ELO_K_FACTOR, INITIAL_ELO_RATING } from "./models";

export function getInitialRating(): number {
  return INITIAL_ELO_RATING;
}

export function getExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function getResultScore(result: "WIN" | "LOSE" | "DRAW"): number {
  switch (result) {
    case "WIN":
      return 1;
    case "DRAW":
      return 0.5;
    case "LOSE":
    default:
      return 0;
  }
}

export function applyEloRating(
  playerRating: number,
  opponentRating: number,
  result: "WIN" | "LOSE" | "DRAW",
): number {
  const expectedScore = getExpectedScore(playerRating, opponentRating);
  return Math.round(playerRating + ELO_K_FACTOR * (getResultScore(result) - expectedScore));
}

export function applyMatchRating(
  playerRating: number,
  actualScore: number,
  opponentRating = INITIAL_ELO_RATING,
): number {
  const expectedScore = getExpectedScore(playerRating, opponentRating);
  return Math.round(playerRating + ELO_K_FACTOR * (actualScore - expectedScore));
}
