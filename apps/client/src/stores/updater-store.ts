import { createExternalStore, useExternalStore } from "./create-store";

export type AppUpdaterPhase =
  | "idle"
  | "checking"
  | "update-available"
  | "downloading"
  | "installing"
  | "failed"
  | "done"
  | "continue-app";

export type UpdaterFailureStage = "check" | "download" | "install";
export type UpdaterProgressEvent = "Started" | "Progress" | "Finished" | null;

export interface UpdaterProgressState {
  event: UpdaterProgressEvent;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export interface UpdaterFailureState {
  stage: UpdaterFailureStage;
  message: string;
  detail: string;
}

export interface AppUpdaterState {
  phase: AppUpdaterPhase;
  currentVersion: string | null;
  nextVersion: string | null;
  progress: UpdaterProgressState;
  failure: UpdaterFailureState | null;
}

interface VersionState {
  currentVersion: string | null;
  nextVersion: string | null;
}

interface FailureInput extends VersionState {
  stage: UpdaterFailureStage;
  message: string;
  detail: string;
}

const emptyProgress: UpdaterProgressState = {
  event: null,
  downloadedBytes: 0,
  totalBytes: null,
  percent: null,
};

const initialState: AppUpdaterState = {
  phase: "idle",
  currentVersion: null,
  nextVersion: null,
  progress: emptyProgress,
  failure: null,
};

const internalStore = createExternalStore<AppUpdaterState>(initialState);

export const updaterStore = {
  ...internalStore,
  beginChecking(): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "checking",
      failure: null,
      progress: emptyProgress,
    }));
  },
  setUpdateAvailable({ currentVersion, nextVersion }: VersionState): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "update-available",
      currentVersion,
      nextVersion,
      failure: null,
      progress: emptyProgress,
    }));
  },
  beginDownload({ currentVersion, nextVersion }: VersionState): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "downloading",
      currentVersion,
      nextVersion,
      failure: null,
      progress: {
        event: "Started",
        downloadedBytes: 0,
        totalBytes: null,
        percent: 0,
      },
    }));
  },
  updateDownloadProgress(progress: UpdaterProgressState): void {
    internalStore.setState((state) => ({
      ...state,
      progress,
    }));
  },
  beginInstall({ currentVersion, nextVersion }: VersionState): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "installing",
      currentVersion,
      nextVersion,
      failure: null,
      progress: {
        ...state.progress,
        event: "Finished",
        percent: 100,
      },
    }));
  },
  setFailed({ stage, message, detail, currentVersion, nextVersion }: FailureInput): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "failed",
      currentVersion,
      nextVersion,
      failure: {
        stage,
        message,
        detail,
      },
    }));
  },
  markDone({ currentVersion, nextVersion }: VersionState): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "done",
      currentVersion,
      nextVersion,
    }));
  },
  allowAppStart(): void {
    internalStore.setState((state) => ({
      ...state,
      phase: "continue-app",
    }));
  },
};

export function useUpdaterStore<TSelected>(
  selector: (state: AppUpdaterState) => TSelected,
): TSelected {
  return useExternalStore(internalStore, selector);
}
