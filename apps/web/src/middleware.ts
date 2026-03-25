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
  '/',
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

  // Allow static files and non-page prefixes
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.includes('.')) return NextResponse.next();

  const sessionCookie = request.cookies.get('session');
  const refreshCookie = request.cookies.get('refresh');
  const isAuthenticated = !!(sessionCookie?.value || refreshCookie?.value);

  // Redirect authenticated users away from login/signup pages
  if (isAuthenticated && PUBLIC_PATHS.includes(pathname)) {
    const isAdminLogin = pathname === '/admin/login';
    return NextResponse.redirect(new URL(isAdminLogin ? '/admin' : '/dashboard', request.url));
  }

  // Allow public paths for unauthenticated users
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  // No tokens at all → redirect to login
  if (!isAuthenticated) {
    const isAdminRoute = pathname.startsWith('/admin');
    const loginUrl = new URL(isAdminRoute ? '/admin/login' : '/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection — decode JWT payload (no verification at edge, API handles that)
  if (pathname.startsWith('/admin')) {
    if (!sessionCookie?.value) {
      // Only have refresh token — let client-side refresh handle role check
      return NextResponse.next();
    }
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
