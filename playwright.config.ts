import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? '3000';
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? '4000';
const webUrl = `http://127.0.0.1:${webPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}`;
// Reuse a local API only when explicitly requested; E2E requires isolated SMTP config.
const reuseExistingServer = !isCI && process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';

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
    baseURL: webUrl,
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
      command: 'node e2e/mail-sink.mjs',
      url: 'http://127.0.0.1:8025/health',
      timeout: 30_000,
      reuseExistingServer,
    },
    {
      command: 'pnpm --filter @saas/api start:prod',
      url: `${apiUrl}/health`,
      env: {
        NODE_ENV: 'test',
        PORT: apiPort,
        FRONTEND_URL: webUrl,
        API_URL: apiUrl,
        NEXT_PUBLIC_API_URL: apiUrl,
        EMAIL_FROM: 'no-reply@example.test',
        EMAIL_FROM_NAME: 'La Oficina Nítida E2E',
        EMAIL_SMTP_HOST: '127.0.0.1',
        EMAIL_SMTP_PORT: '1025',
        EMAIL_SMTP_USER: 'e2e-user',
        EMAIL_SMTP_PASSWORD: 'e2e-password',
        EMAIL_SMTP_SECURE: 'false',
        EMAIL_SMTP_REQUIRE_TLS: 'false',
      },
      timeout: 120_000,
      reuseExistingServer,
    },
    {
      command: `pnpm --filter @saas/web exec next start -H 127.0.0.1 -p ${webPort}`,
      url: `${webUrl}/login`,
      env: {
        PORT: webPort,
        HOSTNAME: '127.0.0.1',
        API_URL: apiUrl,
        NEXT_PUBLIC_API_URL: apiUrl,
      },
      timeout: 120_000,
      reuseExistingServer,
    },
  ],
});
