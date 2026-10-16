import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSearchHistory, saveSearchHistory } from '@/lib/redis';

export async function GET() {
  const session = await auth();
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const history = await getSearchHistory(Number(session.user.adminId));
  return NextResponse.json({ data: history });
}

export async function POST(req: NextRequest | Request) {
  const session = await auth();
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { query } = await req.json();
  if (typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  await saveSearchHistory(Number(session.user.adminId), query.trim());
  return NextResponse.json({ success: true });
}
