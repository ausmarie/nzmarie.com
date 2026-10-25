import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { GET as outreachGET } from '../route';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      suburb,
      streets,
      status = 'pending',
      sent_status = 'unsent',
      report_quarter,
    } = body;

    if (!suburb || !Array.isArray(streets) || streets.length === 0) {
      return NextResponse.json(
        { error: 'Missing suburb or streets' },
        { status: 400 }
      );
    }

    const prefetched: string[] = [];
    const limitStreets = streets.slice(0, 10);
    const cookie = request.headers.get('cookie') ?? '';

    for (const street of limitStreets) {
      if (!street || typeof street !== 'string') continue;
      const sp = new URLSearchParams({
        status,
        sent_status,
        suburb,
        street,
        sortOrder: 'asc',
        limit: '18',
        page: '1',
      });
      if (report_quarter) {
        sp.set('report_quarter', report_quarter);
      }

      const url = new URL(`/api/admin/outreach?${sp.toString()}`, request.url);
      const res = await outreachGET(new Request(url, { headers: { cookie } }));
      if (res.ok) prefetched.push(street);
    }

    return NextResponse.json({
      success: true,
      prefetched,
    });
  } catch (error) {
    console.error('Error prefetching street cards:', error);
    return NextResponse.json(
      { error: 'Failed to prefetch street cards' },
      { status: 500 }
    );
  }
}
