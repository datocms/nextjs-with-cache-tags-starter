import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.hoisted(() => vi.fn());
const truncateAssociationsTable = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('@/lib/database', () => ({ truncateAssociationsTable }));

import { POST } from './route';

const request = (token?: string) =>
  new Request('http://localhost/api/invalidate-all', {
    method: 'POST',
    headers: token ? { 'Webhook-Token': token } : {},
  });

describe('POST /api/invalidate-all', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_TOKEN', 'secret');
    truncateAssociationsTable.mockResolvedValue(undefined);
  });

  it('rejects requests without a valid webhook token', async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request('wrong'))).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(truncateAssociationsTable).not.toHaveBeenCalled();
  });

  it('invalidates the whole site and wipes the associations table', async () => {
    const response = await POST(request('secret'));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(truncateAssociationsTable).toHaveBeenCalledTimes(1);
  });
});
