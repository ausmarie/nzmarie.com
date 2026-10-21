import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { R2_PUBLIC_DOMAIN, uploadToR2 } from '@/lib/r2-storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function safeDocId(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return 'common';
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || 'common';
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docId = safeDocId(formData.get('doc_id'));

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large. Max 5MB' }, { status: 400 });
    }

    const ext = EXTENSIONS[file.type] ?? 'png';
    const uuid = crypto.randomUUID();
    const r2Key = `reports/images/${docId}/${uuid}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(r2Key, buffer, file.type, 'public, max-age=31536000, immutable');

    const publicUrl = `${R2_PUBLIC_DOMAIN.replace(/\/+$/, '')}/${r2Key}`;

    return NextResponse.json({ success: true, url: publicUrl, key: r2Key });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
  }
}
