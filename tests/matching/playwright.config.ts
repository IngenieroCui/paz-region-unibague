import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'browser.spec.ts', outputDir: './test-results', workers: 1, reporter: 'list', use: { baseURL: 'http://127.0.0.1:5525', browserName: 'chromium', channel: 'msedge', trace: 'retain-on-failure' } })
