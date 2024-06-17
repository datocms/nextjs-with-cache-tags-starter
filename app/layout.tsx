import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

import { executeQuery } from "@/lib/fetch-contents";
import { graphql } from "@/lib/graphql";

type LastPostData = {
  lastPost: {
    slug: string;
    title: string;
  };
};

const LAST_POST_QUERY = graphql(`
  query LastPost {
    lastPost: post(orderBy: _publishedAt_DESC) {
      slug
    }
  }
`);

export const dynamic = "error";

export const metadata: Metadata = {
  title: "DatoCMS starter: a blog example",
  description: "Featuring DatoCMS React components, cache tags and more",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data, cacheTags } = await executeQuery(LAST_POST_QUERY);

  const { lastPost } = data;

  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
        />
      </head>
      <body>
        <header className="container">
          <nav>
            <ul>
              <li>
                <strong>DatoCMS starter: a blog example</strong>
              </li>
            </ul>
            <ul>
              <li>
                <Link href="/">Home</Link>
              </li>
              {lastPost && (
                <li>
                  <Link
                    href={`/posts/${lastPost.slug}`}
                    data-tooltip={`This link is generated with a GraphQL query that also returned these cache tags: "${cacheTags.join(
                      ", "
                    )}"`}
                    data-placement="bottom"
                    data-flexible-content
                  >
                    Most recent post
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="container">
          <hr />
          <p>
            This page has been generated on{" "}
            <span
              data-tooltip="This date is injected when the page is built: it won't change anymore, until some of the content changes and all the page is invalidated and, therefore, it will be rebuilt at the first request."
              data-placement="top"
              data-flexible-content
            >
              {new Date().toISOString()}
            </span>
          </p>
        </footer>
      </body>
    </html>
  );
}
