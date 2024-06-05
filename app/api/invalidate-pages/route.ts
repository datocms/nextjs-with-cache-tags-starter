import { NextResponse } from "next/server";

import { CacheTag } from "@/lib/cache-tags";
import { revalidateQueriesUsingCacheTags } from "@/lib/vercel-cache-revalidate-strategy";

export const dynamic = "force-dynamic"; // defaults to auto

export async function POST(request: Request) {
  console.log("Invalidation endpoint just called.");

  if (request.headers.get("Webhook-Token") !== process.env.WEBHOOK_TOKEN) {
    return NextResponse.json(
      {
        error:
          'This endpoint requires an "Webhook-Token" header with a secret token.',
      },
      { status: 401 }
    );
  }

  // Read the request content: that's a comma separated list of cache tags sent
  // by DatoCMS as the body of the webhook.
  const data = await request.json();

  const cacheTags = data["entity"]["attributes"]["tags"].map(
    (tag: string) => tag as CacheTag
  );

  console.log(
    `I'm about to invalidate the following cache tags: ${cacheTags.join(", ")}`
  );

  revalidateQueriesUsingCacheTags(cacheTags);

  console.log("Invalidation done!");

  return NextResponse.json({ cacheTags });
}
