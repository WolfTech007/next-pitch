import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { demoPlayCountFromPitchIndex, NP_DEMO_MODE_COOKIE } from "@/lib/demo-mode";
import {
  getDemoReplayState,
  scheduleDemoAdvanceAfterBet,
} from "@/lib/demo-replay-state";
import { quoteOdds } from "@/lib/odds";
import {
  isValidBattingResult,
  parseZonePick,
  slipLegCount,
  type SlipSelections,
} from "@/lib/markets";
import {
  DEMO_GAME_PK,
  extractScoreboardFromFeed,
  extractScoreboardFromLinescore,
  fetchLinescore,
  fetchLiveFeed,
  getPlayCount,
  parseLastPitchFromFeed,
  stablePitchSignature,
  scoreboardChanged,
} from "@/lib/mlb";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore, writeStore, type ScoreboardSnapshot } from "@/lib/store";

const MIN_STAKE = 0.1;
const MAX_STAKE = 200;

function parseScoreboardBody(raw: unknown): ScoreboardSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Record<string, unknown>;
  const balls = Number(b.balls);
  const strikes = Number(b.strikes);
  const outs = Number(b.outs);
  const inning = Number(b.inning);
  if (![balls, strikes, outs, inning].every((n) => Number.isFinite(n))) return undefined;
  const halfRaw = String(b.inningHalf ?? "top").toLowerCase();
  const inningHalf: "top" | "bottom" = halfRaw.includes("bottom") ? "bottom" : "top";
  return { balls, strikes, outs, inning, inningHalf };
}

