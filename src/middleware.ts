import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NP_SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Middleware runs in Edge Runtime — jose can cause issues there.
 * We only check for cookie presence; route handlers verify the JWT via getSession().
 */
function hasSessionCookie(request: NextRequest): boolean {
  const token = request.cookies.get(NP_SESSION_COOKIE)?.value;
  return Boolean(token && token.length > 0);
}

export async function middleware(request: NextRequest) {
  const ok = hasSessionCookie(request);
  const { pathname } = request.nextUrl;

  if (ok) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/game/:path*",
    "/api/bet",
    "/api/bets",
    "/api/game/:path*",
    "/api/resolve",
    "/api/resolve/auto",
  ],
};
