import { rawExecuteQuery } from '@datocms/cda-client';
import type { TadaDocumentNode } from 'gql.tada';
import { print } from 'graphql';

// biome-ignore lint/style/useNodejsImportProtocol: https://github.com/datocms/nextjs-with-cache-tags-starter/issues/2
import { createHash } from 'crypto';
import { cache } from 'react';
import { parseXCacheTagsResponseHeader } from './cache-tags';
import { storeQueryCacheTags } from './database';

/*
 * Executes a GraphQL query using the DatoCMS Content Delivery API, and caches
 * the result in Next.js Data Cache using the `cache: 'force-cache'` option.
 *
 * To support cache invalidation, we use the `next.tags` option to tag the
 * request in the Next.js Data Cache with a unique query identifier.
 *
 * When a "Cache Tags Invalidation" webhook is received from DatoCMS, we need to
 * identify and invalidate the relevant cached queries. To achieve this, we
 * store the mapping between the unique identifier and the DatoCMS Cache Tags in
 * a persistent Turso database for future reference.
 *
 * 💡 Note: This isn't the final function we're exporting for use in the
 * project! There's one more thing to consider for maximum code optimization.
 * See details below!
 */
async function executeQueryWithoutMemoization<
  Result = unknown,
  Variables = Record<string, unknown>,
>(query: TadaDocumentNode<Result, Variables>, variables?: Variables) {
  if (!query) {
    throw new Error('Query is not valid');
  }

  const queryId = generateQueryId(query, variables);

  const [data, response] = await rawExecuteQuery(query, {
    token: process.env.PUBLIC_DATOCMS_API_TOKEN!,
    excludeInvalid: true,
    returnCacheTags: true,
    variables,
    requestInitOptions: {
      cache: 'force-cache',
      next: {
        tags: [queryId],
      },
    },
  });

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

/*
 * Generates a unique identifier for a GraphQL query by building a SHA1 hash
 * of the query itself and its variables.
 */
function generateQueryId<Result = unknown, Variables = Record<string, unknown>>(
  query: TadaDocumentNode<Result, Variables>,
  variables?: Variables,
) {
  return createHash('sha1')
    .update(print(query))
    .update(JSON.stringify(variables) || '')
    .digest('hex');
}

/*
 * Next.js extends the `fetch` API by memorizing identical requests that happen
 * multiple times. This guarantees that the same `fetch()` call in a React
 * component tree is only carried out once per server request.
 *
 * We want the same benefit for our `executeQuery` function, and to achieve
 * this, we utilize React's `cache()` function.
 *
 * For more information on Request Memoization in Next.js, visit:
 * https://nextjs.org/docs/app/building-your-application/caching#request-memoization
 *
 * For more information on React's `cache`, visit:
 * https://react.dev/reference/react/cache
 */
export const executeQuery = cacheWithDeepCompare(
  executeQueryWithoutMemoization,
);

/*
 * `React.cache` performs a shallow comparison of arguments, but our
 * `executeQuery` has complex arguments. This wrapper provides a workaround by
 * turning the function arguments into a string via JSON serialization, enabling
 * a deep equality comparison.
 */
function cacheWithDeepCompare<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const cachedFn = cache((serialized: string) => {
    return fn(...JSON.parse(serialized));
  });
  return (...args: A) => {
    const serialized = JSON.stringify(args);
    return cachedFn(serialized);
  };
}
