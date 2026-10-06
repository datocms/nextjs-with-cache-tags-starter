import { createHash } from 'node:crypto';
import { print } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rawExecuteQuery = vi.hoisted(() => vi.fn());
const storeQueryCacheTags = vi.hoisted(() => vi.fn());

vi.mock('@datocms/cda-client', () => ({ rawExecuteQuery }));
vi.mock('./database', () => ({ storeQueryCacheTags }));

import { executeQuery } from './fetch-content';
import { graphql } from './graphql';

const POST_QUERY = graphql(`
  query CurrentPostTest($slug: String) {
    post(filter: { slug: { eq: $slug } }) {
      title
    }
  }
`);

const OTHER_QUERY = graphql(`
  query OtherTest {
    allPosts {
      id
    }
  }
`);

/** Mirrors the SHA1-based query identifier built by `executeQuery`. */
const expectedQueryId = (
  query: Parameters<typeof print>[0],
  variables?: unknown,
) =>
  createHash('sha1')
    .update(print(query))
    .update(JSON.stringify(variables) || '')
    .digest('hex');

const mockResponse = (cacheTags: string | null) =>
  ({
    headers: new Headers(cacheTags ? { 'x-cache-tags': cacheTags } : {}),
  }) as Response;

describe('executeQuery', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_DATOCMS_API_TOKEN', 'cda-token');
    storeQueryCacheTags.mockResolvedValue(undefined);
    rawExecuteQuery.mockResolvedValue([
      { post: { title: 'Hello' } },
      mockResponse('tag-a tag-b'),
    ]);
  });

  it('returns the data together with the parsed cache tags', async () => {
    const result = await executeQuery(POST_QUERY, { slug: 'hello' });

    expect(result).toEqual({
      data: { post: { title: 'Hello' } },
      cacheTags: ['tag-a', 'tag-b'],
    });
  });

  it('tags the request in the Next.js Data Cache with a stable query id', async () => {
    await executeQuery(POST_QUERY, { slug: 'hello' });

    const [, options] = rawExecuteQuery.mock.calls[0];
    const queryId = expectedQueryId(POST_QUERY, { slug: 'hello' });

    expect(options).toMatchObject({
      token: 'cda-token',
      excludeInvalid: true,
      returnCacheTags: true,
      variables: { slug: 'hello' },
      requestInitOptions: { cache: 'force-cache', next: { tags: [queryId] } },
    });
  });

  it('stores the query id <-> cache tags association', async () => {
    await executeQuery(POST_QUERY, { slug: 'hello' });

    expect(storeQueryCacheTags).toHaveBeenCalledWith(
      expectedQueryId(POST_QUERY, { slug: 'hello' }),
      ['tag-a', 'tag-b'],
    );
  });

  it('derives different query ids for different variables or queries', async () => {
    await executeQuery(POST_QUERY, { slug: 'one' });
    await executeQuery(POST_QUERY, { slug: 'two' });
    await executeQuery(OTHER_QUERY);

    const ids = rawExecuteQuery.mock.calls.map(
      ([, options]) => options.requestInitOptions.next.tags[0],
    );

    expect(new Set(ids).size).toBe(3);
    expect(ids[2]).toBe(expectedQueryId(OTHER_QUERY));
  });

  it('stores no association when the response carries no cache tags', async () => {
    rawExecuteQuery.mockResolvedValue([{ post: null }, mockResponse(null)]);

    const result = await executeQuery(POST_QUERY, { slug: 'missing' });

    expect(result.cacheTags).toEqual([]);
    expect(storeQueryCacheTags).toHaveBeenCalledWith(expect.any(String), []);
  });

  it('honours the DATOCMS_GRAPHQL_ENDPOINT override', async () => {
    vi.stubEnv('DATOCMS_GRAPHQL_ENDPOINT', 'http://127.0.0.1:4010/');

    await executeQuery(OTHER_QUERY);

    expect(rawExecuteQuery.mock.calls[0][1].graphqlEndpointUrl).toBe(
      'http://127.0.0.1:4010/',
    );
  });

  it('propagates API errors', async () => {
    rawExecuteQuery.mockRejectedValue(new Error('boom'));

    await expect(executeQuery(OTHER_QUERY)).rejects.toThrow('boom');
    expect(storeQueryCacheTags).not.toHaveBeenCalled();
  });
});
