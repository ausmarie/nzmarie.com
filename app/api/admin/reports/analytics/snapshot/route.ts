import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { uploadToR2 } from '@/lib/r2-storage';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { image_data, doc_id } = body;

    if (!image_data || !doc_id) {
      return NextResponse.json({ success: false, error: 'image_data and doc_id are required' }, { status: 400 });
    }

    const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const uuid = crypto.randomUUID();
    const r2Key = `reports/images/${doc_id}/${uuid}.png`;

    await uploadToR2(r2Key, buffer, 'image/png');

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${r2Key}`;

    return NextResponse.json({ success: true, url: publicUrl, key: r2Key });
  } catch (error) {
    console.error('Error saving snapshot:', error);
    return NextResponse.json({ success: false, error: 'Failed to save snapshot' }, { status: 500 });
  }
}
