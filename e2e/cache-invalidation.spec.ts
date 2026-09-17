import { expect, test } from '@playwright/test';
import { e2eConfig } from './config.ts';
import {
  associations,
  fireInvalidationWebhook,
  generatedAt,
  invalidationPayload,
  mockCda,
} from './helpers.ts';

/**
 * These tests exercise the whole cache tags loop:
 *
 *   render page -> store "query id <-> cache tags" in the DB
 *   -> webhook with DatoCMS cache tags -> revalidateTag(query id)
 *   -> next request re-renders with fresh content
 *
 * They run serially against a single app instance, and every test starts
 * from a clean, fully invalidated cache.
 *
 * Note that `<Link>` prefetching makes Next.js render (and therefore query)
 * more pages than the ones explicitly visited, so the tests wait for the
 * network to settle and never assert on exact query counts.
 */
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await mockCda.reset();
  await request.post('/api/invalidate-all', {
    headers: { 'Webhook-Token': e2eConfig.webhookToken },
  });
  await mockCda.clearRequests();
});

test('stores the association between each query and its cache tags', async ({
  page,
}) => {
  await page.goto('/authors/author-1', { waitUntil: 'networkidle' });

  const rows = await associations.all();
  const tagsByQueryId = new Map<string, string[]>();

  for (const { queryId, cacheTag } of rows) {
    tagsByQueryId.set(queryId, [
      ...(tagsByQueryId.get(queryId) ?? []),
      cacheTag,
    ]);
  }

  // The Author query is tagged with exactly `author:author-1` and `site`
  // (other queries may reference the author too, e.g. prefetched posts).
  expect([...tagsByQueryId.values()]).toContainEqual([
    'author:author-1',
    'site',
  ]);
  // The layout's LastPost query is part of every page.
  expect([...tagsByQueryId.values()]).toContainEqual(['post-list', 'site']);
});

test('serves pages from the cache without hitting the Content Delivery API', async ({
  page,
}) => {
  await page.goto('/posts/second-post', { waitUntil: 'networkidle' });
  const initialTimestamp = await generatedAt(page);
  const initialRequests = await mockCda.requestCount();

  expect(initialRequests).toBeGreaterThan(0);

  await page.goto('/posts/second-post', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });

  expect(await generatedAt(page)).toBe(initialTimestamp);
  expect(await mockCda.requestCount()).toBe(initialRequests);
});

test('rejects invalidation webhooks without a valid token', async ({
  page,
  request,
}) => {
  await page.goto('/authors/author-1');
  await mockCda.updateAuthor('author-1', { name: 'Someone Else' });

  const missing = await fireInvalidationWebhook(
    request,
    ['author:author-1'],
    null,
  );
  expect(missing.status()).toBe(401);

  const wrong = await fireInvalidationWebhook(
    request,
    ['author:author-1'],
    'nope',
  );
  expect(wrong.status()).toBe(401);

  await page.goto('/authors/author-1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jane Doe');
});

test('re-renders only the pages affected by the invalidated tags', async ({
  page,
  request,
}) => {
  // Warm up the cache of three different pages.
  await page.goto('/', { waitUntil: 'networkidle' });
  const homeTimestamp = await generatedAt(page);
  await page.goto('/posts/second-post', { waitUntil: 'networkidle' });
  await page.goto('/authors/author-1', { waitUntil: 'networkidle' });

  // Content changes in the CMS, but cached pages keep showing the old name.
  await mockCda.updateAuthor('author-1', { name: 'Janet Doe' });
  await page.goto('/authors/author-1', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jane Doe');

  // At least the Author query and the CurrentPost query of second-post.
  const affectedQueryIds = await associations.queryIdsForTag('author:author-1');
  expect(affectedQueryIds.length).toBeGreaterThanOrEqual(2);

  const untouchedQueryIds = (await associations.all())
    .map((row) => row.queryId)
    .filter((queryId) => !affectedQueryIds.includes(queryId));
  expect(untouchedQueryIds).not.toHaveLength(0);

  await mockCda.clearRequests();

  // DatoCMS notifies the app: only the queries tagged with `author:author-1`
  // get invalidated...
  const response = await fireInvalidationWebhook(request, ['author:author-1']);
  expect(response.status()).toBe(200);
  const { cacheTags, queryIds } = await response.json();
  expect(cacheTags).toEqual(['author:author-1']);
  expect([...queryIds].sort()).toEqual([...affectedQueryIds].sort());

  // ...so the author page and the post page pick up the change...
  await page.goto('/authors/author-1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Janet Doe');

  await page.goto('/posts/second-post');
  await expect(page.locator('main a[href="/authors/author-1"]')).toHaveText(
    'Janet Doe',
  );

  // ...while the homepage is still served from the cache.
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await generatedAt(page)).toBe(homeTimestamp);
  expect(await mockCda.requestCount('RecentPosts')).toBe(0);

  // The invalidated queries were re-executed and their tags stored again,
  // while the associations of the untouched queries were left alone.
  const storedQueryIds = (await associations.all()).map((row) => row.queryId);
  expect(await associations.queryIdsForTag('author:author-1')).toEqual(
    expect.arrayContaining(affectedQueryIds),
  );
  expect(storedQueryIds).toEqual(expect.arrayContaining(untouchedQueryIds));
});

test('invalidating a post refreshes the lists that include it', async ({
  page,
  request,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.goto('/posts/fourth-post', { waitUntil: 'networkidle' });
  await page.goto('/authors/author-1', { waitUntil: 'networkidle' });
  const authorTimestamp = await generatedAt(page);

  await mockCda.updatePost('post-4', { title: 'Fourth post, revised' });

  await page.goto('/');
  await expect(page.locator('main ul li a').first()).toHaveText('Fourth post');

  const response = await fireInvalidationWebhook(request, ['post:post-4']);
  expect(response.status()).toBe(200);

  await page.goto('/');
  await expect(page.locator('main ul li a').first()).toHaveText(
    'Fourth post, revised',
  );

  await page.goto('/posts/fourth-post');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Fourth post, revised',
  );

  // The author page does not depend on the post, so it is untouched.
  await page.goto('/authors/author-1');
  expect(await generatedAt(page)).toBe(authorTimestamp);
});

test('ignores tags that no cached query references', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const timestamp = await generatedAt(page);

  const response = await fireInvalidationWebhook(request, ['unknown-tag']);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    cacheTags: ['unknown-tag'],
    queryIds: [],
  });

  await page.goto('/');
  expect(await generatedAt(page)).toBe(timestamp);
});

test('accepts the exact payload shape sent by DatoCMS', async ({ request }) => {
  const response = await request.post('/api/invalidate-cache-tags', {
    headers: { 'Webhook-Token': e2eConfig.webhookToken },
    data: invalidationPayload(['site']),
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ cacheTags: ['site'] });
});

test('/api/invalidate-all wipes the cache and the stored associations', async ({
  page,
  request,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const timestamp = await generatedAt(page);
  expect(await associations.all()).not.toHaveLength(0);

  const unauthorized = await request.post('/api/invalidate-all');
  expect(unauthorized.status()).toBe(401);

  const response = await request.post('/api/invalidate-all', {
    headers: { 'Webhook-Token': e2eConfig.webhookToken },
  });
  expect(response.status()).toBe(200);
  expect(await associations.all()).toHaveLength(0);

  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await generatedAt(page)).not.toBe(timestamp);
  expect(await associations.all()).not.toHaveLength(0);
});
