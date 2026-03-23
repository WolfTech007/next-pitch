import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readStore } from "@/lib/store";

/** Public — returns `user: null` when logged out (for header / home). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null, balance: null });
    }
    const store = await readStore(session.userId);
    return NextResponse.json({
      user: { id: session.userId, email: session.email },
      balance: store.balance,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "auth/me failed", detail: msg },
      { status: 500 },
    );
  }
}
