import { SOURCE_TYPES, type SourceType } from "@infinitas/shared";
import { runtimeConfig } from "../runtime/runtime-config";
import { readJson, writeJson } from "../services/local-storage";
import { createExternalStore, useExternalStore } from "./create-store";

const SETTINGS_STORAGE_KEY = "infinitas.client.settings.v1";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";
const DEFAULT_VOICE_VOLUME = 80;
export const SOURCE_PORT_MIN = 1;
export const SOURCE_PORT_MAX = 65535;
export const DAKEN_COUNTER_V3_DEFAULT_PORT = 8767;
const FALLBACK_SOURCE: SourceType = "inf-notebook";

export interface SourcePaths {
  dakenTodayUpdateXml: string;
  notebookExportRecentJson: string;
  notebookRecordsRecentJson: string;
  refluxLatestJson: string;
  refluxTrackerTsv: string;
}

export interface SourceDirectories {
  dakenDirectory: string;
  notebookDirectory: string;
  refluxDirectory: string;
}

export interface ClientSettings {
  apiBaseUrl: string;
  playerId: string;
  displayName: string;
  source: SourceType;
  dakenCounterV3Port: number;
  sourcePaths: SourcePaths;
  sourceDirectories: SourceDirectories;
  voiceEnabled: boolean;
  voiceVolume: number;
  voiceMuted: boolean;
  enablePresentationSe: boolean;
  bitUnlockEnabled: boolean;
  djpUnlockEnabled: boolean;
  ownedPackIds: number[];
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
  dakenCounterV3Port?: number;
  sourcePaths?: Partial<SourcePaths>;
  sourceDirectories?: Partial<SourceDirectories>;
  voiceEnabled?: boolean;
  voiceVolume?: number;
  voiceMuted?: boolean;
  enablePresentationSe?: boolean;
  bitUnlockEnabled?: boolean;
  djpUnlockEnabled?: boolean;
  ownedPackIds?: number[];
}

function createDefaultSourcePaths(): SourcePaths {
  return {
    dakenTodayUpdateXml: "",
    notebookExportRecentJson: "",
    notebookRecordsRecentJson: "",
    refluxLatestJson: "",
    refluxTrackerTsv: "",
  };
}

function createDefaultSourceDirectories(): SourceDirectories {
  return {
    dakenDirectory: "",
    notebookDirectory: "",
    refluxDirectory: "",
  };
}

