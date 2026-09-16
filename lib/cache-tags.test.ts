import { describe, expect, it } from 'vitest';
import { parseXCacheTagsResponseHeader } from './cache-tags';

describe('parseXCacheTagsResponseHeader', () => {
  it('splits a space-separated header into cache tags', () => {
    expect(parseXCacheTagsResponseHeader('tag-a tag-2 other-tag')).toEqual([
      'tag-a',
      'tag-2',
      'other-tag',
    ]);
  });

  it('returns a single tag when the header has no spaces', () => {
    expect(parseXCacheTagsResponseHeader('$o')).toEqual(['$o']);
  });

  it('keeps the exact characters DatoCMS uses in its tags', () => {
    const header = '$o #)[sai "s543* )88;]"t';

    expect(parseXCacheTagsResponseHeader(header)).toEqual([
      '$o',
      '#)[sai',
      '"s543*',
      ')88;]"t',
    ]);
  });

  it.each([undefined, null, ''])('returns [] for %s', (value) => {
    expect(parseXCacheTagsResponseHeader(value)).toEqual([]);
  });
});
