import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

function looksLikeSessionToken(value: string): boolean {
  return value.split('.').length >= 3;
}

export function middleware(request: NextRequest) {
  const sessionValue =
    SESSION_COOKIE_NAMES.map((name) => request.cookies.get(name)?.value).find((v) => !!v) ?? '';

  const isLoggedIn = !!sessionValue && looksLikeSessionToken(sessionValue);
  const { pathname } = request.nextUrl;
  const isOnAdminPages = pathname.startsWith('/admin');
  const isOnLoginPage = pathname === '/admin/login';

  if (isOnAdminPages) {
    if (isLoggedIn && isOnLoginPage) {
      const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
      return NextResponse.redirect(new URL(callbackUrl || '/admin/dashboard', request.url));
    }

    if (!isLoggedIn && !isOnLoginPage) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};