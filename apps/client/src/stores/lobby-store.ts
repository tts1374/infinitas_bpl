import type { LobbyRoomSummary } from "@infinitas/shared";
import { listLobby } from "../services/worker-api-client";
import { createExternalStore, useExternalStore } from "./create-store";

export interface LobbyStoreState {
  rooms: LobbyRoomSummary[];
  loading: boolean;
  errorMessage: string | null;
  lastLoadedAt: string | null;
  serverTime: number | null;
}

const internalStore = createExternalStore<LobbyStoreState>({
  rooms: [],
  loading: false,
  errorMessage: null,
  lastLoadedAt: null,
  serverTime: null,
});

export const lobbyStore = {
  ...internalStore,
  upsertOptimistic(room: LobbyRoomSummary): void {
    internalStore.setState((state) => {
      const nextRooms = [...state.rooms];
      const existingIndex = nextRooms.findIndex((entry) => entry.roomId === room.roomId);
      if (existingIndex >= 0) {
        nextRooms[existingIndex] = room;
      } else {
        nextRooms.unshift(room);
      }

      return {
        ...state,
        rooms: nextRooms,
      };
    });
  },
  async refresh(baseUrl: string): Promise<void> {
    internalStore.setState((state) => ({
      ...state,
      loading: true,
      errorMessage: null,
    }));

    try {
      const response = await listLobby(baseUrl);
      internalStore.setState((state) => ({
        ...state,
        rooms: response.rooms,
        loading: false,
        errorMessage: null,
        serverTime: response.serverTime,
        lastLoadedAt: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load lobby.";
      internalStore.setState((state) => ({
        ...state,
        loading: false,
        errorMessage: message,
      }));
    }
  },
};

export function useLobbyStore<TSelected>(selector: (state: LobbyStoreState) => TSelected): TSelected {
  return useExternalStore(internalStore, selector);
}
