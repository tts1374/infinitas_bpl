/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_API_BASE_URL?: string;
  readonly VITE_UPDATER_TARGET?: string;
  readonly VITE_UPDATER_CHECK_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
