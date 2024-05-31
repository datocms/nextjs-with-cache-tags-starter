import React from "react";
import { Image } from "react-datocms";

import { executeQuery } from "@/lib/fetch-contents";

const AUTHOR_QUERY = `
  query Author($id: ItemId) {
    author(filter: {id: {eq: $id}}) {
      name
      picture {
        responsiveImage(imgixParams: {fm: jpg, fit: crop, w: 2000, h: 1000 }) {
          ...responsiveImageFragment
        }
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

export const dynamic = "error";

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

async function Page({ params }: Props) {
  const { id } = params;

  const { data: authorData, cacheTags: authorTags } = await executeQuery(
    AUTHOR_QUERY,
    { id }
  );

  const { author } = authorData;

  return (
    <>
      <article className="grid">
        <Image data={author.picture.responsiveImage} />
        <h1>{author.name}</h1>
      </article>
    </>
  );
}

export default Page;
