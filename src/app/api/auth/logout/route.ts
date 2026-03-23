import { NextResponse } from "next/server";
import { applyClearSessionCookieToResponse } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  applyClearSessionCookieToResponse(res);
  return res;
}
