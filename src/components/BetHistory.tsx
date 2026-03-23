"use client";

import { useCallback, useEffect, useState } from "react";
import { formatZonePickLabel } from "@/lib/markets";
import type { StoredBet } from "@/lib/store";

/**
 * Recent slips + buttons to resolve pending bets (live or demo).
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
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/bets");
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

  async function resolve(id: string, forceDemo: boolean) {
    setResolvingId(id);
    setResolveError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betId: id, forceDemo }),
      });
      let j: { message?: string; error?: string; ok?: boolean };
      try {
        j = (await res.json()) as typeof j;
      } catch {
        setResolveError((prev) => ({
          ...prev,
          [id]: "Could not read server response. Is the dev server running?",
        }));
        return;
      }
      if (!res.ok) {
        setResolveError((prev) => ({
          ...prev,
          [id]:
            j.message ??
            j.error ??
            (res.status === 502
              ? "MLB live feed unavailable — try Demo resolve."
              : res.status === 409
                ? "The app doesn’t see a new pitch yet vs when you bet (same count & same pitch buckets). Wait for the next pitch or use Demo resolve."
                : `Could not resolve (${res.status}).`),
        }));
        return;
      }
      await load();
    } catch {
      setResolveError((prev) => ({
        ...prev,
        [id]: "Network error — check your connection and try again.",
      }));
    } finally {
      setResolvingId(null);
    }
  }

  if (!data) {
    return (
      <div
        className={
          embedded
            ? "py-4 text-sm text-zinc-500"
            : "rounded-xl border border-zinc-800 bg-surface-card p-4 text-sm text-zinc-500"
        }
      >
        Loading history…
      </div>
    );
  }

  const list = (
    <ul className="space-y-3">
        {bets.map((b) => (
          <li
            key={b.id}
            className="rounded-lg border border-zinc-800 bg-surface-raised/40 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-200">{b.gameLabel}</span>
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
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                Count:{" "}
                <span className="text-zinc-400">
                  {b.scoreboardAtBet.balls}-{b.scoreboardAtBet.strikes} ·{" "}
                  {b.scoreboardAtBet.inningHalf === "bottom" ? "Bottom" : "Top"}{" "}
                  {b.scoreboardAtBet.inning} · {b.scoreboardAtBet.outs} out
                </span>
              </p>
            ) : null}
            {b.pitcherNameAtBet || b.batterNameAtBet ? (
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                {b.pitcherNameAtBet ? (
                  <>
                    Pitcher: <span className="text-zinc-400">{b.pitcherNameAtBet}</span>
                  </>
                ) : null}
                {b.pitcherNameAtBet && b.batterNameAtBet ? " · " : null}
                {b.batterNameAtBet ? (
                  <>
                    Batter: <span className="text-zinc-400">{b.batterNameAtBet}</span>
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">
              Stake ${b.stake.toFixed(2)} @ {b.offeredOdds.toFixed(2)}x
            </p>
            <p className="text-xs text-zinc-400">
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
              <p className="mt-1 text-xs text-zinc-500">
                Outcome: {b.outcome.pitchType} /{" "}
                {b.outcome.speedMph != null
                  ? `${b.outcome.speedMph.toFixed(1)} mph`
                  : b.outcome.velocity}{" "}
                / {b.outcome.location}
                {b.outcome.zoneCell != null ? ` · zone ${b.outcome.zoneCell}` : ""}
                {b.outcome.battingResult != null
                  ? ` · ${b.outcome.battingResult}`
                  : ""}
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
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={resolvingId === b.id}
                    onClick={() => resolve(b.id, false)}
                    className="rounded-md bg-zinc-700 px-2 py-1 text-xs text-white hover:bg-zinc-600 disabled:opacity-40"
                  >
                    {resolvingId === b.id ? "…" : "Resolve (live feed)"}
                  </button>
                  <button
                    type="button"
                    disabled={resolvingId === b.id}
                    onClick={() => resolve(b.id, true)}
                    className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-40"
                  >
                    Demo resolve
                  </button>
                </div>
                {resolveError[b.id] ? (
                  <p className="text-xs leading-snug text-red-400">{resolveError[b.id]}</p>
                ) : null}
              </div>
            )}
          </li>
        ))}
    </ul>
  );

  if (embedded) {
    return (
      <div className="px-2 pt-1">
        <p className="mb-3 text-xs text-zinc-500">Last {bets.length} slips</p>
        {list}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-surface-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Bet history
        </h2>
        <span className="text-xs text-zinc-500">Last {bets.length} slips</span>
      </div>
      {list}
    </div>
  );
}
