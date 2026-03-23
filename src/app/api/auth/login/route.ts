import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, signSessionToken } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users-registry";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const token = await signSessionToken(user.id, user.email);
  await setSessionCookie(token);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  });
}
