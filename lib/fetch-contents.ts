import type { TadaDocumentNode } from "gql.tada";
import { print } from "graphql";
import { CacheTag, parseSpaceSeparatedTagString } from "./cache-tags";

const BATCH_SIZE = 64;

async function fetchFromDatoCMS<
  Result = unknown,
  Variables = Record<string, unknown>
>(
  query: TadaDocumentNode<Result, Variables>,
  variables: Variables | undefined = undefined,
  tags: CacheTag[]
) {
  return fetch("https://graphql.datocms.com/", {
    method: "POST",
    // Headers are used to instruct DatoCMS on how to treat the request:
    headers: {
      // - No token, no party: only authorized requests return data
      Authorization: `Bearer ${process.env.PUBLIC_DATOCMS_API_TOKEN}`,
      // - Only returns valid record
      "X-Exclude-Invalid": "true",
      // - Finally, return the cache tags together with the content.
      "X-Cache-Tags": "true",
    },
    body: JSON.stringify({ query: print(query), variables }),
    // Next uses some reasonable default for caching, but we explicite them all
    cache: "force-cache",
    next: {
      tags,
    },
  });
}

/**
 * `executeQuery` uses `fetch` to make a request to the
 * DatoCMS GraphQL API
 */
export async function executeQuery<
  Result = unknown,
  Variables = Record<string, unknown>
>(query: TadaDocumentNode<Result, Variables>, variables?: Variables) {
  if (!query) {
    throw new Error(`Query is not valid`);
  }

  /**
   * Executes a GraphQL query on DatoCMS API.
   */
  const response = await fetchFromDatoCMS(query, variables, []);

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
        errors
      )}`
    );
  }

  /**
   * Converts the string of cache tags received via headers into an array of
   * tags of `CacheTag` type.
   */
  const cacheTags = parseSpaceSeparatedTagString(
    response.headers.get("x-cache-tags")
  );

  /**
   * We strongly leverage the data cache: what follows is the same identical
   * request we did before: we only add the cache tags we just retrieved.
   *
   * What happens behind the curtains is that `fetch` leverages cache (so no
   * second call to DatoCMS) and marks the request with the tags we pass: it's a
   * win-win!
   *
   * There's a little bit of complexity due to the limitations on the number of
   * tags supported by the `fetch`: they must be 64 at most. So we cycle in
   * batches of maximum 64 tags and execute the same request once for each
   * batch.
   */
  for (let position = 0; position < cacheTags.length; position += BATCH_SIZE) {
    const batch = cacheTags.slice(position, position + BATCH_SIZE);

    await fetchFromDatoCMS(query, variables, batch);
  }

  /**
   * For educational purpose, tags are returned together with the data: in a
   * real-world application this is probably not needed.
   */
  return { data, cacheTags };
}
