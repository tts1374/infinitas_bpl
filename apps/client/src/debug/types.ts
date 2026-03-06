import {
  MODES,
  PLAY_STYLES,
  SKIP_REASONS,
  SOURCE_TYPES,
  WIN_METRICS,
  type Mode,
  type PlayStyle,
  type SkipReason,
  type SourceType,
  type WinMetric,
} from "@infinitas/shared";
import type { ParsedSourceChangePayload } from "../services/tauri-bridge";

export interface DebugTargetRoom {
  mode: Mode;
  win_metric: WinMetric;
  play_style: PlayStyle;
}

export interface DebugSourceMetaTemplate {
  timestamp?: string;
  title?: string;
  score?: number;
  misscount?: number;
}

export interface DebugResultTemplate {
  schema_version: 1;
  kind: "result-template";
  case_name: string;
  description: string;
  target_room: DebugTargetRoom;
  source: SourceType;
  metric_value: number;
  source_meta?: DebugSourceMetaTemplate;
}

export interface DebugSkipTemplate {
  schema_version: 1;
  kind: "skip-template";
  case_name: string;
  description: string;
  target_room: DebugTargetRoom;
  skip_reason: SkipReason;
}

export type DebugInjectionTemplate = DebugResultTemplate | DebugSkipTemplate;

export type ParsedDebugInjectionInput =
  | {
      kind: "template";
      template: DebugInjectionTemplate;
    }
  | {
      kind: "parsed-change";
      parsedChange: ParsedSourceChangePayload;
    };

interface ParseDebugInjectionSuccess {
  ok: true;
  value: ParsedDebugInjectionInput;
}

interface ParseDebugInjectionFailure {
  ok: false;
  message: string;
}

type ParseDebugInjectionResult = ParseDebugInjectionSuccess | ParseDebugInjectionFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && SOURCE_TYPES.includes(value as SourceType);
}

function isMode(value: unknown): value is Mode {
  return typeof value === "string" && MODES.includes(value as Mode);
}

function isWinMetric(value: unknown): value is WinMetric {
  return typeof value === "string" && WIN_METRICS.includes(value as WinMetric);
}

function isPlayStyle(value: unknown): value is PlayStyle {
  return typeof value === "string" && PLAY_STYLES.includes(value as PlayStyle);
}

function isSkipReason(value: unknown): value is SkipReason {
  return typeof value === "string" && SKIP_REASONS.includes(value as SkipReason);
}

function isDebugTargetRoom(value: unknown): value is DebugTargetRoom {
  return (
    isRecord(value) &&
    isMode(value.mode) &&
    isWinMetric(value.win_metric) &&
    isPlayStyle(value.play_style)
  );
}

function isDebugSourceMetaTemplate(value: unknown): value is DebugSourceMetaTemplate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.timestamp === undefined || typeof value.timestamp === "string") &&
    (value.title === undefined || typeof value.title === "string") &&
    (value.score === undefined || isNonNegativeInteger(value.score)) &&
    (value.misscount === undefined || isNonNegativeInteger(value.misscount))
  );
}

export function isDebugInjectionTemplate(value: unknown): value is DebugInjectionTemplate {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.schema_version !== 1 ||
    typeof value.kind !== "string" ||
    typeof value.case_name !== "string" ||
    typeof value.description !== "string" ||
    !isDebugTargetRoom(value.target_room)
  ) {
    return false;
  }

  if (value.kind === "result-template") {
    return (
      isSourceType(value.source) &&
      isNonNegativeInteger(value.metric_value) &&
      (value.source_meta === undefined || isDebugSourceMetaTemplate(value.source_meta))
    );
  }

  if (value.kind === "skip-template") {
    return isSkipReason(value.skip_reason);
  }

  return false;
}

function isParsedSourceObservationPayload(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.timestamp === "string" &&
    (value.playStyle === null || value.playStyle === undefined || isPlayStyle(value.playStyle)) &&
    typeof value.difficulty === "string" &&
    typeof value.title === "string" &&
    typeof value.titleSearchKey === "string" &&
    isNonNegativeInteger(value.score) &&
    isNonNegativeInteger(value.misscount)
  );
}

export function isParsedSourceChangePayload(value: unknown): value is ParsedSourceChangePayload {
  return (
    isRecord(value) &&
    isSourceType(value.source) &&
    typeof value.filePath === "string" &&
    isNonNegativeInteger(value.fileSizeBytes) &&
    Array.isArray(value.observations) &&
    value.observations.every(isParsedSourceObservationPayload)
  );
}

export function ensureDebugInjectionTemplate(
  value: unknown,
  fileName: string,
): DebugInjectionTemplate {
  if (!isDebugInjectionTemplate(value)) {
    throw new Error(`${fileName} is not a valid debug injection template.`);
  }

  return value;
}

export function parseDebugInjectionJson(text: string): ParseDebugInjectionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to parse JSON.",
    };
  }

  if (isDebugInjectionTemplate(parsed)) {
    return {
      ok: true,
      value: {
        kind: "template",
        template: parsed,
      },
    };
  }

  if (isParsedSourceChangePayload(parsed)) {
    return {
      ok: true,
      value: {
        kind: "parsed-change",
        parsedChange: parsed,
      },
    };
  }

  return {
    ok: false,
    message:
      "JSON must be either a debug injection template or a normalized ParsedSourceChangePayload.",
  };
}
