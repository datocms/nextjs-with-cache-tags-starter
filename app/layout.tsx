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
                  <Link href={`/posts/${lastPost.slug}`}>Most recent post</Link>
                </li>
              )}
            </ul>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="container">
          <hr />
          <p>This page has been generated on {new Date().toISOString()}</p>
        </footer>
      </body>
    </html>
  );
}
