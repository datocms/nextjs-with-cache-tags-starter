import { revalidateTag } from "next/cache";

export function revalidateQueriesByFetchId(fetchIds: string[]) {
  for (const fetchId of fetchIds) {
    revalidateTag(fetchId);
  }
}
