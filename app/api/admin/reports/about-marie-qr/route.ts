import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'mock',
  },
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PNG, JPEG, WebP and GIF are allowed.' }, { status: 400 });
    }

    const ext = file.name?.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const key = `about-marie/qrcode-${timestamp}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (process.env.R2_BUCKET_NAME) {
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'image/png',
        })
      );
    }

    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://r2.nzmarie.com').replace(/\/+$/, '');
    const url = `${publicDomain}/${key}`;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Error uploading about-marie QR code:', error);
    return NextResponse.json({ error: 'Failed to upload QR code' }, { status: 500 });
  }
}
