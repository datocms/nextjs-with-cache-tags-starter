/**
 * Downloads the DatoCMS GraphQL schema into `schema.graphql` so that gql.tada
 * can infer the types of every query in the project.
 *
 * It runs on `npm install` (via the `prepare` script). When no API token is
 * available (e.g. in CI or on a fresh clone), the committed `schema.graphql`
 * is kept as-is and the download is skipped, instead of failing the install.
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

if (!token) {
  console.log(
    '[generate-schema] PUBLIC_DATOCMS_API_TOKEN is not set: keeping the existing schema.graphql',
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

process.exit(result.status ?? 1);
