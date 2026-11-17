import { NextResponse } from 'next/server';
import { processPageViewQueueBatch } from '@/lib/page-view-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BATCHES_PER_RUN = 10;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let processed = 0;
    let batches = 0;
    while (batches < MAX_BATCHES_PER_RUN) {
      const count = await processPageViewQueueBatch();
      if (count === 0) break;
      processed += count;
      batches += 1;
    }

    return NextResponse.json({ success: true, processed, batches });
  } catch (error) {
    console.error('Failed to persist queued page-view events:', error);
    return NextResponse.json({ success: false, error: 'Failed to persist page-view events.' }, { status: 500 });
  }
}
