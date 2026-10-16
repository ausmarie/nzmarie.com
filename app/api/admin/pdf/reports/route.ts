import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();
  
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const suburb = searchParams.get('suburb');
  const status = searchParams.get('status') || 'active';

  let query = `
    SELECT
      id,
      suburb,
      quarter,
      year,
      doc_label,
      file_url,
      file_name,
      file_size,
      download_count,
      view_count,
      status,
      uploaded_by,
      uploaded_at,
      created_at
    FROM (
      SELECT *,
        MAX(uploaded_at) FILTER (WHERE doc_label = 'Main Report' OR doc_label IS NULL)
          OVER (PARTITION BY suburb) AS suburb_main_date
      FROM suburb_reports
      WHERE status = $1
  `;

  const params: unknown[] = [status];
  let paramIndex = 2;

  if (suburb) {
    query += ` AND suburb = $${paramIndex}`;
    params.push(suburb);
    paramIndex++;
  }

  query += `
    ) t
    ORDER BY suburb_main_date DESC NULLS LAST,
      suburb ASC,
      CASE WHEN doc_label = 'Main Report' OR doc_label IS NULL THEN 0
           WHEN doc_label = 'Letter' THEN 1
           WHEN doc_label = 'About Marie' THEN 2
           ELSE 3 END,
      uploaded_at DESC
  `;

  try {
    const result = await marieDB.query(query, params);

    return NextResponse.json({
      reports: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let id: string;
  try {
    const body = await request.json();
    id = body?.id;
  } catch {
    return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
  }

  try {
    const result = await marieDB.query(
      `SELECT file_url, suburb, quarter, year, doc_label FROM suburb_reports WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Delete from R2 BEFORE deleting from database to ensure it's cleaned up
    const fileUrl = row.file_url as string;
    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://r2.nzmarie.com').replace(/\/+$/, '');
    let r2DeleteSucceeded = false;

    if (fileUrl && fileUrl.startsWith(publicDomain)) {
      const key = fileUrl.slice(publicDomain.length + 1);
      try {
        const r2 = new S3Client({
          region: 'auto',
          endpoint: process.env.R2_ENDPOINT,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID || 'mock',
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'mock',
          },
        });

        const deleteResult = await r2.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
          })
        );

        // DeleteObjectCommand returns success even if file doesn't exist
        // So we just log it
        console.log(`Deleted R2 object: ${key}`, deleteResult);
        r2DeleteSucceeded = true;
      } catch (e) {
        console.error('Failed to delete R2 object:', e);
        // Continue with database deletion even if R2 deletion fails
      }
    }

    // Then delete from database
    await marieDB.query(`DELETE FROM suburb_reports WHERE id = $1`, [id]);

    console.log(`Report deleted - R2: ${r2DeleteSucceeded}, DB: true`, {
      id,
      suburb: row.suburb,
      quarter: row.quarter,
      year: row.year,
      doc_label: row.doc_label,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    );
  }
}
