import { NextResponse } from "next/server";

import { CacheTag, deleteTags, retrieveFetchIdsByTags } from "@/lib/cache-tags";
import { regeneratePagesByFetchId } from "@/lib/vercel-cache-revalidate-strategy";

export const dynamic = 'force-dynamic' // defaults to auto

export async function POST(request: Request) {
  if (request.headers.get('Webhook-Token') !== process.env.WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'This endpoint requires an "Webhook-Token" header with a secret token.' }, { status: 401 })
	}

	// Read the request content: that's a comma separated list of cache tags sent
	// by DatoCMS as the body of the webhook.
	const body = await request.text();

	const data = JSON.parse(body);

	const cacheTags = data['entity']['attributes']['tags'].map((tag: string) => tag as CacheTag);

	// Retrieve from the key-value storage all the identifiers associated to the
	// cache tags signaled as outdated..
	const fetchIdsToRevalidate = await retrieveFetchIdsByTags(cacheTags);

	// Then we're going to delete the cacheTags from the key-value storage.
	await deleteTags(cacheTags);

	regeneratePagesByFetchId(fetchIdsToRevalidate);

	// For illustrational purpose, the list of rebuilt pathname is returned. In a
	// real-world scenario, this is probably not needed.
	return NextResponse.json({ cacheTags, fetchIds: fetchIdsToRevalidate });
}

