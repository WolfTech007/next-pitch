import type { HomeGameCardViewModel } from "@/lib/homeGameCard";

/**
 * Real 2024-07-04 game PKs + labels so `/game/[gamePk]` still loads linescore/boxscore
 * when the schedule API fails (offline) but demo mode is on.
 */
export function buildDemoFallbackHomeCards(): HomeGameCardViewModel[] {
  const rows: Array<{
    gamePk: number;
    away: { name: string; abbr: string; teamId: number };
    home: { name: string; abbr: string; teamId: number };
    awayRuns: number;
    homeRuns: number;
  }> = [
    {
      gamePk: 744834,
      away: { name: "New York Mets", abbr: "NYM", teamId: 121 },
      home: { name: "Washington Nationals", abbr: "WSH", teamId: 120 },
      awayRuns: 0,
      homeRuns: 1,
    },
    {
      gamePk: 745484,
      away: { name: "St. Louis Cardinals", abbr: "STL", teamId: 138 },
      home: { name: "Pittsburgh Pirates", abbr: "PIT", teamId: 134 },
      awayRuns: 3,
      homeRuns: 2,
    },
    {
      gamePk: 745726,
      away: { name: "Cincinnati Reds", abbr: "CIN", teamId: 113 },
      home: { name: "New York Yankees", abbr: "NYY", teamId: 147 },
      awayRuns: 8,
      homeRuns: 4,
    },
    {
      gamePk: 744912,
      away: { name: "Houston Astros", abbr: "HOU", teamId: 117 },
      home: { name: "Toronto Blue Jays", abbr: "TOR", teamId: 141 },
      awayRuns: 5,
      homeRuns: 3,
    },
    {
      gamePk: 745890,
      away: { name: "Detroit Tigers", abbr: "DET", teamId: 116 },
      home: { name: "Minnesota Twins", abbr: "MIN", teamId: 142 },
      awayRuns: 3,
      homeRuns: 12,
    },
    {
      gamePk: 746619,
      away: { name: "Chicago White Sox", abbr: "CWS", teamId: 145 },
      home: { name: "Cleveland Guardians", abbr: "CLE", teamId: 114 },
      awayRuns: 4,
      homeRuns: 8,
    },
  ];

  return rows.map((r) => ({
    gamePk: r.gamePk,
    href: `/game/${r.gamePk}`,
    inningLabel: "Final",
    statusHint: undefined,
    away: {
      name: r.away.name,
      abbr: r.away.abbr,
      runs: r.awayRuns,
      hits: 8,
      errors: 0,
      record: "— —",
      teamId: r.away.teamId,
    },
    home: {
      name: r.home.name,
      abbr: r.home.abbr,
      runs: r.homeRuns,
      hits: 9,
      errors: 0,
      record: "— —",
      teamId: r.home.teamId,
    },
    balls: 0,
    strikes: 0,
    outs: 3,
    onFirst: false,
    onSecond: false,
    onThird: false,
    broadcast: null,
    pitching: {
      teamAbbr: r.home.abbr,
      lastName: "—",
      detail: "—",
      personId: null,
    },
    atBat: {
      teamAbbr: r.away.abbr,
      lastName: "—",
      detail: "—",
      personId: null,
    },
  }));
}
