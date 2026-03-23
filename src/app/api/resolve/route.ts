import { NextResponse } from "next/server";
import { tryResolveBet } from "@/lib/betResolve";
import { getSession } from "@/lib/auth/session";
import { readStore, writeStore } from "@/lib/store";

/**
 * POST /api/resolve
 * Body: { betId: string, forceDemo?: boolean }
 * Settles a single pending bet (manual buttons in bet history).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { betId?: string; forceDemo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const betId = String(body.betId ?? "");
  const forceDemo = Boolean(body.forceDemo);
  if (!betId) {
    return NextResponse.json({ error: "betId required" }, { status: 400 });
  }

  const store = await readStore(session.userId);
  const bet = store.bets.find((b) => b.id === betId);
  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }
  /**
   * Auto-resolve may have settled this slip while the UI still showed “pending”.
   * Treat as success so the client can refresh — not a user error.
   */
  if (bet.status !== "pending") {
    return NextResponse.json({
      ok: true,
      alreadySettled: true,
      bet,
      balance: store.balance,
    });
  }

  const result = await tryResolveBet(bet, store, forceDemo);

  if (!result.ok) {
    if (result.code === "no_feed") {
      return NextResponse.json(
        {
          error:
            "MLB’s live play-by-play feed isn’t available for this game yet. Use “Demo resolve” to settle your slip.",
        },
        { status: 502 },
      );
    }
    if (result.code === "no_pitch_parsed") {
      return NextResponse.json(
        {
          error:
            "The feed loaded but we couldn’t read pitch rows. Refresh and try again, or use Demo resolve.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        message:
          "No new pitch detected: same inning/count and same pitch buckets as when you bet. Wait for the next pitch, or use Demo resolve.",
      },
      { status: 409 },
    );
  }

  await writeStore(session.userId, store);

  return NextResponse.json({
    ok: true,
    won: result.won,
    outcome: result.outcome,
    payout: result.payout,
    balance: store.balance,
    bet: result.bet,
  });
}
