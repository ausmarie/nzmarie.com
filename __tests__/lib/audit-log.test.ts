import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAdminAction } from '../../lib/audit-log';

const mockQuery = vi.fn();

vi.mock('../../lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

describe('logAdminAction', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('inserts audit data with fallback values', async () => {
    await logAdminAction({
      adminId: 'admin-1',
      action: 'update',
      resourceType: 'report',
      resourceId: 'report-1',
      details: { note: 'ok' },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(mockQuery).toHaveBeenCalled();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO admin_audit_logs');
    expect(params[0]).toBe('admin-1');
    expect(params[1]).toBe('update');
    expect(params[3]).toBe('report-1');
    expect(params[4]).toBe('{"note":"ok"}');
  });

  it('handles database errors without throwing', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    await expect(logAdminAction({ adminId: 'admin-2', action: 'delete' })).resolves.toBeUndefined();
  });
});
