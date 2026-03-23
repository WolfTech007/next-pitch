import { NextResponse } from "next/server";
import { readDemoModeFromCookies } from "@/lib/demo-mode";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore } from "@/lib/store";

/** Public — returns `user: null` when logged out (for header / home). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null, balance: null });
    }
    const store = normalizeStoreData(await readStore(session.userId));
    const { enabled: demoMode } = await readDemoModeFromCookies();
    const balance = demoMode ? store.demoBalance ?? 1000 : store.balance;
    return NextResponse.json({
      user: { id: session.userId, email: session.email },
      balance,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "auth/me failed", detail: msg },
      { status: 500 },
    );
  }
}
