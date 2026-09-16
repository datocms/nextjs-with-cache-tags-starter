import { resolve } from 'node:path';

/**
 * Shared settings for the E2E test-suite: where the app, the mock Content
 * Delivery API and the throw-away libSQL database live.
 *
 * Paths are resolved from the working directory (the project root), since
 * this module is loaded both by Playwright (as CommonJS) and by Node (as ESM).
 */
export const e2eConfig = {
  appPort: 3100,
  appUrl: 'http://127.0.0.1:3100',
  mockCdaPort: 4010,
  mockCdaUrl: 'http://127.0.0.1:4010',
  cdaToken: 'e2e-cda-token',
  webhookToken: 'e2e-webhook-token',
  databasePath: resolve(process.cwd(), 'e2e', '.tmp', 'cache-tags.db'),
};
