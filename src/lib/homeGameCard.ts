import {
  type ScheduleGameMeta,
  extractTeamNamesFromBoxscore,
  fetchBoxscore,
  fetchGameContentBrief,
  fetchLinescore,
  fetchScheduleGameMetaForDate,
  fetchTeamIdToAbbrev,
} from "@/lib/mlb";

export type HomeGameCardViewModel = {
  gamePk: number;
  href: string;
  /** e.g. "BOT 7" or "Pre-game" */
  inningLabel: string;
  statusHint?: string;
  away: {
    name: string;
    abbr: string;
    runs: number;
    hits: number;
    errors: number;
    record: string;
    teamId: number;
  };
  home: {
    name: string;
    abbr: string;
    runs: number;
    hits: number;
    errors: number;
    record: string;
    teamId: number;
  };
  balls: number;
  strikes: number;
  outs: number;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  broadcast: string | null;
  pitching: {
    teamAbbr: string;
    lastName: string;
    detail: string;
    personId: number | null;
  };
  atBat: {
    teamAbbr: string;
    lastName: string;
    detail: string;
    personId: number | null;
  };
  /** Demo home: hide internal game id in footer so it feels like a normal broadcast. */
  hideGamePkFooter?: boolean;
};

function fmtRecord(r: { wins: number; losses: number } | null): string {
  if (!r) return "— —";
  return `${r.wins} - ${r.losses}`;
}

function lastName(fullName: string): string {
  const p = fullName.trim().split(/\s+/);
  return p.length ? p[p.length - 1]! : fullName;
}

function boxscoreSideForTeamId(
  box: unknown,
  teamId: number,
): "home" | "away" | null {
  const b = box as Record<string, unknown>;
  const teams = b?.teams as Record<string, unknown> | undefined;
  const home = teams?.home as Record<string, unknown> | undefined;
  const away = teams?.away as Record<string, unknown> | undefined;
  const hid = Number((home?.team as Record<string, unknown> | undefined)?.id);
  const aid = Number((away?.team as Record<string, unknown> | undefined)?.id);
  if (Number.isFinite(hid) && hid === teamId) return "home";
  if (Number.isFinite(aid) && aid === teamId) return "away";
  return null;
}

function playerFromBoxscore(
  box: unknown,
  side: "home" | "away",
  personId: number,
): Record<string, unknown> | undefined {
  const b = box as Record<string, unknown>;
  const teams = b?.teams as Record<string, unknown> | undefined;
  const t = teams?.[side] as Record<string, unknown> | undefined;
  const players = t?.players as Record<string, unknown> | undefined;
  const key = `ID${personId}`;
  const row = players?.[key] as Record<string, unknown> | undefined;
  return row && typeof row === "object" ? row : undefined;
}

function runnerOn(
  offense: Record<string, unknown> | undefined,
  base: "first" | "second" | "third",
): boolean {
  const b = offense?.[base];
  if (b == null || typeof b !== "object") return false;
  const id = Number((b as Record<string, unknown>).id);
  return Number.isFinite(id) && id > 0;
}

function inningLabelFromLinescore(ls: Record<string, unknown>): string {
  const inn = Number(ls.currentInning ?? 0);
  if (!Number.isFinite(inn) || inn <= 0) return "—";
  const halfRaw = String(ls.inningHalf ?? ls.inningState ?? "")
    .toLowerCase();
  const half = halfRaw.includes("bottom") ? "BOT" : "TOP";
  return `${half} ${inn}`;
}

function formatPitcherDetail(row: Record<string, unknown> | undefined): string {
  if (!row) return "—";
  const stats = row.stats as Record<string, unknown> | undefined;
  const season = row.seasonStats as Record<string, unknown> | undefined;
  const pit = stats?.pitching as Record<string, unknown> | undefined;
  const sp = season?.pitching as Record<string, unknown> | undefined;
  const ip = pit?.inningsPitched != null ? String(pit.inningsPitched) : "—";
  const era = sp?.era != null ? String(sp.era) : pit?.era != null ? String(pit.era) : "—";
  return `${ip} IP | ${era} ERA`;
}

