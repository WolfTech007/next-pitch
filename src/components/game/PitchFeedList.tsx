"use client";

import { useState } from "react";
import type { RecentPitchFeedRow } from "@/lib/mlb";
import { pitchTypeStyles } from "@/lib/pitchColors";

function trendFromPitches(pitches: RecentPitchFeedRow[]): string | null {
  if (pitches.length < 3) return null;
  const last5 = pitches.slice(0, 5);
  const type = last5[0]!.pitchType;
  const n = last5.filter((p) => p.pitchType === type).length;
  if (n >= 2) return `${type} used ${n} of last ${last5.length} pitches`;
  return null;
}

type Props = {
  pitches: RecentPitchFeedRow[];
  /** On large screens, parent rail is full height when open so the list can scroll inside. */
  className?: string;
};

/**
 * Full-game recent pitches — collapsible; scroll inside so the panel does not drive page height.
 */
export function PitchFeedList({ pitches, className = "" }: Props) {
  const [open, setOpen] = useState(true);
  const trend = trendFromPitches(pitches);

  return (
    <div
      className={`flex min-h-0 flex-col rounded-xl border border-zinc-800/90 bg-zinc-950/40 p-4 ${
        open ? "lg:h-full lg:min-h-0 lg:flex-1" : "lg:h-auto lg:flex-none"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-transparent px-0.5 py-0.5 text-left transition hover:border-zinc-700/40 hover:bg-zinc-900/35"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Last pitches
          </h2>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {pitches.length === 0
              ? "No feed"
              : `${pitches.length} pitch${pitches.length === 1 ? "" : "es"} · full game`}
          </p>
        </div>
        <span
          className={`mt-1 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 max-h-[min(480px,62vh)] lg:max-h-none lg:min-h-0 lg:flex-1">
          {pitches.length === 0 ? (
            <p className="text-xs leading-relaxed text-zinc-500">
              No live pitch feed for this game yet. Open a game with MLB play-by-play to see pitches
              here.
            </p>
          ) : (
            <>
              {trend ? (
                <p className="mb-3 text-[11px] text-zinc-500">
                  <span className="text-zinc-400">{trend}</span>
                </p>
              ) : null}
              <ul className="space-y-2 pb-1">
                {pitches.map((p, idx) => {
                  const st = pitchTypeStyles(p.pitchType);
                  const isLatest = idx === 0;
                  return (
                    <li
                      key={p.id}
                      className={`flex items-start gap-3 rounded-lg border px-2.5 py-2 transition ${
                        isLatest
                          ? "border-zinc-600 bg-zinc-800/50 shadow-sm ring-1 ring-zinc-600/40"
                          : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className={`text-sm font-semibold ${st.text}`}>{p.pitchType}</span>
                          <span className="font-mono text-xs text-zinc-400">
                            {p.speedMph != null ? `${p.speedMph.toFixed(0)} mph` : "— mph"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{p.callText}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
