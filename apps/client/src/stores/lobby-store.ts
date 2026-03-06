import type { LevelFilter, Mode, PlayStyle, RoomListQuery, RoomListingEntry } from "@infinitas/shared";
import { listRooms } from "../services/worker-api-client";
import { createExternalStore, useExternalStore } from "./create-store";

export interface LobbyFilters {
  mode: Mode | "";
  playStyle: PlayStyle | "";
  levelFilter: LevelFilter | "";
  roomComment: string;
}

export interface LobbyStoreState {
  rooms: RoomListingEntry[];
  filters: LobbyFilters;
  currentCursor: string | null;
  previousCursors: Array<string | null>;
  nextCursor: string | null;
  loading: boolean;
  errorMessage: string | null;
  lastLoadedAt: string | null;
}

const internalStore = createExternalStore<LobbyStoreState>({
  rooms: [],
  filters: {
    mode: "",
    playStyle: "",
    levelFilter: "",
    roomComment: "",
  },
  currentCursor: null,
  previousCursors: [],
  nextCursor: null,
  loading: false,
  errorMessage: null,
  lastLoadedAt: null,
});

async function loadLobbyPage(
  baseUrl: string,
  cursor: string | null,
  previousCursors: Array<string | null>,
): Promise<void> {
  const state = internalStore.getState();
  const query: RoomListQuery = {};

  if (cursor !== null) {
    query.cursor = cursor;
  }
  if (state.filters.mode) {
    query.mode = state.filters.mode;
  }
  if (state.filters.playStyle) {
    query.play_style = state.filters.playStyle;
  }
  if (state.filters.levelFilter) {
    query.level_filter = state.filters.levelFilter;
  }
  if (state.filters.roomComment.trim().length > 0) {
    query.room_comment = state.filters.roomComment.trim();
  }

  internalStore.setState((currentState) => ({
    ...currentState,
    loading: true,
    errorMessage: null,
  }));

  try {
    const response = await listRooms(baseUrl, query);
    internalStore.setState((currentState) => ({
      ...currentState,
      rooms: response.rooms,
      currentCursor: cursor,
      previousCursors,
      nextCursor: response.next_cursor,
      loading: false,
      errorMessage: null,
      lastLoadedAt: new Date().toISOString(),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load lobby.";
    internalStore.setState((currentState) => ({
      ...currentState,
      loading: false,
      errorMessage: message,
    }));
  }
}

export const lobbyStore = {
  ...internalStore,
  updateFilter<K extends keyof LobbyFilters>(key: K, value: LobbyFilters[K]): void {
    internalStore.setState((state) => ({
      ...state,
      filters: {
        ...state.filters,
        [key]: value,
      },
    }));
  },
  async refresh(baseUrl: string): Promise<void> {
    await loadLobbyPage(baseUrl, null, []);
  },
  async nextPage(baseUrl: string): Promise<void> {
    const state = internalStore.getState();
    if (state.nextCursor === null) {
      return;
    }

    await loadLobbyPage(baseUrl, state.nextCursor, [...state.previousCursors, state.currentCursor]);
  },
  async previousPage(baseUrl: string): Promise<void> {
    const state = internalStore.getState();
    if (state.previousCursors.length === 0) {
      return;
    }

    const previousCursor = state.previousCursors[state.previousCursors.length - 1] ?? null;
    await loadLobbyPage(baseUrl, previousCursor, state.previousCursors.slice(0, -1));
  },
};

export function useLobbyStore<TSelected>(selector: (state: LobbyStoreState) => TSelected): TSelected {
  return useExternalStore(internalStore, selector);
}
