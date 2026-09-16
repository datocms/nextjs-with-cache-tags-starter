import { defineConfig, devices } from '@playwright/test';

/**
 * Opt-in E2E tests against the real DatoCMS project and Turso database
 * configured in `.env.local` (run with `npm run test:e2e:live`).
 *
 * The app is built and served like in production; Next.js loads `.env.local`
 * on its own. The invalidation round-trip additionally needs a full-access
 * `DATOCMS_CMA_TOKEN` to edit content, and is skipped otherwise.
 */
const port = 3200;

export default defineConfig({
  testDir: './e2e/live',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          },
        }
      : {}),
  },
  projects: [{ name: 'live', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next build && npx next start -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
