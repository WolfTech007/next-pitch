import { NextResponse } from "next/server";
import { autoResolvePendingForGame } from "@/lib/betResolve";
import { getSession } from "@/lib/auth/session";
import { fetchLiveFeed } from "@/lib/mlb";
import { readStore, writeStore } from "@/lib/store";

/**
 * POST /api/resolve/auto
 * Body: { gamePk: number }
 * Tries to settle pending slips for this real game when the live feed shows a new pitch.
 * Called on a timer from the game page — no button required.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { gamePk?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const gamePk = Number(body.gamePk);
  if (!Number.isFinite(gamePk)) {
    return NextResponse.json({ error: "gamePk required" }, { status: 400 });
  }

  const [store, feed] = await Promise.all([
    readStore(session.userId),
    fetchLiveFeed(gamePk),
  ]);
  const { settled } = await autoResolvePendingForGame(gamePk, store, feed);
  if (settled.length > 0) {
    await writeStore(session.userId, store);
  }

  return NextResponse.json({
    ok: true,
    settledCount: settled.length,
    settledIds: settled.map((b) => b.id),
    balance: store.balance,
  });
}
