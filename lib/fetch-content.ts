import { createHash } from 'node:crypto';
import type { TadaDocumentNode } from 'gql.tada';
import { print } from 'graphql';

import { parseXCacheTagsResponseHeader } from './cache-tags';
import { associateQueryDigestToCacheTags } from './database';

/*
 * Builds a SHA1 digest of a specific GraphQL query, taking into account both
 * the query itself and its variables.
 */
function generateQueryDigest<
  Result = unknown,
  Variables = Record<string, unknown>,
>(query: TadaDocumentNode<Result, Variables>, variables?: Variables) {
  const queryDigest = createHash('sha1')
    .update(print(query))
    .update(JSON.stringify(variables) || '')
    .digest('hex');

  return queryDigest;
}

/**
 * Uses `fetch` to make a request to the DatoCMS GraphQL API. While executing
 * the query, this function also:
 *
 * - Generates a SHA1 digest of the query itself
 * - Stores the `fetch` result in Next.js Data Cache, tagging the cache entry
 *   with the query digest
 * - Stores the association between the query and its related DatoCMS Cache
 *   Tags, so as to later manage the invalidation of the Next cache
 */
export async function executeQuery<
  Result = unknown,
  Variables = Record<string, unknown>,
>(query: TadaDocumentNode<Result, Variables>, variables?: Variables) {
  if (!query) {
    throw new Error('Query is not valid');
  }

  const queryDigest = generateQueryDigest(query, variables);

  const response = await fetch('https://graphql.datocms.com/', {
    method: 'POST',
    // Headers are used to instruct DatoCMS on how to treat the request:
    headers: {
      // Provide the API token for the project we wish to run the query in
      Authorization: `Bearer ${process.env.PUBLIC_DATOCMS_API_TOKEN}`,
      // Only return valid records
      'X-Exclude-Invalid': 'true',
      // Return the DatoCMS Cache Tags along with the query result
      'X-Cache-Tags': 'true',
    },
    body: JSON.stringify({ query: print(query), variables }),
    cache: 'force-cache',
    next: {
      tags: [queryDigest],
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
   * Converts the string of cache tags received via headers into an array of
   * tags of `CacheTag` type.
   */
  const cacheTags = parseXCacheTagsResponseHeader(
    response.headers.get('x-cache-tags'),
  );

  await associateQueryDigestToCacheTags(queryDigest, cacheTags);

  /**
   * For educational purpose, tags are returned together with the data: in a
   * real-world application this is probably not needed.
   */
  return { data, cacheTags };
}
