import { NextResponse } from "next/server";
import { resolveDemoModeForApi } from "@/lib/demo-mode";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore } from "@/lib/store";

/** Public — returns `user: null` when logged out (for header / home). */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null, balance: null });
    }
    const store = normalizeStoreData(await readStore(session.userId));
    const { enabled: demoMode } = await resolveDemoModeForApi(req);
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
