/**
 * Downloads the DatoCMS GraphQL schema into `schema.graphql` so that gql.tada
 * can infer the types of every query in the project.
 *
 * It runs on `npm install` (via the `prepare` script), and it never fails the
 * install: the committed `schema.graphql` is the fallback whenever the
 * download is skipped (CI builds, no API token) or the API call fails.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const loadDotEnvLocal = () => {
  if (!existsSync('.env.local')) return;

  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2').trim();
  }
};

loadDotEnvLocal();

const token = process.env.PUBLIC_DATOCMS_API_TOKEN;

const skipReason = process.env.CI
  ? 'running in CI'
  : !token
    ? 'PUBLIC_DATOCMS_API_TOKEN is not set'
    : null;

if (skipReason) {
  console.log(
    `[generate-schema] ${skipReason}: keeping the committed schema.graphql`,
  );
  process.exit(0);
}

const result = spawnSync(
  'npx',
  [
    'gql.tada',
    'generate',
    'schema',
    'https://graphql.datocms.com',
    '--header',
    'X-Exclude-Invalid: true',
    '--header',
    `Authorization: ${token}`,
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

if (result.status !== 0) {
  console.warn(
    '[generate-schema] the download failed: keeping the committed schema.graphql',
  );
}

