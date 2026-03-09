import type { CheckOptions } from "@tauri-apps/plugin-updater";
import { runtimeConfig } from "../../runtime/runtime-config";

export const STARTUP_UPDATER_FALLBACK_DELAY_MS = 2400;

export function getStartupUpdaterCheckOptions(): CheckOptions {
  const options: CheckOptions = {
    timeout: runtimeConfig.updater.checkTimeoutMs,
  };

  if (runtimeConfig.updater.target) {
    options.target = runtimeConfig.updater.target;
  }

  return options;
}
