import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
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
    const suburb = formData.get('suburb') as string;
    const targetUrl = formData.get('target_url') as string;

    if (!file || !suburb || !targetUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name?.split('.').pop() || 'png';
    const key = `qr-codes/${suburb.toLowerCase().replace(/\s+/g, '-')}/qrcode.${ext}`;

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
    const fileUrl = `${publicDomain}/${key}`;

    await marieDB.query(`
      CREATE TABLE IF NOT EXISTS suburb_qr_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        suburb VARCHAR(100) NOT NULL,
        target_url VARCHAR(500) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(200) NOT NULL,
        file_size INT DEFAULT 0,
        uploaded_by VARCHAR(255),
        scan_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(suburb)
      )
    `);

    const result = await marieDB.query(
      `INSERT INTO suburb_qr_codes (suburb, target_url, file_url, file_name, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (suburb)
       DO UPDATE SET
         target_url = $2,
         file_url = $3,
         file_name = $4,
         file_size = $5,
         uploaded_by = $6,
         created_at = NOW()
       RETURNING *`,
      [suburb, targetUrl, fileUrl, file.name || `qrcode.${ext}`, buffer.length, session.user.email]
    );

    return NextResponse.json({
      success: true,
      url: fileUrl,
      qrcode: result.rows[0],
    });
  } catch (error) {
    console.error('Error uploading QR code:', error);
    return NextResponse.json(
      { error: 'Failed to upload QR code' },
      { status: 500 }
    );
  }
}
