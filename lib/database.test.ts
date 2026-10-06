import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { CacheTag } from './cache-tags';
import {
  deleteQueries,
  queriesReferencingCacheTags,
  storeQueryCacheTags,
  truncateAssociationsTable,
} from './database';

const tag = (value: string) => value as CacheTag;

/**
 * These tests run the real SQL against a throw-away, file-backed libSQL
 * database initialised with the same `schema.sql` used for Turso.
 */
const directory = mkdtempSync(join(tmpdir(), 'cache-tags-db-'));
const url = `file:${join(directory, 'test.db')}`;

const rowCount = async () => {
  const { rows } = await createClient({ url }).execute(
    'SELECT count(*) AS n FROM query_cache_tags',
  );

  return Number(rows[0].n);
};

beforeAll(async () => {
  await createClient({ url }).executeMultiple(
    readFileSync('schema.sql', 'utf8'),
  );
});

beforeEach(async () => {
  // Env stubs are reset after every test (`unstubEnvs`), so re-apply them here.
  vi.stubEnv('TURSO_DATABASE_URL', url);
  vi.stubEnv('TURSO_AUTH_TOKEN', '');

  await truncateAssociationsTable();
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('storeQueryCacheTags', () => {
  it('stores one row per cache tag', async () => {
    await storeQueryCacheTags('query-1', [tag('a'), tag('b')]);

    expect(await rowCount()).toBe(2);
  });

  it('ignores duplicates', async () => {
    await storeQueryCacheTags('query-1', [tag('a'), tag('b')]);
    await storeQueryCacheTags('query-1', [tag('a'), tag('b'), tag('c')]);

    expect(await rowCount()).toBe(3);
  });

  it('is a no-op for an empty list of tags', async () => {
    await expect(storeQueryCacheTags('query-1', [])).resolves.toBeUndefined();

    expect(await rowCount()).toBe(0);
  });
});

describe('queriesReferencingCacheTags', () => {
  beforeEach(async () => {
    await storeQueryCacheTags('query-1', [tag('site'), tag('post:1')]);
    await storeQueryCacheTags('query-2', [tag('site'), tag('post:2')]);
    await storeQueryCacheTags('query-3', [tag('author:1')]);
  });

  it('returns the distinct query ids that reference any of the tags', async () => {
    expect((await queriesReferencingCacheTags([tag('site')])).sort()).toEqual([
      'query-1',
      'query-2',
    ]);

    expect(
      await queriesReferencingCacheTags([tag('post:2'), tag('author:1')]),
    ).toEqual(expect.arrayContaining(['query-2', 'query-3']));
  });

  it('returns [] when no query references the tags', async () => {
    expect(await queriesReferencingCacheTags([tag('unknown')])).toEqual([]);
    expect(await queriesReferencingCacheTags([])).toEqual([]);
  });
});

describe('deleteQueries', () => {
  it('removes every row of the given queries only', async () => {
    await storeQueryCacheTags('query-1', [tag('a'), tag('b')]);
    await storeQueryCacheTags('query-2', [tag('a')]);

    await deleteQueries(['query-1']);

    expect(await queriesReferencingCacheTags([tag('a')])).toEqual(['query-2']);
    expect(await rowCount()).toBe(1);
  });

  it('is a no-op for an empty list', async () => {
    await storeQueryCacheTags('query-1', [tag('a')]);

    await deleteQueries([]);

    expect(await rowCount()).toBe(1);
  });
});

describe('truncateAssociationsTable', () => {
  it('wipes the whole table', async () => {
    await storeQueryCacheTags('query-1', [tag('a')]);
    await storeQueryCacheTags('query-2', [tag('b')]);

    await truncateAssociationsTable();

    expect(await rowCount()).toBe(0);
  });
});
