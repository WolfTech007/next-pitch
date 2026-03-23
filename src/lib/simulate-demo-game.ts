import { loadDemoFeedAndTimeline } from "@/lib/demo-timeline";
import { demoPlayCountFromPitchIndex } from "@/lib/demo-mode";
import type { GameSituation, PitchOutcome, RecentPitchFeedRow } from "@/lib/mlb";
import {
  fetchBoxscore,
  scoreFromFeedAtPitchEvent,
  situationFromFeedAtPitchEvent,
} from "@/lib/mlb";

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
 * Demo-mode game payload: linear replay of real pitch order at `pitchIndex`
 * (advanced only after a bet + delay — see `demo-replay-state`).
 */
export async function buildDemoModeGamePayload(
  gamePk: number,
  pitchIndex: number,
): Promise<{
  situation: GameSituation;
  playCount: number;
  feedSource: "live_feed";
  score: { away: number; home: number };
  teamAbbr: { away: string; home: string };
  recentPitches: RecentPitchFeedRow[];
  atBatPitches: RecentPitchFeedRow[];
  lastPitchPreview: PitchOutcome;
} | null> {
  const [{ feed, timeline }, boxscore] = await Promise.all([
    loadDemoFeedAndTimeline(gamePk),
    fetchBoxscore(gamePk),
  ]);

  if (!feed || timeline.length === 0) {
    return null;
  }

  const idx = Math.min(Math.max(0, pitchIndex), timeline.length - 1);
  const cur = timeline[idx]!;

  const situation = situationFromFeedAtPitchEvent(
    feed,
    cur.playIndex,
    cur.eventIndex,
    gamePk,
  );
  if (!situation) {
    return null;
  }

  const score = scoreFromFeedAtPitchEvent(feed, cur.playIndex, cur.eventIndex);

  const recentPitches = timeline
    .slice(Math.max(0, idx - 7), idx + 1)
    .map((t) => t.row)
    .reverse();

  const samePa = timeline.filter((t, i) => t.playIndex === cur.playIndex && i <= idx);
  const atBatPitches = samePa.map((t) => t.row).reverse();

  const lastPitchPreview = cur.outcome;
  const playCount = demoPlayCountFromPitchIndex(gamePk, pitchIndex);

  const ab = boxscore ? abbrevFromBoxscore(boxscore) : { away: null, home: null };
  const awayAbbr = ab.away ?? situation.away.slice(0, 3).toUpperCase();
  const homeAbbr = ab.home ?? situation.home.slice(0, 3).toUpperCase();

  return {
    situation,
    playCount,
    feedSource: "live_feed",
    score,
    teamAbbr: { away: awayAbbr, home: homeAbbr },
    recentPitches,
    atBatPitches,
    lastPitchPreview,
  };
}
