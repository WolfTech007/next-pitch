import { NextResponse } from "next/server";
import { autoResolveDemoPendingForGame, autoResolvePendingForGame } from "@/lib/betResolve";
import { demoPlayCountFromPitchIndex, resolveDemoModeForApi } from "@/lib/demo-mode";
import {
  applyDemoReplayAdvanceIfDue,
  getDemoReplayState,
} from "@/lib/demo-replay-state";
import { loadDemoFeedAndTimeline } from "@/lib/demo-timeline";
import {
  DEMO_GAME_PK,
  type LiveGameSummary,
  extractTeamAbbrevsFromFeed,
  extractTeamNamesFromBoxscore,
  extractTeamNamesFromFeed,
  extractTeamNamesFromLinescore,
  fetchBoxscore,
  fetchLinescore,
  fetchLiveFeed,
  getPlayCount,
  parseCurrentAtBatPitchesFromFeed,
  parseRecentPitchesFromFeed,
  parseSituation,
  parseSituationFromLinescore,
  randomDemoPitch,
} from "@/lib/mlb";
import { buildDemoModeGamePayload } from "@/lib/simulate-demo-game";
import { getSession } from "@/lib/auth/session";
import { normalizeStoreData, readStore, writeStore } from "@/lib/store";

type Params = { params: Promise<{ gamePk: string }> };

/** Never cache — board must track MLB as fast as polling allows. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function feedHasLinescore(feed: unknown): boolean {
  const f = feed as Record<string, unknown>;
  const ld = f?.liveData as Record<string, unknown> | undefined;
  return ld != null && ld.linescore != null;
}

function runsFromLinescore(ls: unknown): { away: number; home: number } {
  const L = ls as Record<string, unknown>;
  const teams = L?.teams as Record<string, unknown> | undefined;
  const ar = Number((teams?.away as Record<string, unknown> | undefined)?.runs ?? 0);
  const hr = Number((teams?.home as Record<string, unknown> | undefined)?.runs ?? 0);
  return {
    away: Number.isFinite(ar) ? ar : 0,
    home: Number.isFinite(hr) ? hr : 0,
  };
}

function abbrevFromBoxscore(box: unknown): { away: string | null; home: string | null } {
  const b = box as Record<string, unknown>;
  const teams = b?.teams as Record<string, unknown> | undefined;
  const awayT = (teams?.away as Record<string, unknown> | undefined)?.team as
    | Record<string, unknown>
    | undefined;
  const homeT = (teams?.home as Record<string, unknown> | undefined)?.team as
    | Record<string, unknown>
    | undefined;
  const away = typeof awayT?.abbreviation === "string" ? awayT.abbreviation : null;
  const home = typeof homeT?.abbreviation === "string" ? homeT.abbreviation : null;
  return { away, home };
}

/**
 * GET /api/game/[gamePk]
 * Returns scoreboard text + how many plays exist (for settlement).
 * Uses feed/live when rich; falls back to /linescore when the live feed is missing (common pre-game).
 */
