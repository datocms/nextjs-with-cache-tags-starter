import Link from "next/link";
import React from "react";

import { executeQuery } from "@/lib/fetch-contents";

const AUTHOR_QUERY = `
query Author($id: ItemId) {
  author(filter: {id: {eq: $id}}) {
    name
  }
}
`;

export const dynamic = "error";

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

async function Page({ params }: Props) {
  const { id } = params;

  const { data: authorData, tags: authorTags } = await executeQuery(
    AUTHOR_QUERY,
    { id },
  );

  const { author } = authorData;

  return (
    <>
      <h1>{author.name}</h1>

      <footer>
        <p>
          Cache tags from page queries:
          <code>
            {JSON.stringify(authorTags)}
          </code>
        </p>
      </footer>
    </>
  );
}

export default Page;
