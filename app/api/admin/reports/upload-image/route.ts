import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { uploadToR2 } from '@/lib/r2-storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docId = formData.get('doc_id') as string || 'common';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large. Max 5MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const uuid = crypto.randomUUID();
    const r2Key = `reports/images/${docId}/${uuid}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(r2Key, buffer, file.type);

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${r2Key}`;

    return NextResponse.json({ success: true, url: publicUrl, key: r2Key });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
  }
}
