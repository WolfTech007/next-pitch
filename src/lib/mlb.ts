/**
 * MLB Stats API helpers — public JSON, no API key.
 * Docs: https://statsapi.mlb.com (same endpoints the MLB site uses).
 *
 * When something is missing (off-season, no feed, parsing fails),
 * the UI falls back to demo data so the prototype still works.
 */

import type {
  BattingResult,
  LocationBucket,
  PitchType,
  VelocityBucket,
  ZonePick,
} from "./markets";
import type { ScoreboardSnapshot } from "./store";

/** Schedule, boxscore, linescore — v1 is fine. */
const MLB = "https://statsapi.mlb.com/api/v1";
/**
 * Live play-by-play with pitch events — use v1.1. The v1 `.../feed/live` URL often 404s.
 * Same data MLB.com uses for Gameday.
 */
const MLB_V11 = "https://statsapi.mlb.com/api/v1.1";

/** Synthetic game used when there are no live MLB games (demo always works). */
export const DEMO_GAME_PK = 999999;

/**
 * MLB’s “day” follows US Eastern time, not UTC.
 * Using UTC for “today” often shows the wrong slate (or none) for US users.
 */
export function getEasternDateString(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return d.toISOString().slice(0, 10);
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Team label from a schedule game node (field names vary by endpoint). */
function teamNameFromSchedule(g: Record<string, unknown>, side: "away" | "home"): string {
  const t = g?.teams as Record<string, unknown> | undefined;
  const sideTeam = t?.[side] as Record<string, unknown> | undefined;
  const team = sideTeam?.team as Record<string, unknown> | undefined;
  return (
    (team?.name as string) ??
    (team?.teamName as string) ??
    (side === "away" ? "Away" : "Home")
  );
}

/**
 * True when the game is in progress or about to resume — not only abstract "Live".
 * MLB uses several different status fields across seasons.
 */
function isGameLiveLike(status: Record<string, unknown> | undefined): boolean {
  if (!status) return false;
  const abstract = String(status.abstractGameState ?? "");
  const coded = String(status.codedGameState ?? "");
  const detailed = String(status.detailedState ?? "").toLowerCase();
  if (abstract === "Live") return true;
  if (coded === "I") return true; // In progress
  if (
    detailed.includes("progress") ||
    detailed.includes("warmup") ||
    detailed.includes("warm-up") ||
    detailed.includes("delay") ||
    detailed.includes("suspended") ||
    detailed.includes("challenge") ||
    detailed.includes("umpire") ||
    detailed.includes("instant replay")
  ) {
    return true;
  }
  if (detailed === "live") return true;
  return false;
}

function isGameNotStarted(status: Record<string, unknown> | undefined): boolean {
  if (!status) return false;
  const abstract = String(status.abstractGameState ?? "");
  const coded = String(status.codedGameState ?? "");
  return abstract === "Preview" || coded === "P" || coded === "S";
}

/**
 * MLB nests the club under `teams.away.team` (and similar). Names live in `name`,
 * or `locationName` + `teamName`. The old code only read `teams.away.teamName`, which
 * is often missing — that produced literal "Away" / "Home".
 */
export function teamNameFromGameSide(
  side: Record<string, unknown> | undefined,
): string | null {
  if (!side) return null;
  const team = side.team as Record<string, unknown> | undefined;
  if (team) {
    const full = (team.name as string)?.trim();
    if (full) return full;
    const loc = (team.locationName as string)?.trim();
    const tn = (team.teamName as string)?.trim();
    if (loc && tn) return `${loc} ${tn}`;
    if (tn) return tn;
    if (loc) return loc;
  }
  const direct =
    (side.teamName as string)?.trim() ??
    (side.name as string)?.trim() ??
    (side.clubName as string)?.trim();
  return direct || null;
}

export function extractTeamNamesFromFeed(feed: unknown): {
  away: string | null;
  home: string | null;
} {
  const gd = (feed as Record<string, unknown>)?.gameData as Record<string, unknown> | undefined;
  const teams = gd?.teams as Record<string, unknown> | undefined;
  return {
    away: teamNameFromGameSide(teams?.away as Record<string, unknown> | undefined),
    home: teamNameFromGameSide(teams?.home as Record<string, unknown> | undefined),
  };
}

/** `gameData.teams.*.team.abbreviation` — avoids an extra `/boxscore` round trip during live play. */
export function extractTeamAbbrevsFromFeed(feed: unknown): {
  away: string | null;
  home: string | null;
} {
  const gd = (feed as Record<string, unknown>)?.gameData as Record<string, unknown> | undefined;
  const teams = gd?.teams as Record<string, unknown> | undefined;
  const sideAbbr = (side: Record<string, unknown> | undefined): string | null => {
    const team = side?.team as Record<string, unknown> | undefined;
    const a = team?.abbreviation;
    return typeof a === "string" && a.trim() ? a.trim() : null;
  };
  return {
    away: sideAbbr(teams?.away as Record<string, unknown> | undefined),
    home: sideAbbr(teams?.home as Record<string, unknown> | undefined),
  };
}

/**
 * NOTE: MLB’s `/linescore` “teams.away/home” nodes are mostly runs/hits — they usually
 * do NOT include `team: { name }`. Names almost always come from `feed/live` or `/boxscore`.
 */
export function extractTeamNamesFromLinescore(linescore: unknown): {
  away: string | null;
  home: string | null;
} {
  const L = linescore as Record<string, unknown>;
  const teams = L?.teams as Record<string, unknown> | undefined;
  return {
    away: teamNameFromGameSide(teams?.away as Record<string, unknown> | undefined),
    home: teamNameFromGameSide(teams?.home as Record<string, unknown> | undefined),
  };
}

/** https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore — includes full `teams.*.team.name`. */
export async function fetchBoxscore(gamePk: number): Promise<unknown | null> {
  if (gamePk === DEMO_GAME_PK) return null;
  const url = `${MLB}/game/${gamePk}/boxscore`;
  const res = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

export function extractTeamNamesFromBoxscore(boxscore: unknown): {
  away: string | null;
  home: string | null;
} {
  const b = boxscore as Record<string, unknown>;
  const teams = b?.teams as Record<string, unknown> | undefined;
  return {
    away: teamNameFromGameSide(teams?.away as Record<string, unknown> | undefined),
    home: teamNameFromGameSide(teams?.home as Record<string, unknown> | undefined),
  };
}

export type LiveGameSummary = {
  gamePk: number;
  away: string;
  home: string;
  status: string;
  detailedState?: string;
};

export type GameSituation = {
  gamePk: number;
  away: string;
  home: string;
  inning: number;
  inningHalf: "top" | "bottom";
  outs: number;
  balls: number;
  strikes: number;
  pitcherName: string;
  batterName: string;
  /** MLB StatsAPI person id — used for headshot URLs when present */
  pitcherId: number | null;
  batterId: number | null;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  /** Last known play id for “next pitch” anchoring */
  lastPlayId?: string;
};

function personIdFromNode(node: unknown): number | null {
  if (node == null || typeof node !== "object") return null;
  const id = Number((node as Record<string, unknown>).id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function baseOccupancyFromOffense(
  offense: Record<string, unknown> | undefined,
): { onFirst: boolean; onSecond: boolean; onThird: boolean } {
  return {
    onFirst: personIdFromNode(offense?.first) != null,
    onSecond: personIdFromNode(offense?.second) != null,
    onThird: personIdFromNode(offense?.third) != null,
  };
}

export type PitchOutcome = {
  pitchType: PitchType;
  velocity: VelocityBucket;
  location: LocationBucket;
  /** Hit / Ball / Strike / Foul, or null when BIP out / uncoded (no “Batting Result” leg wins). */
  battingResult: BattingResult | null;
  /** Statcast 1–9 in the 3×3 grid, or null if outside those cells / ball call (placement leg). */
  zoneCell: number | null;
  /** Statcast release speed (mph) — for display; settlement matching still uses `velocity` buckets. */
  speedMph?: number;
};

/** Anchor for “same pitch vs new pitch” — buckets only so mph doesn’t false-trigger resolves. */
export function stablePitchSignature(outcome: PitchOutcome): string {
  return JSON.stringify({
    pitchType: outcome.pitchType,
    velocity: outcome.velocity,
    location: outcome.location,
    br: outcome.battingResult,
    zc: outcome.zoneCell,
  });
}

/**
 * Fetch the day’s schedule (Eastern calendar date) and return games you can open.
 * 1) Prefer in-progress / delayed / warmup.
 * 2) If none, include pre-game games for that day so the list isn’t empty off-hours.
 * Skips finished games.
 */
export async function fetchTodaysGames(
  dateStr: string,
): Promise<LiveGameSummary[]> {
  const url = `${MLB}/schedule?sportId=1&date=${dateStr}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  const live: LiveGameSummary[] = [];
  const preview: LiveGameSummary[] = [];
  const dates = json.dates ?? [];
  for (const d of dates) {
    for (const g of d.games ?? []) {
      const status = g.status as Record<string, unknown> | undefined;
      const abstract = String(status?.abstractGameState ?? "");
      if (abstract === "Final") continue;

      const row = g as Record<string, unknown>;
      const detailed = String(status?.detailedState ?? "");
      const summary: LiveGameSummary = {
        gamePk: g.gamePk as number,
        away: teamNameFromSchedule(row, "away"),
        home: teamNameFromSchedule(row, "home"),
        status: detailed || abstract || "Scheduled",
        detailedState: detailed,
      };

      if (isGameLiveLike(status)) {
        live.push(summary);
      } else if (isGameNotStarted(status)) {
        preview.push({ ...summary, status: `Pre-game · ${summary.status}` });
      }
    }
  }
  if (live.length > 0) return live;
  return preview;
}

export type ScheduleGameMeta = {
  gamePk: number;
  awayName: string;
  homeName: string;
  awayTeamId: number;
  homeTeamId: number;
  status: string;
  detailedState: string;
  abstractGameState: string;
  awayRecord: { wins: number; losses: number } | null;
  homeRecord: { wins: number; losses: number } | null;
};

function leagueRecordFromSide(side: Record<string, unknown> | undefined): {
  wins: number;
  losses: number;
} | null {
  const lr = side?.leagueRecord as Record<string, unknown> | undefined;
  if (!lr) return null;
  const w = Number(lr.wins);
  const l = Number(lr.losses);
  if (!Number.isFinite(w) || !Number.isFinite(l)) return null;
  return { wins: w, losses: l };
}

/**
 * Same slate as `fetchTodaysGames` (live first, else pre-game; skips finals by default)
 * with team ids + records for richer home-page cards.
 * When `includeCompleted` is true, finished games are included if there are no live/preview
 * (needed for demo mode, which uses historical dates where every game is final).
 */
export async function fetchScheduleGameMetaForDate(
  dateStr: string,
  options?: { includeCompleted?: boolean },
): Promise<ScheduleGameMeta[]> {
  const url = `${MLB}/schedule?sportId=1&date=${dateStr}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  const live: ScheduleGameMeta[] = [];
  const preview: ScheduleGameMeta[] = [];
  const completed: ScheduleGameMeta[] = [];
  const dates = json.dates ?? [];
  /** Same gamePk can appear more than once in rare multi-date payloads — keep first. */
  const seenGamePk = new Set<number>();
  for (const d of dates) {
    for (const g of d.games ?? []) {
      const gamePk = g.gamePk as number;
      if (!Number.isFinite(gamePk)) continue;
      const status = g.status as Record<string, unknown> | undefined;
      const abstract = String(status?.abstractGameState ?? "");

      const row = g as Record<string, unknown>;
      const teams = row.teams as Record<string, unknown> | undefined;
      const awaySide = teams?.away as Record<string, unknown> | undefined;
      const homeSide = teams?.home as Record<string, unknown> | undefined;
      const awayTeam = awaySide?.team as Record<string, unknown> | undefined;
      const homeTeam = homeSide?.team as Record<string, unknown> | undefined;
      const awayTeamId = Number(awayTeam?.id);
      const homeTeamId = Number(homeTeam?.id);
      if (!Number.isFinite(awayTeamId) || !Number.isFinite(homeTeamId)) continue;

      const detailed = String(status?.detailedState ?? "");
      const summary: ScheduleGameMeta = {
        gamePk: g.gamePk as number,
        awayName: teamNameFromSchedule(row, "away"),
        homeName: teamNameFromSchedule(row, "home"),
        awayTeamId,
        homeTeamId,
        status: detailed || abstract || "Scheduled",
        detailedState: detailed,
        abstractGameState: abstract,
        awayRecord: leagueRecordFromSide(awaySide),
        homeRecord: leagueRecordFromSide(homeSide),
      };

      if (abstract === "Final") {
        if (!options?.includeCompleted) continue;
        if (seenGamePk.has(gamePk)) continue;
        seenGamePk.add(gamePk);
        completed.push(summary);
        continue;
      }

      if (isGameLiveLike(status)) {
        if (seenGamePk.has(gamePk)) continue;
        seenGamePk.add(gamePk);
        live.push(summary);
      } else if (isGameNotStarted(status)) {
        if (seenGamePk.has(gamePk)) continue;
        seenGamePk.add(gamePk);
        preview.push({
          ...summary,
          status: `Pre-game · ${summary.status}`,
        });
      }
    }
  }
  if (live.length > 0) return live;
  if (preview.length > 0) return preview;
  if (options?.includeCompleted && completed.length > 0) return completed;
  return [];
}

let teamIdToAbbrevCache: Record<number, string> | null = null;

/** Active MLB clubs (id → abbreviation) for scoreboard labels. */
export async function fetchTeamIdToAbbrev(): Promise<Record<number, string>> {
  if (teamIdToAbbrevCache) return teamIdToAbbrevCache;
  const res = await fetch(`${MLB}/teams?sportId=1&activeStatus=Active`, {
    cache: "force-cache",
  });
  if (!res.ok) return {};
  const json = await res.json();
  const map: Record<number, string> = {};
  for (const row of json.teams ?? []) {
    const team = row as Record<string, unknown>;
    const id = Number(team.id);
    const abbr = team.abbreviation as string | undefined;
    if (Number.isFinite(id) && abbr) map[id] = abbr;
  }
  teamIdToAbbrevCache = map;
  return map;
}

/** TV broadcast call letters from game content (when listed). */
export async function fetchGameContentBrief(gamePk: number): Promise<string | null> {
  if (gamePk === DEMO_GAME_PK) return null;
  const res = await fetch(`${MLB}/game/${gamePk}/content`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  const epg = json?.media?.epg as { items?: { callLetters?: string }[] }[] | undefined;
  const letters: string[] = [];
  for (const block of epg ?? []) {
    for (const it of block?.items ?? []) {
      if (it?.callLetters) letters.push(it.callLetters);
    }
  }
  if (letters.length === 0) return null;
  return [...new Set(letters)].slice(0, 5).join(", ");
}

/** Count plays in a feed — coarse signal that the game moved forward. */
export function getPlayCount(feed: unknown): number {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  return allPlays.length;
}

/** Inning + count from live feed linescore — used to detect a new pitch vs our coarse pitch buckets. */
export function extractScoreboardFromFeed(feed: unknown): ScoreboardSnapshot | null {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const linescore = liveData?.linescore as Record<string, unknown> | undefined;
  if (!linescore) return null;
  const offense = linescore?.offense as Record<string, unknown> | undefined;
  const balls = Number(offense?.balls ?? linescore?.balls ?? 0);
  const strikes = Number(offense?.strikes ?? linescore?.strikes ?? 0);
  const outs = Number(linescore?.outs ?? 0);
  const inning = Number(linescore?.currentInning ?? 1);
  const half = String(linescore?.inningHalf ?? "Top").toLowerCase().includes("bottom")
    ? "bottom"
    : "top";
  return { balls, strikes, outs, inning, inningHalf: half };
}

export function scoreboardChanged(
  a: ScoreboardSnapshot,
  b: ScoreboardSnapshot,
): boolean {
  return (
    a.balls !== b.balls ||
    a.strikes !== b.strikes ||
    a.outs !== b.outs ||
    a.inning !== b.inning ||
    a.inningHalf !== b.inningHalf
  );
}

/** Same inning + count as `feed/live` snapshot, from standalone `/linescore` JSON. */
export function extractScoreboardFromLinescore(ls: unknown): ScoreboardSnapshot | null {
  const L = ls as Record<string, unknown>;
  if (!L || typeof L !== "object") return null;
  const offense = L?.offense as Record<string, unknown> | undefined;
  const balls = Number(offense?.balls ?? L?.balls ?? 0);
  const strikes = Number(offense?.strikes ?? L?.strikes ?? 0);
  const outs = Number(L?.outs ?? 0);
  const inning = Number(L?.currentInning ?? 1);
  const halfRaw = String(L?.inningState ?? L?.inningHalf ?? "Top").toLowerCase();
  const inningHalf: "top" | "bottom" = halfRaw.includes("bottom") ? "bottom" : "top";
  if (![balls, strikes, outs, inning].every((n) => Number.isFinite(n))) return null;
  return { balls, strikes, outs, inning, inningHalf };
}

/** Full live feed for a game — used for scoreboard + pitch parsing. */
export async function fetchLiveFeed(gamePk: number): Promise<unknown | null> {
  if (gamePk === DEMO_GAME_PK) return null;
  const url = `${MLB_V11}/game/${gamePk}/feed/live`;
  const res = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Lighter endpoint — often works when feed/live is empty (pre-game) or flaky.
 * https://statsapi.mlb.com/api/v1/game/{gamePk}/linescore
 */
export async function fetchLinescore(gamePk: number): Promise<unknown | null> {
  if (gamePk === DEMO_GAME_PK) return null;
  const url = `${MLB}/game/${gamePk}/linescore`;
  const res = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Build scoreboard text from linescore only (no pitch-by-pitch).
 */
export function parseSituationFromLinescore(
  linescore: unknown,
  fallbackLabel: LiveGameSummary,
): GameSituation {
  const L = linescore as Record<string, unknown>;
  const teams = L?.teams as Record<string, unknown> | undefined;
  const awayTeam = teams?.away as Record<string, unknown> | undefined;
  const homeTeam = teams?.home as Record<string, unknown> | undefined;
  const away = teamNameFromGameSide(awayTeam) ?? fallbackLabel.away;
  const home = teamNameFromGameSide(homeTeam) ?? fallbackLabel.home;

  const defense = L?.defense as Record<string, unknown> | undefined;
  const offense = L?.offense as Record<string, unknown> | undefined;
  const balls = Number(offense?.balls ?? L?.balls ?? 0);
  const strikes = Number(offense?.strikes ?? L?.strikes ?? 0);
  const outs = Number(L?.outs ?? 0);

  const pitcher = defense?.pitcher as Record<string, unknown> | undefined;
  const batter = offense?.batter as Record<string, unknown> | undefined;
  const pitcherName = (pitcher?.fullName as string) ?? "Pitcher TBD";
  const batterName = (batter?.fullName as string) ?? "Batter TBD";
  const bases = baseOccupancyFromOffense(offense);

  const inning = Number(L?.currentInning ?? 1);
  const halfRaw = String(L?.inningState ?? "Top").toLowerCase();
  const inningHalf: "top" | "bottom" = halfRaw.includes("bottom") ? "bottom" : "top";

  return {
    gamePk: fallbackLabel.gamePk,
    away,
    home,
    inning,
    inningHalf,
    outs,
    balls,
    strikes,
    pitcherName,
    batterName,
    pitcherId: personIdFromNode(pitcher),
    batterId: personIdFromNode(batter),
    onFirst: bases.onFirst,
    onSecond: bases.onSecond,
    onThird: bases.onThird,
  };
}

/**
 * Pull inning, count, pitcher, batter from the live feed JSON.
 * Shape varies slightly; we use defensive optional chaining.
 */
export function parseSituation(feed: unknown, fallbackLabel: LiveGameSummary): GameSituation {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  const lastPlay = allPlays[allPlays.length - 1] as Record<string, unknown> | undefined;

  const gameData = f?.gameData as Record<string, unknown> | undefined;
  const teams = gameData?.teams as Record<string, unknown> | undefined;
  const awayTeam = teams?.away as Record<string, unknown> | undefined;
  const homeTeam = teams?.home as Record<string, unknown> | undefined;

  const linescore = liveData?.linescore as Record<string, unknown> | undefined;
  const inning = Number(linescore?.currentInning ?? 1);
  const half = String(linescore?.inningHalf ?? "Top").toLowerCase().includes("bottom")
    ? "bottom"
    : "top";
  const outs = Number(linescore?.outs ?? 0);

  const offense = linescore?.offense as Record<string, unknown> | undefined;
  const defense = linescore?.defense as Record<string, unknown> | undefined;

  const balls = Number(offense?.balls ?? linescore?.balls ?? 0);
  const strikes = Number(offense?.strikes ?? linescore?.strikes ?? 0);

  const pitcher = defense?.pitcher as Record<string, unknown> | undefined;
  const batter = offense?.batter as Record<string, unknown> | undefined;

  const pitcherName = (pitcher?.fullName as string) ?? "Pitcher TBD";
  const batterName = (batter?.fullName as string) ?? "Batter TBD";
  const bases = baseOccupancyFromOffense(offense);

  const awayName = teamNameFromGameSide(awayTeam) ?? fallbackLabel.away;
  const homeName = teamNameFromGameSide(homeTeam) ?? fallbackLabel.home;

  return {
    gamePk: fallbackLabel.gamePk,
    away: awayName,
    home: homeName,
    inning,
    inningHalf: half,
    outs,
    balls,
    strikes,
    pitcherName,
    batterName,
    pitcherId: personIdFromNode(pitcher),
    batterId: personIdFromNode(batter),
    onFirst: bases.onFirst,
    onSecond: bases.onSecond,
    onThird: bases.onThird,
    lastPlayId: lastPlay?.atBatIndex != null ? String(lastPlay.atBatIndex) : undefined,
  };
}

/**
 * Map Statcast / Gameday pitch type codes or descriptions into our 5 demo buckets.
 * Codes follow MLB’s pitch_type (see FanGraphs / Statcast legend).
 */
export function mapPitchType(raw: string | undefined): PitchType {
  const s = (raw ?? "").trim();
  if (!s) return "Other";
  const code = s.toUpperCase();
  const u = s.toLowerCase();

  // Two-letter (or short) Statcast codes — exact match first
  if (
    ["FF", "FA", "FT", "SI", "FC", "FS", "FO", "EP", "KN", "PO", "IN", "AB", "UN"].includes(
      code,
    )
  ) {
    if (["FF", "FA", "FT", "SI", "FC"].includes(code)) return "Fastball";
    if (code === "FS") return "Other"; // splitter / fork family → Other for this MVP
    if (code === "FO") return "Changeup"; // forkball grouped with off-speed
    if (["EP", "KN", "PO", "IN", "AB", "UN"].includes(code)) return "Other";
  }
  // ST = sweeper (not a four-seam); SV sometimes appears in feeds
  if (["SL", "ST", "SV", "KC", "CS", "CU", "CH", "SC", "KN"].includes(code)) {
    if (code === "SL" || code === "ST" || code === "SV") return "Slider";
    if (code === "KC" || code === "CS" || code === "CU") return "Curveball";
    if (code === "CH" || code === "SC") return "Changeup";
    if (code === "KN") return "Other";
  }

  // Full descriptions (when only `description` is present, not code)
  if (u.includes("splitter") || u.includes("split finger") || u.includes("split-finger"))
    return "Other";
  if (u.includes("knuckleball")) return "Other";
  if (u.includes("sweeper") || u.includes("slider") || u.includes("slurve")) return "Slider";
  if (u.includes("curve") || u.includes("knuckle curve")) return "Curveball";
  if (u.includes("change") || u.includes("fork") || u.includes("off-speed")) return "Changeup";
  if (u.includes("cutter") || u.includes("sinker") || u.includes("two-seam") || u.includes("2-seam"))
    return "Fastball";
  // Use "fastball" / "seam" — NOT bare "fast" (matches too many strings)
  if (
    u.includes("fastball") ||
    u.includes("four-seam") ||
    u.includes("4-seam") ||
    (u.includes("seam") && !u.includes("change"))
  ) {
    return "Fastball";
  }

  return "Other";
}

/** Map mph to velocity bucket. */
export function mapVelocity(mph: number | undefined): VelocityBucket {
  const v = mph ?? 90;
  if (v < 85) return "Under 85";
  if (v < 90) return "85-89";
  if (v < 95) return "90-94";
  if (v < 98) return "95-97";
  return "98+";
}

/**
 * Very rough location bucket from zone + call.
 * Real Statcast would use coordinates; this is demo-grade mapping.
 */
export function mapLocation(zone: number | undefined, callCode: string | undefined): LocationBucket {
  const call = (callCode ?? "").toLowerCase();
  if (call === "b" || call === "ball") return "Ball";
  const z = zone ?? 0;
  if (z >= 1 && z <= 9) return "In Zone";
  if (z === 11 || z === 12) return "Up";
  if (z === 13 || z === 14) return "Down";
  if (z === 3 || z === 6 || z === 9) return "Outside";
  if (z === 1 || z === 4 || z === 7) return "Inside";
  return "In Zone";
}

/**
 * 3×3 placement grid: Statcast zones 1–9 only. Ball call or zone outside 1–9 → null
 * (counts as “outside the nine boxes” for placement / Ball pick settlement).
 */
export function resolvePlacementZoneCell(
  zone: number | undefined,
  callCode: string | undefined,
): number | null {
  const cc = (callCode ?? "").toUpperCase();
  if (cc === "B" || cc === "I") return null;
  const z = zone != null && Number.isFinite(Number(zone)) ? Number(zone) : NaN;
  if (z >= 1 && z <= 9) return z;
  return null;
}

/** Whether this play event is an actual pitch (MLB v1.1 uses `type: "pitch"` + `pitchData`). */
function isPitchPlayEvent(ev: Record<string, unknown>): boolean {
  if (String(ev.type ?? "").toLowerCase() === "pitch") return true;
  if (ev.isPitch === true) return true;
  if (ev.pitchData && typeof ev.pitchData === "object") return true;
  return false;
}

/** Pitch type code or description from event (pitchData.pitchType is often absent). */
function rawPitchTypeFromEvent(ev: Record<string, unknown>): string | undefined {
  const details = ev.details as Record<string, unknown> | undefined;
  const dt = details?.type;
  if (dt && typeof dt === "object" && dt !== null) {
    const code = (dt as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  if (typeof dt === "string") return dt;
  const pitchData = ev.pitchData as Record<string, unknown> | undefined;
  const pt = pitchData?.pitchType as string | undefined;
  if (pt) return pt;
  const desc = details?.description as string | undefined;
  if (desc && !desc.toLowerCase().includes("status change")) return desc;
  return undefined;
}

function callCodeFromPitchEvent(ev: Record<string, unknown>): string | undefined {
  const details = ev.details as Record<string, unknown> | undefined;
  const call = details?.call as Record<string, unknown> | undefined;
  if (call?.code != null) return String(call.code);
  if (typeof details?.code === "string") return details.code;
  return undefined;
}

/** Statcast row: type code + pitchData — avoids mis-reading a thin “pitch” row as the last pitch. */
function isStatcastPitchEvent(ev: Record<string, unknown>): boolean {
  if (!isPitchPlayEvent(ev)) return false;
  const pd = ev.pitchData as Record<string, unknown> | undefined;
  if (!pd || typeof pd !== "object") return false;
  const details = ev.details as Record<string, unknown> | undefined;
  const t = details?.type;
  return Boolean(
    t && typeof t === "object" && typeof (t as Record<string, unknown>).code === "string",
  );
}

function isPickoffLikeEvent(ev: Record<string, unknown>): boolean {
  const cc = (callCodeFromPitchEvent(ev) ?? "").toUpperCase();
  if (cc === "PK" || cc === "PO") return true;
  const t = String(ev.type ?? "").toLowerCase();
  if (t === "pickoff" || t === "pitching_substitution") return true;
  return false;
}

function outcomeFromPitchEvent(ev: Record<string, unknown>): PitchOutcome | null {
  if (isPickoffLikeEvent(ev)) return null;
  if (!isPitchPlayEvent(ev)) return null;
  const pitchData = ev.pitchData as Record<string, unknown> | undefined;
  const pt = rawPitchTypeFromEvent(ev);
  const rawSpeed = Number(pitchData?.endSpeed ?? pitchData?.startSpeed);
  const endSpeed = Number.isFinite(rawSpeed) ? rawSpeed : 90;
  const zone = pitchData?.zone != null ? Number(pitchData.zone) : undefined;
  const call = callCodeFromPitchEvent(ev);
  if (!pt && !pitchData) return null;
  return {
    pitchType: mapPitchType(pt),
    velocity: mapVelocity(endSpeed),
    location: mapLocation(zone, call),
    battingResult: mapBattingResult(ev),
    zoneCell: resolvePlacementZoneCell(zone, call),
    ...(Number.isFinite(rawSpeed)
      ? { speedMph: Math.round(rawSpeed * 10) / 10 }
      : {}),
  };
}

/**
 * “Batting Result” prop: fair ball for a hit vs ball / strike / foul from the plate appearance.
 * Null = ball in play for an out, or uncoded — slips on Hit/Ball/Strike/Foul all lose that leg.
 */
function mapBattingResult(ev: Record<string, unknown>): BattingResult | null {
  if (isPickoffLikeEvent(ev)) return null;
  if (!isPitchPlayEvent(ev)) return null;
  const details = ev.details as Record<string, unknown> | undefined;
  const desc = String(details?.description ?? "").toLowerCase();

  if (desc.includes("hit by pitch") || desc.includes("hbp")) return "Ball";

  const hitLike =
    /\bsingle\b/.test(desc) ||
    (/\bdouble\b/.test(desc) && !desc.includes("double play")) ||
    (/\btriple\b/.test(desc) && !desc.includes("triple play")) ||
    desc.includes("home run") ||
    desc.includes("grand slam") ||
    desc.includes("inside-the-park") ||
    desc.includes("inside the park");
  if (hitLike) return "Hit";

  if (desc.includes("in play") || desc.includes("in_play")) {
    return null;
  }

  const cc = (callCodeFromPitchEvent(ev) ?? "").toUpperCase();
  if (cc === "B" || cc === "I") return "Ball";
  if (cc === "F" || cc === "L" || cc === "T") return "Foul";
  if (cc === "C" || cc === "S" || cc === "M") return "Strike";

  const pcr = pitchCountResultFromEvent(ev);
  if (pcr === "ball") return "Ball";
  if (pcr === "foul") return "Foul";
  if (pcr === "strike") return "Strike";
  return null;
}

/** Ball / strike / foul styling on the pitch map (from play event call). */
export type PitchCountResult = "ball" | "strike" | "foul" | "other";

/** One row for the live pitch feed + strike-zone plot (from real `feed/live`). */
export type RecentPitchFeedRow = {
  id: string;
  pitchType: PitchType;
  speedMph: number | null;
  callText: string;
  zone: number | null;
  /** 0–100, strike-zone panel coordinates */
  plotX: number;
  plotY: number;
  countResult: PitchCountResult;
};

/** Map MLB playEvent call → map dot color bucket. */
export function pitchCountResultFromEvent(ev: Record<string, unknown>): PitchCountResult {
  const cc = (callCodeFromPitchEvent(ev) ?? "").toUpperCase();
  if (cc === "B" || cc === "I") return "ball";
  if (cc === "F" || cc === "L" || cc === "T") return "foul";
  if (cc === "C" || cc === "S" || cc === "M") return "strike";
  const desc = String(
    (ev.details as Record<string, unknown> | undefined)?.description ?? "",
  ).toLowerCase();
  if (desc.includes("foul") || desc.includes("foul tip")) return "foul";
  if (desc.includes("ball") && !desc.includes("foul")) return "ball";
  if (
    desc.includes("strike") ||
    desc.includes("swinging") ||
    desc.includes("called strike")
  ) {
    return "strike";
  }
  if (desc.includes("in play") || desc.includes("hit by pitch")) return "other";
  return "other";
}

/** Strike-zone widget geometry (viewBox 0–100) — MLB-style portrait rectangle + 3×3 cells. */
const SZ_LEFT = 24;
const SZ_TOP = 14;
const SZ_W = 52;
const SZ_H = 70;
const SZ_CELL_W = SZ_W / 3;
const SZ_CELL_H = SZ_H / 3;

const ZONE_GUESS_XY: Record<number, [number, number]> = {
  1: [SZ_LEFT + SZ_CELL_W / 2, SZ_TOP + SZ_CELL_H / 2],
  2: [SZ_LEFT + (3 * SZ_CELL_W) / 2, SZ_TOP + SZ_CELL_H / 2],
  3: [SZ_LEFT + (5 * SZ_CELL_W) / 2, SZ_TOP + SZ_CELL_H / 2],
  4: [SZ_LEFT + SZ_CELL_W / 2, SZ_TOP + (3 * SZ_CELL_H) / 2],
  5: [SZ_LEFT + (3 * SZ_CELL_W) / 2, SZ_TOP + (3 * SZ_CELL_H) / 2],
  6: [SZ_LEFT + (5 * SZ_CELL_W) / 2, SZ_TOP + (3 * SZ_CELL_H) / 2],
  7: [SZ_LEFT + SZ_CELL_W / 2, SZ_TOP + (5 * SZ_CELL_H) / 2],
  8: [SZ_LEFT + (3 * SZ_CELL_W) / 2, SZ_TOP + (5 * SZ_CELL_H) / 2],
  9: [SZ_LEFT + (5 * SZ_CELL_W) / 2, SZ_TOP + (5 * SZ_CELL_H) / 2],
  11: [18, 26],
  12: [50, 7],
  13: [82, 26],
  14: [50, 90],
};

function clampPct(n: number): number {
  // MLB Gameday allows dots to sit closer to the panel edges than our previous clamp.
  // Keep a small safety margin so markers don't clip into rounded corners.
  return Math.min(98, Math.max(2, n));
}

const SZ_RIGHT = SZ_LEFT + SZ_W;
const SZ_BOTTOM = SZ_TOP + SZ_H;

/**
 * If the umpire called a ball but pX/pZ (or zone guess) landed inside the drawn strike zone,
 * push the dot outside along the ray from zone center → pitch so the map matches the call.
 */
function ballPlotOutsideStrikeZone(x: number, y: number): { x: number; y: number } {
  const pad = 2.4;
  const insideClosed =
    x >= SZ_LEFT && x <= SZ_RIGHT && y >= SZ_TOP && y <= SZ_BOTTOM;
  if (!insideClosed) {
    return { x: clampPct(x), y: clampPct(y) };
  }

  const cx = SZ_LEFT + SZ_W / 2;
  const cy = SZ_TOP + SZ_H / 2;
  let dx = x - cx;
  let dy = y - cy;
  const len0 = Math.hypot(dx, dy);
  if (len0 < 0.08) {
    dx = 1;
    dy = 0;
  } else {
    dx /= len0;
    dy /= len0;
  }

  let tExit = 0;
  for (let t = 0; t < 160; t += 0.2) {
    const px = cx + t * dx;
    const py = cy + t * dy;
    if (px < SZ_LEFT || px > SZ_RIGHT || py < SZ_TOP || py > SZ_BOTTOM) {
      tExit = t;
      break;
    }
  }
  const x2 = cx + (tExit + pad) * dx;
  const y2 = cy + (tExit + pad) * dy;
  return { x: clampPct(x2), y: clampPct(y2) };
}

function guessPlotFromZoneAndLocation(
  zone: number | null,
  location: LocationBucket,
): { x: number; y: number } {
  /** Called balls must not use zones 1–9 (those are in-box); feed often still sends a zone int. */
  if (location === "Ball") return { x: 88, y: 48 };
  if (zone != null && Number.isFinite(zone) && ZONE_GUESS_XY[zone]) {
    const [x, y] = ZONE_GUESS_XY[zone]!;
    return { x, y };
  }
  if (location === "Up") return { x: 50, y: 6 };
  if (location === "Down") return { x: 50, y: 92 };
  if (location === "Inside") return { x: 12, y: 49 };
  if (location === "Outside") return { x: 88, y: 49 };
  return { x: SZ_LEFT + SZ_W / 2, y: SZ_TOP + SZ_H / 2 };
}

/**
 * Where to draw a slip “location” pick on the strike-zone widget (no Statcast zone at bet time).
 * Matches `guessPlotFromZoneAndLocation(null, location)` so the ring aligns with bucket geometry.
 */
export function slipLocationPlot(location: LocationBucket): { x: number; y: number } {
  return guessPlotFromZoneAndLocation(null, location);
}

/**
 * Map Statcast plate coords (feet) to % positions in the strike-zone widget.
 * Falls back to zone / location heuristics when pX/pZ missing.
 */
export function plotPitchFromPitchData(
  pitchData: Record<string, unknown> | undefined,
  zone: number | null,
  location: LocationBucket,
  options?: { countResult?: PitchCountResult },
): { x: number; y: number } {
  const c = pitchData?.coordinates as Record<string, unknown> | undefined;
  const pX = Number(c?.pX);
  const pZ = Number(c?.pZ);
  let plot: { x: number; y: number };
  if (Number.isFinite(pX) && Number.isFinite(pZ)) {
    const szTop = Number(pitchData?.strikeZoneTop ?? 3.5);
    const szBot = Number(pitchData?.strikeZoneBottom ?? 1.65);
    const span = Math.max(0.35, szTop - szBot);
    // MLB Gameday uses a tighter horizontal scaling than our previous mapping.
    // Statcast pX is measured in feet from plate center; typical values cluster ~[-1.5, 1.5].
    const halfPlateFt = 1.75;
    const pxClamped = Math.max(-halfPlateFt, Math.min(halfPlateFt, pX));
    const xPct = SZ_LEFT + SZ_W / 2 + pxClamped * (SZ_W / 2 / halfPlateFt);

    const t = (pZ - szBot) / span;
    // Allow a small overshoot above/below the box for high/low pitches.
    const tClamped = Math.max(-0.25, Math.min(1.25, t));
    const yBot = SZ_BOTTOM;
    const yPct = yBot - tClamped * SZ_H;
    plot = { x: clampPct(xPct), y: clampPct(yPct) };
  } else {
    plot = guessPlotFromZoneAndLocation(zone, location);
  }

  return plot;
}

function callTextFromPitchEvent(ev: Record<string, unknown>): string {
  const d = ev.details as Record<string, unknown> | undefined;
  const desc = d?.description;
  if (typeof desc === "string" && desc.trim()) return desc.trim();
  const raw = (callCodeFromPitchEvent(ev) ?? "").toUpperCase();
  if (raw === "S") return "Strike";
  if (raw === "B") return "Ball";
  if (raw === "C") return "Called strike";
  if (raw === "F") return "Foul";
  if (raw === "T") return "Foul tip";
  if (raw === "L") return "Foul bunt";
  if (raw === "M") return "Missed bunt";
  return "Pitch";
}

function pushPitchRowIfValid(
  ev: Record<string, unknown>,
  playIndex: number,
  eventIndex: number,
  chronological: RecentPitchFeedRow[],
): void {
  if (isPickoffLikeEvent(ev)) return;
  const o = outcomeFromPitchEvent(ev);
  if (!o) return;
  const pitchData = ev.pitchData as Record<string, unknown> | undefined;
  const z = pitchData?.zone != null ? Number(pitchData.zone) : null;
  const zn = z != null && Number.isFinite(z) ? z : null;
  const countResult = pitchCountResultFromEvent(ev);
  const plot = plotPitchFromPitchData(pitchData, zn, o.location, { countResult });
  chronological.push({
    id: `${playIndex}-${eventIndex}`,
    pitchType: o.pitchType,
    speedMph: o.speedMph ?? null,
    callText: callTextFromPitchEvent(ev),
    zone: zn,
    plotX: plot.x,
    plotY: plot.y,
    countResult,
  });
}

/**
 * Pitches in the **current plate appearance** only (last `allPlays` entry), **most recent first**.
 */
export function parseCurrentAtBatPitchesFromFeed(feed: unknown): RecentPitchFeedRow[] {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  if (allPlays.length === 0) return [];
  const lastIdx = allPlays.length - 1;
  const play = allPlays[lastIdx] as Record<string, unknown>;
  const chronological: RecentPitchFeedRow[] = [];
  const events = (play.playEvents as unknown[]) ?? [];
  for (let j = 0; j < events.length; j++) {
    pushPitchRowIfValid(events[j] as Record<string, unknown>, lastIdx, j, chronological);
  }
  return chronological.reverse();
}

/**
 * Last `limit` pitches from the live feed, **most recent first**.
 * Skips pickoffs / non-pitch rows. Plot uses pX/pZ when present, else zone/location guess.
 */
export function parseRecentPitchesFromFeed(feed: unknown, limit: number): RecentPitchFeedRow[] {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  const chronological: RecentPitchFeedRow[] = [];

  for (let i = 0; i < allPlays.length; i++) {
    const play = allPlays[i] as Record<string, unknown>;
    const events = (play.playEvents as unknown[]) ?? [];
    for (let j = 0; j < events.length; j++) {
      pushPitchRowIfValid(events[j] as Record<string, unknown>, i, j, chronological);
    }
  }

  const tail = chronological.slice(-Math.max(1, limit));
  return tail.reverse();
}

/** One pitch in real chronological order (demo replay). */
export type DemoTimelinePitch = {
  row: RecentPitchFeedRow;
  outcome: PitchOutcome;
  playIndex: number;
  eventIndex: number;
};

/**
 * Every pitch in the game in **true order** (Statcast rows), for demo replay.
 * Same filters as the pitch feed (`pushPitchRowIfValid`).
 */
export function collectDemoTimelinePitchesFromFeed(feed: unknown): DemoTimelinePitch[] {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  const out: DemoTimelinePitch[] = [];

  for (let i = 0; i < allPlays.length; i++) {
    const play = allPlays[i] as Record<string, unknown>;
    const events = (play.playEvents as unknown[]) ?? [];
    for (let j = 0; j < events.length; j++) {
      const ev = events[j] as Record<string, unknown>;
      if (isPickoffLikeEvent(ev)) continue;
      const o = outcomeFromPitchEvent(ev);
      if (!o) continue;
      const pitchData = ev.pitchData as Record<string, unknown> | undefined;
      const z = pitchData?.zone != null ? Number(pitchData.zone) : null;
      const zn = z != null && Number.isFinite(z) ? z : null;
      const countResult = pitchCountResultFromEvent(ev);
      const plot = plotPitchFromPitchData(pitchData, zn, o.location, { countResult });
      const row: RecentPitchFeedRow = {
        id: `${i}-${j}`,
        pitchType: o.pitchType,
        speedMph: o.speedMph ?? null,
        callText: callTextFromPitchEvent(ev),
        zone: zn,
        plotX: plot.x,
        plotY: plot.y,
        countResult,
      };
      out.push({ row, outcome: o, playIndex: i, eventIndex: j });
    }
  }
  return out;
}

function halfInningFromAbout(about: Record<string, unknown> | undefined): "top" | "bottom" {
  if (!about) return "top";
  if (about.isTopInning === true) return "top";
  if (about.isTopInning === false) return "bottom";
  const h = String(about.halfInning ?? "").toLowerCase();
  return h.includes("bottom") ? "bottom" : "top";
}

/** Away / home club names from `feed/live` gameData. */
export function gameTeamNamesFromFeed(feed: unknown): { away: string; home: string } {
  const f = feed as Record<string, unknown>;
  const gd = f?.gameData as Record<string, unknown> | undefined;
  const teams = gd?.teams as Record<string, unknown> | undefined;
  const away = teamNameFromGameSide(teams?.away as Record<string, unknown> | undefined) ?? "Away";
  const home = teamNameFromGameSide(teams?.home as Record<string, unknown> | undefined) ?? "Home";
  return { away, home };
}

/**
 * Scoreboard totals **as of** this pitch (cumulative from `play.result` on prior plays / this PA).
 */
export function scoreFromFeedAtPitchEvent(
  feed: unknown,
  playIndex: number,
  eventIndex: number,
): { away: number; home: number } {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  const play = allPlays[playIndex] as Record<string, unknown> | undefined;
  if (!play) return { away: 0, home: 0 };
  const events = (play.playEvents as unknown[]) ?? [];
  let lastPitchEventIdx = -1;
  for (let j = events.length - 1; j >= 0; j--) {
    const ev = events[j] as Record<string, unknown>;
    if (isPickoffLikeEvent(ev)) continue;
    if (outcomeFromPitchEvent(ev)) lastPitchEventIdx = j;
  }
  const isLastPitchOfPa = lastPitchEventIdx >= 0 && eventIndex >= lastPitchEventIdx;
  const r = play.result as Record<string, unknown> | undefined;
  if (isLastPitchOfPa && r?.awayScore != null && r?.homeScore != null) {
    return { away: Number(r.awayScore), home: Number(r.homeScore) };
  }
  if (playIndex === 0) return { away: 0, home: 0 };
  const prev = allPlays[playIndex - 1] as Record<string, unknown> | undefined;
  const pr = prev?.result as Record<string, unknown> | undefined;
  if (pr?.awayScore != null && pr?.homeScore != null) {
    return { away: Number(pr.awayScore), home: Number(pr.homeScore) };
  }
  return { away: 0, home: 0 };
}

/**
 * Inning, count, matchup, bases — aligned to this pitch event in the feed.
 */
export function situationFromFeedAtPitchEvent(
  feed: unknown,
  playIndex: number,
  eventIndex: number,
  gamePk: number,
): GameSituation | null {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];
  const play = allPlays[playIndex] as Record<string, unknown> | undefined;
  if (!play) return null;
  const events = (play.playEvents as unknown[]) ?? [];
  const event = events[eventIndex] as Record<string, unknown> | undefined;
  if (!event) return null;

  const names = gameTeamNamesFromFeed(feed);
  const about = play.about as Record<string, unknown> | undefined;
  const inning = Number(about?.inning ?? 1);
  const half = halfInningFromAbout(about);
  const count = event.count as Record<string, unknown> | undefined;
  const balls = Number(count?.balls ?? 0);
  const strikes = Number(count?.strikes ?? 0);
  const outs = Number(count?.outs ?? 0);

  const matchup = play.matchup as Record<string, unknown> | undefined;
  const pitcher = matchup?.pitcher as Record<string, unknown> | undefined;
  const batter = matchup?.batter as Record<string, unknown> | undefined;
  const pitcherName = typeof pitcher?.fullName === "string" ? pitcher.fullName : "—";
  const batterName = typeof batter?.fullName === "string" ? batter.fullName : "—";
  const pitcherId = personIdFromNode(pitcher);
  const batterId = personIdFromNode(batter);

  const ls = liveData?.linescore as Record<string, unknown> | undefined;
  const offense = ls?.offense as Record<string, unknown> | undefined;
  const bases = baseOccupancyFromOffense(offense);

  return {
    gamePk,
    away: names.away,
    home: names.home,
    inning: Number.isFinite(inning) ? inning : 1,
    inningHalf: half,
    outs: Number.isFinite(outs) ? outs : 0,
    balls: Number.isFinite(balls) ? balls : 0,
    strikes: Number.isFinite(strikes) ? strikes : 0,
    pitcherName,
    batterName,
    pitcherId,
    batterId,
    onFirst: bases.onFirst,
    onSecond: bases.onSecond,
    onThird: bases.onThird,
  };
}

/**
 * Read the **last** pitch from MLB’s live feed (`feed/live` v1.1).
 * This is real Statcast-backed data when the game is live or completed with PBP stored.
 */
export function parseLastPitchFromFeed(feed: unknown): PitchOutcome | null {
  const f = feed as Record<string, unknown>;
  const liveData = f?.liveData as Record<string, unknown> | undefined;
  const plays = liveData?.plays as Record<string, unknown> | undefined;
  const allPlays = (plays?.allPlays as unknown[]) ?? [];

  const scan = (preferStatcast: boolean): PitchOutcome | null => {
    for (let i = allPlays.length - 1; i >= 0; i--) {
      const play = allPlays[i] as Record<string, unknown>;
      const events = (play.playEvents as unknown[]) ?? [];
      for (let j = events.length - 1; j >= 0; j--) {
        const ev = events[j] as Record<string, unknown>;
        if (preferStatcast && !isStatcastPitchEvent(ev)) continue;
        const o = outcomeFromPitchEvent(ev);
        if (o) return o;
      }
    }
    return null;
  };

  return scan(true) ?? scan(false);
}

/** Random demo pitch — keeps the flow working without MLB JSON. */
export function randomDemoPitch(): PitchOutcome {
  const types: PitchType[] = [
    "Fastball",
    "Slider",
    "Curveball",
    "Changeup",
    "Other",
  ];
  const locations: LocationBucket[] = [
    "In Zone",
    "Ball",
    "Up",
    "Down",
    "Inside",
    "Outside",
  ];
  const brOpts: BattingResult[] = ["Hit", "Ball", "Strike", "Foul"];
  const brWeights = [0.085, 0.36, 0.285, 0.27];
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const pickWeighted = (): BattingResult => {
    const t = Math.random();
    let c = 0;
    for (let i = 0; i < brOpts.length; i++) {
      c += brWeights[i]!;
      if (t < c) return brOpts[i]!;
    }
    return "Ball";
  };
  const rawSpeed = 75 + Math.random() * 27;
  const speedMph = Math.round(rawSpeed * 10) / 10;
  const inZone = Math.random() < 0.47;
  const zoneCell: number | null = inZone ? Math.floor(Math.random() * 9) + 1 : null;
  return {
    pitchType: pick(types),
    velocity: mapVelocity(rawSpeed),
    location: pick(locations),
    battingResult: pickWeighted(),
    zoneCell,
    speedMph,
  };
}

/** Win only if every selection the user made matches the outcome. */
export function slipWins(
  selections: {
    pitchType?: string;
    velocity?: string;
    location?: string;
    battingResult?: string;
    zonePick?: ZonePick;
  },
  outcome: PitchOutcome,
): boolean {
  if (selections.pitchType && selections.pitchType !== outcome.pitchType) return false;
  if (selections.velocity) {
    const mphSel = Number(selections.velocity);
    if (Number.isFinite(mphSel) && String(selections.velocity).trim() !== "") {
      const mphOut = outcome.speedMph;
      if (mphOut == null || !Number.isFinite(mphOut)) return false;
      if (Math.abs(mphOut - mphSel) > 1.0) return false;
    } else if (selections.velocity !== outcome.velocity) {
      return false;
    }
  }
  if (selections.zonePick) {
    if (selections.zonePick.mode === "ball") {
      if (outcome.zoneCell !== null) return false;
    } else {
      const cells = selections.zonePick.cells;
      if (outcome.zoneCell === null) return false;
      if (!cells.includes(outcome.zoneCell)) return false;
    }
  } else if (selections.location && selections.location !== outcome.location) {
    return false;
  }
  if (selections.battingResult) {
    if (outcome.battingResult == null) return false;
    if (selections.battingResult !== outcome.battingResult) return false;
  }
  return true;
}
