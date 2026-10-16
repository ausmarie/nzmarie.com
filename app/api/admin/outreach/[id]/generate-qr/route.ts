import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getOrCreateQRToken, buildQRUrl } from '@/lib/qr-token';
import { marieDB } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const { id } = await params;
    const token = await getOrCreateQRToken(id);
    const url = buildQRUrl(token);

    return NextResponse.json({
      success: true,
      token,
      url,
      qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
    });
  } catch (error) {
    console.error('Error generating QR token:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR token' },
      { status: 500 }
    );
  }
}
