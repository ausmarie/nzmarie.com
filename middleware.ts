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
  const { pathname } = request.nextUrl;
  const publicMarketReportPath = /^\/market-reports\/([^/]+)(\/cn)?$/i.exec(pathname);
  const requestedLanguage = request.nextUrl.searchParams.get('lang');
  if (publicMarketReportPath && requestedLanguage && requestedLanguage !== 'en' && requestedLanguage !== 'zh') {
    return new NextResponse(null, { status: 404 });
  }
  if (publicMarketReportPath && (
    publicMarketReportPath[1] !== publicMarketReportPath[1].toLowerCase()
    || requestedLanguage !== null
  )) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(publicMarketReportPath[1], publicMarketReportPath[1].toLowerCase());
    if (requestedLanguage === 'zh' && !publicMarketReportPath[2]) {
      url.pathname = `${url.pathname}/cn`;
    }
    url.searchParams.delete('lang');
    return NextResponse.redirect(url, 301);
  }

  const sessionValue =
    SESSION_COOKIE_NAMES.map((name) => request.cookies.get(name)?.value).find((v) => !!v) ?? '';

  const isLoggedIn = !!sessionValue && looksLikeSessionToken(sessionValue);
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
  matcher: ['/admin/:path*', '/market-reports/:path*'],
};