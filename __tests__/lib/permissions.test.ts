import { describe, expect, it } from 'vitest';
import { getUserInfo, getUserRole, isAdmin, isSuperAdmin, UserRole } from '@/lib/permissions';

describe('admin email permissions', () => {
  it('matches authorized account emails without case or surrounding-whitespace sensitivity', () => {
    const email = ' NZLOUIS.COM@GMAIL.COM ';

    expect(isAdmin(email)).toBe(true);
    expect(isSuperAdmin(email)).toBe(true);
    expect(getUserRole(email)).toBe(UserRole.SUPER_ADMIN);
    expect(getUserInfo(email).name).toBe('Louis');
  });

  it('continues to reject accounts that are not on the admin allowlist', () => {
    expect(isAdmin('someone@example.com')).toBe(false);
    expect(isSuperAdmin('someone@example.com')).toBe(false);
    expect(getUserRole('someone@example.com')).toBeNull();
  });
});
