import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockUploadToR2 = vi.hoisted(() => vi.fn());
const mockDeleteFromR2 = vi.hoisted(() => vi.fn());
const mockCreatePresignedUploadUrl = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: mockQuery,
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'admin@example.com' } }),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock('@/lib/r2-storage', () => ({
  R2_PUBLIC_DOMAIN: 'https://reports.nzmarie.com',
  uploadToR2: mockUploadToR2,
  deleteFromR2: mockDeleteFromR2,
  createPresignedUploadUrl: mockCreatePresignedUploadUrl,
}));

import { DELETE, POST } from '../../../app/api/admin/leads/[id]/documents/route';

const leadId = 'lead-1';

function makeUploadRequest(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const request = new Request(`http://localhost:3000/api/admin/leads/${leadId}/documents`, {
    method: 'POST',
  });
  (request as Request & { formData: () => Promise<FormData> }).formData = async () => formData;
  return request;
}

describe('lead appraisal PDF documents API', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockUploadToR2.mockReset();
    mockDeleteFromR2.mockReset();
    mockCreatePresignedUploadUrl.mockReset();
    mockUploadToR2.mockResolvedValue(undefined);
    mockDeleteFromR2.mockResolvedValue(undefined);
    mockCreatePresignedUploadUrl.mockResolvedValue('https://r2.example.com/presigned');
  });

  function makeJsonRequest(body: unknown) {
    return new Request(`http://localhost:3000/api/admin/leads/${leadId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns a presigned R2 upload URL for large PDFs', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: leadId }] });

    const response = await POST(
      makeJsonRequest({
        action: 'presign',
        fileName: 'big appraisal.pdf',
        fileSize: 10 * 1024 * 1024,
        contentType: 'application/pdf',
      }),
      { params: Promise.resolve({ id: leadId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.uploadUrl).toBe('https://r2.example.com/presigned');
    expect(body.key).toMatch(/^leads\/lead-1\/appraisal\/\d+-[a-f0-9]{8}-big_appraisal\.pdf$/);
    expect(mockCreatePresignedUploadUrl).toHaveBeenCalledTimes(1);
    expect(mockUploadToR2).not.toHaveBeenCalled();
  });

  it('finalizes a direct R2 upload by storing document metadata', async () => {
    const document = {
      id: 'document-2',
      lead_id: leadId,
      doc_type: 'appraisal_pdf',
      file_name: 'big appraisal.pdf',
      file_key: 'leads/lead-1/appraisal/123-abcdef12-big_appraisal.pdf',
      file_url: 'https://reports.nzmarie.com/leads/lead-1/appraisal/123-abcdef12-big_appraisal.pdf',
      file_size: 10 * 1024 * 1024,
      mime_type: 'application/pdf',
      created_at: '2026-10-24T00:00:00.000Z',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: leadId }] })
      .mockResolvedValueOnce({ rows: [document] });

    const response = await POST(
      makeJsonRequest({
        action: 'finalize',
        key: document.file_key,
        fileName: document.file_name,
        fileSize: document.file_size,
        contentType: 'application/pdf',
      }),
      { params: Promise.resolve({ id: leadId }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.file_name).toBe('big appraisal.pdf');
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO lead_documents');
    expect(mockUploadToR2).not.toHaveBeenCalled();
  });

  it('rejects finalize requests for keys outside the lead folder', async () => {
    const response = await POST(
      makeJsonRequest({
        action: 'finalize',
        key: 'leads/other-lead/appraisal/123-evil.pdf',
        fileName: 'evil.pdf',
        fileSize: 1024,
        contentType: 'application/pdf',
      }),
      { params: Promise.resolve({ id: leadId }) }
    );

    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('uploads a PDF to R2 and stores its lead document metadata', async () => {
    const document = {
      id: 'document-1',
      lead_id: leadId,
      doc_type: 'appraisal_pdf',
      file_name: 'appraisal.pdf',
      file_key: 'leads/lead-1/appraisal/key-appraisal.pdf',
      file_url: 'https://reports.nzmarie.com/leads/lead-1/appraisal/key-appraisal.pdf',
      file_size: 4,
      mime_type: 'application/pdf',
      created_at: '2026-10-24T00:00:00.000Z',
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: leadId }] })
      .mockResolvedValueOnce({ rows: [document] });

    const file = new File([new Uint8Array([37, 80, 68, 70])], 'appraisal.pdf', {
      type: 'application/pdf',
    });
    const response = await POST(makeUploadRequest(file), { params: Promise.resolve({ id: leadId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.file_name).toBe('appraisal.pdf');
    expect(mockUploadToR2).toHaveBeenCalledTimes(1);
    expect(mockUploadToR2.mock.calls[0][0]).toMatch(
      /^leads\/lead-1\/appraisal\/\d+-[a-f0-9]{8}-appraisal\.pdf$/
    );
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO lead_documents');
  });

  it('rejects non-PDF uploads', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'notes.txt', { type: 'text/plain' });
    const response = await POST(makeUploadRequest(file), { params: Promise.resolve({ id: leadId }) });

    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockUploadToR2).not.toHaveBeenCalled();
  });

  it('deletes the R2 object and database row', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'document-1', file_key: 'leads/lead-1/appraisal/old.pdf' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const request = new Request(
      `http://localhost:3000/api/admin/leads/${leadId}/documents?documentId=document-1`,
      { method: 'DELETE' }
    );
    const response = await DELETE(request, { params: Promise.resolve({ id: leadId }) });

    expect(response.status).toBe(200);
    expect(mockDeleteFromR2).toHaveBeenCalledWith('leads/lead-1/appraisal/old.pdf');
    expect(mockQuery.mock.calls[1][0]).toContain('DELETE FROM lead_documents');
  });
});
