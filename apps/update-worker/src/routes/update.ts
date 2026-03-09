import { badRequest, internalError, methodNotAllowed, noContent, ok } from "../lib/response";
import {
  buildArtifactPath,
  buildUpdateResponse,
  buildUpdateUrl,
  isUpdateDisabled,
  parseAndValidateQuery,
  readLatestVersion,
  readSignature,
  UpdateBadRequestError,
} from "../lib/update";
import { compareVersions } from "../lib/version";
import type { Env } from "../types/env";

export async function handleUpdateRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  console.info("[update-api] request start", { method: request.method, url: request.url });

  try {
    const query = parseAndValidateQuery(request);
    console.info("[update-api] query received", query);

    const disabled = await isUpdateDisabled(env);
    console.info("[update-api] disabled flag", { disabled });
    if (disabled) {
      console.info("[update-api] no update", { reason: "disabled" });
      return noContent();
    }

    const latestVersion = await readLatestVersion(env);
    console.info("[update-api] latest version", { latestVersion });

    if (compareVersions(query.currentVersion, latestVersion) >= 0) {
      console.info("[update-api] no update", {
        reason: "already-latest",
        currentVersion: query.currentVersion,
        latestVersion,
      });
      return noContent();
    }

    const objectKey = buildArtifactPath(latestVersion, query.target);
    let signature: string;
    try {
      signature = await readSignature(env, objectKey);
    } catch (error) {
      console.error("[update-api] signature read failed", {
        objectKey,
        message: error instanceof Error ? error.message : "unknown error",
      });
      throw error;
    }

    const payload = buildUpdateResponse({
      version: latestVersion,
      url: buildUpdateUrl(env, objectKey),
      signature,
    });

    console.info("[update-api] update available", {
      currentVersion: query.currentVersion,
      latestVersion,
      objectKey,
    });
    return ok(payload);
  } catch (error) {
    if (error instanceof UpdateBadRequestError) {
      console.warn("[update-api] invalid request", {
        message: error.message,
        url: request.url,
      });
      return badRequest(error.message);
    }

    console.error("[update-api] internal error", {
      message: error instanceof Error ? error.message : "unknown error",
      url: request.url,
    });
    return internalError();
  }
}
