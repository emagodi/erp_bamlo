import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['app/**', '.next/**', 'node_modules/**', 'tests/e2e.spec.ts'],
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
});
