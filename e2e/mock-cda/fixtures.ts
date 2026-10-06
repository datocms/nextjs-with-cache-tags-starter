/**
 * In-memory content served by the mock DatoCMS Content Delivery API used by
 * the E2E test-suite. The shapes mirror what the real GraphQL queries in
 * `app/` select, so the pages render exactly as they would in production.
 */

import { e2eConfig } from '../config.ts';

export type ResponsiveImageFixture = {
  srcSet: string;
  webpSrcSet: string;
  sizes: string;
  src: string;
  width: number;
  height: number;
  aspectRatio: number;
  alt: string | null;
  title: string | null;
  base64: string | null;
};

export type AuthorFixture = {
  id: string;
  name: string;
  picture: { responsiveImage: ResponsiveImageFixture } | null;
};

export type PostFixture = {
  id: string;
  slug: string;
  title: string;
  /** Plain-text paragraph rendered inside the Structured Text field */
  body: string;
  authorId: string | null;
  coverImage: { responsiveImage: ResponsiveImageFixture } | null;
  /** ISO 8601 timestamp used both as `_firstPublishedAt` and `_publishedAt` */
  publishedAt: string;
};

export type ContentState = {
  posts: PostFixture[];
  authors: AuthorFixture[];
};

const image = (
  seed: string,
  width: number,
  height: number,
): ResponsiveImageFixture => {
  // Served by the mock server itself, so pages load with zero failed requests.
  const src = `${e2eConfig.mockCdaUrl}/images/${seed}.jpg?w=${width}&h=${height}`;

  return {
    src,
    srcSet: `${src}&dpr=0.5 ${width / 2}w, ${src} ${width}w`,
    webpSrcSet: `${src}&fm=webp&dpr=0.5 ${width / 2}w, ${src}&fm=webp ${width}w`,
    sizes: '(max-width: 2000px) 100vw, 2000px',
    width,
    height,
    aspectRatio: width / height,
    alt: `${seed} alt text`,
    title: null,
    base64:
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  };
};

export const createInitialState = (): ContentState => ({
  authors: [
    {
      id: 'author-1',
      name: 'Jane Doe',
      picture: { responsiveImage: image('jane', 2000, 1000) },
    },
  ],
  posts: [
    {
      id: 'post-1',
      slug: 'first-post',
      title: 'First post',
      body: 'Body of the first post.',
      authorId: 'author-1',
      coverImage: { responsiveImage: image('first-cover', 2000, 1000) },
      publishedAt: '2024-01-01T10:00:00Z',
    },
    {
      id: 'post-2',
      slug: 'second-post',
      title: 'Second post',
      body: 'Body of the second post.',
      authorId: 'author-1',
      coverImage: { responsiveImage: image('second-cover', 2000, 1000) },
      publishedAt: '2024-02-01T10:00:00Z',
    },
    {
      id: 'post-3',
      slug: 'third-post',
      title: 'Third post',
      body: 'Body of the third post.',
      authorId: null,
      coverImage: null,
      publishedAt: '2024-03-01T10:00:00Z',
    },
    {
      id: 'post-4',
      slug: 'fourth-post',
      title: 'Fourth post',
      body: 'Body of the fourth post.',
      authorId: 'author-1',
      coverImage: { responsiveImage: image('fourth-cover', 2000, 1000) },
      publishedAt: '2024-04-01T10:00:00Z',
    },
  ],
});
