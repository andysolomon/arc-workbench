import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

export const HAS_PROTO = existsSync('Form submission process/Workbench v10.dc.html');

// Two servers: the built port on 4173, and the ORIGINAL prototype export served statically on
// 4180 so the visual spec can diff the two renderings of the same document.
export default defineConfig({
  testDir: 'tests/e2e',
  // the benchmark matrix is its own workflow (pnpm bench · .github/workflows/bench.yml)
  testIgnore: process.env['BENCH'] ? [] : ['**/bench.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1500, height: 900 },
    deviceScaleFactor: 1,
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'pnpm build && pnpm preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
    ...(HAS_PROTO ? [{ command: 'pnpm serve:proto', url: 'http://localhost:4180/Workbench%20v10.dc.html', reuseExistingServer: true, timeout: 30_000 }] : []),
  ],
});
