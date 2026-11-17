import { NextResponse } from 'next/server';
import { enqueuePageViewEvent, isPageViewPayload } from '@/lib/page-view-queue';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'A valid JSON request body is required.' }, { status: 400 });
  }
  if (!isPageViewPayload(body)) {
    return NextResponse.json({ success: false, error: 'Invalid page-view event.' }, { status: 400 });
  }

  try {
    await enqueuePageViewEvent(body);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to queue page-view event:', error);
    return NextResponse.json({ success: false, error: 'Failed to queue page-view event.' }, { status: 503 });
  }
}
