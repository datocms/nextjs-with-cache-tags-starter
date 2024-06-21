import type { TadaDocumentNode } from 'gql.tada';
import { print } from 'graphql';

import { parseXCacheTagsResponseHeader } from './cache-tags';
import { storeQueryCacheTags } from './database';

/*
 * Executes a GraphQL query using the DatoCMS Content Delivery API and caches
 * the result:
 *
 * To support cache invalidation, the request is tagged with a unique identifier
 * in the Next.js Data Cache.
 *
 * When a "Cache Tags Invalidation" webhook is received from DatoCMS, we need to
 * identify and invalidate the relevant cached queries. To achieve this, we
 * store the mapping between the unique identifier and the DatoCMS Cache Tags in
 * a persistent Turso database for future reference.
 */
export async function executeQuery<
  Result = unknown,
  Variables = Record<string, unknown>,
>(query: TadaDocumentNode<Result, Variables>, variables?: Variables) {
  if (!query) {
    throw new Error('Query is not valid');
  }

  const queryId = crypto.randomUUID();

  const response = await fetch('https://graphql.datocms.com/', {
    method: 'POST',
    // Headers to instruct DatoCMS on how to process the request:
    headers: {
      // API token for the project
      Authorization: `Bearer ${process.env.PUBLIC_DATOCMS_API_TOKEN}`,
      // Return only valid records
      'X-Exclude-Invalid': 'true',
      // Return the DatoCMS Cache Tags along with the query result
      'X-Cache-Tags': 'true',
    },
    body: JSON.stringify({ query: print(query), variables }),
    cache: 'force-cache',
    next: {
      tags: [queryId],
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${JSON.stringify(response)}`);
  }

  const { data, errors } = (await response.json()) as {
    data: Result;
    errors?: unknown;
  };

  if (errors) {
    throw new Error(
      `Something went wrong while executing the query: ${JSON.stringify(
        errors,
      )}`,
    );
  }

  /**
   * Converts the cache tags string from the headers into an array of CacheTag
   * type.
   */
  const cacheTags = parseXCacheTagsResponseHeader(
    response.headers.get('x-cache-tags'),
  );

  await storeQueryCacheTags(queryId, cacheTags);

  /**
   * For educational purposes, return tags along with the data. This might not
   * be needed in a real application.
   */
  return { data, cacheTags };
}
