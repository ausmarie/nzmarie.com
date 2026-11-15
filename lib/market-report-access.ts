import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/permissions';

export async function getMarketReportAdminEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  return email && isSuperAdmin(email) ? email : null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
