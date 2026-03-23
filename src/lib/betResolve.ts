import { potentialPayout } from "@/lib/odds";
import {
  DEMO_GAME_PK,
  extractScoreboardFromFeed,
  fetchLiveFeed,
  getPlayCount,
  parseLastPitchFromFeed,
  randomDemoPitch,
  stablePitchSignature,
  scoreboardChanged,
  slipWins,
  type PitchOutcome,
} from "@/lib/mlb";
import type { StoredBet, StoreData } from "@/lib/store";

export type ResolveAttemptResult =
  | { ok: true; won: boolean; payout: number; outcome: PitchOutcome; bet: StoredBet }
  | { ok: false; code: "no_feed" | "no_new_pitch" | "no_pitch_parsed" };

/**
 * Core settlement: detect a *new* pitch vs the slip’s anchor.
 * We use (1) coarse pitch buckets, (2) play count, (3) inning/count snapshot.
 * Without (3), two real pitches can map to the same buckets — the UI looked “broken”.
 */
export async function tryResolveBet(
  bet: StoredBet,
  store: StoreData,
  forceDemo: boolean,
  options?: { feed?: unknown; wallet?: "live" | "demo" },
): Promise<ResolveAttemptResult> {
  if (bet.status !== "pending") {
    return { ok: false, code: "no_new_pitch" };
  }

  let outcome: PitchOutcome;

  if (bet.gamePk === DEMO_GAME_PK || forceDemo) {
    outcome = randomDemoPitch();
  } else {
    const feed = options?.feed ?? (await fetchLiveFeed(bet.gamePk));
    if (!feed) {
      return { ok: false, code: "no_feed" };
    }
    if (bet.status !== "pending") {
      return { ok: false, code: "no_new_pitch" };
    }
    const parsed = parseLastPitchFromFeed(feed);
    const sig = parsed ? stablePitchSignature(parsed) : null;
    const prev = bet.pitchSignatureAtBet ?? null;
    const noPitchParsedYet = !parsed;

    const pc = getPlayCount(feed);
    const playAdvanced = pc > (bet.playCountAtBet ?? 0);

    const currentBoard = extractScoreboardFromFeed(feed);
    const boardChanged =
      Boolean(currentBoard && bet.scoreboardAtBet) &&
      scoreboardChanged(currentBoard!, bet.scoreboardAtBet!);

    const signatureDiffers = sig !== null && sig !== prev;
    const newPitchDetected = signatureDiffers || playAdvanced || boardChanged;

    if (noPitchParsedYet) {
      // Feed loaded but no pitch rows parsed — do not fake a result; user can use Demo resolve.
      return { ok: false, code: "no_pitch_parsed" };
    }
    if (!newPitchDetected) {
      return { ok: false, code: "no_new_pitch" };
    }
    outcome = parsed;
  }

  const won = slipWins(bet.selections, outcome);
  const gross = potentialPayout(bet.stake, bet.offeredOdds);
  const payout = won ? gross : 0;

  bet.status = won ? "won" : "lost";
  bet.resolvedAt = new Date().toISOString();
  bet.outcome = {
    pitchType: outcome.pitchType,
    velocity: outcome.velocity,
    location: outcome.location,
    zoneCell: outcome.zoneCell,
    ...(outcome.battingResult != null
      ? { battingResult: outcome.battingResult }
      : {}),
    ...(outcome.speedMph != null ? { speedMph: outcome.speedMph } : {}),
  };
  bet.payout = payout;
  if (won) {
    const w = options?.wallet ?? "live";
    if (w === "demo") {
      if (store.demoBalance == null) store.demoBalance = 1000;
      store.demoBalance += payout;
    } else {
      store.balance += payout;
    }
  }

  return { ok: true, won, payout, outcome, bet };
}

/**
 * Demo-mode “live” sim: resolve when synthetic play count advances past the slip anchor.
 */
export async function tryResolveBetDemoSim(
  bet: StoredBet,
  store: StoreData,
  currentPlayCount: number,
): Promise<ResolveAttemptResult> {
  if (bet.status !== "pending") {
    return { ok: false, code: "no_new_pitch" };
  }
  if (currentPlayCount <= (bet.playCountAtBet ?? 0)) {
    return { ok: false, code: "no_new_pitch" };
  }
  const outcome = randomDemoPitch();
  const won = slipWins(bet.selections, outcome);
  const gross = potentialPayout(bet.stake, bet.offeredOdds);
  const payout = won ? gross : 0;
  bet.status = won ? "won" : "lost";
  bet.resolvedAt = new Date().toISOString();
  bet.outcome = {
    pitchType: outcome.pitchType,
    velocity: outcome.velocity,
    location: outcome.location,
    zoneCell: outcome.zoneCell,
    ...(outcome.battingResult != null
      ? { battingResult: outcome.battingResult }
      : {}),
    ...(outcome.speedMph != null ? { speedMph: outcome.speedMph } : {}),
  };
  bet.payout = payout;
  if (won) {
    if (store.demoBalance == null) store.demoBalance = 1000;
    store.demoBalance += payout;
  }
  return { ok: true, won, payout, outcome, bet };
}

/**
 * Auto-settle demo-wallet pending slips (FIFO) when sim play count advances.
 */
export async function autoResolveDemoPendingForGame(
  gamePk: number,
  store: StoreData,
  currentPlayCount: number,
): Promise<{ settled: StoredBet[] }> {
  const list = store.demoBets ?? [];
  const pending = list
    .filter((b) => b.gamePk === gamePk && b.status === "pending")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const settled: StoredBet[] = [];
  for (const bet of pending) {
    const r = await tryResolveBetDemoSim(bet, store, currentPlayCount);
    if (r.ok) settled.push(r.bet);
    else break;
  }
  return { settled };
}

/**
 * Auto-settle all pending slips for a real game (FIFO). Stops when the feed
 * shows no new pitch yet (same for every slip tied to this snapshot).
 */
export async function autoResolvePendingForGame(
  gamePk: number,
  store: StoreData,
  feed?: unknown | null,
): Promise<{ settled: StoredBet[] }> {
  if (gamePk === DEMO_GAME_PK) {
    return { settled: [] };
  }

  const pending = store.bets
    .filter((b) => b.gamePk === gamePk && b.status === "pending")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const settled: StoredBet[] = [];
  const feedOpt = feed != null ? { feed } : undefined;

  for (const bet of pending) {
    const r = await tryResolveBet(bet, store, false, feedOpt);
    if (r.ok) {
      settled.push(r.bet);
      continue;
    }
    if (
      r.code === "no_new_pitch" ||
      r.code === "no_feed" ||
      r.code === "no_pitch_parsed"
    ) {
      break;
    }
  }

  return { settled };
}
