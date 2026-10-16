import { defineConfig } from '@playwright/test'
const offset = Number(process.env.PYR_E2E_PORT_OFFSET || 0)
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/base',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', channel: 'msedge', trace: 'retain-on-failure' },
  projects: [
    { name: 'development', use: { baseURL: `http://127.0.0.1:${5173 + offset}` }, testMatch: 'development.spec.ts' },
    { name: 'auth', use: { baseURL: `http://127.0.0.1:${5174 + offset}` }, testMatch: ['auth.spec.ts', 'p3.spec.ts'] },
    { name: 'production', use: { baseURL: `http://127.0.0.1:${4173 + offset}` }, testMatch: 'production.spec.ts' },
  ],
  // scripts/run-e2e.mjs owns direct Node children, avoiding npm shell trees on Windows.
})
