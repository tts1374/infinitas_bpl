import { SOURCE_TYPES, type SourceType } from "@infinitas/shared";

export interface RuntimeSourcePathDefaults {
  dakenTodayUpdateXml: string | undefined;
  notebookExportRecentJson: string | undefined;
  notebookRecordsRecentJson: string | undefined;
  refluxLatestJson: string | undefined;
  refluxTrackerTsv: string | undefined;
}

export interface RuntimeSettingsDefaults {
  apiBaseUrl: string | undefined;
  playerId: string | undefined;
  displayName: string | undefined;
  source: SourceType | undefined;
  dakenCounterV3Port: number | undefined;
  sourcePaths: RuntimeSourcePathDefaults;
}

export interface RuntimeUpdaterConfig {
  target: string | undefined;
  checkTimeoutMs: number;
}

export interface RuntimeConfig {
  debugUiEnabled: boolean;
  instanceId: string | null;
  instanceLabel: string;
  mockScenarioId: string | null;
  autoCapture: boolean;
  captureDelayMs: number;
  updater: RuntimeUpdaterConfig;
  settingsDefaults: RuntimeSettingsDefaults;
}

function readSearchParam(name: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = new URLSearchParams(window.location.search).get(name)?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readFlagParam(name: string): boolean {
  const value = readSearchParam(name)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function readOptionalFlagParam(name: string): boolean | undefined {
  const value = readSearchParam(name);
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readNumberParam(name: string, fallback: number): number {
  const value = Number(readSearchParam(name));
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalIntegerParam(name: string): number | undefined {
  const raw = readSearchParam(name);
  if (raw === undefined) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function normalizeInstanceId(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 && normalized !== "default" ? normalized : null;
}

function parseSourceType(value: string | undefined): SourceType | undefined {
  return SOURCE_TYPES.includes(value as SourceType) ? (value as SourceType) : undefined;
}

const instanceId = normalizeInstanceId(readSearchParam("instance"));
const displayName = readSearchParam("name");
const playerId = readSearchParam("playerId");
const apiBaseUrlFromEnv = import.meta.env.VITE_WORKER_API_BASE_URL?.trim();
const apiBaseUrl =
  apiBaseUrlFromEnv && apiBaseUrlFromEnv.length > 0 ? apiBaseUrlFromEnv : readSearchParam("api");
const source = parseSourceType(readSearchParam("source"));
const dakenCounterV3Port =
  readOptionalIntegerParam("dakenCounterV3Port") ??
  readOptionalIntegerParam("dakenPort");
const updaterTarget =
  readSearchParam("updateTarget") ?? import.meta.env.VITE_UPDATER_TARGET?.trim() ?? "windows-x86_64";
const updaterTimeoutEnvRaw = import.meta.env.VITE_UPDATER_CHECK_TIMEOUT_MS?.trim();
const updaterTimeoutEnv =
  updaterTimeoutEnvRaw && updaterTimeoutEnvRaw.length > 0
    ? Number(updaterTimeoutEnvRaw)
    : Number.NaN;
const debugUiEnabled = readOptionalFlagParam("debugUi") ?? import.meta.env.DEV;

export const runtimeConfig: RuntimeConfig = {
  debugUiEnabled,
  instanceId,
  instanceLabel: readSearchParam("label") ?? displayName ?? instanceId ?? "default",
  mockScenarioId: readSearchParam("scenario") ?? null,
  autoCapture: readFlagParam("capture"),
  captureDelayMs: readNumberParam("captureDelayMs", 500),
  updater: {
    target: updaterTarget.trim().length > 0 ? updaterTarget.trim() : undefined,
    checkTimeoutMs: Number.isFinite(updaterTimeoutEnv)
      ? updaterTimeoutEnv
      : readNumberParam("updateTimeoutMs", 10000),
  },
  settingsDefaults: {
    apiBaseUrl,
    playerId,
    displayName,
    source,
    dakenCounterV3Port,
    sourcePaths: {
      dakenTodayUpdateXml: readSearchParam("dakenPath"),
      notebookExportRecentJson: readSearchParam("notebookPath"),
      notebookRecordsRecentJson: readSearchParam("recordsPath"),
      refluxLatestJson: readSearchParam("refluxLatestPath"),
      refluxTrackerTsv: readSearchParam("refluxTrackerPath"),
    },
  },
};

export function buildScopedStorageKey(key: string): string {
  return runtimeConfig.instanceId === null ? key : `${key}:instance:${runtimeConfig.instanceId}`;
}
