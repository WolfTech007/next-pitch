"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrlWithDemoSearch, demoModeRequestHeaders } from "@/lib/demo-mode-client";
import { formatZonePickLabel } from "@/lib/markets";
import type { StoredBet } from "@/lib/store";

/**
 * Recent slips; each row links to `/game/[gamePk]` (live + demo). Pending slips settle from the feed.
 */
export function BetHistory({
  refreshKey,
  embedded,
}: {
  refreshKey?: number;
  /** When true, omit outer card + title (parent provides chrome, e.g. collapsible). */
  embedded?: boolean;
}) {
  const [data, setData] = useState<{
    balance: number;
    bets: StoredBet[];
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrlWithDemoSearch("/api/bets"), {
      credentials: "include",
      cache: "no-store",
      headers: demoModeRequestHeaders(),
    });
    const j = (await res.json()) as {
      balance?: number;
      bets?: StoredBet[];
      error?: string;
    };
    const bets = Array.isArray(j.bets) ? j.bets : [];
    const balance = typeof j.balance === "number" ? j.balance : 0;
    setData({ balance, bets });
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const bets = data?.bets ?? [];
  const pendingCount = bets.filter((b) => b.status === "pending").length;

  /** Stay in sync when auto-resolve settles slips on the game page (stale “pending” otherwise). */
  useEffect(() => {
    if (pendingCount < 1) return;
    const id = setInterval(() => {
      load();
    }, 3500);
    return () => clearInterval(id);
  }, [pendingCount, load]);

  if (!data) {
    return (
      <div
        className={
          embedded
            ? "py-4 text-sm text-white/45"
            : "np-card rounded-np-card border border-white/[0.06] bg-np-card/90 p-4 text-sm text-white/45"
        }
      >
        Loading history…
      </div>
    );
  }

  const list = (
    <ul className="space-y-3">
      {bets.map((b) => (
        <li key={b.id}>
          <Link
            href={`/game/${b.gamePk}`}
            className="block rounded-np-control border border-white/[0.06] bg-np-panel/50 p-3 text-sm backdrop-blur-sm transition hover:border-np-blue/30 hover:bg-white/[0.04]"
          >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-np-text">{b.gameLabel}</span>
            <span
              className={
                b.status === "pending"
                  ? "text-accent-amber"
                  : b.status === "won"
                    ? "text-accent-green"
                    : "text-accent-red"
              }
            >
              {b.status.toUpperCase()}
            </span>
          </div>
          {b.scoreboardAtBet ? (
            <p className="mt-1 text-[10px] leading-relaxed text-white/45">
              Count:{" "}
              <span className="text-white/65">
                {b.scoreboardAtBet.balls}-{b.scoreboardAtBet.strikes} ·{" "}
                {b.scoreboardAtBet.inningHalf === "bottom" ? "Bottom" : "Top"}{" "}
                {b.scoreboardAtBet.inning} · {b.scoreboardAtBet.outs} out
              </span>
            </p>
          ) : null}
          {b.pitcherNameAtBet || b.batterNameAtBet ? (
            <p className="mt-1 text-[10px] leading-relaxed text-white/45">
              {b.pitcherNameAtBet ? (
                <>
                  Pitcher: <span className="text-white/65">{b.pitcherNameAtBet}</span>
                </>
              ) : null}
              {b.pitcherNameAtBet && b.batterNameAtBet ? " · " : null}
              {b.batterNameAtBet ? (
                <>
                  Batter: <span className="text-white/65">{b.batterNameAtBet}</span>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-white/45">
            Stake ${b.stake.toFixed(2)} @ {b.offeredOdds.toFixed(2)}x
          </p>
          <p className="text-xs text-white/55">
            Picks:{" "}
            {[
              b.selections.pitchType,
              b.selections.velocity,
              formatZonePickLabel(b.selections.zonePick) ?? b.selections.location,
              b.selections.battingResult,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {b.outcome ? (
            <p className="mt-1 text-xs text-white/45">
              Outcome: {b.outcome.pitchType} /{" "}
              {b.outcome.speedMph != null
                ? `${b.outcome.speedMph.toFixed(1)} mph`
                : b.outcome.velocity}{" "}
              / {b.outcome.location}
              {b.outcome.zoneCell != null ? ` · zone ${b.outcome.zoneCell}` : ""}
              {b.outcome.battingResult != null ? ` · ${b.outcome.battingResult}` : ""}
            </p>
          ) : null}
          {b.status !== "pending" ? (
            <p className="mt-1 text-xs">
              {b.status === "won" ? (
                <span className="text-accent-green">
                  Paid ${(b.payout ?? 0).toFixed(2)}
                </span>
              ) : (
                <span className="text-accent-red">Lost stake</span>
              )}
            </p>
          ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );

  if (embedded) {
    return (
      <div className="px-2 pt-1">
        <p className="mb-3 text-xs text-white/45">Last {bets.length} slips</p>
        {list}
      </div>
    );
  }

  return (
    <div className="np-card rounded-np-card border border-white/[0.06] p-4 shadow-np-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">
          Bet history
        </h2>
        <span className="text-xs text-white/40">Last {bets.length} slips</span>
      </div>
      {list}
    </div>
  );
}
