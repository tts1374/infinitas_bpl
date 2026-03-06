import { useSyncExternalStore } from "react";

type StoreListener = () => void;
type StoreUpdater<TState> = TState | ((current: TState) => TState);

export interface ExternalStore<TState> {
  getState: () => TState;
  setState: (updater: StoreUpdater<TState>) => void;
  subscribe: (listener: StoreListener) => () => void;
}

export function createExternalStore<TState>(initialState: TState): ExternalStore<TState> {
  let currentState = initialState;
  const listeners = new Set<StoreListener>();

  return {
    getState() {
      return currentState;
    },
    setState(updater) {
      currentState =
        typeof updater === "function"
          ? (updater as (state: TState) => TState)(currentState)
          : updater;

      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useExternalStore<TState, TSelected>(
  store: ExternalStore<TState>,
  selector: (state: TState) => TSelected,
): TSelected {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
