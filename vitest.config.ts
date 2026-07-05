import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Next.js aliases 'react' to its bundled canary build (which exports the
      // RSC `cache` API) at build/dev time via its own webpack config. Outside
      // that pipeline, plain node_modules/react (stable) has no `cache` export,
      // which breaks any test importing lib/auth/session.ts. Resolve to the
      // same React build Next.js itself uses so behavior matches production.
      react: path.resolve(__dirname, 'node_modules/next/dist/compiled/react/index.js')
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.routes.setup.ts'],
    exclude: ['**/tests/e2e/**', '**/node_modules/**'],
    include: ['tests/**/*.test.ts', '__tests__/**/*.test.ts'],
    // DB-backed route tests (tests/routes/*.route.test.ts) share fixture rows
    // (org-a, org-b, user-dealer, ...) directly in the real test database, so
    // running test files in parallel causes cross-file FK/unique races.
    fileParallelism: false
  }
});
