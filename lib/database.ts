/*
 * The purpose of this module is to manage inside of a Turso database the
 * associations between the GraphQL queries made to the DatoCMS Content Delivery
 * API, and the `Cache-Tags` that these requests return.
 *
 * To store these associations, we use a simple table `query_cache_tags`
 * composed of just two columns:
 *
 * - `query_id` (TEXT): Random identifier for the query, used to tag the request;
 * - `cache_tag` (TEXT): An actual cache tag returned by the query.
 *
 * These associations will allow us to selectively invalidate individual GraphQL
 * queries, when we receive a "Cache Tags Invalidation" webhook from DatoCMS.
 */

import { createClient } from '@libsql/client';

import type { CacheTag } from './cache-tags';

/*
 * Creates and returns a Turso database client. Note the custom fetch method
 * provided to the Turso client. By setting the `cache` option to `no-store`, we
 * ensure that Next.js does not cache our HTTP requests for database calls.
 */
const database = () =>
  createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
    fetch: (input: string | URL, init?: RequestInit) => {
      return fetch(input, { ...init, cache: 'no-store' });
    },
  });

/*
 * Generates a string of SQL placeholders ('?') separated by commas.
 * It's useful for constructing SQL queries with varying numbers of parameters.
 */
function sqlPlaceholders(count: number) {
  return Array.from({ length: count }, () => '?').join(',');
}

/*
 * Associates DatoCMS Cache Tags to a given GraphQL query. In case of a conflict
 * (e.g. trying to insert a duplicate entry), the operation simply does nothing.
 */
export async function storeQueryCacheTags(
  queryId: string,
  cacheTags: CacheTag[],
) {
  const placeholders = cacheTags.map(() => '(?, ?)').join(', ');

  await database().execute({
    sql: `
      INSERT INTO query_cache_tags (query_id, cache_tag)
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `,
    args: cacheTags.flatMap((cacheTag) => [queryId, cacheTag]),
  });
}

/*
 * Retrieves the query hashs associated with specified cache tags.
 */
export async function queriesReferencingCacheTags(
  cacheTags: CacheTag[],
): Promise<string[]> {
  const { rows } = await database().execute({
    sql: `
      SELECT DISTINCT query_id
      FROM query_cache_tags
      WHERE cache_tag IN (${sqlPlaceholders(cacheTags.length)})
    `,
    args: cacheTags,
  });

  return rows.map((row) => row.query_id as string);
}

/*
 * Removes all entries that reference the specified queries.
 */
export async function deleteQueries(queryIds: string[]) {
  await database().execute({
    sql: `
      DELETE FROM query_cache_tags
      WHERE query_id IN (${sqlPlaceholders(queryIds.length)})
    `,
    args: queryIds,
  });
}

/*
 * Wipes out all data contained in the table.
 */
export async function truncateAssociationsTable() {
  await database().execute('DELETE FROM query_cache_tags');
}
