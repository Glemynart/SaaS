import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @saas/api start:prod',
      url: 'http://127.0.0.1:4000/health',
      env: { NODE_ENV: 'test', PORT: '4000' },
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
    {
      command: 'pnpm --filter @saas/web exec next start -H 127.0.0.1 -p 3000',
      url: 'http://127.0.0.1:3000/login',
      env: { PORT: '3000', HOSTNAME: '127.0.0.1' },
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
  ],
});
