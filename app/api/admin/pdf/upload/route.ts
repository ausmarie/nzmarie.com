import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marieDB } from '@/lib/db';
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
    const contentType = typeof request.headers?.get === 'function'
      ? request.headers.get('content-type') || ''
      : '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const uploads = Array.isArray(body?.uploads) ? body.uploads : [];

      if (uploads.length > 0) {
        const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://r2.nzmarie.com').replace(/\/+$/, '');
        const finalized: Array<{ file_name: string; doc_label: string; file_url: string; file_size: number; report?: unknown }> = [];

        for (const item of uploads) {
          const suburb = String(item?.suburb || '').trim();
          const quarter = String(item?.quarter || '').trim();
          const year = Number(item?.year);
          const docLabel = String(item?.label || 'Main Report').trim() || 'Main Report';
          const fileUrl = String(item?.fileUrl || '').trim();
          const fileName = String(item?.fileName || 'report.pdf').trim() || 'report.pdf';
          const fileSize = Number(item?.fileSize || 0);

          if (!suburb || !quarter || Number.isNaN(year) || !fileUrl) {
            return NextResponse.json({ error: 'Invalid upload metadata' }, { status: 400 });
          }

          const existingResult = await marieDB.query(
            `SELECT file_url FROM suburb_reports WHERE suburb = $1 AND quarter = $2 AND year = $3 AND doc_label = $4`,
            [suburb, quarter, year, docLabel]
          );

          if (existingResult.rows.length > 0) {
            const oldFileUrl = existingResult.rows[0].file_url as string;
            if (oldFileUrl && oldFileUrl.startsWith(publicDomain)) {
              const oldKey = oldFileUrl.replace(`${publicDomain}/`, '');
              try {
                if (process.env.R2_BUCKET_NAME) {
                  await r2.send(
                    new DeleteObjectCommand({
                      Bucket: process.env.R2_BUCKET_NAME,
                      Key: oldKey,
                    })
                  );
                }
              } catch (e) {
                console.error('[Upload finalize] Failed to delete old R2 object:', e);
              }
            }
          }

          const result = await marieDB.query(
            `INSERT INTO suburb_reports (suburb, quarter, year, doc_label, file_url, file_name, file_size, uploaded_by, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
             ON CONFLICT (suburb, quarter, year, doc_label)
             DO UPDATE SET
               file_url = $5,
               file_name = $6,
               file_size = $7,
               uploaded_at = NOW(),
               updated_at = NOW()
             RETURNING *`,
            [suburb, quarter, year, docLabel, fileUrl, fileName, fileSize, session.user.email]
          );

          finalized.push({
            file_name: fileName,
            doc_label: docLabel,
            file_url: fileUrl,
            file_size: fileSize,
            report: result.rows[0],
          });
        }

        return NextResponse.json({
          success: true,
          reports: finalized,
          count: finalized.length,
          message: `${finalized.length} report document(s) uploaded successfully`,
        });
      }
    }

    const formData = await request.formData();
    const suburb = formData.get('suburb') as string;
    const quarter = formData.get('quarter') as string;
    const yearRaw = formData.get('year') as string;
    const year = parseInt(yearRaw, 10);

    // Support multiple files via the "files" field, with a parallel "labels" array (JSON).
    // Backward compatible with a single "file" field.
    const files = (formData.getAll('files') as File[]).filter(f => f && typeof f.name === 'string');
    const singleFile = formData.get('file') as File | null;
    if (singleFile && typeof singleFile.name === 'string') files.push(singleFile);

    let labels: string[] = [];
    const labelsRaw = formData.get('labels') as string | null;
    if (labelsRaw) {
      try {
        labels = JSON.parse(labelsRaw) as string[];
      } catch {
        labels = [];
      }
    }

    if (!suburb || !quarter || isNaN(year)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      );
    }

    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://r2.nzmarie.com').replace(/\/+$/, '');
    const folderKey = `reports/${suburb}/${quarter}-${year}`;
    const uploaded: Array<{ file_name: string; doc_label: string; file_url: string; file_size: number; report?: unknown }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: `Only PDF files are allowed (${file.name})` },
          { status: 400 }
        );
      }

      const docLabel = (labels[i] || '').trim() || 'Main Report';
      const buffer = Buffer.from(await file.arrayBuffer());
      const timestamp = Date.now();
      const key = `${folderKey}/${timestamp}-${sanitizeFileName(file.name)}`;

      console.log(`[Upload] Processing file ${i + 1}/${files.length}: ${file.name} → ${key}`);

      // Check if a file with the same suburb, quarter, year, and doc_label already exists
      // If so, delete the old R2 file before uploading the new one
      const existingResult = await marieDB.query(
        `SELECT file_url FROM suburb_reports WHERE suburb = $1 AND quarter = $2 AND year = $3 AND doc_label = $4`,
        [suburb, quarter, year, docLabel]
      );

      if (existingResult.rows.length > 0) {
        const oldFileUrl = existingResult.rows[0].file_url as string;
        if (oldFileUrl && oldFileUrl.startsWith(publicDomain)) {
          const oldKey = oldFileUrl.replace(`${publicDomain}/`, '');
          try {
            if (process.env.R2_BUCKET_NAME) {
              await r2.send(
                new DeleteObjectCommand({
                  Bucket: process.env.R2_BUCKET_NAME,
                  Key: oldKey,
                })
              );
              console.log(`[Upload] Deleted old R2 file: ${oldKey}`);
            }
          } catch (e) {
            console.error(`[Upload] Failed to delete old R2 object (${oldKey}):`, e);
          }
        }
      }

      if (process.env.R2_BUCKET_NAME) {
        console.log(`[Upload] Uploading to R2: ${key} (${buffer.length} bytes)`);
        await r2.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
            ContentDisposition: 'inline',
            CacheControl: 'public, max-age=31536000, immutable',
            Metadata: {
              'upload-timestamp': new Date().toISOString(),
            },
          })
        );
        console.log(`[Upload] Successfully uploaded to R2: ${key}`);
      }

      const fileUrl = `${publicDomain}/${key}`;

      const result = await marieDB.query(
        `INSERT INTO suburb_reports (suburb, quarter, year, doc_label, file_url, file_name, file_size, uploaded_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
         ON CONFLICT (suburb, quarter, year, doc_label)
         DO UPDATE SET
           file_url = $5,
           file_name = $6,
           file_size = $7,
           uploaded_at = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [suburb, quarter, year, docLabel, fileUrl, file.name || `${suburb}_${quarter}_${year}.pdf`, buffer.length, session.user.email]
      );

      console.log(`[Upload] DB record saved/updated for ${docLabel}: ${result.rows[0].id}`);

      uploaded.push({
        file_name: file.name,
        doc_label: docLabel,
        file_url: fileUrl,
        file_size: buffer.length,
        report: result.rows[0],
      });
    }

    return NextResponse.json({
      success: true,
      reports: uploaded,
      count: uploaded.length,
      message: `${uploaded.length} report document(s) uploaded successfully`,
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}

// Configuration for Vercel serverless function
export const config = {
  maxDuration: 60, // 60 seconds for upload processing
};
