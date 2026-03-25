import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side route protection via Next.js Edge middleware.
 *
 * Checks for the `session` cookie (short-lived JWT access token).
 * If missing → redirect to login.
 * If present → allow through (the API will reject expired/invalid tokens).
 *
 * For the refresh flow: if the access token is expired but a refresh cookie
 * exists, the frontend API wrapper handles calling /api/auth/refresh
 * transparently.
 */

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/admin/login',
];

const PUBLIC_PREFIXES = [
  '/portal/',
  '/_next/',
  '/api/',
  '/favicon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Allow static files
  if (pathname.includes('.')) return NextResponse.next();

  const sessionCookie = request.cookies.get('session');

  // No access token at all → redirect to login
  if (!sessionCookie?.value) {
    // Check if there's a refresh token — if so, let the client-side handle refresh
    const refreshCookie = request.cookies.get('refresh');
    if (refreshCookie?.value) {
      // Allow through — the frontend will call /api/auth/refresh on 401
      return NextResponse.next();
    }

    const isAdminRoute = pathname.startsWith('/admin');
    const loginUrl = new URL(isAdminRoute ? '/admin/login' : '/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection — decode JWT payload (no verification at edge, API handles that)
  if (pathname.startsWith('/admin')) {
    try {
      const payload = JSON.parse(
        Buffer.from(sessionCookie.value.split('.')[1], 'base64').toString()
      );
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
