import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [repoRoot],
    },
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
  },
});
