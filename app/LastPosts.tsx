import { executeQuery } from "@/lib/fetch-contents";
import React from "react";

const QUERY = `
  {
    allPosts(orderBy: _firstPublishedAt_DESC) {
      title
      slug
      _firstPublishedAt
    }
  }
`;

type Props = {};

async function LastPosts({}: Props) {
  const { data, tags } = await executeQuery(QUERY);

  const { allPosts } = data;

  return (
    <ul>
      {allPosts.map(({ slug, title }: { slug: string; title: string }) => (
        <li key={slug}>
          <a href={`/${slug}`}>{title}</a>
        </li>
      ))}
    </ul>
  );
}

export default LastPosts;
