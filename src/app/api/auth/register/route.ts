import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { applySessionCookieToResponse, signSessionToken } from "@/lib/auth/session";
import { createUser } from "@/lib/auth/users-registry";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const hash = await hashPassword(password);
    const user = await createUser(email, hash);
    const token = await signSessionToken(user.id, user.email);
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email },
    });
    applySessionCookieToResponse(res, token);
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Could not create account." },
      { status: 400 },
    );
  }
}
