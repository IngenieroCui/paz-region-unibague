import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/base',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', channel: 'msedge', trace: 'retain-on-failure' },
  projects: [
    { name: 'development', use: { baseURL: 'http://127.0.0.1:5173' }, testMatch: 'development.spec.ts' },
    { name: 'auth', use: { baseURL: 'http://127.0.0.1:5174' }, testMatch: ['auth.spec.ts', 'p3.spec.ts'] },
    { name: 'production', use: { baseURL: 'http://127.0.0.1:4173' }, testMatch: 'production.spec.ts' },
  ],
  // scripts/run-e2e.mjs owns direct Node children, avoiding npm shell trees on Windows.
})
