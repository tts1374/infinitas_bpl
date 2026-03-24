import type { ResultReadyPayload, RoomStateSnapshot } from "@infinitas/shared";
import { createExternalStore, useExternalStore } from "../stores/create-store";
import { roomStore } from "../stores/room-store";
import { readJson, writeJson } from "./local-storage";
import { isTauriRuntime, saveLocalResultJson } from "./tauri-bridge";

const ROOM_RESULT_ARCHIVE_STORAGE_KEY = "infinitas.client.room-results.v1";
const LOCAL_RESULT_ARCHIVE_SCHEMA_VERSION = 1;
const LOCAL_RESULT_ARCHIVE_SUPPORTED_SCHEMA_VERSIONS = [LOCAL_RESULT_ARCHIVE_SCHEMA_VERSION] as const;
type LocalResultArchiveSchemaVersion = (typeof LOCAL_RESULT_ARCHIVE_SUPPORTED_SCHEMA_VERSIONS)[number];

export type LocalResultArchiveStatus = "IDLE" | "SAVING" | "READY" | "ERROR";
export type LocalResultArchiveStorage = "NONE" | "TAURI_FILE" | "LOCAL_STORAGE";

export interface LocalResultArchiveEntry {
  saved_at: string;
  room_state_snapshot: RoomStateSnapshot;
  result_ready: ResultReadyPayload | null;
}

export interface LocalResultArchive {
  schema_version: LocalResultArchiveSchemaVersion;
  room_id: string;
  created_at: string | null;
  updated_at: string;
  latest_snapshot: RoomStateSnapshot;
  result_ready: ResultReadyPayload | null;
  entries: LocalResultArchiveEntry[];
}

export interface LocalResultArchiveState {
  status: LocalResultArchiveStatus;
  storage: LocalResultArchiveStorage;
  roomId: string | null;
  filePath: string | null;
  storageKey: string | null;
  lastSavedAt: string | null;
  saveCount: number;
  lastError: string | null;
  latestArchive: LocalResultArchive | null;
}

const internalStore = createExternalStore<LocalResultArchiveState>({
  status: "IDLE",
  storage: "NONE",
  roomId: null,
  filePath: null,
  storageKey: null,
  lastSavedAt: null,
  saveCount: 0,
  lastError: null,
  latestArchive: null,
});

const archivesByRoom = new Map<string, LocalResultArchive>();

let unsubscribeRoomStore: (() => void) | null = null;
let persistSequence: Promise<unknown> = Promise.resolve();
let lastRoomId: string | null = null;
let lastFingerprint: string | null = null;

function buildFallbackKey(roomId: string): string {
  return `${ROOM_RESULT_ARCHIVE_STORAGE_KEY}:${roomId}`;
}

function isCompatibleLocalResultArchive(value: unknown): value is LocalResultArchive {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (!LOCAL_RESULT_ARCHIVE_SUPPORTED_SCHEMA_VERSIONS.includes(record.schema_version as LocalResultArchiveSchemaVersion)) {
    return false;
  }

  return (
    typeof record.room_id === "string" &&
    Array.isArray(record.entries) &&
    typeof record.updated_at === "string"
  );
}

function loadFallbackArchive(roomId: string): LocalResultArchive | null {
  const rawArchive = readJson<unknown>(buildFallbackKey(roomId), null);
  return isCompatibleLocalResultArchive(rawArchive) ? rawArchive : null;
}

function buildArchive(
  snapshot: RoomStateSnapshot,
  resultReady: ResultReadyPayload | null,
): LocalResultArchive {
  const existingArchive = archivesByRoom.get(snapshot.room_id) ?? loadFallbackArchive(snapshot.room_id);
  const savedAt = new Date().toISOString();

  const nextArchive: LocalResultArchive = {
    schema_version: LOCAL_RESULT_ARCHIVE_SCHEMA_VERSION,
    room_id: snapshot.room_id,
    created_at: snapshot.created_at ?? existingArchive?.created_at ?? null,
    updated_at: savedAt,
    latest_snapshot: snapshot,
    result_ready: resultReady,
    entries: [
      ...(existingArchive?.entries ?? []),
      {
        saved_at: savedAt,
        room_state_snapshot: snapshot,
        result_ready: resultReady,
      },
    ],
  };

  archivesByRoom.set(snapshot.room_id, nextArchive);
  return nextArchive;
}

function queuePersist(archive: LocalResultArchive): void {
  persistSequence = persistSequence
    .catch(() => undefined)
    .then(async () => {
      await persistArchive(archive);
    });
}

async function persistArchive(archive: LocalResultArchive): Promise<void> {
  internalStore.setState((state) => ({
    ...state,
    status: "SAVING",
    roomId: archive.room_id,
    lastError: null,
    latestArchive: archive,
    saveCount: archive.entries.length,
  }));

  const jsonText = JSON.stringify(archive, null, 2);

  try {
    if (isTauriRuntime()) {
      const response = await saveLocalResultJson({
        roomId: archive.room_id,
        createdAt: archive.created_at,
        jsonText,
      });

      internalStore.setState((state) => ({
        ...state,
        status: "READY",
        storage: "TAURI_FILE",
        roomId: archive.room_id,
        filePath: response.filePath,
        storageKey: null,
        lastSavedAt: archive.updated_at,
        saveCount: archive.entries.length,
        lastError: null,
        latestArchive: archive,
      }));
      return;
    }

    const storageKey = buildFallbackKey(archive.room_id);
    writeJson(storageKey, archive);

    internalStore.setState((state) => ({
      ...state,
      status: "READY",
      storage: "LOCAL_STORAGE",
      roomId: archive.room_id,
      filePath: null,
      storageKey,
      lastSavedAt: archive.updated_at,
      saveCount: archive.entries.length,
      lastError: null,
      latestArchive: archive,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save local result archive.";
    roomStore.noteLocalEvent(`Local result save failed: ${message}`);
    internalStore.setState((state) => ({
      ...state,
      status: "ERROR",
      roomId: archive.room_id,
      lastError: message,
      latestArchive: archive,
    }));
  }
}

function syncFromRoomStore(): void {
  const { snapshot, resultReady } = roomStore.getState();

  if (snapshot === null) {
    lastRoomId = null;
    lastFingerprint = null;
    return;
  }

  if (snapshot.room_id !== lastRoomId) {
    lastRoomId = snapshot.room_id;
    lastFingerprint = null;
  }

  const fingerprint = JSON.stringify({
    snapshot,
    resultReady,
  });
  if (fingerprint === lastFingerprint) {
    return;
  }

  lastFingerprint = fingerprint;
  queuePersist(buildArchive(snapshot, resultReady));
}

export const localResultArchiveService = {
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
  },
};

export function useLocalResultArchiveStore<TSelected>(
  selector: (state: LocalResultArchiveState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
