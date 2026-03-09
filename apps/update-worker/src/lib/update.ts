import type { Env } from "../types/env";
import type { UpdateCheckQuery, UpdateResponse } from "../types/update";
import { normalizeVersion } from "./version";

export const SUPPORTED_TARGET = "windows-x86_64";

const UPDATE_DISABLED_KEY = "app:update:disabled";
const LATEST_VERSION_KEY = "app:stable:latest";
const ARTIFACT_PREFIX = "bpl-app/stable";
const MSI_FILE_NAME = "app.msi";
const DEFAULT_UPDATE_NOTES = "不具合修正";
const DEFAULT_UPDATE_PUB_DATE = "2026-03-09T00:00:00.000Z";

export class UpdateBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateBadRequestError";
  }
}

export class UpdateInternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpdateInternalError";
  }
}

export function parseAndValidateQuery(request: Request): UpdateCheckQuery {
  const url = new URL(request.url);
  const version = url.searchParams.get("version");
  if (version === null || version.trim().length === 0) {
    throw new UpdateBadRequestError("version is required");
  }

  const target = url.searchParams.get("target");
  if (target === null || target.trim().length === 0) {
    throw new UpdateBadRequestError("target is required");
  }

  if (target !== SUPPORTED_TARGET) {
    throw new UpdateBadRequestError("invalid target");
  }

  try {
    return {
      currentVersion: normalizeVersion(version),
      target,
    };
  } catch {
    throw new UpdateBadRequestError("invalid version");
  }
}

export async function isUpdateDisabled(env: Env): Promise<boolean> {
  const rawValue = await env.APP_KV.get(UPDATE_DISABLED_KEY, "text");
  return rawValue?.trim().toLowerCase() === "true";
}

export async function readLatestVersion(env: Env): Promise<string> {
  const rawValue = await env.APP_KV.get(LATEST_VERSION_KEY, "text");
  if (rawValue === null || rawValue.trim().length === 0) {
    throw new UpdateInternalError("latest version is not configured");
  }

  try {
    return normalizeVersion(rawValue);
  } catch {
    throw new UpdateInternalError("latest version is invalid");
  }
}

export function buildArtifactPath(version: string, target: string): string {
  return `${ARTIFACT_PREFIX}/${version}/${target}/${MSI_FILE_NAME}`;
}

export async function readSignature(env: Env, objectKey: string): Promise<string> {
  const object = await env.APP_BUCKET.get(`${objectKey}.sig`);
  if (object === null) {
    throw new UpdateInternalError("signature object is missing");
  }

  const signature = (await object.text()).trim();
  if (signature.length === 0) {
    throw new UpdateInternalError("signature object is empty");
  }

  return signature;
}

export function buildUpdateUrl(env: Env, objectKey: string): string {
  const baseUrl = env.DOWNLOAD_BASE_URL.trim().replace(/\/+$/, "");
  if (baseUrl.length === 0) {
    throw new UpdateInternalError("download base url is not configured");
  }

  return `${baseUrl}/${objectKey}`;
}

interface BuildUpdateResponseInput {
  version: string;
  url: string;
  signature: string;
  notes?: string;
  pubDate?: string;
}

export function buildUpdateResponse({
  version,
  url,
  signature,
  notes = DEFAULT_UPDATE_NOTES,
  pubDate = DEFAULT_UPDATE_PUB_DATE,
}: BuildUpdateResponseInput): UpdateResponse {
  return {
    version,
    url,
    signature,
    notes,
    pub_date: pubDate,
  };
}
