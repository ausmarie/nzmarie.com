import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdminPages = nextUrl.pathname.startsWith('/admin');
      const isOnLoginPage = nextUrl.pathname === '/admin/login';
      
      if (isOnAdminPages) {
        // If logged in and on login page, redirect to callbackUrl or dashboard
        if (isLoggedIn && isOnLoginPage) {
          const callbackUrl = nextUrl.searchParams.get('callbackUrl');
          const redirectUrl = callbackUrl || '/admin/dashboard';
          return Response.redirect(new URL(redirectUrl, nextUrl.origin));
        }
        
        // If not logged in and not on login page, don't allow access
        if (!isLoggedIn && !isOnLoginPage) {
          return false; // Will redirect to signIn page
        }
      }
      
      return true;
    },
    // JWT callback - adds role to token (no database queries here)
    async jwt({ token }) {
      // Role and adminId are added during signIn in auth.ts
      // This just passes them through
      return token;
    },
    // Session callback - adds role to session
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "super_admin" | "admin" | "viewer";
        session.user.adminId = token.adminId as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
