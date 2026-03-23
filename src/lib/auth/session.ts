import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { NP_SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "./constants";
import { jwtSecretKey } from "./secret";

export type SessionPayload = {
  userId: string;
  email: string;
};

export async function signSessionToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC)
    .sign(jwtSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

/**
 * Parse session JWT from a raw Cookie header (Vercel/serverless sometimes omits cookies in
 * `cookies()` while the browser still sends the header).
 */
function parseSessionTokenFromCookieHeader(raw: string | null): string | null {
  if (!raw) return null;
  const prefix = `${NP_SESSION_COOKIE}=`;
  for (const part of raw.split(";")) {
    const s = part.trim();
    if (!s.startsWith(prefix)) continue;
    const v = s.slice(prefix.length);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
}

/** Server routes / RSC — read httpOnly cookie; merge raw Cookie header when jar is incomplete. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  let token = jar.get(NP_SESSION_COOKIE)?.value ?? null;
  if (!token) {
    token = parseSessionTokenFromCookieHeader((await headers()).get("cookie"));
  }
  if (!token) return null;
  return verifySessionToken(token);
}

/** Options shared by Route Handlers (NextResponse) and any future cookie writes. */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  path: string;
  maxAge: number;
  sameSite: "lax";
  secure: boolean;
} {
  return {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Prefer this in Route Handlers — attaching Set-Cookie to the returned `NextResponse`
 * is reliable on Vercel; `cookies().set()` alone can fail to persist the cookie on some hosts.
 */
export function applySessionCookieToResponse(response: NextResponse, token: string): void {
  response.cookies.set(NP_SESSION_COOKIE, token, sessionCookieOptions());
}

export function applyClearSessionCookieToResponse(response: NextResponse): void {
  response.cookies.set(NP_SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}
