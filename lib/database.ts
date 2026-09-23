/*
 * The purpose of this module is to manage inside of a Turso database the
 * associations between the GraphQL queries made to the DatoCMS Content Delivery
 * API, and the `Cache-Tags` that these requests return.
 *
 * Why is a database needed at all? Couldn't the webhook just call
 * `revalidateTag()` with the DatoCMS tags it receives?
 *
 * It could, if the `fetch()` requests were tagged with the DatoCMS Cache Tags.
 * But Next.js caps the number of tags per request at 128, and a DatoCMS query
 * can return many more than that (see lib/fetch-content.ts). So each request is
 * tagged with a single "Query ID" instead, and Next.js has no idea which
 * DatoCMS tags that entry depends on. The Next.js Data Cache cannot be searched
 * by tag either: it can only be told "expire everything tagged X".
 *
 * Someone therefore has to remember "Query ID <-> DatoCMS Cache Tags", and it
 * cannot be an in-memory map: the page render (which learns the tags) and the
 * webhook handler (which needs them, possibly hours later) typically run in
 * different serverless invocations, on different instances, or even different
 * deployments. A small, shared, persistent store is the simplest thing that
 * works: Turso is cheap and reachable from anywhere, but any database would do.
 *
 * To store these associations, we use a simple table `query_cache_tags`
 * composed of just two columns:
 *
 * - `query_id` (TEXT): A unique identifier for the query, used to tag the request;
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
 * Associates DatoCMS Cache Tags to a given GraphQL query. Rows are only ever
 * added here: a query is re-executed only after its previous rows have been
 * removed by the webhook (see app/api/invalidate-cache-tags/route.ts), so the
 * table never accumulates stale tags. Should the same query be rendered
 * concurrently, both renders insert the same rows: `ON CONFLICT DO NOTHING`
 * makes that harmless.
 */
export async function storeQueryCacheTags(
  queryId: string,
  cacheTags: CacheTag[],
) {
  if (cacheTags.length === 0) return;

  await database().execute({
    sql: `
      INSERT INTO query_cache_tags (query_id, cache_tag)
      VALUES ${cacheTags.map(() => '(?, ?)').join(', ')}
      ON CONFLICT DO NOTHING
    `,
    args: cacheTags.flatMap((cacheTag) => [queryId, cacheTag]),
  });
}

/*
 * Retrieves the query IDs associated with the specified cache tags: these are
 * the Next.js tags that need to be revalidated when DatoCMS says that any of
 * the given tags has changed.
 */
export async function queriesReferencingCacheTags(
  cacheTags: CacheTag[],
): Promise<string[]> {
  if (cacheTags.length === 0) return [];

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
 * Removes all entries that reference the specified queries. It's called right
 * before the queries are invalidated: their next execution stores a fresh set
 * of tags, which may differ from the previous one (e.g. a list of posts that
 * now includes a different post).
 */
export async function deleteQueries(queryIds: string[]) {
  if (queryIds.length === 0) return;

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