function normalizeSource(value: string | undefined): SourceType {
  if (!SOURCE_TYPES.includes(value as SourceType)) {
    return FALLBACK_SOURCE;
  }

  const normalized = value as SourceType;
  return normalized === "inf_daken_counter" ? FALLBACK_SOURCE : normalized;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidPortNumber(value: number): boolean {
  return Number.isInteger(value) && value >= SOURCE_PORT_MIN && value <= SOURCE_PORT_MAX;
}

export function normalizeDakenCounterV3Port(value: unknown): number {
  if (!isFiniteNumber(value)) {
    return DAKEN_COUNTER_V3_DEFAULT_PORT;
  }

  const normalized = Math.trunc(value);
  return isValidPortNumber(normalized) ? normalized : DAKEN_COUNTER_V3_DEFAULT_PORT;
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return (trimmed.length === 0 ? DEFAULT_API_BASE_URL : trimmed).replace(/\/+$/, "");
}

function resolveApiBaseUrl(rawSettings: PartialClientSettings | null, defaultValue: string): string {
  const injectedApiBaseUrl = runtimeConfig.settingsDefaults.apiBaseUrl?.trim();
  if (injectedApiBaseUrl && injectedApiBaseUrl.length > 0) {
    return normalizeBaseUrl(injectedApiBaseUrl);
  }

  return normalizeBaseUrl(rawSettings?.apiBaseUrl ?? defaultValue);
}

function normalizeDirectory(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return "";
  }

  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\\`;
  }

  if (/^[\\/]+$/.test(trimmed)) {
    return "/";
  }

  return trimmed.replace(/[\\/]+$/, "");
}

function normalizeVoiceVolume(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_VOICE_VOLUME;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function inferSeparator(path: string): "/" | "\\" {
  return path.includes("\\") ? "\\" : "/";
}

function joinPath(directory: string, segments: string[]): string {
  const normalizedDirectory = normalizeDirectory(directory);
  if (normalizedDirectory.length === 0) {
    return "";
  }

  if (normalizedDirectory === "/") {
    return `/${segments.join("/")}`;
  }

  const separator = inferSeparator(normalizedDirectory);
  if (normalizedDirectory.endsWith(separator)) {
    return `${normalizedDirectory}${segments.join(separator)}`;
  }

  return [normalizedDirectory, ...segments].join(separator);
}

function extractParentDirectory(filePath: string | undefined): string {
  const trimmed = filePath?.trim() ?? "";
  if (trimmed.length === 0) {
    return "";
  }

  const parent = trimmed.replace(/[\\/][^\\/]+$/, "");
  return normalizeDirectory(parent === trimmed ? trimmed : parent);
}

function extractNotebookDirectory(paths: Partial<SourcePaths>): string {
  const candidate = paths.notebookExportRecentJson?.trim() || paths.notebookRecordsRecentJson?.trim() || "";
  if (candidate.length === 0) {
    return "";
  }

  const withoutSuffix = candidate
    .replace(/[\\/]export[\\/]recent\.json$/i, "")
    .replace(/[\\/]records[\\/]summary\.json$/i, "");

  return normalizeDirectory(withoutSuffix === candidate ? extractParentDirectory(candidate) : withoutSuffix);
}

function deriveSourceDirectories(paths: Partial<SourcePaths>): SourceDirectories {
  const dakenCandidate = paths.dakenTodayUpdateXml?.trim() ?? "";
  const refluxCandidate = paths.refluxLatestJson?.trim() || paths.refluxTrackerTsv?.trim() || "";
  const refluxBaseDirectory =
    refluxCandidate.length === 0
      ? ""
      : normalizeDirectory(
          refluxCandidate
            .replace(/[\\/]latest\.json$/i, "")
            .replace(/[\\/]tracker\.tsv$/i, ""),
        ) || extractParentDirectory(refluxCandidate);

  return {
    dakenDirectory:
      dakenCandidate.length === 0
        ? ""
        : normalizeDirectory(dakenCandidate.replace(/[\\/]today_update\.xml$/i, "")) || extractParentDirectory(dakenCandidate),
    notebookDirectory: extractNotebookDirectory(paths),
    refluxDirectory: refluxBaseDirectory,
  };
}

export function deriveSourcePaths(sourceDirectories: SourceDirectories): SourcePaths {
  return {
    dakenTodayUpdateXml:
      sourceDirectories.dakenDirectory.length === 0
        ? ""
        : joinPath(sourceDirectories.dakenDirectory, ["today_update.xml"]),
    notebookExportRecentJson:
      sourceDirectories.notebookDirectory.length === 0
        ? ""
        : joinPath(sourceDirectories.notebookDirectory, ["export", "recent.json"]),
    notebookRecordsRecentJson:
      sourceDirectories.notebookDirectory.length === 0
        ? ""
        : joinPath(sourceDirectories.notebookDirectory, ["records", "summary.json"]),
    refluxLatestJson:
      sourceDirectories.refluxDirectory.length === 0
        ? ""
        : joinPath(sourceDirectories.refluxDirectory, ["latest.json"]),
    refluxTrackerTsv:
      sourceDirectories.refluxDirectory.length === 0
        ? ""
        : joinPath(sourceDirectories.refluxDirectory, ["tracker.tsv"]),
  };
}

function normalizeVoiceSettings(rawSettings: PartialClientSettings | null): Pick<ClientSettings, "voiceEnabled" | "voiceMuted" | "voiceVolume"> {
  const voiceVolume = normalizeVoiceVolume(rawSettings?.voiceVolume);
  const voiceMuted = rawSettings?.voiceMuted ?? rawSettings?.voiceEnabled === false;

  return {
    voiceVolume,
    voiceMuted,
    voiceEnabled: !voiceMuted && voiceVolume > 0,
  };
}

function normalizeOwnedPackIds(rawOwnedPackIds: number[] | undefined): number[] {
  if (!Array.isArray(rawOwnedPackIds)) {
    return [];
  }

  const deduped = new Set<number>();
  for (const value of rawOwnedPackIds) {
    if (!Number.isInteger(value) || value <= 0) {
      continue;
    }
    deduped.add(value);
  }

  return Array.from(deduped).sort((left, right) => left - right);
}

function createDefaultSettings(): ClientSettings {
  const runtimePaths: SourcePaths = {
    dakenTodayUpdateXml: runtimeConfig.settingsDefaults.sourcePaths.dakenTodayUpdateXml ?? "",
    notebookExportRecentJson: runtimeConfig.settingsDefaults.sourcePaths.notebookExportRecentJson ?? "",
    notebookRecordsRecentJson: runtimeConfig.settingsDefaults.sourcePaths.notebookRecordsRecentJson ?? "",
    refluxLatestJson: runtimeConfig.settingsDefaults.sourcePaths.refluxLatestJson ?? "",
    refluxTrackerTsv: runtimeConfig.settingsDefaults.sourcePaths.refluxTrackerTsv ?? "",
  };
  const sourceDirectories = {
    ...createDefaultSourceDirectories(),
    ...deriveSourceDirectories(runtimePaths),
  };
  const sourcePaths = {
    ...createDefaultSourcePaths(),
    ...runtimePaths,
    ...deriveSourcePaths(sourceDirectories),
  };

  return {
    apiBaseUrl: normalizeBaseUrl(runtimeConfig.settingsDefaults.apiBaseUrl),
    playerId: runtimeConfig.settingsDefaults.playerId?.trim() || crypto.randomUUID(),
    displayName: runtimeConfig.settingsDefaults.displayName?.trim() ?? "",
    source: normalizeSource(runtimeConfig.settingsDefaults.source),
    dakenCounterV3Port: normalizeDakenCounterV3Port(runtimeConfig.settingsDefaults.dakenCounterV3Port),
    sourcePaths,
    sourceDirectories,
    voiceEnabled: true,
    voiceVolume: DEFAULT_VOICE_VOLUME,
    voiceMuted: false,
    enablePresentationSe: true,
    bitUnlockEnabled: false,
    djpUnlockEnabled: false,
    ownedPackIds: [],
  };
}

function normalizeSettings(rawSettings: PartialClientSettings | null): ClientSettings {
  const defaults = createDefaultSettings();
  const normalizedRawDirectories: Partial<SourceDirectories> = {};
  if (rawSettings?.sourceDirectories?.dakenDirectory !== undefined) {
    normalizedRawDirectories.dakenDirectory = normalizeDirectory(rawSettings.sourceDirectories.dakenDirectory);
  }
  if (rawSettings?.sourceDirectories?.notebookDirectory !== undefined) {
    normalizedRawDirectories.notebookDirectory = normalizeDirectory(rawSettings.sourceDirectories.notebookDirectory);
  }
  if (rawSettings?.sourceDirectories?.refluxDirectory !== undefined) {
    normalizedRawDirectories.refluxDirectory = normalizeDirectory(rawSettings.sourceDirectories.refluxDirectory);
  }
  const pathHints: SourcePaths = {
    ...defaults.sourcePaths,
    ...rawSettings?.sourcePaths,
  };
  const sourceDirectories = {
    ...defaults.sourceDirectories,
    ...deriveSourceDirectories(pathHints),
    ...normalizedRawDirectories,
  };
  const sourcePaths = {
    ...defaults.sourcePaths,
    ...pathHints,
    ...deriveSourcePaths(sourceDirectories),
  };
  const voiceSettings = normalizeVoiceSettings(rawSettings);
  const ownedPackIds = normalizeOwnedPackIds(rawSettings?.ownedPackIds);

  return {
    apiBaseUrl: resolveApiBaseUrl(rawSettings, defaults.apiBaseUrl),
    playerId: rawSettings?.playerId?.trim() || defaults.playerId,
    displayName: rawSettings?.displayName?.trim() ?? defaults.displayName,
    source: normalizeSource(rawSettings?.source ?? defaults.source),
    dakenCounterV3Port: normalizeDakenCounterV3Port(rawSettings?.dakenCounterV3Port ?? defaults.dakenCounterV3Port),
    sourcePaths,
    sourceDirectories,
    ...voiceSettings,
    enablePresentationSe: rawSettings?.enablePresentationSe ?? defaults.enablePresentationSe,
    bitUnlockEnabled: rawSettings?.bitUnlockEnabled === true,
    djpUnlockEnabled: rawSettings?.djpUnlockEnabled === true,
    ownedPackIds,
  };
}

function syncVoiceDraft(draft: ClientSettings): ClientSettings {
  const voiceEnabled = !draft.voiceMuted && draft.voiceVolume > 0;
  return {
    ...draft,
    voiceEnabled,
  };
}

export function getActiveSourceDirectory(settings: Pick<ClientSettings, "source" | "sourceDirectories">): string {
  if (settings.source === "inf_daken_counter") {
    return settings.sourceDirectories.dakenDirectory;
  }

  if (settings.source === "inf-notebook") {
    return settings.sourceDirectories.notebookDirectory;
  }

  if (settings.source === "reflux") {
    return settings.sourceDirectories.refluxDirectory;
  }

  return "";
}

export function isRoomEntryReady(
  settings: Pick<ClientSettings, "displayName" | "source" | "sourceDirectories" | "dakenCounterV3Port">,
): boolean {
  if (settings.displayName.trim().length === 0) {
    return false;
  }

  if (settings.source === "inf_daken_counter") {
    return false;
  }

  if (settings.source === "daken_counter_v3") {
    return isValidPortNumber(settings.dakenCounterV3Port);
  }

  return getActiveSourceDirectory(settings).trim().length > 0;
}

export function isVoicePlaybackEnabled(
  settings: Pick<ClientSettings, "voiceEnabled" | "voiceMuted" | "voiceVolume">,
): boolean {
  return settings.voiceEnabled && !settings.voiceMuted && settings.voiceVolume > 0;
}

export function getVoicePlaybackVolume(settings: Pick<ClientSettings, "voiceMuted" | "voiceVolume">): number {
  if (settings.voiceMuted) {
    return 0;
  }

  return normalizeVoiceVolume(settings.voiceVolume) / 100;
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
  replaceAll(
    nextSettings: ClientSettings,
    options: { persist?: boolean; statusMessage?: string | null } = {},
  ): void {
    const normalized = normalizeSettings(nextSettings);
    if (options.persist ?? false) {
      writeJson(SETTINGS_STORAGE_KEY, normalized);
    }

    internalStore.setState((state) => ({
      ...state,
      draft: normalized,
      saved: normalized,
      lastSavedAt: options.persist ?? false ? new Date().toISOString() : state.lastSavedAt,
      statusMessage: options.statusMessage ?? null,
    }));
  },
  update<K extends keyof ClientSettings>(key: K, value: ClientSettings[K]): void {
    internalStore.setState((state) => ({
      ...state,
      draft: syncVoiceDraft({
        ...state.draft,
        [key]: value,
      }),
      statusMessage: null,
    }));
  },
  updateSourceDirectory(source: SourceType, directory: string): void {
    internalStore.setState((state) => {
      if (source === "daken_counter_v3") {
        return {
          ...state,
          statusMessage: null,
        };
      }

      const sourceDirectories =
        source === "inf_daken_counter"
          ? {
              ...state.draft.sourceDirectories,
              dakenDirectory: normalizeDirectory(directory),
            }
          : source === "reflux"
            ? {
                ...state.draft.sourceDirectories,
                refluxDirectory: normalizeDirectory(directory),
              }
          : {
              ...state.draft.sourceDirectories,
              notebookDirectory: normalizeDirectory(directory),
            };

      return {
        ...state,
        draft: {
          ...state.draft,
          sourceDirectories,
          sourcePaths: deriveSourcePaths(sourceDirectories),
        },
        statusMessage: null,
      };
    });
  },
  updateVoiceVolume(value: number): void {
    internalStore.setState((state) => ({
      ...state,
      draft: syncVoiceDraft({
        ...state.draft,
        voiceVolume: normalizeVoiceVolume(value),
      }),
      statusMessage: null,
    }));
  },
  updateVoiceMuted(value: boolean): void {
    internalStore.setState((state) => ({
      ...state,
      draft: syncVoiceDraft({
        ...state.draft,
        voiceMuted: value,
      }),
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
  restoreDraftFromSaved(): void {
    internalStore.setState((state) => ({
      ...state,
      draft: state.saved,
      statusMessage: null,
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
