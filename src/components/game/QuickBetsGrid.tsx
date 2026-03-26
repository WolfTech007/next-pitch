"use client";

import { useMemo } from "react";
import { quoteOdds } from "@/lib/odds";
import type { SlipSelections } from "@/lib/markets";

export type QuickBetPreset = {
  label: string;
  selections: SlipSelections;
};

export function QuickBetsGrid({
  presets,
  disabled,
  onApply,
  className = "",
}: {
  presets: QuickBetPreset[];
  disabled: boolean;
  onApply: (sel: SlipSelections) => void;
  className?: string;
}) {
  const items = useMemo(() => {
    const withQuotes = presets
      .map((p) => {
        const q = quoteOdds(p.selections);
        return { ...p, quote: q };
      })
      .sort((a, b) => b.quote.probability - a.quote.probability)
      .slice(0, 6);
    return withQuotes;
  }, [presets]);

  return (
    <section className={`np-card np-card-interactive flex h-full min-h-0 flex-col p-4 shadow-np-card ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          Quick bets
        </h2>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2.5">
        {items.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={disabled}
            onClick={() => onApply(p.selections)}
            className="rounded-np-control border border-white/[0.08] bg-np-panel/55 px-3 py-2.5 text-left transition hover:border-np-blue/40 hover:bg-np-blue/10 hover:shadow-[0_0_22px_rgba(37,99,255,0.14)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            <p className="text-[11px] font-medium leading-snug text-np-text">{p.label}</p>
            <p className="mt-1 font-mono text-xs font-semibold text-np-cyan">
              {p.quote.offeredOdds.toFixed(2)}x
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

