import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/permissions';

export { isUuid } from '@/lib/uuid';

export async function getMarketReportAdminEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  return email && isSuperAdmin(email) ? email : null;
}
