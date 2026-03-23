import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const landingEntry = new URL("./index.html", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const joinEntry = new URL("./join/index.html", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig({
  base: process.env.VITE_WEB_BASE ?? "/",
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
    },
    host: "0.0.0.0",
    port: 1430,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        landing: landingEntry,
        join: joinEntry,
      },
    },
  },
});
