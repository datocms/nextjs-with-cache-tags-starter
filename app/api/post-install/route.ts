import { ApiError, type Client, buildClient } from "@datocms/cma-client-node";
import { NextResponse } from "next/server";

const cors = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
};

/*
  This endpoint is called right after bootstrapping the Starter project... they
  can be removed afterwards!
*/

export async function OPTIONS() {
  return new Response("OK", cors);
}

export async function POST(request: Request) {
  const body = await request.json();

  const client = buildClient({ apiToken: body.datocmsApiToken });

  const baseUrl = (
    process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : process.env.URL
  ) as string;

  try {
    await createCacheInvalidationWebhook(client, baseUrl);

    return NextResponse.json({ success: true }, cors);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          request: error.request,
          response: error.response,
        },
        { status: 500, ...cors }
      );
    }

    return NextResponse.json({ success: false }, { status: 500, ...cors });
  }
}

async function createCacheInvalidationWebhook(client: Client, baseUrl: string) {
  await client.webhooks.create({
    name: "🔄 Invalidate pages using cache tags",
    url: `${baseUrl}/api/invalidate-pages`,
    custom_payload: null,
    headers: {
      "Webhook-Token": process.env.WEBHOOK_TOKEN,
    },
    events: [
      {
        filters: [],
        entity_type: "cda_cache_tags",
        event_types: ["invalidate"],
      },
    ],
    http_basic_user: null,
    http_basic_password: null,
    enabled: true,
    payload_api_version: "3",
    nested_items_in_payload: false,
  });
}
