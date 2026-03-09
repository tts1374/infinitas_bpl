import { type AppUpdaterState, useUpdaterStore } from "../stores/updater-store";

export function useAppUpdater<TSelected>(
  selector: (state: AppUpdaterState) => TSelected,
): TSelected {
  return useUpdaterStore(selector);
}
