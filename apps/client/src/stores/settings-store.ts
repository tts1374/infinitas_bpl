import { SOURCE_TYPES, type SourceType } from "@infinitas/shared";
import { readJson, writeJson } from "../services/local-storage";
import { createExternalStore, useExternalStore } from "./create-store";

const SETTINGS_STORAGE_KEY = "infinitas.client.settings.v1";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";

export interface SourcePaths {
  dakenTodayUpdateXml: string;
  notebookExportRecentJson: string;
  notebookRecordsRecentJson: string;
}

export interface ClientSettings {
  apiBaseUrl: string;
  playerId: string;
  displayName: string;
  source: SourceType;
  sourcePaths: SourcePaths;
  voiceEnabled: boolean;
}

export interface SettingsStoreState {
  draft: ClientSettings;
  saved: ClientSettings;
  lastSavedAt: string | null;
  statusMessage: string | null;
}

interface PartialClientSettings {
  apiBaseUrl?: string;
  playerId?: string;
  displayName?: string;
  source?: string;
  sourcePaths?: Partial<SourcePaths>;
  voiceEnabled?: boolean;
}

function createDefaultSourcePaths(): SourcePaths {
  return {
    dakenTodayUpdateXml: "",
    notebookExportRecentJson: "",
    notebookRecordsRecentJson: "",
  };
}

function normalizeSource(value: string | undefined): SourceType {
  return SOURCE_TYPES.includes(value as SourceType) ? (value as SourceType) : SOURCE_TYPES[0];
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return (trimmed.length === 0 ? DEFAULT_API_BASE_URL : trimmed).replace(/\/+$/, "");
}

function normalizeSettings(rawSettings: PartialClientSettings | null): ClientSettings {
  return {
    apiBaseUrl: normalizeBaseUrl(rawSettings?.apiBaseUrl),
    playerId: rawSettings?.playerId?.trim() || crypto.randomUUID(),
    displayName: rawSettings?.displayName?.trim() ?? "",
    source: normalizeSource(rawSettings?.source),
    sourcePaths: {
      ...createDefaultSourcePaths(),
      ...rawSettings?.sourcePaths,
    },
    voiceEnabled: rawSettings?.voiceEnabled ?? true,
  };
}

const initialSettings = normalizeSettings(readJson<PartialClientSettings | null>(SETTINGS_STORAGE_KEY, null));

const internalStore = createExternalStore<SettingsStoreState>({
  draft: initialSettings,
  saved: initialSettings,
  lastSavedAt: null,
  statusMessage: null,
});

export const settingsStore = {
  ...internalStore,
  update<K extends keyof ClientSettings>(key: K, value: ClientSettings[K]): void {
    internalStore.setState((state) => ({
      ...state,
      draft: {
        ...state.draft,
        [key]: value,
      },
      statusMessage: null,
    }));
  },
  updateSourcePath<K extends keyof SourcePaths>(key: K, value: SourcePaths[K]): void {
    internalStore.setState((state) => ({
      ...state,
      draft: {
        ...state.draft,
        sourcePaths: {
          ...state.draft.sourcePaths,
          [key]: value,
        },
      },
      statusMessage: null,
    }));
  },
  save(): void {
    const normalized = normalizeSettings(internalStore.getState().draft);
    writeJson(SETTINGS_STORAGE_KEY, normalized);
    internalStore.setState((state) => ({
      ...state,
      draft: normalized,
      saved: normalized,
      lastSavedAt: new Date().toISOString(),
      statusMessage: "Saved local settings.",
    }));
  },
  resetDraft(): void {
    internalStore.setState((state) => ({
      ...state,
      draft: state.saved,
      statusMessage: "Reverted draft to saved values.",
    }));
  },
  setStatusMessage(message: string | null): void {
    internalStore.setState((state) => ({
      ...state,
      statusMessage: message,
    }));
  },
};

export function useSettingsStore<TSelected>(
  selector: (state: SettingsStoreState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
