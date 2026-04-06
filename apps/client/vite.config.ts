import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("/@tauri-apps/")) {
            return "vendor-tauri";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
  },
});
