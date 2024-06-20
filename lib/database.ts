import { createClient } from '@libsql/client';

import type { CacheTag } from './cache-tags';

function noCacheFetch(
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) {
  return fetch(input, { ...init, cache: 'no-store' });
}

const turso = () =>
  createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
    fetch: noCacheFetch,
  });

function generateSqlPlaceholders(count: number) {
  return Array.from({ length: count }, () => '?').join(',');
}

export async function associateQueryDigestToCacheTags(
  queryDigest: string,
  cacheTags: CacheTag[],
) {
  await turso().execute({
    sql: `INSERT INTO query_digest_to_cache_tag_mappings (cache_tag, query_digest) VALUES ${cacheTags
      .map(() => '(?, ?)')
      .join(', ')} ON CONFLICT DO NOTHING`,
    args: cacheTags.flatMap((cacheTag) => [cacheTag, queryDigest]),
  });
}

export async function retrieveQueryDigestsByCacheTags(
  cacheTags: CacheTag[],
): Promise<string[]> {
  const { rows } = await turso().execute({
    sql: `SELECT DISTINCT query_digest FROM query_digest_to_cache_tag_mappings WHERE cache_tag IN (${generateSqlPlaceholders(
      cacheTags.length,
    )})`,
    args: cacheTags,
  });

  return rows
    .map((row) => row.query_digest)
    .filter(
      (queryDigest): queryDigest is string => typeof queryDigest === 'string',
    );
}

export async function deleteCacheTagAssociations(queryDigests: string[]) {
  await turso().execute({
    sql: `DELETE FROM query_digest_to_cache_tag_mappings WHERE query_digest IN (${generateSqlPlaceholders(
      queryDigests.length,
    )})`,
    args: queryDigests,
  });
}

export async function truncateAssociationsTable() {
  await turso().execute('DELETE FROM query_digest_to_cache_tag_mappings');
}
