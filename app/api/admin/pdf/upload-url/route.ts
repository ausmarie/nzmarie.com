import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'mock',
  },
});

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const suburb = String(body?.suburb || '').trim();
    const quarter = String(body?.quarter || '').trim();
    const year = Number(body?.year);
    const fileName = String(body?.fileName || '').trim();
    const label = String(body?.label || 'Main Report').trim() || 'Main Report';

    if (!suburb || !quarter || Number.isNaN(year) || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.R2_BUCKET_NAME || !process.env.R2_ENDPOINT) {
      return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 500 });
    }

    const timestamp = Date.now();
    const key = `reports/${suburb}/${quarter}-${year}/${timestamp}-${sanitizeFileName(fileName)}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: 'application/pdf',
      CacheControl: 'public, max-age=31536000, immutable',
    });

    const signedUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://r2.nzmarie.com').replace(/\/+$/, '');

    return NextResponse.json({
      success: true,
      url: signedUrl,
      key,
      fileUrl: `${publicDomain}/${key}`,
      label,
    });
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
