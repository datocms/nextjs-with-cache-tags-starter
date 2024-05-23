/**
 * KV (standing for key-value) is a type of storage offered by Vercel and other provider:
 * it's a tool to store long lasting data, and associating it to a string key. The conventional
 * usage of key value storage is for storing contents (a page HTML, as an example) that need to be cached.
 *
 * We're gonna use the key-value storage to keep track of all the pages that need to be rebult
 * when a cache tag is declared as invalid (DatoCMS signals tags that are outdated using a webhook call).
 */
import { kv } from "@vercel/kv";

import type { CacheTag } from "./cache-tags";

/**
 * For each tag passed, an association "tag → query" is saved in the
 * key-value storage: we're using the `sadd` method (short for "set add"), which
 * adds the query to the set named after the tag, but only if the query is
 * not already there.
 *
 * We're not actually using the query as a key: we produce a SHA1 signature and use it as a key.
 */
export async function associateFetchIdToTags(id: string, tags: CacheTag[]) {
  for (const tag of tags) {
    await kv.sadd(tag, `fetchId:${id}`);
  }
}

/**
 * Find all the unique pathnames of the pages associated to a list of passed tags.
 */
export async function retrieveFetchIdsByTags(tags: CacheTag[]) {
  const fetchIds = await Promise.all(
    tags.map(async (tag) => {
      try {
        return await kv.smembers(tag);
      } catch (error) {
        return [];
      }
    }),
  );

  // See: https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates
  return fetchIds.flat().filter((value, index, array) => array.indexOf(value) === index);
}

function chunkArray<T>(array: T[], size: number) {
  const result: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

export async function deleteTags(tags: CacheTag[]) {
  const chunks = chunkArray(tags, 128);

  return await Promise.all(
    chunks.map(async (chunk) => {
      await kv.del(...chunk);
    }),
  );
}
