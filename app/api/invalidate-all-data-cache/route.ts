import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic"; // defaults to auto

export async function POST(request: Request) {
  revalidatePath('/', 'layout')

  return NextResponse.json({});
}
