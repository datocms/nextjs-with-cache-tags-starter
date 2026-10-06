import { createClient } from '@libsql/client';
import type { APIRequestContext, Page } from '@playwright/test';
import { e2eConfig } from './config.ts';
import type { AuthorFixture, PostFixture } from './mock-cda/fixtures.ts';
import type { ReceivedRequest } from './mock-cda/server.ts';

const controlFetch = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(
    `${e2eConfig.mockCdaUrl}/__control/${path}`,
    init,
  );

  if (!response.ok) {
    throw new Error(
      `Mock CDA control call failed: ${path} -> ${response.status}`,
    );
  }

  return (await response.json()) as T;
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** Client for the `/__control/*` endpoints of the mock Content Delivery API. */
export const mockCda = {
  reset: () => controlFetch('reset', jsonInit('POST')),
  updatePost: (id: string, patch: Partial<Omit<PostFixture, 'id'>>) =>
    controlFetch<PostFixture>('posts', jsonInit('POST', { id, ...patch })),
  updateAuthor: (id: string, patch: Partial<Omit<AuthorFixture, 'id'>>) =>
    controlFetch<AuthorFixture>('authors', jsonInit('POST', { id, ...patch })),
  requests: () => controlFetch<ReceivedRequest[]>('requests'),
  clearRequests: () => controlFetch('requests', jsonInit('DELETE')),
  /** Number of GraphQL requests received, optionally filtered by operation. */
  requestCount: async (operationName?: string) => {
    const requests = await mockCda.requests();
    return operationName
      ? requests.filter((request) => request.operationName === operationName)
          .length
      : requests.length;
  },
};

/** Builds the payload DatoCMS sends for a "Cache Tags Invalidation" event. */
export const invalidationPayload = (tags: string[]) => ({
  entity_type: 'cda_cache_tags',
  event_type: 'invalidate',
  entity: {
    id: 'cda_cache_tags',
    type: 'cda_cache_tags',
    attributes: { tags },
  },
});

/** Fires the invalidation webhook against the app, like DatoCMS would. */
export const fireInvalidationWebhook = (
  request: APIRequestContext,
  tags: string[],
  token: string | null = e2eConfig.webhookToken,
) =>
  request.post('/api/invalidate-cache-tags', {
    headers: token === null ? {} : { 'Webhook-Token': token },
    data: invalidationPayload(tags),
  });

/** Reads the "generated on" timestamp printed in the footer of every page. */
export const generatedAt = (page: Page) =>
  page.locator('footer span[data-tooltip]').innerText();

/** Extracts the cache tags listed in the tooltip attached to `locator`. */
export const cacheTagsInTooltip = async (page: Page, selector: string) => {
  const tooltip = await page.locator(selector).getAttribute('data-tooltip');
  const match = tooltip?.match(/cache tags: "(.*)"$/);

  return match ? match[1].split(', ') : [];
};

/** Direct access to the associations stored by the app in the libSQL file. */
export const associations = {
  async all() {
    const client = createClient({ url: `file:${e2eConfig.databasePath}` });
    // The app may be writing while we read: wait instead of failing with SQLITE_BUSY.
    await client.execute('PRAGMA busy_timeout = 5000');
    const { rows } = await client.execute(
      'SELECT query_id, cache_tag FROM query_cache_tags ORDER BY query_id, cache_tag',
    );
    client.close();

    return rows.map((row) => ({
      queryId: String(row.query_id),
      cacheTag: String(row.cache_tag),
    }));
  },
  async queryIdsForTag(cacheTag: string) {
    const rows = await associations.all();
    return [
      ...new Set(
        rows
          .filter((row) => row.cacheTag === cacheTag)
          .map((row) => row.queryId),
      ),
    ];
  },
};
