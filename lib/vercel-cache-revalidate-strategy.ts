import { revalidateTag } from "next/cache";

export function regeneratePagesByFetchId(fetchIds: string[]) {
  for (const fetchId of fetchIds) {
    revalidateTag(fetchId);
  }
}
