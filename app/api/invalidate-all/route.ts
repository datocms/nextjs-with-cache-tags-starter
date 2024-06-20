import { truncateAssociationsTable } from '@/lib/database';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // defaults to auto

export async function POST(request: Request) {
  if (request.headers.get('Webhook-Token') !== process.env.WEBHOOK_TOKEN) {
    return NextResponse.json(
      {
        error:
          'This endpoint requires an "Webhook-Token" header with a secret token.',
      },
      { status: 401 },
    );
  }

  revalidatePath('/', 'layout');

  await truncateAssociationsTable();

  return NextResponse.json({});
}
