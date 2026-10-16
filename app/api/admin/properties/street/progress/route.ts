import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getStreetProgress, setStreetProgress, StreetProgressStatus } from '@/lib/street-progress';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb') ?? '';
  if (!suburb.trim()) {
    return NextResponse.json({ error: 'Missing suburb parameter' }, { status: 400 });
  }

  try {
    const progress = await getStreetProgress(suburb);
    return NextResponse.json({ success: true, suburb, progress });
  } catch (error) {
    console.error('Error fetching street progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch street progress' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { suburb?: string; street?: string; status?: StreetProgressStatus; liked_count?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const suburb = typeof body?.suburb === 'string' ? body.suburb.trim() : '';
  const street = typeof body?.street === 'string' ? body.street.trim() : '';
  const status: StreetProgressStatus = body?.status === 'completed' ? 'completed' : 'in_progress';

  if (!suburb || !street) {
    return NextResponse.json({ error: 'suburb and street are required' }, { status: 400 });
  }

  try {
    const entry = await setStreetProgress({
      suburb,
      street,
      status,
      likedCount: body?.liked_count,
      email: session.user.email,
    });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Error saving street progress:', error);
    return NextResponse.json({ success: false, error: 'Failed to save street progress' }, { status: 500 });
  }
}