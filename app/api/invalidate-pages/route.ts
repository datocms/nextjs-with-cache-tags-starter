import { NextResponse } from 'next/server';

import type { CacheTag } from '@/lib/cache-tags';
import {
  deleteCacheTagAssociations,
  retrieveQueryDigestsByCacheTags,
} from '@/lib/database';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic'; // defaults to auto

type CdaCacheTagsInvalidateWebhook = {
  entity_type: 'cda_cache_tags';
  event_type: 'invalidate';
  entity: {
    id: 'cda_cache_tags';
    type: 'cda_cache_tags';
    attributes: {
      // The array of DatoCMS Cache Tags that need to be invalidated
      tags: CacheTag[];
    };
  };
};

export async function POST(request: Request) {
  if (request.headers.get('Webhook-Token') !== process.env.WEBHOOK_TOKEN) {
    return NextResponse.json(
      {
        error:
          'This endpoint requires an "Webhook-Token" header with a secret token.',
      },
      { status: 401 },
    );
  }

  const data = (await request.json()) as CdaCacheTagsInvalidateWebhook;

  const cacheTags = data.entity.attributes.tags;

  const queryDigests = await retrieveQueryDigestsByCacheTags(cacheTags);

  await deleteCacheTagAssociations(queryDigests);

  invalidatePagesByQueryDigest(queryDigests);

  return NextResponse.json({ cacheTags, queryDigests });
}

function invalidatePagesByQueryDigest(queryDigests: string[]) {
  for (const queryDigest of queryDigests) {
    /**
     * The `revalidateTag()` function provided by Next.js actually performs a
     * cache invalidation: this means that the cache entries previously
     * associated with the given tag are immediately marked as outdated (the
     * process is so fast that the method is even synchronous).
     *
     * The next time someone requests any of these outdated entries, the cache
     * will respond with a MISS.
     */
    revalidateTag(queryDigest);
  }
}
