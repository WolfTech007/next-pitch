import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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

/** Server routes / RSC — read httpOnly cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(NP_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(NP_SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(NP_SESSION_COOKIE);
}
