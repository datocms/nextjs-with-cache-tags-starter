import { graphql } from '@/lib/graphql';

export const ResponsiveImage = graphql(`
  fragment ResponsiveImage on ResponsiveImage {
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
`);
