import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readStore } from "@/lib/store";

/**
 * GET /api/bets
 * Returns fake balance + recent bet slips for the history panel.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const store = await readStore(session.userId);
  return NextResponse.json({
    balance: store.balance,
    defaultUnitSize: store.defaultUnitSize,
    bets: store.bets.slice(0, 50),
  });
}