export async function GET(_req: Request, segment: Params) {
  const { gamePk: raw } = await segment.params;
  const gamePk = Number(raw);

  if (gamePk === DEMO_GAME_PK) {
    const pitch = randomDemoPitch();
    return NextResponse.json({
      demo: false,
      settledCount: 0,
      situation: {
        gamePk,
        away: "Demo Away",
        home: "Demo Home",
        inning: 3,
        inningHalf: "top",
        outs: 1,
        balls: 2,
        strikes: 1,
        pitcherName: "Demo Pitcher",
        batterName: "Demo Batter",
        pitcherId: null,
        batterId: null,
        onFirst: true,
        onSecond: false,
        onThird: true,
      },
      playCount: 42,
      lastPitchPreview: pitch,
      score: { away: 0, home: 0 },
      teamAbbr: { away: "DEM", home: "DEM" },
      recentPitches: [],
      atBatPitches: [],
    });
  }

  const session = await getSession();
  const storeForDemo = session
    ? normalizeStoreData(await readStore(session.userId))
    : null;
  const { enabled: demoMode } = await resolveDemoModeForApi(_req, { store: storeForDemo });
  if (demoMode) {
    let pitchIndex = 0;
    let settledCount = 0;

    if (session) {
      const store = normalizeStoreData(await readStore(session.userId));
      const { timeline } = await loadDemoFeedAndTimeline(gamePk);
      if (!timeline.length) {
        return NextResponse.json(
          {
            error:
              "Could not load this game from MLB (feed/live). Try another game or turn off Demo mode.",
          },
          { status: 502 },
        );
      }
      const maxIdx = Math.max(0, timeline.length - 1);
      const adv = applyDemoReplayAdvanceIfDue(store, gamePk, maxIdx);
      pitchIndex = getDemoReplayState(store, gamePk).pitchIndex;
      const built = await buildDemoModeGamePayload(gamePk, pitchIndex);
      if (!built) {
        return NextResponse.json(
          {
            error:
              "Could not build demo game state. Try another game or turn off Demo mode.",
          },
          { status: 502 },
        );
      }
      const playCount = demoPlayCountFromPitchIndex(gamePk, pitchIndex);
      const { settled } = await autoResolveDemoPendingForGame(gamePk, store, playCount);
      settledCount = settled.length;
      if (adv.changed || settledCount > 0) {
        await writeStore(session.userId, store);
      }
      return NextResponse.json(
        {
          demo: false,
          situation: built.situation,
          playCount: built.playCount,
          feedSource: built.feedSource,
          settledCount,
          score: built.score,
          teamAbbr: built.teamAbbr,
          recentPitches: built.recentPitches,
          atBatPitches: built.atBatPitches,
          lastPitchPreview: built.lastPitchPreview,
        },
        {
          headers: {
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
          },
        },
      );
    }

    const built = await buildDemoModeGamePayload(gamePk, pitchIndex);
    if (!built) {
      return NextResponse.json(
        {
          error:
            "Could not load this game from MLB (linescore/boxscore). Try another game or turn off Demo mode.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        demo: false,
        situation: built.situation,
        playCount: built.playCount,
        feedSource: built.feedSource,
        settledCount,
        score: built.score,
        teamAbbr: built.teamAbbr,
        recentPitches: built.recentPitches,
        atBatPitches: built.atBatPitches,
        lastPitchPreview: built.lastPitchPreview,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      },
    );
  }

  const [feed, linescore] = await Promise.all([
    fetchLiveFeed(gamePk),
    fetchLinescore(gamePk),
  ]);

  const fromFeedEarly = feed ? extractTeamNamesFromFeed(feed) : { away: null, home: null };
  const abFromFeed = feed ? extractTeamAbbrevsFromFeed(feed) : { away: null, home: null };
  let boxscore: unknown | null = null;
  const needBoxscore =
    !feed ||
    !fromFeedEarly.away ||
    !fromFeedEarly.home ||
    !abFromFeed.away ||
    !abFromFeed.home;
  if (needBoxscore) {
    boxscore = await fetchBoxscore(gamePk);
  }

  if (!feed && !linescore) {
    return NextResponse.json(
      {
        error:
          "Could not load this game from MLB (no live feed or linescore). Try another game or Demo.",
      },
      { status: 502 },
    );
  }

  const summary: LiveGameSummary = {
    gamePk,
    away: "Away",
    home: "Home",
    status: "Live",
  };

  const fromFeed = fromFeedEarly;
  const fromBox = boxscore
    ? extractTeamNamesFromBoxscore(boxscore)
    : { away: null, home: null };
  const fromLs = linescore
    ? extractTeamNamesFromLinescore(linescore)
    : { away: null, home: null };
  // Linescore rarely has names; boxscore does when the live feed is thin or missing.
  summary.away = fromFeed.away ?? fromBox.away ?? fromLs.away ?? summary.away;
  summary.home = fromFeed.home ?? fromBox.home ?? fromLs.home ?? summary.home;

  let situation;
  let feedSource: "live_feed" | "linescore" = "live_feed";

  if (feed && feedHasLinescore(feed)) {
    situation = parseSituation(feed, summary);
  } else if (linescore) {
    situation = parseSituationFromLinescore(linescore, summary);
    feedSource = "linescore";
  } else if (feed) {
    situation = parseSituation(feed, summary);
  } else {
    return NextResponse.json(
      { error: "Could not parse game state from MLB." },
      { status: 502 },
    );
  }

  const playCount = feed ? getPlayCount(feed) : 0;

  const linescoreNode =
    feed && feedHasLinescore(feed)
      ? (feed as Record<string, unknown>)?.liveData != null
        ? ((feed as Record<string, unknown>).liveData as Record<string, unknown>)?.linescore
        : null
      : linescore;

  const runs = linescoreNode ? runsFromLinescore(linescoreNode) : { away: 0, home: 0 };
  const ab = boxscore ? abbrevFromBoxscore(boxscore) : { away: null, home: null };
  const awayAbbr =
    abFromFeed.away ??
    ab.away ??
    (situation.away.length >= 3 ? situation.away.slice(0, 3).toUpperCase() : situation.away.toUpperCase());
  const homeAbbr =
    abFromFeed.home ??
    ab.home ??
    (situation.home.length >= 3 ? situation.home.slice(0, 3).toUpperCase() : situation.home.toUpperCase());

  const recentPitches = feed ? parseRecentPitchesFromFeed(feed, 24) : [];
  const atBatPitches = feed ? parseCurrentAtBatPitchesFromFeed(feed) : [];

  let settledCount = 0;
  if (feed && gamePk !== DEMO_GAME_PK) {
    const session = await getSession();
    if (session) {
      const store = normalizeStoreData(await readStore(session.userId));
      const { settled } = await autoResolvePendingForGame(gamePk, store, feed);
      settledCount = settled.length;
      if (settledCount > 0) {
        await writeStore(session.userId, store);
      }
    }
  }

  return NextResponse.json(
    {
      demo: false,
      situation,
      playCount,
      feedSource,
      settledCount,
      score: runs,
      teamAbbr: { away: awayAbbr, home: homeAbbr },
      recentPitches,
      atBatPitches,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    },
  );
}
