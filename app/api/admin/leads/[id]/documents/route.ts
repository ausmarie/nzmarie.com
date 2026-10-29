import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import {
  createPresignedUploadUrl,
  deleteFromR2,
  R2_PUBLIC_DOMAIN,
  uploadToR2,
} from '@/lib/r2-storage';

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

function isPdf(fileName: string, contentType?: string | null): boolean {
  return fileName.toLowerCase().endsWith('.pdf') || contentType === 'application/pdf';
}

function leadDocumentPrefix(leadId: string): string {
  return `leads/${leadId}/appraisal/`;
}

function isValidDocumentKey(leadId: string, key: string): boolean {
  const prefix = leadDocumentPrefix(leadId);
  if (!key.startsWith(prefix) || key.includes('..')) return false;
  const name = key.slice(prefix.length);
  return name.length > 0 && /^[a-zA-Z0-9._-]+$/.test(name);
}

function buildFileUrl(key: string): string {
  return `${R2_PUBLIC_DOMAIN.replace(/\/+$/, '')}/${key}`;
}

function normalizeFileName(value: unknown, fallback: string): string {
  const name = typeof value === 'string' ? value.trim() : '';
  return (name || fallback).slice(0, 255);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await marieDB.query(
      `SELECT * FROM lead_documents WHERE lead_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching lead documents:', error);
    return NextResponse.json({ error: 'Failed to fetch lead documents' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';

    // Direct-to-R2 upload flow. Vercel serverless functions reject request bodies
    // over ~4.5MB with a 413, so large PDFs are uploaded straight to R2 using a
    // short-lived presigned URL and only the small metadata payload hits this API.
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const action = String(body?.action || '');
      const bodyContentType = typeof body?.contentType === 'string' ? body.contentType : null;

      if (action === 'presign') {
        const fileName = normalizeFileName(body?.fileName, 'appraisal.pdf');
        const declaredSize = Number(body?.fileSize);

        if (!isPdf(fileName, bodyContentType)) {
          return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }

        if (Number.isFinite(declaredSize) && declaredSize > MAX_PDF_BYTES) {
          return NextResponse.json({ error: 'PDF must be 25MB or smaller' }, { status: 400 });
        }

        const leadResult = await marieDB.query(`SELECT id FROM leads WHERE id = $1`, [id]);
        if (leadResult.rows.length === 0) {
          return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const key = `${leadDocumentPrefix(id)}${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeFileName(fileName)}`;
        const uploadUrl = await createPresignedUploadUrl(key, 'application/pdf', 600);

        return NextResponse.json({
          success: true,
          uploadUrl,
          key,
          fileUrl: buildFileUrl(key),
        });
      }

      if (action === 'finalize') {
        const key = String(body?.key || '');
        const fileName = normalizeFileName(body?.fileName, key.split('/').pop() || 'appraisal.pdf');
        const fileSize = Number(body?.fileSize);

        if (!isValidDocumentKey(id, key)) {
          return NextResponse.json({ error: 'Invalid document key' }, { status: 400 });
        }

        if (!isPdf(fileName, bodyContentType)) {
          return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }

        if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_PDF_BYTES) {
          return NextResponse.json({ error: 'PDF must be 25MB or smaller' }, { status: 400 });
        }

        const leadResult = await marieDB.query(`SELECT id FROM leads WHERE id = $1`, [id]);
        if (leadResult.rows.length === 0) {
          return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        try {
          const result = await marieDB.query(
            `INSERT INTO lead_documents
              (lead_id, doc_type, file_name, file_key, file_url, file_size, mime_type, uploaded_by)
             VALUES ($1, 'appraisal_pdf', $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              id,
              fileName,
              key,
              buildFileUrl(key),
              fileSize,
              bodyContentType || 'application/pdf',
              session.user.email,
            ]
          );

          return NextResponse.json({ success: true, data: result.rows[0] });
        } catch (error) {
          await deleteFromR2(key).catch(() => {});
          throw error;
        }
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'PDF must be 25MB or smaller' }, { status: 400 });
    }

    const leadResult = await marieDB.query(`SELECT id FROM leads WHERE id = $1`, [id]);
    if (leadResult.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const fileName = file.name || 'appraisal.pdf';
    const key = `leads/${id}/appraisal/${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeFileName(fileName)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(key, buffer, 'application/pdf', 'public, max-age=31536000, immutable');

    const fileUrl = `${R2_PUBLIC_DOMAIN.replace(/\/+$/, '')}/${key}`;

    try {
      const result = await marieDB.query(
        `INSERT INTO lead_documents
          (lead_id, doc_type, file_name, file_key, file_url, file_size, mime_type, uploaded_by)
         VALUES ($1, 'appraisal_pdf', $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, fileName, key, fileUrl, buffer.length, file.type || 'application/pdf', session.user.email]
      );

      return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await deleteFromR2(key).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('Error uploading lead document:', error);
    return NextResponse.json({ error: 'Failed to upload lead document' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const documentResult = await marieDB.query(
      `SELECT id, file_key FROM lead_documents WHERE id = $1 AND lead_id = $2`,
      [documentId, id]
    );

    if (documentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const fileKey = documentResult.rows[0].file_key as string | null;
    if (fileKey) {
      await deleteFromR2(fileKey).catch((error) => {
        console.error('Failed to delete lead document from R2:', error);
      });
    }

    await marieDB.query(
      `DELETE FROM lead_documents WHERE id = $1 AND lead_id = $2`,
      [documentId, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead document:', error);
    return NextResponse.json({ error: 'Failed to delete lead document' }, { status: 500 });
  }
}
