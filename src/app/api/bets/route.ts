import { NextResponse } from "next/server";
import { resolveDemoModeForApi } from "@/lib/demo-mode";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore } from "@/lib/store";

/**
 * GET /api/bets
 * Returns fake balance + recent bet slips for the history panel.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const store = normalizeStoreData(await readStore(session.userId));
  const { enabled: demoMode } = await resolveDemoModeForApi(req, { store });

  // IMPORTANT: Demo wallet/history is only surfaced when the user is truly
  // in demo-mode games. For real MLB games we always return the live wallet
  // and live bet list so settlement works correctly.
  if (demoMode) {
    return NextResponse.json({
      balance: store.demoBalance ?? 1000,
      defaultUnitSize: store.demoDefaultUnitSize ?? store.defaultUnitSize,
      bets: (store.demoBets ?? []).slice(0, 50),
    });
  }
  return NextResponse.json({
    balance: store.balance,
    defaultUnitSize: store.defaultUnitSize,
    bets: store.bets.slice(0, 50),
  });
}
