import type { RoomStateSnapshot } from "@infinitas/shared";
import {
  captureRoomStatsSession,
  createArchiveFromStorage,
  reduceArchiveWithClosedMatch,
  reduceArchiveWithSession,
} from "../features/stats/stats";
import {
  STATS_STORAGE_KEY,
  type RoomStatsSession,
  type StatsArchiveState,
} from "../features/stats/models";
import { readJson, writeJson } from "./local-storage";
import { roomStore } from "../stores/room-store";
import { settingsStore } from "../stores/settings-store";
import { createExternalStore, useExternalStore } from "../stores/create-store";

const internalStore = createExternalStore<StatsArchiveState>({
  status: "READY",
  updatedAt: null,
  archive: createArchiveFromStorage(readJson<unknown>(STATS_STORAGE_KEY, null)),
});

let unsubscribeRoomStore: (() => void) | null = null;
let currentSession: RoomStatsSession | null = null;
let lastClosedRoomKey: string | null = null;

function persistArchive(): void {
  writeJson(STATS_STORAGE_KEY, internalStore.getState().archive);
}

function setArchiveIfChanged(nextArchive: StatsArchiveState["archive"]): void {
  if (nextArchive === internalStore.getState().archive) {
    return;
  }

  internalStore.setState({
    status: "READY",
    updatedAt: nextArchive.updated_at,
    archive: nextArchive,
  });
  persistArchive();
}

function syncSession(snapshot: RoomStateSnapshot | null): void {
  if (snapshot === null) {
    currentSession = null;
    return;
  }

  currentSession = captureRoomStatsSession(
    currentSession,
    snapshot,
    roomStore.getState().resultReady,
  );
}

function syncFromRoomStore(): void {
  const snapshot = roomStore.getState().snapshot;
  const resultReady = roomStore.getState().resultReady;
  syncSession(snapshot);

  if (snapshot === null) {
    lastClosedRoomKey = null;
    return;
  }

  const myPlayerId = settingsStore.getState().saved.playerId;
  const processedAt = new Date().toISOString();
  const afterSessionFlush = reduceArchiveWithSession(internalStore.getState().archive, {
    session: currentSession,
    myPlayerId,
    processedAt,
  });
  setArchiveIfChanged(afterSessionFlush);

  const syntheticClosedSnapshot =
    snapshot.room_state === "RESULT" && resultReady !== null
      ? {
          ...snapshot,
          room_state: "CLOSED" as const,
          close_reason: "ALL_ROUNDS_COMPLETED" as const,
          closed_at: snapshot.closed_at ?? processedAt,
        }
      : null;
  const finalizedSnapshot = snapshot.room_state === "CLOSED" ? snapshot : syntheticClosedSnapshot;

  if (finalizedSnapshot === null) {
    return;
  }

  const roundSignature =
    currentSession?.rounds
      .map((round) => `${round.round_index}:${round.round_started_at ?? ""}`)
      .join("|") ?? "no-rounds";
  const closedRoomKey =
    snapshot.room_state === "CLOSED"
      ? `${snapshot.room_id}:${snapshot.closed_at ?? "open"}:${roundSignature}`
      : `${snapshot.room_id}:result:${roundSignature}`;
  if (closedRoomKey === lastClosedRoomKey) {
    return;
  }

  lastClosedRoomKey = closedRoomKey;
  const afterMatchClose = reduceArchiveWithClosedMatch(afterSessionFlush, {
    session: currentSession,
    snapshot: finalizedSnapshot,
    resultReady,
    myPlayerId,
    processedAt,
  });
  setArchiveIfChanged(afterMatchClose);
  currentSession = null;
}

export const statsArchiveService = {
  ...internalStore,
  start(): void {
    if (unsubscribeRoomStore !== null) {
      return;
    }

    unsubscribeRoomStore = roomStore.subscribe(syncFromRoomStore);
    syncFromRoomStore();
  },
  stop(): void {
    unsubscribeRoomStore?.();
    unsubscribeRoomStore = null;
    currentSession = null;
    lastClosedRoomKey = null;
  },
};

export function useStatsArchiveStore<TSelected>(
  selector: (state: StatsArchiveState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
