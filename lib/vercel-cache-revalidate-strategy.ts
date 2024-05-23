import { revalidateTag } from "next/cache";

export function regenerateQueriesByFetchId(fetchIds: string[]) {
  for (const fetchId of fetchIds) {
    revalidateTag(fetchId);
  }
}
