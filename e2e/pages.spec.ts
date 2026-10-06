import { expect, test } from '@playwright/test';
import { e2eConfig } from './config.ts';
import { cacheTagsInTooltip, generatedAt, mockCda } from './helpers.ts';

test.beforeAll(async ({ request }) => {
  // Start from the pristine content and a fully invalidated cache.
  await mockCda.reset();
  await request.post('/api/invalidate-all', {
    headers: { 'Webhook-Token': e2eConfig.webhookToken },
  });
});

test.describe('homepage', () => {
  test('lists the three most recent posts, newest first', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('DatoCMS starter: a blog example');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Recently published',
    );

    const links = page.locator('main ul li a');
    await expect(links).toHaveText([
      'Fourth post',
      'Third post',
      'Second post',
    ]);
    await expect(links.nth(0)).toHaveAttribute('href', '/posts/fourth-post');
    await expect(page.locator('main ul li small').first()).toHaveText(
      new Date('2024-04-01T10:00:00Z').toDateString(),
    );
  });

  test('links to the most recent post from the navigation', async ({
    page,
  }) => {
    await page.goto('/');

    const link = page.getByRole('link', { name: 'Most recent post' });
    await expect(link).toHaveAttribute('href', '/posts/fourth-post');

    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fourth post',
    );
  });

  test('exposes the DatoCMS cache tags returned by its queries', async ({
    page,
  }) => {
    await page.goto('/');

    expect(
      await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]'),
    ).toEqual([
      'site',
      'post-list',
      'post:post-4',
      'post:post-3',
      'post:post-2',
    ]);

    expect(await cacheTagsInTooltip(page, 'nav a[data-tooltip]')).toEqual([
      'site',
      'post-list',
    ]);
  });

  test('prints the time the page was generated', async ({ page }) => {
    await page.goto('/');

    const timestamp = await generatedAt(page);

    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.now() - Date.parse(timestamp)).toBeLessThan(10 * 60 * 1000);
  });
});

test.describe('post page', () => {
  test('renders the post with cover, content, image block and author', async ({
    page,
  }) => {
    await page.goto('/posts/second-post');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Second post',
    );

    // Cover image + the image block inside the Structured Text field
    const pictures = page.locator('main picture');
    await expect(pictures).toHaveCount(2);
    await expect(pictures.first().locator('img')).toHaveAttribute(
      'alt',
      'second-cover alt text',
    );

    await expect(
      page.locator('main p', { hasText: 'Body of the second post.' }),
    ).toBeVisible();

    // The author link is styled as a button (`role="button"`).
    const authorLink = page.locator('main a[href="/authors/author-1"]');
    await expect(authorLink).toHaveText('Jane Doe');

    expect(
      await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]'),
    ).toEqual(['site', 'post:post-2', 'author:author-1']);
  });

  test('links to the previous and next posts', async ({ page }) => {
    await page.goto('/posts/second-post');

    const siblings = page.locator('main .grid > div');
    await expect(siblings.nth(0)).toContainText('Previous:');
    await expect(siblings.nth(0).getByRole('link')).toHaveText('First post');
    await expect(siblings.nth(0).getByRole('link')).toHaveAttribute(
      'href',
      '/posts/first-post',
    );
    await expect(siblings.nth(1)).toContainText('Next:');
    await expect(siblings.nth(1).getByRole('link')).toHaveText('Third post');
    await expect(siblings.nth(1).getByRole('link')).toHaveAttribute(
      'href',
      '/posts/third-post',
    );
  });

  test('handles posts without previous sibling, cover or author', async ({
    page,
  }) => {
    await page.goto('/posts/first-post');
    await expect(page.locator('main .grid > div').nth(0)).toHaveText(
      /Previous:\s*—/,
    );

    await page.goto('/posts/third-post');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Third post',
    );
    await expect(page.locator('main picture')).toHaveCount(0);
    await expect(page.getByText('Written by')).toHaveCount(0);
  });

  test('returns a 404 for unknown posts', async ({ page }) => {
    const response = await page.goto('/posts/does-not-exist');

    expect(response?.status()).toBe(404);
  });
});

test.describe('author page', () => {
  test('renders the author name and picture', async ({ page }) => {
    await page.goto('/authors/author-1');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Jane Doe',
    );
    await expect(page.locator('main picture img')).toHaveAttribute(
      'alt',
      'jane alt text',
    );

    expect(
      await cacheTagsInTooltip(page, 'main h1 span[data-tooltip]'),
    ).toEqual(['site', 'author:author-1']);
  });

  test('returns a 404 for unknown authors', async ({ page }) => {
    const response = await page.goto('/authors/nobody');

    expect(response?.status()).toBe(404);
  });
});

test.describe('browser health', () => {
  test('pages load without console errors, page errors or failed requests', async ({
    page,
  }) => {
    const issues: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        issues.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) =>
      issues.push(
        `requestfailed: ${request.url()} ${request.failure()?.errorText}`,
      ),
    );
    page.on('response', (response) => {
      if (response.status() >= 400)
        issues.push(`http ${response.status()}: ${response.url()}`);
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.goto('/posts/second-post', { waitUntil: 'networkidle' });
    await page.goto('/authors/author-1', { waitUntil: 'networkidle' });

    // Client-side navigations too (hydration, prefetching, RSC payloads).
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Most recent post' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fourth post',
    );
    await page.locator('main a[href="/authors/author-1"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Jane Doe',
    );
    await page.waitForLoadState('networkidle');

    expect(issues).toEqual([]);
  });
});