/**
 * POST /api/bet
 * Body: { gamePk, gameLabel, pitcherName?, batterName?, scoreboardAtBet?, selections, stake }
 * Rejects if MLB’s current count ≠ client count (a pitch already changed the board).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: {
    gamePk?: number;
    gameLabel?: string;
    pitcherName?: string;
    batterName?: string;
    scoreboardAtBet?: unknown;
    selections?: SlipSelections;
    stake?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const gamePk = Number(body.gamePk);
  const gameLabel = String(body.gameLabel ?? "Game");
  const pitcherNameAtBet =
    typeof body.pitcherName === "string" && body.pitcherName.trim()
      ? body.pitcherName.trim()
      : undefined;
  const batterNameAtBet =
    typeof body.batterName === "string" && body.batterName.trim()
      ? body.batterName.trim()
      : undefined;
  const rawSel = (body.selections ?? {}) as Record<string, unknown>;
  const selections: SlipSelections = {};
  if (rawSel.pitchType) selections.pitchType = rawSel.pitchType as SlipSelections["pitchType"];
  if (rawSel.velocity) selections.velocity = rawSel.velocity as SlipSelections["velocity"];
  const zp = parseZonePick(rawSel.zonePick);
  if (zp && rawSel.location != null && String(rawSel.location).trim() !== "") {
    return NextResponse.json(
      { error: "Use either strike-zone placement or legacy location — not both." },
      { status: 400 },
    );
  }
  if (zp) selections.zonePick = zp;
  else if (rawSel.location) selections.location = rawSel.location as SlipSelections["location"];
  if (rawSel.battingResult != null && String(rawSel.battingResult).trim() !== "") {
    const br = String(rawSel.battingResult);
    if (!isValidBattingResult(br)) {
      return NextResponse.json(
        { error: "Invalid Batting Result pick." },
        { status: 400 },
      );
    }
    selections.battingResult = br;
  }
  const stake = Number(body.stake);

  const pickCount = slipLegCount(selections);
  if (pickCount < 1 || pickCount > 3) {
    return NextResponse.json(
      { error: "Pick 1 to 3 categories." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE) {
    return NextResponse.json(
      { error: `Stake must be between $${MIN_STAKE} and $${MAX_STAKE}.` },
      { status: 400 },
    );
  }

  const store = normalizeStoreData(await readStore(session.userId));
  const jar = await cookies();
  const demoMode = jar.get(NP_DEMO_MODE_COOKIE)?.value === "1";

  const liveBal = store.balance;
  const demoBal = store.demoBalance ?? 1000;
  if (demoMode) {
    if (demoBal < stake) {
      return NextResponse.json({ error: "Insufficient fake balance." }, { status: 400 });
    }
  } else if (liveBal < stake) {
    return NextResponse.json({ error: "Insufficient fake balance." }, { status: 400 });
  }

  let playCountAtBet = 0;
  let pitchSignatureAtBet: string | null = null;
  let scoreboardAtBet: ScoreboardSnapshot | undefined;

  if (demoMode && gamePk !== DEMO_GAME_PK) {
    const clientBoard = parseScoreboardBody(body.scoreboardAtBet);
    if (!clientBoard) {
      return NextResponse.json(
        {
          error:
            "We need the current balls/strikes from the scoreboard. Refresh the game page, then submit before the next pitch.",
        },
        { status: 400 },
      );
    }
    scoreboardAtBet = clientBoard;
    const pitchIdx = getDemoReplayState(store, gamePk).pitchIndex;
    playCountAtBet = demoPlayCountFromPitchIndex(gamePk, pitchIdx);
    pitchSignatureAtBet = null;
  } else if (gamePk === DEMO_GAME_PK) {
    playCountAtBet = 0;
    pitchSignatureAtBet = null;
  } else {
    const [feed, linescore] = await Promise.all([
      fetchLiveFeed(gamePk),
      fetchLinescore(gamePk),
    ]);
    if (!feed && !linescore) {
      return NextResponse.json(
        {
          error:
            "Could not reach this game on MLB’s API (no live feed or linescore). Try Demo or another game.",
        },
        { status: 502 },
      );
    }

    const liveBoard: ScoreboardSnapshot | null =
      (feed ? extractScoreboardFromFeed(feed) : null) ??
      (linescore ? extractScoreboardFromLinescore(linescore) : null);

    const clientBoard = parseScoreboardBody(body.scoreboardAtBet);
    if (!clientBoard) {
      return NextResponse.json(
        {
          error:
            "We need the current balls/strikes from the scoreboard. Refresh the game page, then submit before the next pitch.",
        },
        { status: 400 },
      );
    }
    if (!liveBoard) {
      return NextResponse.json(
        {
          error:
            "Could not read inning/count from MLB. Try again in a few seconds.",
        },
        { status: 502 },
      );
    }

    // If the board changed vs what the UI sent, at least one pitch already finished.
    if (scoreboardChanged(liveBoard, clientBoard)) {
      return NextResponse.json(
        {
          error:
            "That pitch already happened — the count moved. Refresh the page and place your bet before the next pitch.",
        },
        { status: 409 },
      );
    }

    // Store the server snapshot (matches client after validation).
    scoreboardAtBet = liveBoard;

    if (feed) {
      playCountAtBet = getPlayCount(feed);
      const last = parseLastPitchFromFeed(feed);
      pitchSignatureAtBet = last ? stablePitchSignature(last) : null;
    } else {
      playCountAtBet = 0;
      pitchSignatureAtBet = null;
    }
  }

  const q = quoteOdds(selections);

  const id = randomUUID();
  const bet = {
    id,
    gamePk,
    gameLabel,
    ...(pitcherNameAtBet ? { pitcherNameAtBet } : {}),
    ...(batterNameAtBet ? { batterNameAtBet } : {}),
    selections: {
      pitchType: selections.pitchType,
      velocity: selections.velocity,
      location: selections.location,
      battingResult: selections.battingResult,
      zonePick: selections.zonePick,
    },
    stake,
    probability: q.probability,
    offeredOdds: q.offeredOdds,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    playCountAtBet,
    pitchSignatureAtBet,
    ...(scoreboardAtBet ? { scoreboardAtBet } : {}),
  };

  if (demoMode) {
    store.demoBalance = (store.demoBalance ?? 1000) - stake;
    store.demoBets = store.demoBets ?? [];
    store.demoBets.unshift(bet);
    store.demoDefaultUnitSize = stake;
    if (gamePk !== DEMO_GAME_PK) {
      scheduleDemoAdvanceAfterBet(store, gamePk);
    }
  } else {
    store.balance -= stake;
    store.bets.unshift(bet);
    store.defaultUnitSize = stake;
  }
  await writeStore(session.userId, store);

  const balOut = demoMode ? store.demoBalance! : store.balance;
  return NextResponse.json({ ok: true, bet, balance: balOut, quote: q });
}
