import { revalidateTag } from "next/cache";
import { CacheTag } from "./cache-tags";

export function revalidateQueriesUsingCacheTags(cacheTags: CacheTag[]) {
  for (const tag of cacheTags) {
    console.log(`About to revalidate ${tag}`);
    revalidateTag(tag);
  }
}
