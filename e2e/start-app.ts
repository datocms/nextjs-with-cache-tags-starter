/**
 * Boots everything the E2E tests need, in order:
 *
 * 1. a fresh file-backed libSQL database initialised with `schema.sql`;
 * 2. the mock DatoCMS Content Delivery API;
 * 3. a clean production build of the Next.js app pointed at both;
 * 4. `next start` serving that build.
 *
 * Playwright runs this script as its `webServer` and waits for the app URL.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { e2eConfig } from './config.ts';
import { startMockCdaServer } from './mock-cda/server.ts';

const projectRoot = process.cwd();

const appEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PUBLIC_DATOCMS_API_TOKEN: e2eConfig.cdaToken,
  DATOCMS_GRAPHQL_ENDPOINT: `${e2eConfig.mockCdaUrl}/graphql`,
  WEBHOOK_TOKEN: e2eConfig.webhookToken,
  TURSO_DATABASE_URL: `file:${e2eConfig.databasePath}`,
  TURSO_AUTH_TOKEN: '',
  NEXT_TELEMETRY_DISABLED: '1',
};

const run = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: appEnv,
      stdio: 'inherit',
    });
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)),
    );
  });

const prepareDatabase = async () => {
  rmSync(dirname(e2eConfig.databasePath), { recursive: true, force: true });
  mkdirSync(dirname(e2eConfig.databasePath), { recursive: true });

  const client = createClient({ url: `file:${e2eConfig.databasePath}` });
  await client.executeMultiple(
    readFileSync(resolve(projectRoot, 'schema.sql'), 'utf8'),
  );
  client.close();
};

await prepareDatabase();

const mockCda = await startMockCdaServer(
  e2eConfig.mockCdaPort,
  e2eConfig.cdaToken,
);
console.log(`[e2e] mock CDA listening on ${mockCda.url}`);

// A clean build guarantees no Data Cache entries survive from a previous run.
rmSync(resolve(projectRoot, '.next'), { recursive: true, force: true });
await run('npx', ['next', 'build']);

const app = spawn('npx', ['next', 'start', '-p', String(e2eConfig.appPort)], {
  cwd: projectRoot,
  env: appEnv,
  stdio: 'inherit',
});

const shutdown = async () => {
  app.kill('SIGTERM');
  await mockCda.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
app.on('exit', (code) => {
  console.log(`[e2e] next start exited with ${code}`);
  process.exit(code ?? 1);
});
