import { revalidateTag } from "next/cache";
import { CacheTag } from "./cache-tags";

export function revalidateQueriesUsingCacheTags(cacheTags: CacheTag[]) {
  for (const tag of cacheTags) {
    revalidateTag(tag);
  }
}
