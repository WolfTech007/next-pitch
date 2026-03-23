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
  className?: string;
};

/**
 * Full-game recent pitches — collapsible data panel.
 */
export function PitchFeedList({ pitches, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const trend = trendFromPitches(pitches);

  return (
    <div
      className={`np-card np-card-interactive flex min-h-0 flex-col p-4 shadow-np-card ${
        open ? "lg:h-full lg:min-h-0 lg:flex-1" : "lg:h-auto lg:flex-none"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-np-control border border-transparent px-1 py-1 text-left transition hover:border-white/[0.06] hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Pitch feed
            </h2>
            <span className="rounded-full border border-np-cyan/25 bg-np-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-np-cyan/90">
              Full game
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-white/40">
            {pitches.length === 0
              ? "No feed"
              : `${pitches.length} pitch${pitches.length === 1 ? "" : "es"} logged`}
          </p>
        </div>
        <span
          className={`mt-1 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div className="mt-3 min-h-0 max-h-[min(480px,62vh)] flex-1 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0">
          {pitches.length === 0 ? (
            <p className="text-xs leading-relaxed text-white/45">
              No live pitch feed for this game yet. Open a game with MLB play-by-play to see pitches
              here.
            </p>
          ) : (
            <>
              {trend ? (
                <p className="mb-3 text-[11px] text-white/45">
                  <span className="text-np-cyan/90">{trend}</span>
                </p>
              ) : null}
              <ul className="space-y-2 pb-1">
                {pitches.map((p, idx) => {
                  const st = pitchTypeStyles(p.pitchType);
                  const isLatest = idx === 0;
                  return (
                    <li
                      key={p.id}
                      className={`flex items-start gap-3 rounded-np-control border px-2.5 py-2 transition ${
                        isLatest
                          ? "border-np-blue/35 bg-np-blue/10 shadow-[0_0_24px_rgba(37,99,255,0.12)] ring-1 ring-np-blue/20"
                          : "border-white/[0.06] bg-np-panel/40 hover:border-np-blue/20"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className={`text-sm font-semibold ${st.text}`}>{p.pitchType}</span>
                          <span className="font-mono text-xs text-white/45">
                            {p.speedMph != null ? `${p.speedMph.toFixed(0)} mph` : "— mph"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-white/45">{p.callText}</p>
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
