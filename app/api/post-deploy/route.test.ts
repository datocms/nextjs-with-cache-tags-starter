import { ApiError } from '@datocms/cma-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const webhooksCreate = vi.hoisted(() => vi.fn());
const buildClient = vi.hoisted(() => vi.fn());

vi.mock('@datocms/cma-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@datocms/cma-client')>()),
  buildClient,
}));

import { OPTIONS, POST } from './route';

const request = (body: unknown) =>
  new Request('http://localhost/api/post-deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('/api/post-deploy', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_TOKEN', 'secret');
    buildClient.mockReturnValue({ webhooks: { create: webhooksCreate } });
    webhooksCreate.mockResolvedValue({});
  });

  it('answers CORS preflight requests', async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'POST',
    );
  });

  it('creates the cache tags invalidation webhook on DatoCMS', async () => {
    const response = await POST(
      request({
        datocmsApiToken: 'cma-token',
        frontendUrl: 'https://example.com/',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

    expect(buildClient).toHaveBeenCalledWith({ apiToken: 'cma-token' });
    expect(webhooksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/api/invalidate-cache-tags',
        headers: { 'Webhook-Token': 'secret' },
        enabled: true,
        events: [
          {
            filters: [],
            entity_type: 'cda_cache_tags',
            event_types: ['invalidate'],
          },
        ],
      }),
    );
  });

  it('fails when WEBHOOK_TOKEN is not configured', async () => {
    vi.stubEnv('WEBHOOK_TOKEN', '');

    const response = await POST(
      request({
        datocmsApiToken: 'cma-token',
        frontendUrl: 'https://example.com/',
      }),
    );

    expect(response.status).toBe(500);
    expect(webhooksCreate).not.toHaveBeenCalled();
  });

  it('reports DatoCMS API errors', async () => {
    webhooksCreate.mockRejectedValue(
      new ApiError({
        request: {
          url: 'https://site-api.datocms.com/webhooks',
          method: 'POST',
          headers: {},
        },
        response: {
          status: 422,
          statusText: 'Unprocessable Entity',
          body: {},
          headers: {},
        },
      }),
    );

    const response = await POST(
      request({
        datocmsApiToken: 'cma-token',
        frontendUrl: 'https://example.com/',
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      success: false,
      error: expect.any(String),
    });
  });

  it('reports unexpected errors without leaking details', async () => {
    webhooksCreate.mockRejectedValue(new Error('network down'));

    const response = await POST(
      request({
        datocmsApiToken: 'cma-token',
        frontendUrl: 'https://example.com/',
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false });
  });
});
