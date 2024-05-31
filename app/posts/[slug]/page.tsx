import Link from "next/link";
import React from "react";
import { StructuredText, Image } from "react-datocms";

import { executeQuery } from "@/lib/fetch-contents";

const CURRENT_POST_QUERY = `
  query CurrentPost($slug: String) {
    currentPost: post(filter: { slug: { eq: $slug }}) {
      slug
      title
      content {
        value
        blocks {
          __typename
          ... on ImageBlockRecord {
            id
            image {
              responsiveImage(
                imgixParams: { fit: crop, w: 300, h: 300, auto: format }
              ) {
                ...responsiveImageFragment
              }
            }
          }
        }
      }
      coverImage {
        responsiveImage(imgixParams: {fm: jpg, fit: crop, w: 2000, h: 1000 }) {
          ...responsiveImageFragment
        }
      }
      _firstPublishedAt
      author {
        id
        name
      }
    }
  }

  fragment responsiveImageFragment on ResponsiveImage {
    srcSet
    webpSrcSet
    sizes
    src
    width
    height
    aspectRatio
    alt
    title
    base64
  }
`;

const PREVIOUS_AND_NEXT_POSTS_QUERY = `
  query PreviousAndNextPosts($firstPublishedAt: DateTime, $slug: String) {
    previousPost: post(
      orderBy: _firstPublishedAt_DESC,
      filter: {slug: {neq: $slug}, _firstPublishedAt: {lt: $firstPublishedAt}}
    ) {
      id
      title
      slug
      _status
      _firstPublishedAt
    }
    
    nextPost: post(
      orderBy: _firstPublishedAt_ASC,
      filter: {slug: {neq: $slug}, _firstPublishedAt: {gt: $firstPublishedAt}}
    ) {
      id
      title
      slug
      _status
      _firstPublishedAt
    }
  }
`;

export const dynamic = "error";

type Props = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

async function Page({ params }: Props) {
  const { slug } = params;

  const { data: currentPostData, cacheTags: currentPostTags } =
    await executeQuery(CURRENT_POST_QUERY, { slug });

  const { currentPost } = currentPostData;
  const { _firstPublishedAt: firstPublishedAt } = currentPost;

  const {
    data: previousAndNextPostsData,
    cacheTags: previousAndNextPostsTags,
  } = await executeQuery(PREVIOUS_AND_NEXT_POSTS_QUERY, {
    firstPublishedAt,
    slug,
  });

  const { previousPost, nextPost } = previousAndNextPostsData;

  return (
    <>
      <section>
        <Image
          data={currentPost.coverImage.responsiveImage}
        />
      </section>

      <header>
        <h1>{currentPost.title}</h1>
      </header>

      <StructuredText
        data={currentPost.content}
        renderBlock={({ record }) => {
          switch (record.__typename) {
            case "ImageRecord":
              return (
                <Image
                  data={record.image.responsiveImage}
                />
              );
            default:
              return null;
          }
        }}
      />

      <p>
        Written by{" "}
        <Link href={`/authors/${currentPost.author.id}`} role="button">
          {currentPost.author.name}
        </Link>
      </p>

      <h2>Siblings posts</h2>

      <div className="grid">
        <div>
          Previous:{" "}
          {previousPost ? (
            <Link href={`/posts/${previousPost.slug}`}>{previousPost.title}</Link>
          ) : (
            "—"
          )}
        </div>
        <div>
          Next:{" "}
          {nextPost ? (
            <Link href={`/posts/${nextPost.slug}`}>{nextPost.title}</Link>
          ) : (
            "—"
          )}
        </div>
      </div>
    </>
  );
}

export default Page;
