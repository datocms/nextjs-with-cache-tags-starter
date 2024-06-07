import { revalidateTag } from "next/cache";

import { CacheTag } from "./cache-tags";

export function revalidateQueriesUsingCacheTags(cacheTags: CacheTag[]) {
  for (const tag of cacheTags) {
    /**
     * The method used below here is called "revalidate", but it actually
     * executes a proper "invalidation": that means that the cache entries that
     * were previously tagged with the passed tag are immediately marked as
     * stale (the process is so quick that the method is even synchronous). The
     * next time someone will request any of the these stale entries, the cache
     * will answer with a MISS.
     */
    revalidateTag(tag);
  }
}
