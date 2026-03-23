import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { autoResolveDemoPendingForGame, autoResolvePendingForGame } from "@/lib/betResolve";
import { demoPlayCountFromPitchIndex, NP_DEMO_MODE_COOKIE } from "@/lib/demo-mode";
import {
  applyDemoReplayAdvanceIfDue,
  getDemoReplayState,
} from "@/lib/demo-replay-state";
import { loadDemoFeedAndTimeline } from "@/lib/demo-timeline";
import { getSession } from "@/lib/auth/session";
import { fetchLiveFeed } from "@/lib/mlb";
import { normalizeStoreData, readStore, writeStore } from "@/lib/store";

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

  const jar = await cookies();
  const demoMode = jar.get(NP_DEMO_MODE_COOKIE)?.value === "1";

  if (demoMode) {
    const store = normalizeStoreData(await readStore(session.userId));
    const { timeline } = await loadDemoFeedAndTimeline(gamePk);
    const maxIdx = Math.max(0, timeline.length - 1);
    const adv = applyDemoReplayAdvanceIfDue(store, gamePk, maxIdx);
    const pitchIndex = getDemoReplayState(store, gamePk).pitchIndex;
    const playCount = demoPlayCountFromPitchIndex(gamePk, pitchIndex);
    const { settled } = await autoResolveDemoPendingForGame(gamePk, store, playCount);
    if (adv.changed || settled.length > 0) {
      await writeStore(session.userId, store);
    }
    return NextResponse.json({
      ok: true,
      settledCount: settled.length,
      settledIds: settled.map((b) => b.id),
      balance: store.demoBalance ?? 1000,
    });
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
