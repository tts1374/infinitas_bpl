import { SOURCE_TYPES, type SourceType } from "@infinitas/shared";

export interface RuntimeSourcePathDefaults {
  dakenTodayUpdateXml: string | undefined;
  notebookExportRecentJson: string | undefined;
  notebookRecordsRecentJson: string | undefined;
}

export interface RuntimeSettingsDefaults {
  apiBaseUrl: string | undefined;
  playerId: string | undefined;
  displayName: string | undefined;
  source: SourceType | undefined;
  sourcePaths: RuntimeSourcePathDefaults;
}

export interface RuntimeConfig {
  debugUiEnabled: boolean;
  instanceId: string | null;
  instanceLabel: string;
  mockScenarioId: string | null;
  autoCapture: boolean;
  captureDelayMs: number;
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

function readNumberParam(name: string, fallback: number): number {
  const value = Number(readSearchParam(name));
  return Number.isFinite(value) ? value : fallback;
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
const apiBaseUrl = readSearchParam("api");
const source = parseSourceType(readSearchParam("source"));

export const runtimeConfig: RuntimeConfig = {
  debugUiEnabled: import.meta.env.DEV,
  instanceId,
  instanceLabel: readSearchParam("label") ?? displayName ?? instanceId ?? "default",
  mockScenarioId: readSearchParam("scenario") ?? null,
  autoCapture: readFlagParam("capture"),
  captureDelayMs: readNumberParam("captureDelayMs", 500),
  settingsDefaults: {
    apiBaseUrl,
    playerId,
    displayName,
    source,
    sourcePaths: {
      dakenTodayUpdateXml: readSearchParam("dakenPath"),
      notebookExportRecentJson: readSearchParam("notebookPath"),
      notebookRecordsRecentJson: readSearchParam("recordsPath"),
    },
  },
};

export function buildScopedStorageKey(key: string): string {
  return runtimeConfig.instanceId === null ? key : `${key}:instance:${runtimeConfig.instanceId}`;
}
