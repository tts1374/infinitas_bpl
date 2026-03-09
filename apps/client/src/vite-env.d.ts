/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UPDATER_TARGET?: string;
  readonly VITE_UPDATER_CHECK_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
