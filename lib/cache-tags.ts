/**
 * A branded type for cache tags. This is created by intersecting `string`
 * with `{ readonly _: unique symbol }`, making it a unique type.
 * Although it is fundamentally a string, it is treated as a distinct type
 * due to the unique symbol.
 *
 * This pattern enhances type safety by ensuring that only values explicitly
 * marked as `CacheTag` can be used where a `CacheTag` is expected.
 *
 * More on branded types: https://egghead.io/blog/using-branded-types-in-typescript
 */
export type CacheTag = string & { readonly _: unique symbol };

/**
 * Converts the value of DatoCMS's `X-Cache-Tags` header into an array of
 * strings typed as `CacheTag`. For example, it transforms `'tag-a tag-2 other-tag'`
 * into `['tag-a', 'tag-2', 'other-tag']`.
 */
export function parseXCacheTagsResponseHeader(
  string: undefined | null | string,
) {
  if (!string) return [];

  return (string.split(' ') || []).map((tag) => tag as CacheTag);
}
