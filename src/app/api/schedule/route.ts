import { NextResponse } from "next/server";
import { DEMO_GAME_PK, fetchTodaysGames, getEasternDateString } from "@/lib/mlb";

/**
 * GET /api/schedule?date=YYYY-MM-DD
 * Returns live games from MLB Stats API plus a built-in demo game row.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? getEasternDateString();

  try {
    const live = await fetchTodaysGames(date);
    const demo = {
      gamePk: DEMO_GAME_PK,
      away: "Demo Away",
      home: "Demo Home",
      status: "Demo / Offline",
      detailedState: "Demo",
    };
    return NextResponse.json({ games: [demo, ...live], date });
  } catch {
    return NextResponse.json(
      {
        games: [
          {
            gamePk: DEMO_GAME_PK,
            away: "Demo Away",
            home: "Demo Home",
            status: "Demo / Offline",
            detailedState: "Demo",
          },
        ],
        date,
        error: "Schedule fetch failed — demo only.",
      },
      { status: 200 },
    );
  }
}
