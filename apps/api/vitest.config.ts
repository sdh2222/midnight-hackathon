import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    server: {
      deps: {
        inline: ["@midnight-hackathon/intent-contract"],
        // Compiler output is loaded by Node directly; Vite must not rewrite it.
        external: [/\/managed\//],
      },
    },
  },
});
