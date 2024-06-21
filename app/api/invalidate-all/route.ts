/*
 *  This route handler serves to completely invalidate the project's cache. It
 *  can be useful to start from a clean slate in case of problems.
 */

import { truncateAssociationsTable } from '@/lib/database';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // defaults to auto

export async function POST(request: Request) {
  if (request.headers.get('Webhook-Token') !== process.env.WEBHOOK_TOKEN) {
    return NextResponse.json(
      {
        error:
          'You need to provide a secret token in the `Webhook-Token` header for this endpoint.',
      },
      { status: 401 },
    );
  }

  revalidatePath('/', 'layout');

  await truncateAssociationsTable();

  return NextResponse.json({});
}
