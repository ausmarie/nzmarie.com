import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdmin: vi.fn(),
  uploadToR2: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/permissions', () => ({ isAdmin: mocks.isAdmin }));
vi.mock('@/lib/r2-storage', () => ({
  R2_PUBLIC_DOMAIN: 'https://reports.example.com/',
  uploadToR2: mocks.uploadToR2,
}));

import { POST } from '../../../app/api/admin/reports/upload-image/route';

type MockFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function makeFile(overrides: Partial<MockFile> = {}): MockFile {
  return {
    name: 'pasted-image.png',
    type: 'image/png',
    size: 4,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    ...overrides,
  };
}

function makeRequest(file: MockFile | null, docId: string | null = 'doc-1'): Request {
  const entries = new Map<string, unknown>();
  if (file) entries.set('file', file);
  if (docId !== null) entries.set('doc_id', docId);

  const request = new Request('http://localhost/api/admin/reports/upload-image', {
    method: 'POST',
  });
  (request as unknown as { formData: () => Promise<FormData> }).formData = async () =>
    ({ get: (key: string) => entries.get(key) ?? null }) as unknown as FormData;
  return request;
}

describe('POST /api/admin/reports/upload-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { email: 'nzmarie.com@gmail.com' } });
    mocks.isAdmin.mockReturnValue(true);
    mocks.uploadToR2.mockImplementation(async (key: string) => key);
  });

  it('uploads an image and returns its R2 public URL', async () => {
    const response = await POST(makeRequest(makeFile()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.key).toMatch(/^reports\/images\/doc-1\/[0-9a-f-]+\.png$/);
    expect(body.url).toBe(`https://reports.example.com/${body.key}`);
    expect(mocks.uploadToR2).toHaveBeenCalledWith(
      body.key,
      expect.any(Buffer),
      'image/png',
      'public, max-age=31536000, immutable'
    );
  });

  it('sanitizes the document id before building the R2 key', async () => {
    const response = await POST(makeRequest(makeFile(), '../../unsafe id'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.key).toMatch(/^reports\/images\/unsafeid\/[0-9a-f-]+\.png$/);
    expect(body.key).not.toContain('..');
  });

  it('rejects unsupported image types', async () => {
    const response = await POST(makeRequest(makeFile({ name: 'note.txt', type: 'text/plain' })));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid file type');
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects images larger than 5MB', async () => {
    const response = await POST(makeRequest(makeFile({ size: 5 * 1024 * 1024 + 1 })));

    expect(response.status).toBe(400);
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await POST(makeRequest(makeFile()));

    expect(response.status).toBe(403);
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
  });
});
