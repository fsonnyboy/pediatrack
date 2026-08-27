/**
 * SEC-007 fix: Server-side route protection.
 *
 * This middleware runs at the Next.js edge before any page is rendered.
 * It checks for the presence of the HttpOnly auth cookie (set by the API on
 * login) and redirects unauthenticated visitors to /login before React has
 * a chance to boot.
 *
 * Important: the cookie is HttpOnly so JavaScript cannot read it, but the
 * Next.js edge middleware CAN read it via the NextRequest cookies API.
 * We only check presence here — the JWT signature is validated by the API on
 * every data request; an expired or revoked token will return 401, which the
 * api-client.ts 401 handler converts into a redirect to /login.
 *
 * This two-layer approach means:
 *  - Unauthenticated users never see a dashboard flash before redirect.
 *  - The API remains the authoritative auth enforcer (single source of truth).
 *
 * Note: middleware deliberately does NOT redirect an already-authenticated
 * visitor away from /login, because "authenticated" here only means
 * "has a cookie" — not "has a valid one". Bouncing on presence alone caused
 * an infinite redirect loop whenever the cookie was stale (expired, revoked
 * by a logout/password-change elsewhere, etc.): the dashboard would detect
 * the invalid session and send the user to /login, middleware would see the
 * (still-present, still-invalid) cookie and bounce them back to /, which
 * redirects to /dashboard, which fails auth again — forever. The login page
 * itself handles the "already have a valid session" redirect, using the
 * validated /auth/me result instead of raw cookie presence.
 */

import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'peditrack_token';

/** Routes that do not require authentication. */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let Next.js internals and static assets through without any auth check.
  // The `matcher` config below also filters these, but being explicit is safer.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')   ||
    pathname.includes('.')         // static files (favicon.ico, images, etc.)
  ) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasAuthCookie = req.cookies.has(AUTH_COOKIE);

  // ── Unauthenticated visitor trying to reach a protected page ──────────
  if (!hasAuthCookie && !isPublicPath) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve the intended destination so we can redirect back after login.
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Run on every route EXCEPT:
   *  - Next.js internals (_next/static, _next/image, etc.)
   *  - The public favicon
   *
   * Adjust the negative lookahead when you add new public asset paths.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
