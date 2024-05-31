/**
 * The purpose of this type alias is to create a [branded type][bt]: by
 * intersecting string with { readonly _: unique symbol }, you can create a type
 * that is distinguishable from plain strings even though it is still
 * fundamentally a string.
 *
 * [bt]: https://egghead.io/blog/using-branded-types-in-typescript
 *
 * Even though CacheTag  is technically a string, it is treated as a distinct
 * type because of the unique symbol. This pattern is used to add a layer of
 * type safety, ensuring that only values explicitly marked as CacheTag can be
 * used where a CacheTag is expected.
 */
export type CacheTag = string & { readonly _: unique symbol };

/**
 * Converts a string like `"tag-a, tag-2, other-tag"` into
 * an array of string properly typed: `['tag-a', 'tag-2', 'other-tag']`.
 */
export function parseCommaSeparatedTagString(
  string: undefined | null | string,
) {
  if (!string) return [];

  return (string.split(" ") || []) as CacheTag[];
}
