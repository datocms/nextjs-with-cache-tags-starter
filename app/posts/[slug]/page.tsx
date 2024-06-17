import Link from "next/link";
import React from "react";
import { StructuredText } from "react-datocms";

import { executeQuery } from "@/lib/fetch-contents";
import { graphql } from "@/lib/graphql";

import { Content, readContentFragment } from "@/fragments/content";
import { ResponsiveImage } from "@/fragments/responsive-image";

import ContentImage from "@/components/ResponsiveImage";

const CURRENT_POST_QUERY = graphql(
  `
    query CurrentPost($slug: String) {
      currentPost: post(filter: { slug: { eq: $slug } }) {
        title
        content {
          ...Content
        }
        coverImage {
          responsiveImage(
            imgixParams: { fm: jpg, fit: crop, w: 2000, h: 1000 }
          ) {
            ...ResponsiveImage
          }
        }
        _firstPublishedAt
        author {
          id
          name
        }
      }
    }
  `,
  [Content, ResponsiveImage]
);

const PREVIOUS_AND_NEXT_POSTS_QUERY = graphql(`
  query PreviousAndNextPosts($firstPublishedAt: DateTime, $slug: String) {
    previousPost: post(
      orderBy: _firstPublishedAt_DESC
      filter: {
        slug: { neq: $slug }
        _firstPublishedAt: { lt: $firstPublishedAt }
      }
    ) {
      id
      title
      slug
    }

    nextPost: post(
      orderBy: _firstPublishedAt_ASC
      filter: {
        slug: { neq: $slug }
        _firstPublishedAt: { gt: $firstPublishedAt }
      }
    ) {
      id
      title
      slug
    }
  }
`);

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

  if (!currentPost) return null;

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
      {currentPost.coverImage?.responsiveImage && (
        <section>
          <ContentImage
            responsiveImage={currentPost.coverImage.responsiveImage}
          />
        </section>
      )}
      <header>
        <h1>
          <span
            data-tooltip={`The content of this page is generated with a GraphQL query that also returned these cache tags: "${currentPostTags.join(
              ", "
            )}"`}
            data-placement="bottom"
            data-flexible-content
          >
            {currentPost.title}
          </span>
        </h1>
      </header>

      {currentPost.content && (
        <StructuredText
          data={readContentFragment(currentPost.content)}
          renderBlock={({ record }) => {
            switch (record.__typename) {
              case "ImageBlockRecord":
                return record.image?.responsiveImage ? (
                  <ContentImage
                    responsiveImage={record.image.responsiveImage}
                  />
                ) : null;
              default:
                return null;
            }
          }}
        />
      )}

      {currentPost.author && (
        <p>
          Written by{" "}
          <Link href={`/authors/${currentPost.author.id}`} role="button">
            {currentPost.author.name}
          </Link>
        </p>
      )}

      <h2>
        <span
          data-tooltip={`The content of this section is generated with a GraphQL query that also returned these cache tags: "${previousAndNextPostsTags.join(
            ", "
          )}"`}
          data-placement="bottom"
          data-flexible-content
        >
          Siblings posts
        </span>
      </h2>

      <div className="grid">
        <div>
          Previous:{" "}
          {previousPost ? (
            <Link href={`/posts/${previousPost.slug}`}>
              {previousPost.title}
            </Link>
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
