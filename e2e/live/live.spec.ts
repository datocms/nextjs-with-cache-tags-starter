import { buildClient } from '@datocms/cma-client';
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test';
import { cacheTagsInTooltip, invalidationPayload } from '../helpers.ts';

const webhookToken = process.env.WEBHOOK_TOKEN ?? '';
const cdaToken = process.env.PUBLIC_DATOCMS_API_TOKEN ?? '';
const cmaToken = process.env.DATOCMS_CMA_TOKEN;

test.beforeAll(async ({ request }) => {
  test.skip(
    !webhookToken || !cdaToken,
    'PUBLIC_DATOCMS_API_TOKEN and WEBHOOK_TOKEN are required',
  );

  // The Next.js Data Cache survives rebuilds: start from a clean slate.
  const response = await request.post('/api/invalidate-all', {
    headers: { 'Webhook-Token': webhookToken },
  });
  expect(response.status()).toBe(200);
});

const postTitle = (page: Page) =>
  page.locator('main h1 span[data-tooltip]').innerText();

const fireWebhook = (request: APIRequestContext, tags: string[]) =>
  request.post('/api/invalidate-cache-tags', {
    headers: { 'Webhook-Token': webhookToken },
    data: invalidationPayload(tags),
  });

/**
 * Fires the invalidation webhook and reloads the page until the expected
 * title shows up. DatoCMS purges its own CDN cache shortly after a publish
 * (the real webhook is sent once that is done), so a single invalidation
 * fired right after publishing may still re-fetch the previous content.
 */
const expectTitleAfterInvalidation = async (
  page: Page,
  request: APIRequestContext,
  slug: string,
  tags: string[],
  expectedTitle: string,
) => {
  await expect
    .poll(
      async () => {
        const response = await fireWebhook(request, tags);
        expect(response.status()).toBe(200);
        await page.goto(`/posts/${slug}`);
        return postTitle(page);
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBe(expectedTitle);
};

/** Polls the Content Delivery API until the published title matches. */
const waitForCdaTitle = async (slug: string, expectedTitle: string) => {
  await expect
    .poll(
      async () => {
        const response = await fetch('https://graphql.datocms.com/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cdaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query:
              'query($slug: String) { post(filter: { slug: { eq: $slug } }) { title } }',
            variables: { slug },
          }),
        });
        const { data } = await response.json();
        return data?.post?.title;
      },
      { timeout: 30_000 },
    )
    .toBe(expectedTitle);
};

test('homepage lists the most recent posts from DatoCMS', async ({ page }) => {
  await page.goto('/');

  const links = page.locator('main ul li a');
  await expect(links.first()).toBeVisible();
  expect(await links.count()).toBeGreaterThan(0);
  expect(await links.count()).toBeLessThanOrEqual(3);

  for (const href of await links.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('href')),
  )) {
    expect(href).toMatch(/^\/posts\/[\w-]+$/);
  }

  expect(
    (await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]')).length,
  ).toBeGreaterThan(0);
});

test('post and author pages render real content', async ({ page }) => {
  await page.goto('/');
  await page.locator('main ul li a').first().click();

  await expect(page.locator('main h1')).not.toBeEmpty();
  expect(
    (await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]')).length,
  ).toBeGreaterThan(0);

  const authorLink = page.locator('main a[href^="/authors/"]');
  if ((await authorLink.count()) > 0) {
    const name = await authorLink.innerText();
    await authorLink.click();
    await expect(page.locator('main h1')).toHaveText(name);
  }
});

test('unknown posts return a 404', async ({ page }) => {
  const response = await page.goto('/posts/this-post-does-not-exist');
  expect(response?.status()).toBe(404);
});

test('editing a record and firing the webhook refreshes the page', async ({
  page,
  request,
}) => {
  test.skip(!cmaToken, 'DATOCMS_CMA_TOKEN is required to edit content');

  const client = buildClient({ apiToken: cmaToken as string });
  const [post] = await client.items.list({
    filter: { type: 'post' },
    page: { limit: 1 },
  });
  const originalTitle = post.title as string;
  const slug = post.slug as string;
  const editedTitle = `${originalTitle} (e2e ${Date.now()})`;

  const publishTitle = async (title: string) => {
    await client.items.update(post.id, { title });
    await client.items.publish(post.id);
    await waitForCdaTitle(slug, title);
  };

  try {
    await page.goto(`/posts/${slug}`);
    expect(await postTitle(page)).toBe(originalTitle);
    const tags = await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]');

    await publishTitle(editedTitle);

    // Cached: still the old title...
    await page.goto(`/posts/${slug}`);
    expect(await postTitle(page)).toBe(originalTitle);

    // ...until DatoCMS notifies us about the invalidated cache tags.
    const response = await fireWebhook(request, tags);
    expect(response.status()).toBe(200);
    expect((await response.json()).queryIds.length).toBeGreaterThan(0);

    await expectTitleAfterInvalidation(page, request, slug, tags, editedTitle);
  } finally {
    await publishTitle(originalTitle);
    await page.goto(`/posts/${slug}`);
    const tags = await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]');
    await expectTitleAfterInvalidation(
      page,
      request,
      slug,
      tags,
      originalTitle,
    );
  }
});
