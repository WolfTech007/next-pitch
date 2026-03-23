import { simulatedPlayCount } from "@/lib/demo-mode";
import type {
  GameSituation,
  LiveGameSummary,
  PitchCountResult,
  PitchOutcome,
  RecentPitchFeedRow,
} from "@/lib/mlb";
import {
  fetchBoxscore,
  fetchLinescore,
  parseSituationFromLinescore,
  randomDemoPitch,
} from "@/lib/mlb";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countResultFromPitch(o: PitchOutcome): PitchCountResult {
  const br = o.battingResult;
  if (br === "Ball") return "ball";
  if (br === "Strike") return "strike";
  if (br === "Foul") return "foul";
  return "other";
}

function outcomeToPitchRow(id: string, o: PitchOutcome, plotX: number, plotY: number): RecentPitchFeedRow {
  return {
    id,
    pitchType: o.pitchType,
    speedMph: o.speedMph ?? null,
    callText: `${o.pitchType} · ${o.location}`,
    zone: o.zoneCell,
    plotX,
    plotY,
    countResult: countResultFromPitch(o),
  };
}

function plotFromZone(o: PitchOutcome): { x: number; y: number } {
  const z = o.zoneCell;
  if (z != null && z >= 1 && z <= 9) {
    const col = (z - 1) % 3;
    const row = Math.floor((z - 1) / 3);
    const SZ = { x: 24, y: 14, w: 52, h: 70 };
    const cw = SZ.w / 3;
    const ch = SZ.h / 3;
    return {
      x: SZ.x + col * cw + cw / 2 + (Math.random() - 0.5) * 4,
      y: SZ.y + row * ch + ch / 2 + (Math.random() - 0.5) * 4,
    };
  }
  return { x: 18 + Math.random() * 64, y: 12 + Math.random() * 76 };
}

/**
 * Builds a “live” game payload using real MLB team names + boxscore IDs, with
 * simulated counts and pitch history so the UI matches normal live mode.
 */
export async function buildDemoModeGamePayload(gamePk: number): Promise<{
  situation: GameSituation;
  playCount: number;
  feedSource: "live_feed";
  score: { away: number; home: number };
  teamAbbr: { away: string; home: string };
  recentPitches: RecentPitchFeedRow[];
  atBatPitches: RecentPitchFeedRow[];
  lastPitchPreview: PitchOutcome;
} | null> {
  const [linescore, boxscore] = await Promise.all([
    fetchLinescore(gamePk),
    fetchBoxscore(gamePk),
  ]);
  if (!linescore) return null;

  const summary: LiveGameSummary = {
    gamePk,
    away: "Away",
    home: "Home",
    status: "Live",
  };

  const fromLs = linescore as Record<string, unknown>;
  const teams = fromLs?.teams as Record<string, unknown> | undefined;
  const awayT = teams?.away as Record<string, unknown> | undefined;
  const homeT = teams?.home as Record<string, unknown> | undefined;
  const away = (awayT?.team as Record<string, unknown> | undefined)?.name as string | undefined;
  const home = (homeT?.team as Record<string, unknown> | undefined)?.name as string | undefined;
  if (away) summary.away = away;
  if (home) summary.home = home;

  let situation = parseSituationFromLinescore(linescore, summary);

  const tick = Math.floor(Date.now() / 2800);
  const rng = mulberry32(gamePk * 7919 + tick * 104729);

  situation.inning = Math.max(1, Math.min(9, Math.floor(rng() * 9) + 1));
  situation.inningHalf = rng() > 0.5 ? "bottom" : "top";
  situation.outs = Math.min(2, Math.floor(rng() * 3));
  situation.balls = Math.min(3, Math.floor(rng() * 4));
  situation.strikes = Math.min(2, Math.floor(rng() * 3));
  situation.onFirst = rng() > 0.72;
  situation.onSecond = rng() > 0.82;
  situation.onThird = rng() > 0.9;

  const runs = (() => {
    const L = linescore as Record<string, unknown>;
    const T = L?.teams as Record<string, unknown> | undefined;
    const ar = Number((T?.away as Record<string, unknown> | undefined)?.runs ?? 0);
    const hr = Number((T?.home as Record<string, unknown> | undefined)?.runs ?? 0);
    return {
      away: Number.isFinite(ar) ? ar : 0,
      home: Number.isFinite(hr) ? hr : 0,
    };
  })();

  const abbr = (() => {
    const b = boxscore as Record<string, unknown> | undefined;
    const teams = b?.teams as Record<string, unknown> | undefined;
    const awayT = (teams?.away as Record<string, unknown> | undefined)?.team as
      | Record<string, unknown>
      | undefined;
    const homeT = (teams?.home as Record<string, unknown> | undefined)?.team as
      | Record<string, unknown>
      | undefined;
    const away = typeof awayT?.abbreviation === "string" ? awayT.abbreviation : null;
    const home = typeof homeT?.abbreviation === "string" ? homeT.abbreviation : null;
    return {
      away: away ?? situation.away.slice(0, 3).toUpperCase(),
      home: home ?? situation.home.slice(0, 3).toUpperCase(),
    };
  })();

  const lastPitchPreview = randomDemoPitch();
  const recentPitches: RecentPitchFeedRow[] = [];
  for (let i = 0; i < 8; i++) {
    const o = i === 0 ? lastPitchPreview : randomDemoPitch();
    const { x, y } = plotFromZone(o);
    recentPitches.push(outcomeToPitchRow(`sim-${gamePk}-${tick}-${i}`, o, x, y));
  }
  const atBatPitches = recentPitches.slice(0, 4);

  const playCount = simulatedPlayCount(gamePk);

  return {
    situation,
    playCount,
    feedSource: "live_feed",
    score: runs,
    teamAbbr: abbr,
    recentPitches,
    atBatPitches,
    lastPitchPreview,
  };
}
