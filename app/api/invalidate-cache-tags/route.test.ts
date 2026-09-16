import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.hoisted(() => vi.fn());
const queriesReferencingCacheTags = vi.hoisted(() => vi.fn());
const deleteQueries = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({ revalidateTag }));
vi.mock('@/lib/database', () => ({
  queriesReferencingCacheTags,
  deleteQueries,
}));

import { POST } from './route';

const webhookPayload = (tags: string[]) => ({
  entity_type: 'cda_cache_tags',
  event_type: 'invalidate',
  entity: {
    id: 'cda_cache_tags',
    type: 'cda_cache_tags',
    attributes: { tags },
  },
});

const request = (token: string | null, body: unknown) =>
  new Request('http://localhost/api/invalidate-cache-tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Webhook-Token': token } : {}),
    },
    body: JSON.stringify(body),
  });

describe('POST /api/invalidate-cache-tags', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_TOKEN', 'secret');
    queriesReferencingCacheTags.mockResolvedValue(['query-1', 'query-2']);
    deleteQueries.mockResolvedValue(undefined);
  });

  it('rejects requests without the webhook token', async () => {
    const response = await POST(request(null, webhookPayload(['tag'])));

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(queriesReferencingCacheTags).not.toHaveBeenCalled();
  });

  it('rejects requests with a wrong webhook token', async () => {
    const response = await POST(request('nope', webhookPayload(['tag'])));

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('invalidates every query referencing the received tags', async () => {
    const response = await POST(
      request('secret', webhookPayload(['tag-a', 'tag-b'])),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cacheTags: ['tag-a', 'tag-b'],
      queryIds: ['query-1', 'query-2'],
    });

    expect(queriesReferencingCacheTags).toHaveBeenCalledWith([
      'tag-a',
      'tag-b',
    ]);
    expect(deleteQueries).toHaveBeenCalledWith(['query-1', 'query-2']);

    // Next.js 16 requires an explicit cache-life profile: `{ expire: 0 }`
    // expires the entries immediately.
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenNthCalledWith(1, 'query-1', { expire: 0 });
    expect(revalidateTag).toHaveBeenNthCalledWith(2, 'query-2', { expire: 0 });
  });

  it('does nothing when no cached query references the tags', async () => {
    queriesReferencingCacheTags.mockResolvedValue([]);

    const response = await POST(request('secret', webhookPayload(['unknown'])));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cacheTags: ['unknown'],
      queryIds: [],
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
