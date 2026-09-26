import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  envDir: "../..",
  build: {
    target: "esnext",
  },
  plugins: [react(), wasm()],
  optimizeDeps: {
    exclude: ["@midnight-ntwrk/onchain-runtime-v3"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
