import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/permissions';
import { isUuid } from '@/lib/uuid';

export { isUuid };

export async function getBlogAdminEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  return email && isSuperAdmin(email) ? email : null;
}
