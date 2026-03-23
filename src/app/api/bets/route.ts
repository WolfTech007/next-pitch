import { NextResponse } from "next/server";
import { readDemoModeFromCookies } from "@/lib/demo-mode";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore } from "@/lib/store";

/**
 * GET /api/bets
 * Returns fake balance + recent bet slips for the history panel.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const store = normalizeStoreData(await readStore(session.userId));
  const { enabled: demoMode } = await readDemoModeFromCookies();
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
