import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    server: {
      deps: {
        // Compiler output is loaded by Node directly; Vite must not rewrite it or read its sourcemap.
        external: [/\/managed\//],
      },
    },
  },
});