function formatBatterDetail(row: Record<string, unknown> | undefined): string {
  if (!row) return "—";
  const stats = row.stats as Record<string, unknown> | undefined;
  const season = row.seasonStats as Record<string, unknown> | undefined;
  const bat = stats?.batting as Record<string, unknown> | undefined;
  const sb = season?.batting as Record<string, unknown> | undefined;
  const summary =
    typeof bat?.summary === "string" && bat.summary
      ? bat.summary
      : "—";
  const ops = sb?.ops != null ? String(sb.ops) : bat?.ops != null ? String(bat.ops) : "—";
  return `${summary} | ${ops} OPS`;
}

function composeHomeGameCard(
  meta: ScheduleGameMeta,
  linescore: unknown | null,
  boxscore: unknown | null,
  broadcast: string | null,
  abbrevMap: Record<number, string>,
): HomeGameCardViewModel {
  const L = (linescore ?? null) as Record<string, unknown> | null;
  const teams = L?.teams as Record<string, unknown> | undefined;
  const awayLs = teams?.away as Record<string, unknown> | undefined;
  const homeLs = teams?.home as Record<string, unknown> | undefined;

  const fromBox = boxscore ? extractTeamNamesFromBoxscore(boxscore) : { away: null, home: null };
  const awayName = fromBox.away ?? meta.awayName;
  const homeName = fromBox.home ?? meta.homeName;

  const awayAbbr = abbrevMap[meta.awayTeamId] ?? meta.awayName.slice(0, 3).toUpperCase();
  const homeAbbr = abbrevMap[meta.homeTeamId] ?? meta.homeName.slice(0, 3).toUpperCase();

  const runsAway = Number(awayLs?.runs ?? 0);
  const hitsAway = Number(awayLs?.hits ?? 0);
  const errAway = Number(awayLs?.errors ?? 0);
  const runsHome = Number(homeLs?.runs ?? 0);
  const hitsHome = Number(homeLs?.hits ?? 0);
  const errHome = Number(homeLs?.errors ?? 0);

  const isPreview = meta.abstractGameState === "Preview";
  const isFinal = meta.abstractGameState === "Final";
  const inningLabel = isPreview
    ? "Pre-game"
    : isFinal
      ? "Final"
      : L
        ? inningLabelFromLinescore(L)
        : "—";

  const offense = L?.offense as Record<string, unknown> | undefined;
  const defense = L?.defense as Record<string, unknown> | undefined;
  const balls = Number(offense?.balls ?? L?.balls ?? 0);
  const strikes = Number(offense?.strikes ?? L?.strikes ?? 0);
  const outs = Number(L?.outs ?? 0);

  const onFirst = runnerOn(offense, "first");
  const onSecond = runnerOn(offense, "second");
  const onThird = runnerOn(offense, "third");

  const halfRaw = String(L?.inningHalf ?? L?.inningState ?? "").toLowerCase();
  const isBottom = halfRaw.includes("bottom");
  /** Top: home pitches; bottom: away pitches */
  const expectedPitchTeamId = !isBottom ? meta.homeTeamId : meta.awayTeamId;
  const expectedBatTeamId = !isBottom ? meta.awayTeamId : meta.homeTeamId;

  const pitcher = defense?.pitcher as Record<string, unknown> | undefined;
  const batter = offense?.batter as Record<string, unknown> | undefined;
  const pitcherId = Number(pitcher?.id);
  const batterId = Number(batter?.id);
  const pitcherName = typeof pitcher?.fullName === "string" ? pitcher.fullName : "—";
  const batterName = typeof batter?.fullName === "string" ? batter.fullName : "—";

  const defTeam = defense?.team as Record<string, unknown> | undefined;
  const offTeam = offense?.team as Record<string, unknown> | undefined;
  const defTid = Number(defTeam?.id);
  const offTid = Number(offTeam?.id);
  const resolvedPitchTid = Number.isFinite(defTid) ? defTid : expectedPitchTeamId;
  const resolvedBatTid = Number.isFinite(offTid) ? offTid : expectedBatTeamId;
  const pitchTeamAbbr = abbrevMap[resolvedPitchTid] ?? (!isBottom ? homeAbbr : awayAbbr);
  const batTeamAbbr = abbrevMap[resolvedBatTid] ?? (!isBottom ? awayAbbr : homeAbbr);

  let pitchDetail = "—";
  let batDetail = "—";
  let pitchPid: number | null = Number.isFinite(pitcherId) ? pitcherId : null;
  let batPid: number | null = Number.isFinite(batterId) ? batterId : null;

  if (boxscore && Number.isFinite(pitcherId)) {
    const side = boxscoreSideForTeamId(boxscore, resolvedPitchTid);
    if (side) {
      const prow = playerFromBoxscore(boxscore, side, pitcherId);
      pitchDetail = formatPitcherDetail(prow);
    }
  }
  if (boxscore && Number.isFinite(batterId)) {
    const side = boxscoreSideForTeamId(boxscore, resolvedBatTid);
    if (side) {
      const brow = playerFromBoxscore(boxscore, side, batterId);
      batDetail = formatBatterDetail(brow);
    }
  }

  return {
    gamePk: meta.gamePk,
    href: `/game/${meta.gamePk}`,
    inningLabel,
    statusHint: isPreview ? meta.detailedState || meta.status : undefined,
    away: {
      name: awayName,
      abbr: awayAbbr,
      runs: Number.isFinite(runsAway) ? runsAway : 0,
      hits: Number.isFinite(hitsAway) ? hitsAway : 0,
      errors: Number.isFinite(errAway) ? errAway : 0,
      record: fmtRecord(meta.awayRecord),
      teamId: meta.awayTeamId,
    },
    home: {
      name: homeName,
      abbr: homeAbbr,
      runs: Number.isFinite(runsHome) ? runsHome : 0,
      hits: Number.isFinite(hitsHome) ? hitsHome : 0,
      errors: Number.isFinite(errHome) ? errHome : 0,
      record: fmtRecord(meta.homeRecord),
      teamId: meta.homeTeamId,
    },
    balls: Number.isFinite(balls) ? balls : 0,
    strikes: Number.isFinite(strikes) ? strikes : 0,
    outs: Number.isFinite(outs) ? outs : 0,
    onFirst,
    onSecond,
    onThird,
    broadcast,
    pitching: {
      teamAbbr: pitchTeamAbbr,
      lastName: lastName(pitcherName),
      detail: pitchDetail,
      personId: pitchPid,
    },
    atBat: {
      teamAbbr: batTeamAbbr,
      lastName: lastName(batterName),
      detail: batDetail,
      personId: batPid,
    },
  };
}

export async function loadHomeGameCardsForDate(
  dateStr: string,
  options?: { includeCompleted?: boolean },
): Promise<HomeGameCardViewModel[]> {
  const [scheduleMetas, abbrevMap] = await Promise.all([
    fetchScheduleGameMetaForDate(dateStr, options),
    fetchTeamIdToAbbrev(),
  ]);

  const loaded = await Promise.all(
    scheduleMetas.map(async (meta) => {
      try {
        const [ls, box, bc] = await Promise.all([
          fetchLinescore(meta.gamePk),
          fetchBoxscore(meta.gamePk),
          fetchGameContentBrief(meta.gamePk),
        ]);
        return composeHomeGameCard(meta, ls, box, bc, abbrevMap);
      } catch {
        return composeHomeGameCard(meta, null, null, null, abbrevMap);
      }
    }),
  );

  const seenPk = new Set<number>();
  return loaded.filter((c) => {
    if (seenPk.has(c.gamePk)) return false;
    seenPk.add(c.gamePk);
    return true;
  });
}
