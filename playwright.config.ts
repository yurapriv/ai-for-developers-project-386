import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node scripts/serve-api.mjs',
      url: 'http://127.0.0.1:8080/health',
      env: {
        LISTEN_ADDR: '127.0.0.1:8080',
        E2E_MODE: '1',
        E2E_FIXED_NOW: '2026-12-31T17:00:00Z',
        E2E_CLOCK_FILE: 'test-results/server-clock.txt',
      },
      reuseExistingServer: false,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js preview --config frontend/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
  ],
});
