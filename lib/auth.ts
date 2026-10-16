import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { query } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Override signIn to add database checks
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const result = await query<{ id: string; role: string; is_active: boolean }>(
        `SELECT id, role, is_active FROM admin_users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        console.warn(`Login rejected: ${email}`);
        return false;
      }

      await query(
        `UPDATE admin_users 
         SET last_login_at = NOW(), 
             login_count = login_count + 1,
             google_id = $1,
             name = $2,
             avatar_url = $3
         WHERE email = $4`,
        [user.id, user.name ?? null, user.image ?? null, email]
      );

      return true;
    },
    // Override jwt to add role from database
    async jwt({ token, user }) {
      if (user?.email) {
        const result = await query<{ id: string; role: string }>(
          `SELECT id, role FROM admin_users WHERE email = $1`,
          [user.email.toLowerCase()]
        );
        if (result.rows.length > 0) {
          token.role = result.rows[0].role;
          token.adminId = result.rows[0].id;
        }
      }
      return token;
    },
    // session callback is inherited from authConfig
  },
});

export function hasPermission(
  userRole: string | undefined,
  requiredRole: "super_admin" | "admin" | "viewer"
): boolean {
  const roleHierarchy: Record<string, number> = {
    super_admin: 3,
    admin: 2,
    viewer: 1,
  };
  const userLevel = roleHierarchy[userRole ?? ""] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole];
  return userLevel >= requiredLevel;
}
