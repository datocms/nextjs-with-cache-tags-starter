import { defineConfig, devices } from '@playwright/test';
import { e2eConfig } from './e2e/config.ts';

/**
 * E2E tests run a real production build of the app against a local mock of
 * the DatoCMS Content Delivery API and a file-backed libSQL database, so they
 * need no secrets and can run in CI. See `e2e/start-app.ts`.
 *
 * The specs share one app instance (and therefore one cache), so they run
 * serially.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: e2eConfig.appUrl,
    trace: 'retain-on-failure',
    // Lets environments with a pre-installed Chromium skip the browser download.
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node e2e/start-app.ts',
    url: e2eConfig.appUrl,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
