import type { ChartDifficulty } from "@infinitas/shared";

export type RoomSong = {
  id?: string | number;
  title: string;
  artist: string;
  version?: string;
  playStyle?: string;
  difficulty?: string;
  level: string | number;
  genre?: string;
};

export type RoomHistoryItem = {
  round: number;
  song: RoomSong;
  scores: Record<string, number>;
  winnerId: string | "DRAW";
};

export type RoomPlayerStatusLabel = "UNCONFIRMED" | "PLAYED" | "SKIPPED" | "TIMEOUT";

export type RoomPlayerStatusSnapshot = {
  label: string | null | undefined;
  metric: number | null | undefined;
};

export type DifficultyShortLabel = "B" | "N" | "H" | "A" | "L";

export type DifficultyPresentation = {
  difficulty: ChartDifficulty;
  shortLabel: DifficultyShortLabel;
  colorClass: string;
  textClass: string;
  badgeClass: string;
};

export const DIFFICULTY_PRESENTATIONS: readonly DifficultyPresentation[] = [
  {
    difficulty: "BEGINNER",
    shortLabel: "B",
    colorClass: "bg-green-500",
    textClass: "text-green-400",
    badgeClass: "bg-green-500 text-black shadow-[0_0_18px_rgba(34,197,94,0.35)]",
  },
  {
    difficulty: "NORMAL",
    shortLabel: "N",
    colorClass: "bg-blue-500",
    textClass: "text-blue-400",
    badgeClass: "bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]",
  },
  {
    difficulty: "HYPER",
    shortLabel: "H",
    colorClass: "bg-yellow-500",
    textClass: "text-yellow-400",
    badgeClass: "bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.45)]",
  },
  {
    difficulty: "ANOTHER",
    shortLabel: "A",
    colorClass: "bg-red-500",
    textClass: "text-red-400",
    badgeClass: "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]",
  },
  {
    difficulty: "LEGGENDARIA",
    shortLabel: "L",
    colorClass: "bg-purple-600",
    textClass: "text-purple-400",
    badgeClass: "bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]",
  },
];

const DIFFICULTY_PRESENTATION_BY_DIFFICULTY = new Map<string, DifficultyPresentation>(
  DIFFICULTY_PRESENTATIONS.map((presentation) => [presentation.difficulty, presentation]),
);

const DIFFICULTY_PRESENTATION_BY_SHORT_LABEL = new Map<string, DifficultyPresentation>(
  DIFFICULTY_PRESENTATIONS.map((presentation) => [presentation.shortLabel, presentation]),
);

export function maskJoinCode(joinCode: string): string {
  return "*".repeat(joinCode.length);
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatOrdinal(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${value}st`;
  }
  if (mod10 === 2 && mod100 !== 12) {
    return `${value}nd`;
  }
  if (mod10 === 3 && mod100 !== 13) {
    return `${value}rd`;
  }
  return `${value}th`;
}

export function formatRankLabel(rank: number | null): string {
  return rank === null ? "-" : formatOrdinal(rank);
}

export function getDifficultyPresentation(
  difficulty: string | null | undefined,
): DifficultyPresentation | null {
  return difficulty === null || difficulty === undefined
    ? null
    : DIFFICULTY_PRESENTATION_BY_DIFFICULTY.get(difficulty) ?? null;
}

export function getDifficultyPresentationByShortLabel(
  shortLabel: string | null | undefined,
): DifficultyPresentation | null {
  return shortLabel === null || shortLabel === undefined
    ? null
    : DIFFICULTY_PRESENTATION_BY_SHORT_LABEL.get(shortLabel) ?? null;
}

export function resolveDifficultyPresentation(
  value: string | null | undefined,
): DifficultyPresentation | null {
  return (
    getDifficultyPresentation(value) ??
    getDifficultyPresentationByShortLabel(value)
  );
}

export function getDifficultyShortLabel(difficulty: string | null | undefined): string {
  return resolveDifficultyPresentation(difficulty)?.shortLabel ?? "-";
}

export function getDifficultyFromShortLabel(
  shortLabel: string | null | undefined,
): ChartDifficulty | null {
  return getDifficultyPresentationByShortLabel(shortLabel)?.difficulty ?? null;
}

export function getDifficultyBadgeClass(difficulty: string | null | undefined): string {
  return resolveDifficultyPresentation(difficulty)?.badgeClass ?? "bg-gray-600 text-white";
}

export function getDifficultyBadgeLabel(difficulty: string | null | undefined): string {
  return resolveDifficultyPresentation(difficulty)?.difficulty ?? difficulty ?? "-";
}

export function normalizeRoomPlayerStatus(
  status: string | null | undefined,
): RoomPlayerStatusLabel {
  return status === "PLAYED" || status === "SKIPPED" || status === "TIMEOUT"
    ? status
    : "UNCONFIRMED";
}

export function buildPresentationPlayerMaps<TPlayer extends { id: string }>(
  presentationPlayers: readonly TPlayer[],
  actualPlayerIds: ReadonlyArray<string | null | undefined>,
  resolveStatus: (actualPlayerId: string) => RoomPlayerStatusSnapshot,
): {
  playerStatus: Record<string, RoomPlayerStatusLabel>;
  playerMetrics: Record<string, number | null>;
} {
  return presentationPlayers.reduce<{
    playerStatus: Record<string, RoomPlayerStatusLabel>;
    playerMetrics: Record<string, number | null>;
  }>(
    (accumulator, player, index) => {
      const actualPlayerId = actualPlayerIds[index] ?? null;
      const statusSnapshot =
        actualPlayerId === null ? null : resolveStatus(actualPlayerId);

      accumulator.playerStatus[player.id] = normalizeRoomPlayerStatus(
        statusSnapshot?.label,
      );
      accumulator.playerMetrics[player.id] = statusSnapshot?.metric ?? null;
      return accumulator;
    },
    { playerStatus: {}, playerMetrics: {} },
  );
}
