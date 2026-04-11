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

export function getDifficultyBadgeClass(difficulty: string | null | undefined): string {
  switch (difficulty) {
    case "B":
      return "bg-green-500 text-black shadow-[0_0_18px_rgba(34,197,94,0.35)]";
    case "N":
      return "bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]";
    case "H":
      return "bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.45)]";
    case "A":
      return "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]";
    case "L":
      return "bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]";
    default:
      return "bg-gray-600 text-white";
  }
}

export function getDifficultyBadgeLabel(difficulty: string | null | undefined): string {
  switch (difficulty) {
    case "B":
      return "BEGINNER";
    case "N":
      return "NORMAL";
    case "H":
      return "HYPER";
    case "A":
      return "ANOTHER";
    case "L":
      return "LEGGENDARIA";
    default:
      return difficulty ?? "-";
  }
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
