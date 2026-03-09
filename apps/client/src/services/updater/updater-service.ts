import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { isTauriRuntime } from "../tauri-bridge";
import {
  STARTUP_UPDATER_FALLBACK_DELAY_MS,
  getStartupUpdaterCheckOptions,
} from "./updater-config";
import { updaterStore } from "../../stores/updater-store";

type UpdaterApiModule = typeof import("@tauri-apps/plugin-updater");
type FailureStage = "check" | "download" | "install";

const UPDATER_LOG_PREFIX = "[app-updater]";

function logInfo(message: string, context?: Record<string, unknown>): void {
  if (context) {
    console.info(UPDATER_LOG_PREFIX, message, context);
    return;
  }

  console.info(UPDATER_LOG_PREFIX, message);
}

function logError(message: string, error: unknown, context?: Record<string, unknown>): void {
  if (context) {
    console.error(UPDATER_LOG_PREFIX, message, context, error);
    return;
  }

  console.error(UPDATER_LOG_PREFIX, message, error);
}

function formatErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function failureMessage(stage: FailureStage): string {
  switch (stage) {
    case "download":
      return "更新のダウンロードに失敗しました";
    case "install":
      return "更新の適用に失敗しました";
    case "check":
    default:
      return "更新の確認に失敗しました";
  }
}

let updaterApiPromise: Promise<UpdaterApiModule> | null = null;

async function getUpdaterApi(): Promise<UpdaterApiModule> {
  updaterApiPromise ??= import("@tauri-apps/plugin-updater");
  return updaterApiPromise;
}

class AppUpdaterService {
  private startupPromise: Promise<void> | null = null;
  private installPromise: Promise<void> | null = null;
  private fallbackTimerId: number | null = null;
  private pendingUpdate: Update | null = null;

  async bootstrap(): Promise<void> {
    if (this.startupPromise !== null) {
      return this.startupPromise;
    }

    this.startupPromise = this.runBootstrap();
    return this.startupPromise;
  }

  async installAvailableUpdate(): Promise<void> {
    if (this.installPromise !== null) {
      return this.installPromise;
    }

    this.installPromise = this.runInstallFlow();
    try {
      await this.installPromise;
    } finally {
      this.installPromise = null;
    }
  }

  private async runBootstrap(): Promise<void> {
    if (!isTauriRuntime()) {
      logInfo("Skipping startup updater check outside the Tauri runtime.");
      updaterStore.allowAppStart();
      return;
    }

    const options = getStartupUpdaterCheckOptions();
    updaterStore.beginChecking();
    logInfo("Starting updater check.", options.target ? { target: options.target } : undefined);

    try {
      const { check } = await getUpdaterApi();
      const update = await check(options);

      if (update === null) {
        logInfo("Updater check completed with no update.");
        updaterStore.allowAppStart();
        return;
      }

      this.pendingUpdate = update;
      logInfo("Updater check found an available update.", {
        currentVersion: update.currentVersion,
        nextVersion: update.version,
      });
      updaterStore.setUpdateAvailable({
        currentVersion: update.currentVersion,
        nextVersion: update.version,
      });
    } catch (error) {
      this.handleFailure("check", error);
    }
  }

  private async runInstallFlow(): Promise<void> {
    const update = this.pendingUpdate;
    if (update === null) {
      return;
    }

    const currentVersion = update.currentVersion;
    const nextVersion = update.version;
    let downloadedBytes = 0;
    let totalBytes: number | null = null;

    updaterStore.beginDownload({
      currentVersion,
      nextVersion,
    });
    logInfo("Starting update download.", {
      currentVersion,
      nextVersion,
    });

    try {
      await update.download((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? null;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
        } else if (event.event === "Finished" && totalBytes !== null) {
          downloadedBytes = totalBytes;
        }

        updaterStore.updateDownloadProgress(
          this.createProgressSnapshot(event, downloadedBytes, totalBytes),
        );
        logInfo("Updater progress event.", {
          event: event.event,
          downloadedBytes,
          totalBytes,
        });
      });
    } catch (error) {
      await this.closePendingUpdate();
      this.handleFailure("download", error, {
        currentVersion,
        nextVersion,
      });
      return;
    }

    updaterStore.beginInstall({
      currentVersion,
      nextVersion,
    });
    logInfo("Starting update install.", {
      currentVersion,
      nextVersion,
    });

    try {
      await update.install();
      updaterStore.markDone({
        currentVersion,
        nextVersion,
      });
      logInfo("Updater install completed.");
    } catch (error) {
      await this.closePendingUpdate();
      this.handleFailure("install", error, {
        currentVersion,
        nextVersion,
      });
    }
  }

  private createProgressSnapshot(
    event: DownloadEvent,
    downloadedBytes: number,
    totalBytes: number | null,
  ) {
    const percent =
      totalBytes !== null && totalBytes > 0
        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
        : event.event === "Finished"
          ? 100
          : null;

    return {
      event: event.event,
      downloadedBytes,
      totalBytes,
      percent,
    };
  }

  private handleFailure(
    stage: FailureStage,
    error: unknown,
    context: { currentVersion?: string; nextVersion?: string } = {},
  ): void {
    const message = failureMessage(stage);
    const detail = formatErrorDetail(error);

    logError(message, error, context);
    updaterStore.setFailed({
      stage,
      message,
      detail,
      currentVersion: context.currentVersion ?? null,
      nextVersion: context.nextVersion ?? null,
    });
    this.scheduleFallbackStart();
  }

  private scheduleFallbackStart(): void {
    if (typeof window === "undefined") {
      updaterStore.allowAppStart();
      return;
    }

    if (this.fallbackTimerId !== null) {
      window.clearTimeout(this.fallbackTimerId);
    }

    this.fallbackTimerId = window.setTimeout(() => {
      this.fallbackTimerId = null;
      logInfo("Continuing to the current app version after updater fallback.");
      updaterStore.allowAppStart();
    }, STARTUP_UPDATER_FALLBACK_DELAY_MS);
  }

  private async closePendingUpdate(): Promise<void> {
    if (this.pendingUpdate === null) {
      return;
    }

    try {
      await this.pendingUpdate.close();
    } catch (error) {
      logError("Failed to close updater resource.", error);
    } finally {
      this.pendingUpdate = null;
    }
  }
}

export const appUpdaterService = new AppUpdaterService();
